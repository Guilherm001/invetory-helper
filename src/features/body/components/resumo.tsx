'use client'

import type { Product } from '../services/listService'

export type Filtro = 'todos' | 'pendentes' | 'alta'

interface ResumoProps {
  products: Product[]
  loading?: boolean
  filtro: Filtro
  onFiltroChange: (filtro: Filtro) => void
}

export default function Resumo({
  products,
  loading = false,
  filtro,
  onFiltroChange,
}: ResumoProps) {
  const total = products.length
  const concluidos = products.filter((p) => p.status === 'Concluído').length
  const pendentes = products.filter((p) => p.status === 'Pendente').length
  const alta = products.filter(
    (p) => p.priority === 'Alta' && p.status !== 'Concluído'
  ).length

  const percentual = total === 0 ? 0 : Math.round((concluidos / total) * 100)

  const chips: { id: Filtro; label: string; count: number; ativo: string }[] = [
    { id: 'todos', label: 'Todos', count: total, ativo: 'bg-[#079C9C] text-white border-[#079C9C]' },
    { id: 'pendentes', label: 'Pendentes', count: pendentes, ativo: 'bg-[#E3A534] text-white border-[#E3A534]' },
    { id: 'alta', label: 'Alta prioridade', count: alta, ativo: 'bg-[#c70000] text-white border-[#c70000]' },
  ]

  return (
    <div className="mx-4 md:mx-10 my-4 space-y-3">
      <div>
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>{loading ? 'Carregando...' : `${concluidos} de ${total} comprados`}</span>
          <span>{percentual}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
          <div
            className="h-full rounded-full bg-[#079C9C] transition-all duration-300"
            style={{ width: `${percentual}%` }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => {
          const selecionado = filtro === chip.id
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => onFiltroChange(chip.id)}
              aria-pressed={selecionado}
              className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                selecionado
                  ? chip.ativo
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {chip.label} {loading ? '' : chip.count}
            </button>
          )
        })}
      </div>
    </div>
  )
}