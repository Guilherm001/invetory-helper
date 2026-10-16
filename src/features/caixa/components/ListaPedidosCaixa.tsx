'use client'

import { useEffect, useRef } from 'react'
import { Search, Store, Truck, X } from 'lucide-react'
import type { PedidoAberto } from '../types'
import { hora, normalizar, reais } from '../lib/formatar'

export default function ListaPedidosCaixa({
  pedidos,
  selecionado,
  onSelecionar,
  busca,
  onBusca,
  foco,
}: {
  pedidos: PedidoAberto[]
  selecionado: string | null
  onSelecionar: (id: string) => void
  busca: string
  onBusca: (v: string) => void
  foco: number // muda quando a busca deve receber o cursor
}) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ref.current?.focus()
  }, [foco])

  const palavras = normalizar(busca).split(/\s+/).filter(Boolean)
  const visiveis = pedidos.filter((p) => {
    if (palavras.length === 0) return true
    const texto = normalizar(`${p.numero} ${p.cliente_nome ?? ''} ${p.cliente_telefone ?? ''}`)
    return palavras.every((w) => texto.includes(w))
  })

  return (
    <div className="flex min-h-0 flex-col">
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
        <input
          ref={ref}
          value={busca}
          onChange={(e) => onBusca(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && visiveis[0]) {
              e.preventDefault()
              onSelecionar(visiveis[0].id)
            }
          }}
          autoFocus
          placeholder="Nº do pedido, nome ou telefone"
          aria-label="Buscar pedido"
          className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-10 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20"
        />
        {busca && (
          <button
            type="button"
            aria-label="Limpar busca"
            onClick={() => onBusca('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:text-slate-600"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Em aberto ({visiveis.length})
      </p>

      {visiveis.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
          {pedidos.length === 0 ? 'Nenhum pedido em aberto.' : 'Nenhum pedido encontrado.'}
        </div>
      ) : (
        <ul className="min-h-0 space-y-2 overflow-y-auto pb-2">
          {visiveis.map((p) => {
            const ativo = p.id === selecionado
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onSelecionar(p.id)}
                  aria-current={ativo ? 'true' : undefined}
                  className={`w-full rounded-xl border p-3 text-left shadow-sm transition active:scale-[0.99] ${
                    ativo
                      ? 'border-[#079C9C] bg-[#079C9C]/5 ring-1 ring-[#079C9C]/30'
                      : 'border-slate-200 bg-white hover:border-[#079C9C]/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[#079C9C]">Nº {p.numero}</span>
                        <span className="flex items-center gap-1 text-[11px] text-slate-500">
                          {p.tipo === 'entrega' ? (
                            <Truck className="size-3" />
                          ) : (
                            <Store className="size-3" />
                          )}
                          {p.tipo === 'entrega' ? 'Entrega' : 'Retirada'}
                        </span>
                      </p>
                      <p className="truncate font-semibold text-slate-900">
                        {p.cliente_nome || 'Cliente não informado'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {hora(p.criado_em)} · {p.itens} {p.itens === 1 ? 'item' : 'itens'}
                        {p.vendedor_nome ? ` · ${p.vendedor_nome}` : ''}
                      </p>
                    </div>
                    <p className="shrink-0 text-lg font-bold text-slate-900">{reais(p.total)}</p>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}