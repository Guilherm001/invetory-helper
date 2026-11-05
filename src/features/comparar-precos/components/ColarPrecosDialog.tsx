'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ClipboardPaste,
  FileUp,
  Loader2,
  Search,
} from 'lucide-react'
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
import {
  extrairItensDoPdf,
  textoDasLinhas,
  type LinhaPdf,
  type ModoPreco,
} from '../utils/lerPdf'
import {
  IGNORAR,
  SEM_ACHADO,
  candidatosDe,
  carregarVinculos,
  montarIndice,
  normalizarBusca,
  salvarVinculos,
} from '../utils/casarItens'

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

// ---------- leitura do texto colado ----------

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

// ---------- seletor de item com pesquisa ----------

interface SeletorProps {
  escolhido: string // id do item, IGNORAR ou ''
  candidatos: ItemComparacao[]
  itens: ItemComparacao[]
  usados: Set<string>
  tom: string // classes de cor do botão
  ariaLabel: string
  onChange: (valor: string) => void
}

function SeletorItem({
  escolhido,
  candidatos,
  itens,
  usados,
  tom,
  ariaLabel,
  onChange,
}: SeletorProps) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const raiz = useRef<HTMLDivElement>(null)

  // fecha ao clicar fora e garante que a lista aberta apareça inteira na rolagem
  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) {
        setAberto(false)
        setBusca('')
      }
    }
    document.addEventListener('mousedown', fora)
    raiz.current?.scrollIntoView({ block: 'nearest' })
    return () => document.removeEventListener('mousedown', fora)
  }, [aberto])

  const fechar = () => {
    setAberto(false)
    setBusca('')
  }

  const escolher = (valor: string) => {
    onChange(valor)
    fechar()
  }

  // o item já escolhido nesta linha continua aparecendo; os usados em outras linhas somem
  const livre = (i: ItemComparacao) => i.id === escolhido || !usados.has(i.id)

  const termosBusca = aberto ? normalizarBusca(busca) : []
  const passa = (i: ItemComparacao) => {
    if (termosBusca.length === 0) return true
    const nome = normalizarBusca(i.name).join(' ')
    return termosBusca.every((t) => nome.includes(t))
  }

  const provaveis = aberto ? candidatos.filter((i) => livre(i) && passa(i)) : []
  const idsProvaveis = new Set(provaveis.map((i) => i.id))
  const outros = aberto
    ? itens
        .filter((i) => !idsProvaveis.has(i.id) && livre(i) && passa(i))
        .sort((a, b) =>
          a.name.localeCompare(b.name, 'pt-BR', { numeric: true, sensitivity: 'base' })
        )
    : []

  const itemAtual = itens.find((i) => i.id === escolhido)
  const rotulo =
    escolhido === IGNORAR ? 'Ignorar esta linha' : itemAtual ? itemAtual.name : 'Escolher item...'

  const opcao = (i: ItemComparacao) => (
    <button
      key={i.id}
      type="button"
      role="option"
      aria-selected={i.id === escolhido}
      onClick={() => escolher(i.id)}
      className={`block w-full whitespace-normal break-words px-3 py-2 text-left text-sm text-slate-800 transition hover:bg-slate-50 ${
        i.id === escolhido ? 'bg-[#079C9C]/10 font-medium' : ''
      }`}
    >
      {i.name}
    </button>
  )

  const titulo = (texto: string) => (
    <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
      {texto}
    </p>
  )

  return (
    <div ref={raiz} className="min-w-0">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        onClick={() => (aberto ? fechar() : setAberto(true))}
        className={`flex w-full items-start justify-between gap-2 rounded-lg border px-2.5 py-2 text-left text-sm outline-none transition focus:ring-2 focus:ring-[#079C9C]/20 ${tom}`}
      >
        <span className="min-w-0 flex-1 whitespace-normal break-words">{rotulo}</span>
        <ChevronDown
          className={`mt-0.5 size-4 shrink-0 text-slate-400 transition ${aberto ? 'rotate-180' : ''}`}
        />
      </button>

      {aberto && (
        <div className="mt-1.5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="relative border-b border-slate-100 p-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              data-seletor-busca=""
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  fechar()
                }
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const primeiro = provaveis[0] ?? outros[0]
                  if (primeiro) escolher(primeiro.id)
                }
              }}
              placeholder="Pesquisar item..."
              aria-label="Pesquisar item"
              className="w-full rounded-md border border-slate-200 bg-white py-2 pl-8 pr-2 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20"
            />
          </div>

          <div role="listbox" className="max-h-52 overflow-y-auto pb-1">
            {provaveis.length > 0 && (
              <>
                {titulo('Prováveis')}
                {provaveis.map(opcao)}
              </>
            )}
            {outros.length > 0 && (
              <>
                {titulo(provaveis.length > 0 ? 'Outros itens' : 'Itens')}
                {outros.map(opcao)}
              </>
            )}
            {provaveis.length === 0 && outros.length === 0 && (
              <p className="px-3 py-3 text-sm text-slate-500">Nenhum item encontrado.</p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold">
            <button
              type="button"
              onClick={() => escolher(IGNORAR)}
              className="text-slate-500 hover:text-slate-800 hover:underline"
            >
              Ignorar esta linha
            </button>
            {escolhido !== '' && (
              <button
                type="button"
                onClick={() => escolher('')}
                className="text-[#079C9C] hover:underline"
              >
                Limpar escolha
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- diálogo ----------

function Conteudo({ itens, fornecedores, precos, onClose, onAplicar }: Omit<Props, 'open'>) {
  const [fornecedorId, setFornecedorId] = useState(
    fornecedores.length === 1 ? fornecedores[0].id : ''
  )
  const [texto, setTexto] = useState('')
  // escolhas manuais, por número da linha: id do item, IGNORAR ou '' (limpar)
  const [escolhas, setEscolhas] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // importação de PDF
  const inputArquivoRef = useRef<HTMLInputElement>(null)
  const [lendoPdf, setLendoPdf] = useState(false)
  const [itensPdf, setItensPdf] = useState<LinhaPdf[]>([])
  const [modoPreco, setModoPreco] = useState<ModoPreco>('unidade')
  const temEmbalagem = itensPdf.some((l) => l.embalagem !== null)

  const importarPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0]
    e.target.value = '' // permite escolher o mesmo arquivo de novo
    if (!arquivo) return

    if (arquivo.type !== 'application/pdf' && !arquivo.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage('Escolha um arquivo PDF.')
      return
    }

    setLendoPdf(true)
    setErrorMessage('')
    try {
      const lidos = await extrairItensDoPdf(arquivo)
      if (lidos.length === 0) {
        setErrorMessage(
          'Não encontrei linhas com preço neste PDF. Se ele for escaneado (foto), não dá para ler.'
        )
        return
      }
      setItensPdf(lidos)
      setTexto(textoDasLinhas(lidos, modoPreco))
      setEscolhas({})
    } catch {
      setErrorMessage('Não consegui abrir este PDF.')
    } finally {
      setLendoPdf(false)
    }
  }

  const trocarModo = (novo: ModoPreco) => {
    setModoPreco(novo)
    setTexto(textoDasLinhas(itensPdf, novo))
    setEscolhas({})
  }

  const mapa = useMemo(() => montarMapa(precos), [precos])

  // o que você já confirmou antes para este fornecedor (neste navegador)
  const vinculos = useMemo(() => carregarVinculos(fornecedorId), [fornecedorId])
  const indice = useMemo(() => montarIndice(itens), [itens])

  const linhas = useMemo(
    () =>
      texto
        .split('\n')
        .map(lerLinha)
        .filter((l): l is Linha => l !== null)
        .map((l) => {
          const r = l.valor === null ? SEM_ACHADO : candidatosDe(l.nome, indice, vinculos)
          return {
            ...l,
            candidatos: r.candidatos,
            auto: r.auto,
            aproximado: r.aproximado,
            lembrado: r.lembrado,
          }
        }),
    [texto, indice, vinculos]
  )

  // item escolhido em cada linha: escolha manual > casamento automático > nenhum
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

  // itens já escolhidos em alguma linha: saem das listas das outras linhas
  const usados = new Set(linhasFinais.filter((l) => l.valido).map((l) => l.escolhido))

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

    // aprende o que você confirmou (escolha manual ou casamento sem dúvida)
    salvarVinculos(
      fornecedorId,
      itens,
      linhasFinais
        .filter(
          (l) =>
            l.valor !== null &&
            l.escolhido !== '' &&
            (escolhas[l.idx] !== undefined || !l.aproximado)
        )
        .map((l) => ({ nome: l.nome, itemId: l.escolhido }))
    )
    onClose()
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
              Cole a lista ou importe um PDF e confira antes de aplicar
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
          <div className="flex items-center justify-between">
            <label htmlFor="colar-texto" className="block text-sm font-semibold text-slate-700">
              Lista de preços
            </label>
            <button
              type="button"
              onClick={() => inputArquivoRef.current?.click()}
              disabled={lendoPdf}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#079C9C] hover:underline disabled:opacity-60"
            >
              {lendoPdf ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileUp className="size-4" />
              )}
              Importar PDF
            </button>
            <input
              ref={inputArquivoRef}
              type="file"
              accept="application/pdf"
              onChange={importarPdf}
              className="hidden"
            />
          </div>

          {temEmbalagem && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <span className="font-medium text-slate-700">Preço a usar:</span>
              <select
                value={modoPreco}
                onChange={(e) => trocarModo(e.target.value as ModoPreco)}
                aria-label="Preço por unidade ou por caixa"
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm outline-none focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20"
              >
                <option value="unidade">Por unidade (valor ÷ embalagem)</option>
                <option value="caixa">Por caixa</option>
              </select>
            </div>
          )}

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

                const tom = l.valido
                  ? 'border-emerald-300 bg-emerald-50/60 text-slate-800'
                  : l.escolhido === IGNORAR
                    ? 'border-slate-200 bg-slate-50 text-slate-500'
                    : 'border-amber-300 bg-amber-50 text-slate-800'

                return (
                  <li
                    key={l.idx}
                    className={`space-y-1.5 px-3 py-2.5 ${l.escolhido === IGNORAR ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0 break-words text-sm font-medium text-slate-800">
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
                      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start">
                        <div className="min-w-0 flex-1">
                          <SeletorItem
                            escolhido={l.escolhido}
                            candidatos={l.candidatos}
                            itens={itens}
                            usados={usados}
                            tom={tom}
                            ariaLabel={`Item para "${l.nome}"`}
                            onChange={(valor) =>
                              setEscolhas((prev) => ({ ...prev, [l.idx]: valor }))
                            }
                          />
                        </div>

                        <span className="shrink-0 text-xs sm:pt-2.5">
                          {l.valido ? (
                            <span className="inline-flex items-center gap-1.5 font-medium">
                              {l.parecido ? (
                                <span className="text-amber-600">parecido, confira</span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-emerald-700">
                                  <Check className="size-3.5" />
                                  {precoAtual !== undefined && !troca
                                    ? 'igual ao atual'
                                    : l.lembrado
                                      ? 'lembrado'
                                      : 'ok'}
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
      <DialogContent
        // Esc dentro da pesquisa de itens só fecha a lista, não o diálogo
        onEscapeKeyDown={(e) => {
          const ativo = document.activeElement as HTMLElement | null
          if (ativo && ativo.dataset.seletorBusca !== undefined) e.preventDefault()
        }}
        className="top-[5%] flex max-h-[90vh] translate-y-0 flex-col gap-0 overflow-hidden border-slate-200 bg-white p-0 sm:max-w-[600px] [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:opacity-100"
      >
        <Conteudo {...resto} />
      </DialogContent>
    </Dialog>
  )
}