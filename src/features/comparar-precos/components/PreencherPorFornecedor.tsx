'use client'

import { useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { Check, Clock, Pencil, Plus, Trophy } from 'lucide-react'
import IndicadorHistorico from '@/features/historico-precos/components/IndicadorHistorico'
import { chaveDoProduto } from '@/features/historico-precos/utils/estatisticas'
import type { Referencia } from '@/features/historico-precos/utils/referencias'
import type { Fornecedor, ItemComparacao, Preco } from '../types'
import { chave, formatarReais, montarMapa, type Analise } from '../utils/melhorPreco'
import { numero } from '../utils/formatacao'
import { FOCO } from '../utils/estilos'
import CelulaPreco, { camposDePreco } from './CelulaPreco'
import Kbd from './Kbd'

interface Props {
  itens: ItemComparacao[] // itens exibidos (já filtrados e ordenados)
  todosItens: ItemComparacao[] // para o contador de progresso de cada fornecedor
  fornecedores: Fornecedor[]
  precos: Preco[]
  analise: Analise
  referencias?: Map<string, Referencia>
  ativoId: string
  onAtivar: (id: string) => void
  onDefinirPreco: (itemId: string, fornecedorId: string, valor: number | null) => Promise<void>
  onEditarFornecedor: (fornecedor: Fornecedor) => void
  onAdicionarFornecedor: () => void
}

export default function PreencherPorFornecedor({
  itens,
  todosItens,
  fornecedores,
  precos,
  analise,
  referencias,
  ativoId,
  onAtivar,
  onDefinirPreco,
  onEditarFornecedor,
  onAdicionarFornecedor,
}: Props) {
  const abasRef = useRef<(HTMLButtonElement | null)[]>([])
  const mapa = montarMapa(precos)

  const ativo = fornecedores.find((f) => f.id === ativoId) ?? fornecedores[0]

  const preenchidosDe = (fornecedorId: string) =>
    todosItens.filter((i) => mapa.get(chave(i.id, fornecedorId)) !== undefined).length

  const refDe = (item: ItemComparacao) =>
    referencias?.get(chaveDoProduto({ codigo: item.catalog_code, itemNome: item.name }))

  const focarPrimeiroVazio = () => {
    const campos = camposDePreco()
    ;(campos.find((el) => el.value === '') ?? campos[0])?.focus()
  }

  // setas trocam de aba; ↓ entra na lista de preços
  const aoTeclarAbas = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = fornecedores.findIndex((f) => f.id === ativo.id)
    const n = fornecedores.length
    let novo = -1
    if (e.key === 'ArrowRight') novo = (i + 1) % n
    else if (e.key === 'ArrowLeft') novo = (i - 1 + n) % n
    else if (e.key === 'Home') novo = 0
    else if (e.key === 'End') novo = n - 1
    else if (e.key === 'ArrowDown') {
      e.preventDefault()
      focarPrimeiroVazio()
      return
    }
    if (novo >= 0) {
      e.preventDefault()
      onAtivar(fornecedores[novo].id)
      abasRef.current[novo]?.focus()
    }
  }

  const feitos = preenchidosDe(ativo.id)

  return (
    <div className="space-y-3">
      {/* Rolagem própria: as abas ficam fixas no topo enquanto você desce pela lista */}
      <div className="max-h-[calc(100dvh-17rem)] min-h-[16rem] overflow-auto rounded-lg border border-slate-200 bg-white">
        <div className="sticky top-0 z-20 bg-white">
          <div
            role="tablist"
            aria-label="Fornecedores"
            onKeyDown={aoTeclarAbas}
            className="flex items-end overflow-x-auto border-b border-slate-200 px-2"
          >
            {fornecedores.map((f, i) => {
              const ativa = f.id === ativo.id
              const feitosF = preenchidosDe(f.id)
              const completo = todosItens.length > 0 && feitosF === todosItens.length

              return (
                <button
                  key={f.id}
                  ref={(el) => {
                    abasRef.current[i] = el
                  }}
                  type="button"
                  role="tab"
                  aria-selected={ativa}
                  tabIndex={ativa ? 0 : -1}
                  aria-keyshortcuts={i < 9 ? String(i + 1) : undefined}
                  onClick={() => onAtivar(f.id)}
                  className={`-mb-px inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#079C9C] ${
                    ativa
                      ? 'border-[#079C9C] font-medium text-slate-900'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {i < 9 && (
                    <span className="hidden rounded border border-slate-200 bg-slate-50 px-1.5 text-[11px] font-medium text-slate-500 md:inline">
                      {i + 1}
                    </span>
                  )}
                  <span className="max-w-[10rem] truncate">{f.name}</span>
                  <span
                    className={`inline-flex items-center gap-0.5 text-xs tabular-nums ${
                      completo ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                  >
                    {completo ? <Check className="size-3.5" /> : `${feitosF}/${todosItens.length}`}
                  </span>
                </button>
              )
            })}

            <button
              type="button"
              onClick={onAdicionarFornecedor}
              aria-keyshortcuts="F"
              className={`mb-1 ml-1 inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 ${FOCO}`}
            >
              <Plus className="size-4" />
              Fornecedor
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2">
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900" title={ativo.name}>
                {ativo.name}
              </p>
              {ativo.lead_time_days != null && (
                <p className="flex items-center gap-1 text-xs text-slate-500">
                  <Clock className="size-3" />
                  Prazo de {ativo.lead_time_days} {ativo.lead_time_days === 1 ? 'dia' : 'dias'}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-xs tabular-nums text-slate-500">
                {feitos} de {todosItens.length} preços
              </span>
              <button
                type="button"
                aria-label={`Editar ${ativo.name}`}
                onClick={() => onEditarFornecedor(ativo)}
                className={`rounded-md p-1.5 text-slate-400 transition hover:bg-slate-200/60 hover:text-slate-700 ${FOCO}`}
              >
                <Pencil className="size-4" />
              </button>
            </div>
          </div>
        </div>

        <ul role="tabpanel" aria-label={`Preços de ${ativo.name}`} className="divide-y divide-slate-100">
          {itens.map((item) => {
            const linha = analise.linhas.get(item.id)
            const preco = mapa.get(chave(item.id, ativo.id))
            const destaque =
              !!linha?.comparavel && preco !== undefined && linha.vencedores.includes(ativo.id)
            const sozinho =
              fornecedores.length > 1 && preco !== undefined && linha?.cotacoes === 1

            // menor preço entre os OUTROS fornecedores: referência enquanto você digita
            let melhorOutro: { nome: string; preco: number } | null = null
            for (const f of fornecedores) {
              if (f.id === ativo.id) continue
              const p = mapa.get(chave(item.id, f.id))
              if (p !== undefined && (melhorOutro === null || p < melhorOutro.preco)) {
                melhorOutro = { nome: f.name, preco: p }
              }
            }

            return (
              <li
                key={`${ativo.id}:${item.id}`}
                className="flex flex-col gap-1.5 px-4 py-2 hover:bg-slate-50 sm:flex-row sm:items-start sm:gap-4"
              >
                <div className="flex min-w-0 flex-1 items-baseline gap-3 sm:pt-1.5">
                  <span className="w-20 shrink-0 text-right text-sm tabular-nums text-slate-500">
                    {numero(item.quantity)}
                    {item.unit ? ` ${item.unit}` : ''}
                  </span>
                  <span className="min-w-0 break-words font-medium text-slate-900">
                    {item.name}
                  </span>
                </div>

                <div className="pl-[5.75rem] text-xs sm:w-56 sm:pl-0 sm:pt-2.5 sm:text-right">
                  {destaque ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                      <Trophy className="size-3" />
                      Menor preço
                    </span>
                  ) : melhorOutro ? (
                    <span className="block truncate text-slate-500">
                      Menor: {formatarReais(melhorOutro.preco)} · {melhorOutro.nome}
                    </span>
                  ) : null}
                </div>

                <div className="pl-[5.75rem] sm:w-36 sm:shrink-0 sm:pl-0">
                  <CelulaPreco
                    valor={preco}
                    destaque={destaque}
                    sozinho={sozinho}
                    coluna={ativo.id}
                    rotulo={`Preço de ${item.name} em ${ativo.name}`}
                    onSalvar={(v) => onDefinirPreco(item.id, ativo.id, v)}
                  />
                  <IndicadorHistorico preco={preco} referencia={refDe(item)} />
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      <p className="hidden flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 md:flex">
        <span>
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> ou <Kbd>Enter</Kbd> descem pela lista (fora de um campo, entram nela)
        </span>
        <span>
          <Kbd>Esc</Kbd> cancelar
        </span>
        <span>
          <Kbd>1</Kbd>–<Kbd>9</Kbd> trocar de fornecedor (fora de um campo)
        </span>
        <span>
          <Kbd>M</Kbd> voltar à tabela
        </span>
      </p>
    </div>
  )
}