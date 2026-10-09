'use client'

import { useState } from 'react'
import { useCatalogSearch } from '../hooks/useCatalogSearch'
import type { CatalogItem } from '../services/catalogService'

interface Props {
  onSelect: (item: CatalogItem) => void
}

export default function BuscaCatalogo({ onSelect }: Props) {
  const [termo, setTermo] = useState('')
  const { results, loading } = useCatalogSearch(termo)

  function escolher(item: CatalogItem) {
    onSelect(item)
    setTermo('')
  }

  // leitor de código de barras: digita o código e envia Enter
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault() // não envia o formulário
    const t = termo.trim()
    const exato = results.find((r) => r.barcode === t || r.code === t)
    if (exato) escolher(exato)
    else if (results.length === 1) escolher(results[0])
  }

  return (
    <div className="relative">
      <input
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Buscar no catálogo: código, barras ou descrição"
        className="w-full p-2 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-[#079C9C]"
      />

      {termo.trim().length >= 2 && (
        <ul className="absolute z-10 mt-1 w-full max-h-64 overflow-y-auto rounded-md border bg-white shadow-lg">
          {loading && <li className="p-2 text-sm text-gray-500">Buscando...</li>}
          {!loading && results.length === 0 && (
            <li className="p-2 text-sm text-gray-500">Nada encontrado no catálogo.</li>
          )}
          {results.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => escolher(item)}
                className="w-full text-left p-2 hover:bg-gray-50 border-b last:border-b-0"
              >
                <p className="text-sm font-medium text-gray-900">{item.name}</p>
                <p className="text-xs text-gray-500">
                  Cód. {item.code}
                  {item.unit && ` · ${item.unit}`}
                  {item.price != null && ` · R$ ${item.price.toFixed(2).replace('.', ',')}`}
                  {item.stock != null && ` · Estoque: ${item.stock}`}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}