'use client'

import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { Product } from '@/features/body/services/listService'
import type { CotacaoData } from '../types'
import { preparar } from '../services/gerarCotacao'

interface Props {
  products: Product[]
  onClose: () => void
  onConfirm: (data: CotacaoData) => void
}

const inputClass =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20'

export default function QuantidadesCotacao({ products, onClose, onConfirm }: Props) {
  const [fornecedor, setFornecedor] = useState('')
  const [qtds, setQtds] = useState<Record<string, string>>({})
  const fornecedorRef = useRef<HTMLInputElement>(null)
  const qtdRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    fornecedorRef.current?.focus()
    preparar()
  }, [])

  const completo =
    fornecedor.trim().length > 0 && products.every((p) => (qtds[p.id!] ?? '').trim() !== '')

  function confirmar() {
    if (!completo) return
    onConfirm({
      fornecedor: fornecedor.trim(),
      itens: products.map((p) => ({
        name: p.name,
        quantity: qtds[p.id!].trim(),
        unit: p.unit ?? null,
      })),
    })
  }

  function avancar(i: number) {
    if (i < products.length - 1) qtdRefs.current[i + 1]?.focus()
    else confirmar()
  }

  function teclaQtd(e: ReactKeyboardEvent<HTMLInputElement>, i: number) {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (e.key === 'Enter') {
      e.preventDefault()
      avancar(i)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      qtdRefs.current[i + 1]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (i === 0) fornecedorRef.current?.focus()
      else qtdRefs.current[i - 1]?.focus()
    }
  }

  return (
    <div
      className="fixed inset-0 z-30 flex flex-col bg-white"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          onClose()
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault()
          confirmar()
        }
      }}
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded px-1 text-sm text-slate-500 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#079C9C]"
        >
          Voltar
        </button>
        <h2 className="text-sm font-semibold text-slate-900">Quantidades</h2>
        <span className="w-12" />
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="space-y-1.5">
          <label htmlFor="qc-fornecedor" className="block text-xs font-medium text-slate-600">
            Fornecedor
          </label>
          <input
            id="qc-fornecedor"
            ref={fornecedorRef}
            value={fornecedor}
            onChange={(e) => setFornecedor(e.target.value)}
            onKeyDown={(e) => {
              if (e.ctrlKey || e.metaKey) return
              if (e.key === 'Enter' || e.key === 'ArrowDown') {
                e.preventDefault()
                qtdRefs.current[0]?.focus()
              }
            }}
            enterKeyHint="next"
            placeholder="Nome do fornecedor"
            className={`${inputClass} w-full`}
          />
        </div>

        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {products.map((p, i) => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2">
              <p className="min-w-0 flex-1 break-words text-sm text-slate-900">{p.name}</p>
              <input
                ref={(el) => {
                  qtdRefs.current[i] = el
                }}
                value={qtds[p.id!] ?? ''}
                onChange={(e) => setQtds((prev) => ({ ...prev, [p.id!]: e.target.value }))}
                onFocus={(e) => e.currentTarget.select()}
                onKeyDown={(e) => teclaQtd(e, i)}
                inputMode="decimal"
                enterKeyHint={i === products.length - 1 ? 'done' : 'next'}
                placeholder="Qtd"
                aria-label={`Quantidade de ${p.name}`}
                className={`${inputClass} w-20 shrink-0 text-center tabular-nums`}
              />
              <span className="w-8 shrink-0 text-xs text-slate-500">{p.unit ?? ''}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-slate-100 p-4">
        <button
          type="button"
          disabled={!completo}
          onClick={confirmar}
          className="w-full rounded-lg bg-[#079C9C] py-2.5 text-sm font-medium text-white transition hover:bg-[#079C9C]/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#079C9C] disabled:opacity-40"
        >
          Gerar PDF
        </button>
      </div>
    </div>
  )
}