'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, Check, ClipboardPaste, Loader2 } from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog'
import type { Fornecedor, ItemComparacao, Preco } from '../types'
import { chave, formatarReais, montarMapa } from '../utils/melhorPreco'

interface Props {
  open: boolean
  itens: ItemComparacao[]
  fornecedores: Fornecedor[]
  precos: Preco[]
  onClose: () => void
  onAplicar: (itemId: string, fornecedorId: string, valor: number | null) => Promise<void>
}

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20'

const IGNORAR = '__ignorar'

// ---------- leitura do texto colado ----------

const ROMANOS: Record<string, string> = {
  ii: '2',
  iii: '3',
  iv: '4',
  vi: '6',
  vii: '7',
  viii: '8',
  ix: '9',
}

// palavras do nome, sem acento, maiúscula ou pontuação.
// "CP2" e "CP-II" viram as mesmas palavras: "cp" e "2"
function termosDe(s: string): string[] {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .split(' ')
    .filter(Boolean)
    .map((t) => ROMANOS[t] ?? t)
}

const ehNumero = (t: string) => /^\d+$/.test(t)
const singular = (t: string) => (t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t)

// número de trocas de letra entre duas palavras
function distancia(a: string, b: string): number {
  const d: number[] = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let anterior = d[0]
    d[0] = i
    for (let j = 1; j <= b.length; j++) {
      const guardado = d[j]
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, anterior + (a[i - 1] === b[j - 1] ? 0 : 1))
      anterior = guardado
    }
  }
  return d[b.length]
}

// quão parecidas são duas palavras: 1 = iguais, 0 = diferentes
function parecenca(a: string, b: string): number {
  if (a === b) return 1
  // números só valem se forem iguais ("brita 1" não é "brita 2")
  if (/\d/.test(a) || /\d/.test(b)) return 0

  const sa = singular(a)
  const sb = singular(b)
  if (sa === sb) return 1

  // abreviação: "cim" -> "cimento"
  if (Math.min(a.length, b.length) >= 3 && (a.startsWith(b) || b.startsWith(a))) return 0.9

  // erro de digitação: "cimneto" -> "cimento"
  if (sa.length >= 4 && sb.length >= 4) {
    const limite = Math.max(sa.length, sb.length) >= 7 ? 2 : 1
    if (distancia(sa, sb) <= limite) return 0.85
  }
  return 0
}

// nota de 0 a 1 para "esta linha é este item"; 0 = não é
function pontuar(q: string[], i: string[]): number {
  if (q.length === 0 || i.length === 0) return 0

  // números (medidas, bitolas) não podem se contradizer
  const nq = q.filter(ehNumero)
  const ni = i.filter(ehNumero)
  if (nq.length > 0 && ni.length > 0) {
    const qDentro = nq.every((n) => ni.includes(n))
    const iDentro = ni.every((n) => nq.includes(n))
    if (!qDentro && !iDentro) return 0
  }

  const melhor = (t: string, lista: string[]) => Math.max(...lista.map((x) => parecenca(t, x)))
  const coberturaLinha = q.reduce((soma, t) => soma + melhor(t, i), 0) / q.length
  const coberturaItem = i.reduce((soma, t) => soma + melhor(t, q), 0) / i.length

  // um dos lados precisa estar quase todo explicado pelo outro
  const forte = Math.max(coberturaLinha, coberturaItem)
  if (forte < 0.85) return 0
  return forte * 0.7 + Math.min(coberturaLinha, coberturaItem) * 0.3
}

