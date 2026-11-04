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

// sem acento, sem maiúscula, sem pontuação: "Cimento CP-II" -> "cimento cp ii"
const chaveBusca = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

// "32,50" | "32.50" | "1.234,56" | "1.234" -> número
function paraNumero(s: string): number | null {
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) {
    return Number(s.replace(/\./g, '').replace(',', '.'))
  }
  if (/^\d+([.,]\d{1,2})?$/.test(s)) return Number(s.replace(',', '.'))
  return null
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
  chave: string
  termos: string[]
}

// itens que podem ser o da linha: igual > contém todas as palavras > o item está dentro da linha
function candidatosDe(nome: string, itens: ItemNorm[]): ItemNorm[] {
  const q = chaveBusca(nome)
  if (!q) return []

  const exatos = itens.filter((i) => i.chave === q)
  if (exatos.length > 0) return exatos

  const termosQ = q.split(' ')
  const contidos = itens.filter((i) => termosQ.every((t) => i.chave.includes(t)))
  if (contidos.length > 0) return contidos

  return itens.filter((i) => i.termos.length > 0 && i.termos.every((t) => q.includes(t)))
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
      itens.map((item) => {
        const k = chaveBusca(item.name)
        return { item, chave: k, termos: k.split(' ').filter(Boolean) }
      }),
    [itens]
  )

  const linhas = useMemo(
    () =>
      texto
        .split('\n')
        .map(lerLinha)
        .filter((l): l is Linha => l !== null)
        .map((l) => {
          const candidatos = l.valor === null ? [] : candidatosDe(l.nome, itensNorm)
          return { ...l, candidatos: candidatos.map((c) => c.item) }
        }),
    [texto, itensNorm]
  )

  // item escolhido em cada linha: escolha manual > único candidato > nenhum
  const linhasFinais = linhas.map((l, idx) => {
    const auto = l.candidatos.length === 1 ? l.candidatos[0].id : ''
    const escolhido = escolhas[idx] ?? auto
    const valido = l.valor !== null && escolhido !== '' && escolhido !== IGNORAR
    return { ...l, idx, escolhido, valido }
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
            O nome não precisa ser igual: ignora acentos e maiúsculas e aceita só parte do nome.
            Preços como 32,50, 32.50 e R$ 1.234,56 funcionam.
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
                            troca ? (
                              <span className="font-medium text-amber-600">
                                troca {formatarReais(precoAtual as number)}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                                <Check className="size-3.5" />
                                {precoAtual !== undefined ? 'igual ao atual' : 'ok'}
                              </span>
                            )
                          ) : l.escolhido === IGNORAR ? (
                            <span className="text-slate-400">ignorada</span>
                          ) : l.candidatos.length > 1 ? (
                            <span className="font-medium text-amber-600">
                              {l.candidatos.length} possíveis
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