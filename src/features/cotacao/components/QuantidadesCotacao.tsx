'use client'

import { useEffect, useRef, useState } from 'react'
import type { Product } from '@/features/body/services/listService'
import type { CotacaoData } from '../types'

interface Props {
  products: Product[]
  onClose: () => void
  onConfirm: (data: CotacaoData) => void
}

export default function QuantidadesCotacao({ products, onClose, onConfirm }: Props) {
  const [fornecedor, setFornecedor] = useState('')
  const [qtds, setQtds] = useState<Record<string, string>>({})
  const fornecedorRef = useRef<HTMLInputElement>(null)
  const qtdRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    fornecedorRef.current?.focus()
  }, [])

  const completo =
    fornecedor.trim().length > 0 &&
    products.every((p) => (qtds[p.id!] ?? '').trim() !== '')

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

  return (
    <div className="fixed inset-0 z-30 bg-white flex flex-col">
      <div className="flex items-center justify-between p-3 border-b">
        <button onClick={onClose} className="text-sm text-gray-600">Voltar</button>
        <h2 className="text-base font-semibold">Quantidades</h2>
        <span className="w-12" />
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <input
          ref={fornecedorRef}
          value={fornecedor}
          onChange={(e) => setFornecedor(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            qtdRefs.current[0]?.focus()
          }}
          enterKeyHint="next"
          placeholder="Nome do fornecedor"
          className="w-full p-2 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-[#079C9C]"
        />

        {products.map((p, i) => (
          <div key={p.id} className="flex items-center gap-3">
            <p className="flex-1 min-w-0 text-sm text-gray-900 break-words">{p.name}</p>
            <input
              ref={(el) => { qtdRefs.current[i] = el }}
              value={qtds[p.id!] ?? ''}
              onChange={(e) => setQtds((prev) => ({ ...prev, [p.id!]: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                avancar(i)
              }}
              inputMode="decimal"
              enterKeyHint={i === products.length - 1 ? 'done' : 'next'}
              placeholder="Qtd"
              className="w-24 p-2 text-center border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-[#079C9C]"
            />
            {p.unit && <span className="w-8 text-xs text-gray-500">{p.unit}</span>}
          </div>
        ))}
      </div>

      <div className="p-3 border-t">
        <button
          disabled={!completo}
          onClick={confirmar}
          className="w-full py-3 rounded-md bg-[#079C9C] text-white font-medium disabled:opacity-40"
        >
          Gerar PDF
        </button>
      </div>
    </div>
  )
}