// "32,50" | "32.50" | "1.234,56" | "1.234" | "32,505" -> número com 2 casas (arredonda)
function paraNumero(s: string): number | null {
  let inteiro: string
  let decimais = ''

  let m: RegExpMatchArray | null
  if ((m = s.match(/^(\d{1,3}(?:\.\d{3})+|\d+),(\d+)$/))) {
    // vírgula decimal, com ou sem pontos de milhar: 1.234,56 | 32,505
    inteiro = m[1].replace(/\./g, '')
    decimais = m[2]
  } else if (/^[1-9]\d{0,2}(?:\.\d{3})+$/.test(s)) {
    // só pontos, em grupos de 3: milhar ("1.234" = 1234)
    inteiro = s.replace(/\./g, '')
  } else if ((m = s.match(/^(\d+)\.(\d+)$/))) {
    // ponto decimal: 32.50 | 0.125 | 1.2345
    inteiro = m[1]
    decimais = m[2]
  } else if (/^\d+$/.test(s)) {
    inteiro = s
  } else {
    return null
  }

  // arredonda em centavos pelos dígitos (evita erro de ponto flutuante: 1,005 -> 1,01)
  const centavos =
    Number(inteiro + (decimais + '00').slice(0, 2)) + (decimais.charAt(2) >= '5' ? 1 : 0)
  return centavos / 100
}

interface Linha {
  bruta: string
  nome: string
  valor: number | null
}

// o preço é a última palavra da linha: "cimento CP-II - R$ 32,50"
function lerLinha(bruta: string): Linha | null {
  const t = bruta.trim().replace(/^[-•*]\s*/, '')
  if (!t) return null

  const partes = t.split(/\s+/)
  const ultimo = (partes.pop() ?? '').replace(/^R\$/i, '')
  const valor = paraNumero(ultimo)

  if (valor === null) return { bruta: t, nome: t, valor: null }

  if (partes.length > 0 && partes[partes.length - 1].toUpperCase() === 'R$') partes.pop()
  const nome = partes.join(' ').replace(/[\s:;=|–—-]+$/, '')
  return { bruta: t, nome, valor }
}

interface ItemNorm {
  item: ItemComparacao
  termos: string[]
}

interface Achado {
  candidatos: ItemNorm[] // do mais ao menos provável
  auto: string // id do item escolhido sozinho ('' = o usuário decide)
  aproximado: boolean // casou por semelhança, não por nome igual
}

function candidatosDe(nome: string, itens: ItemNorm[]): Achado {
  const vazio: Achado = { candidatos: [], auto: '', aproximado: false }
  const q = termosDe(nome)
  if (q.length === 0) return vazio

  const pontuados = itens
    .map((i) => ({ i, nota: pontuar(q, i.termos) }))
    .filter((x) => x.nota > 0)
    .sort((a, b) => b.nota - a.nota)
  if (pontuados.length === 0) return vazio

  const [topo, segundo] = pontuados
  // escolhe sozinho só quando o primeiro é bom e está bem à frente do segundo
  const claro = topo.nota >= 0.8 && (!segundo || topo.nota - segundo.nota >= 0.1)

  return {
    candidatos: pontuados.slice(0, 6).map((x) => x.i),
    auto: claro ? topo.i.item.id : '',
    aproximado: claro && topo.nota < 0.99,
  }
}

// ---------- diálogo ----------

