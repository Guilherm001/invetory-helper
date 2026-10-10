'use client'

import { useRef, useState, useEffect } from 'react'
import { searchCatalog, type CatalogItem } from '../services/catalogService'

interface Props {
  onSelect: (item: CatalogItem) => void
}

export default function BuscaCatalogo({ onSelect }: Props) {
  const [termo, setTermo] = useState('')
  const [results, setResults] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(false)
  const lendo = useRef(false)

  // Busca enquanto o usuário digita, com debounce
  useEffect(() => {
    const t = termo.trim()

    if (t.length < 2) {
      setResults([])
      setLoading(false)
      return
    }

    let cancelado = false

    const timer = setTimeout(async () => {
      setLoading(true)

      try {
        const encontrados = await searchCatalog(t)

        if (!cancelado) {
          setResults(encontrados)
        }
      } catch {
        if (!cancelado) {
          setResults([])
        }
      } finally {
        if (!cancelado) {
          setLoading(false)
        }
      }
    }, 300)

    return () => {
      cancelado = true
      clearTimeout(timer)
    }
  }, [termo])

  function escolher(item: CatalogItem) {
    onSelect(item)
    setTermo('')
    setResults([])
  }

  // Enter: se o que foi digitado é um código (ou código de barras) exato,
  // adiciona na hora. Senão, mostra os semelhantes.
  async function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setTermo('')
      setResults([])
      return
    }

    if (e.key !== 'Enter') return

    e.preventDefault()

    const t = termo.trim()
    const soNumeros = /^\d+$/.test(t)

    // código de 1 dígito só vale no Enter; texto precisa de 2+
    if (t.length < (soNumeros ? 1 : 2) || lendo.current) return

    lendo.current = true

    try {
      // busca direto, sem esperar o debounce
      const encontrados = await searchCatalog(t)

      const exato = encontrados.find(
        (item) => item.code === t || item.barcode === t
      )

      if (exato) {
        escolher(exato)
      } else if (encontrados.length === 1) {
        escolher(encontrados[0])
      } else {
        setResults(encontrados)
      }
    } catch {
      // mantém a interface disponível em caso de erro
    } finally {
      lendo.current = false
    }
  }

  return (
    <div className="relative">
      <input
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Buscar no catálogo: código, barras ou descrição"
        autoFocus
        className="w-full p-2 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-[#079C9C]"
      />

      {termo.trim().length >= 2 && (
        <ul className="absolute z-10 mt-1 w-full max-h-64 overflow-y-auto rounded-md border bg-white shadow-lg">
          {loading && (
            <li className="p-2 text-sm text-gray-500">
              Buscando...
            </li>
          )}

          {!loading && results.length === 0 && (
            <li className="p-2 text-sm text-gray-500">
              Nada encontrado no catálogo.
            </li>
          )}

          {results.map((item) => {
            const exato =
              item.code === termo.trim() || item.barcode === termo.trim()

            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => escolher(item)}
                  className={`w-full text-left p-2 hover:bg-gray-50 border-b last:border-b-0 ${
                    exato ? 'bg-[#079C9C]/5' : ''
                  }`}
                >
                  <p className="text-sm font-medium text-gray-900">
                    {item.name}
                  </p>

                  <p className="text-xs text-gray-500">
                    Cód. {item.code}
                    {item.unit && ` · ${item.unit}`}
                    {item.price != null &&
                      ` · R$ ${item.price.toFixed(2).replace('.', ',')}`}
                    {item.stock != null && ` · Estoque: ${item.stock}`}
                  </p>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}