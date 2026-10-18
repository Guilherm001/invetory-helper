'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { PedidoAberto } from '../../types'
import { hora, normalizar, reais } from '../../lib/formatar'

export default function ListaPDV({
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
  const [ativo, setAtivo] = useState(0)

  useEffect(() => {
    ref.current?.focus()
  }, [foco])

  const palavras = normalizar(busca).split(/\s+/).filter(Boolean)
  const visiveis = pedidos.filter((p) => {
    if (palavras.length === 0) return true
    const texto = normalizar(`${p.numero} ${p.cliente_nome ?? ''} ${p.cliente_telefone ?? ''}`)
    return palavras.every((w) => texto.includes(w))
  })

  const idx = Math.min(ativo, Math.max(0, visiveis.length - 1))
  const idAtivo = visiveis[idx]?.id ?? null

  // a linha escolhida pelas setas sempre fica à vista
  useEffect(() => {
    if (idAtivo) document.getElementById(`pdv-linha-${idAtivo}`)?.scrollIntoView({ block: 'nearest' })
  }, [idAtivo])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative mb-3 shrink-0">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
        <input
          ref={ref}
          value={busca}
          onChange={(e) => {
            onBusca(e.target.value)
            setAtivo(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setAtivo(Math.min(idx + 1, visiveis.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setAtivo(Math.max(idx - 1, 0))
            } else if (e.key === 'Enter' && visiveis[idx]) {
              e.preventDefault()
              onSelecionar(visiveis[idx].id)
            }
          }}
          autoFocus
          autoComplete="off"
          placeholder="Nº, nome ou telefone   ( / )"
          aria-label="Buscar pedido"
          className="w-full rounded-md border border-slate-700 bg-slate-900 py-2.5 pl-9 pr-9 text-base text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-500"
        />
        {busca && (
          <button
            type="button"
            aria-label="Limpar busca"
            onClick={() => {
              onBusca('')
              ref.current?.focus()
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-slate-200"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="mb-1 grid shrink-0 grid-cols-[3.5rem_minmax(0,1fr)_2.5rem_3rem_6.5rem] gap-2 px-2 text-[11px] uppercase tracking-wider text-slate-500">
        <span>Nº</span>
        <span>Cliente</span>
        <span className="text-right">Itens</span>
        <span className="text-right">Hora</span>
        <span className="text-right">Total</span>
      </div>

      {visiveis.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-800 py-10 text-center text-sm text-slate-500">
          {pedidos.length === 0 ? 'Nenhum pedido em aberto.' : 'Nenhum pedido encontrado.'}
        </p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto rounded-md border border-slate-800">
          {visiveis.map((p, i) => {
            const marcado = i === idx
            const aberto = p.id === selecionado
            return (
              <li key={p.id} className="border-b border-slate-800 last:border-b-0">
                <button
                  id={`pdv-linha-${p.id}`}
                  type="button"
                  onClick={() => onSelecionar(p.id)}
                  onMouseEnter={() => setAtivo(i)}
                  aria-current={aberto ? 'true' : undefined}
                  className={`grid w-full grid-cols-[3.5rem_minmax(0,1fr)_2.5rem_3rem_6.5rem] items-center gap-2 px-2 py-2.5 text-left text-sm outline-none transition ${
                    aberto
                      ? 'bg-emerald-500/15 text-emerald-100'
                      : marcado
                        ? 'bg-slate-800 text-slate-100'
                        : 'text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  <span className="font-mono font-bold tabular-nums">{p.numero}</span>
                  <span className="truncate">
                    {p.cliente_nome || <span className="text-slate-500">sem nome</span>}
                    {p.tipo === 'entrega' && (
                      <span className="ml-1.5 rounded bg-slate-700 px-1 text-[10px] uppercase text-slate-300">
                        entrega
                      </span>
                    )}
                  </span>
                  <span className="text-right font-mono tabular-nums text-slate-400">{p.itens}</span>
                  <span className="text-right font-mono tabular-nums text-slate-400">{hora(p.criado_em)}</span>
                  <span className="text-right font-mono font-semibold tabular-nums">{reais(p.total)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <p className="mt-2 shrink-0 text-[11px] text-slate-500">
        ↑ ↓ escolhem · Enter abre · / busca
      </p>
    </div>
  )
}