function Conteudo({ itens, fornecedores, precos, onClose, onAplicar }: Omit<Props, 'open'>) {
  const [fornecedorId, setFornecedorId] = useState(
    fornecedores.length === 1 ? fornecedores[0].id : ''
  )
  const [texto, setTexto] = useState('')
  // escolhas manuais, por número da linha: id do item ou IGNORAR
  const [escolhas, setEscolhas] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const mapa = useMemo(() => montarMapa(precos), [precos])

  const itensNorm = useMemo<ItemNorm[]>(
    () =>
      itens.map((item) => ({ item, termos: termosDe(item.name) })),
    [itens]
  )

  const linhas = useMemo(
    () =>
      texto
        .split('\n')
        .map(lerLinha)
        .filter((l): l is Linha => l !== null)
        .map((l) => {
          const r: Achado =
            l.valor === null
              ? { candidatos: [], auto: '', aproximado: false }
              : candidatosDe(l.nome, itensNorm)
          return {
            ...l,
            candidatos: r.candidatos.map((c) => c.item),
            auto: r.auto,
            aproximado: r.aproximado,
          }
        }),
    [texto, itensNorm]
  )

  // item escolhido em cada linha: escolha manual > único candidato > nenhum
  const linhasFinais = linhas.map((l, idx) => {
    const escolhido = escolhas[idx] ?? l.auto
    const valido = l.valor !== null && escolhido !== '' && escolhido !== IGNORAR
    // casou por semelhança e o usuário ainda não confirmou no seletor
    const parecido = valido && l.aproximado && escolhas[idx] === undefined
    return { ...l, idx, escolhido, valido, parecido }
  })

  const prontas = linhasFinais.filter((l) => l.valido)
  const ignoradas = linhasFinais.filter((l) => l.escolhido === IGNORAR).length
  const atencao = linhasFinais.length - prontas.length - ignoradas

  const aplicar = async () => {
    if (!fornecedorId) {
      setErrorMessage('Escolha o fornecedor.')
      return
    }
    if (prontas.length === 0) {
      setErrorMessage('Nenhuma linha pronta para aplicar.')
      return
    }

    // se o mesmo item aparece duas vezes, vale a última linha
    const porItem = new Map<string, number>()
    prontas.forEach((l) => porItem.set(l.escolhido, l.valor as number))

    setSaving(true)
    setErrorMessage('')
    const resultados = await Promise.allSettled(
      Array.from(porItem, ([itemId, valor]) => onAplicar(itemId, fornecedorId, valor))
    )
    const falhas = resultados.filter((r) => r.status === 'rejected').length

    if (falhas > 0) {
      setErrorMessage(
        `${falhas} ${falhas === 1 ? 'preço não foi salvo' : 'preços não foram salvos'}. Os outros já foram. Tente aplicar de novo.`
      )
      setSaving(false)
      return
    }
    onClose()
  }

  const opcoesItens = (candidatos: ItemComparacao[]) => {
    const ids = new Set(candidatos.map((c) => c.id))
    const outros = itens.filter((i) => !ids.has(i.id))
    return (
      <>
        <option value="">Escolher item...</option>
        {candidatos.length > 0 && (
          <optgroup label="Prováveis">
            {candidatos.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </optgroup>
        )}
        {outros.length > 0 && (
          <optgroup label={candidatos.length > 0 ? 'Outros itens' : 'Itens'}>
            {outros.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </optgroup>
        )}
        <option value={IGNORAR}>Ignorar esta linha</option>
      </>
    )
  }

  return (
    <>
      <DialogHeader className="bg-[#079C9C] px-6 py-5 text-left">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/20">
            <ClipboardPaste className="size-6 text-white" />
          </div>
          <div>
            <DialogTitle className="text-xl font-bold text-white">Colar preços</DialogTitle>
            <DialogDescription className="text-sm text-white/80">
              Cole a lista do fornecedor e confira antes de aplicar
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
        {/* Fornecedor */}
        <div className="space-y-1.5">
          <label htmlFor="colar-fornecedor" className="block text-sm font-semibold text-slate-700">
            Fornecedor
          </label>
          <select
            id="colar-fornecedor"
            value={fornecedorId}
            onChange={(e) => setFornecedorId(e.target.value)}
            className={inputClass}
          >
            <option value="">Escolher fornecedor...</option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>

        {/* Texto */}
        <div className="space-y-1.5">
          <label htmlFor="colar-texto" className="block text-sm font-semibold text-slate-700">
            Lista de preços
          </label>
          <textarea
            id="colar-texto"
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value)
              setEscolhas({})
            }}
            autoFocus
            className={`${inputClass} min-h-[130px] resize-y`}
            placeholder={'Um item por linha, com o preço no fim. Ex:\ncimento CP-II 32,50\nareia média - R$ 120,00\ntijolo 8 furos: 1,15'}
          />
          <p className="text-xs text-slate-400">
            O nome não precisa ser igual: ignora acentos e maiúsculas e aceita parte do nome,
            abreviações (cim. CP2) e pequenos erros de digitação. Preços como 32,50, 32.50 e
            R$ 1.234,56 funcionam, e mais de 2 casas decimais são arredondadas.
          </p>
        </div>

        {/* Conferência */}
        {linhasFinais.length > 0 && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="font-semibold text-slate-700">Conferência</span>
              <span className="font-medium text-emerald-700">{prontas.length} prontas</span>
              {atencao > 0 && (
                <span className="font-medium text-amber-600">{atencao} precisam de atenção</span>
              )}
              {ignoradas > 0 && <span className="text-slate-400">{ignoradas} ignoradas</span>}
            </div>

            <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
              {linhasFinais.map((l) => {
                const precoAtual =
                  l.valido && fornecedorId
                    ? mapa.get(chave(l.escolhido, fornecedorId))
                    : undefined
                const troca = precoAtual !== undefined && precoAtual !== l.valor

                return (
                  <li
                    key={l.idx}
                    className={`space-y-1.5 px-3 py-2.5 ${l.escolhido === IGNORAR ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span
                        className="min-w-0 truncate text-sm font-medium text-slate-800"
                        title={l.bruta}
                      >
                        {l.valor === null ? l.bruta : l.nome || '(sem nome)'}
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-slate-900">
                        {l.valor === null ? '—' : formatarReais(l.valor)}
                      </span>
                    </div>

                    {l.valor === null ? (
                      <p className="flex items-center gap-1 text-xs font-medium text-red-600">
                        <AlertTriangle className="size-3.5" />
                        Não encontrei o preço no fim da linha
                      </p>
                    ) : (
                      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
                        <select
                          value={l.escolhido}
                          onChange={(e) =>
                            setEscolhas((prev) => ({ ...prev, [l.idx]: e.target.value }))
                          }
                          aria-label={`Item para "${l.nome}"`}
                          className={`min-w-0 flex-1 rounded-lg border px-2.5 py-2 text-sm outline-none transition focus:ring-2 focus:ring-[#079C9C]/20 ${
                            l.valido
                              ? 'border-emerald-300 bg-emerald-50/60 text-slate-800'
                              : l.escolhido === IGNORAR
                                ? 'border-slate-200 bg-slate-50 text-slate-500'
                                : 'border-amber-300 bg-amber-50 text-slate-800'
                          }`}
                        >
                          {opcoesItens(l.candidatos)}
                        </select>

                        <span className="shrink-0 text-xs">
                          {l.valido ? (
                            <span className="inline-flex items-center gap-1.5 font-medium">
                              {l.parecido ? (
                                <span className="text-amber-600">parecido, confira</span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-emerald-700">
                                  <Check className="size-3.5" />
                                  {precoAtual !== undefined && !troca ? 'igual ao atual' : 'ok'}
                                </span>
                              )}
                              {troca && (
                                <span className="text-amber-600">
                                  · troca {formatarReais(precoAtual as number)}
                                </span>
                              )}
                            </span>
                          ) : l.escolhido === IGNORAR ? (
                            <span className="text-slate-400">ignorada</span>
                          ) : l.candidatos.length > 0 ? (
                            <span className="font-medium text-amber-600">
                              {l.candidatos.length}{' '}
                              {l.candidatos.length === 1 ? 'possível' : 'possíveis'}
                            </span>
                          ) : (
                            <span className="font-medium text-amber-600">não achei</span>
                          )}
                        </span>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {errorMessage && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {errorMessage}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={saving}
          className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
        >
          Cancelar
        </Button>
        <Button
          type="button"
          onClick={aplicar}
          disabled={saving || prontas.length === 0}
          className="min-w-44 gap-2 bg-[#079C9C] text-white shadow-sm hover:bg-[#079C9C]/90"
        >
          {saving ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Aplicando...
            </>
          ) : (
            `Aplicar ${prontas.length} ${prontas.length === 1 ? 'preço' : 'preços'}`
          )}
        </Button>
      </div>
    </>
  )
}

export default function ColarPrecosDialog({ open, ...resto }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && resto.onClose()}>
      <DialogContent className="top-[5%] flex max-h-[90vh] translate-y-0 flex-col gap-0 overflow-hidden border-slate-200 bg-white p-0 sm:max-w-[600px] [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:opacity-100">
        <Conteudo {...resto} />
      </DialogContent>
    </Dialog>
  )
}