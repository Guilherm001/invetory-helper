'use client'

import { formatarReais, type Analise } from '../utils/melhorPreco'

interface Props {
  analise: Analise
  preenchidos: number // preços já digitados
  total: number // itens × fornecedores
  onVerResumo: () => void
}

export default function BarraResumo({ analise, preenchidos, total, onVerResumo }: Props) {
  const { melhorUnico, melhorUnicoParcial, totalMisto, economia, economiaPercentual } = analise

  const percentual = total > 0 ? Math.round((preenchidos / total) * 100) : 0
  const temEconomia = economia !== null && economia > 0

  return (
    <div
      role="region"
      aria-label="Resumo rápido"
      className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-[0_-6px_12px_-8px_rgba(15,23,42,0.18)]"
    >
      <div className="flex items-center gap-2">
        <span className="text-slate-500">Preços</span>
        <span className="font-medium tabular-nums text-slate-900">
          {preenchidos}/{total}
        </span>
        <div
          className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-slate-100 sm:block"
          role="progressbar"
          aria-valuenow={percentual}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Preços preenchidos"
        >
          <div className="h-full rounded-full bg-[#079C9C]" style={{ width: `${percentual}%` }} />
        </div>
      </div>

      {melhorUnico && (
        <div className="hidden min-w-0 items-center gap-2 md:flex">
          <span className="text-slate-500">Melhor único</span>
          <span className="font-medium tabular-nums text-slate-900">
            {formatarReais(melhorUnico.total)}
          </span>
          <span className="max-w-[10rem] truncate text-slate-500" title={melhorUnico.fornecedor.name}>
            {melhorUnico.fornecedor.name}
            {melhorUnicoParcial && ' (estimativa)'}
          </span>
        </div>
      )}

      {totalMisto !== null && (
        <div className="hidden items-center gap-2 lg:flex">
          <span className="text-slate-500">Menor de cada item</span>
          <span className="font-medium tabular-nums text-slate-900">
            {formatarReais(totalMisto)}
          </span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="text-slate-500">Economia</span>
        {temEconomia && economia !== null ? (
          <span className="font-semibold tabular-nums text-emerald-700">
            {formatarReais(economia)}
            {economiaPercentual !== null && (
              <span className="ml-1 font-normal text-emerald-700/80">
                ({String(economiaPercentual).replace('.', ',')}%)
              </span>
            )}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </div>

      <button
        type="button"
        onClick={onVerResumo}
        aria-keyshortcuts="R"
        className="ml-auto inline-flex items-center gap-2 rounded-md px-2 py-1 font-medium text-[#079C9C] transition hover:bg-[#079C9C]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#079C9C]"
      >
        Ver resumo
        <kbd className="hidden rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans text-[11px] font-medium text-slate-500 md:inline">
          R
        </kbd>
      </button>
    </div>
  )
}
