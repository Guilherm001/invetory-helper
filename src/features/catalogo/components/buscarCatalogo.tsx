'use client'

import { useRef, useState, useEffect } from 'react'
import { Check, X } from 'lucide-react'
import { searchCatalog, type CatalogItem } from '../services/catalogService'

const PASSO = 50

interface Props {
  onSelect: (item: CatalogItem) => void
  // true: depois de escolher, o termo e os resultados continuam na tela
  manterAberto?: boolean
  // marca com um check os itens que já foram adicionados
  jaAdicionado?: (item: CatalogItem) => boolean
}

export default function BuscaCatalogo({
  onSelect,
  manterAberto = false,
  jaAdicionado,
}: Props) {
  const [termo, setTermo] = useState('')
  const [results, setResults] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [limite, setLimite] = useState(PASSO)
  const lendo = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

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
        const encontrados = await searchCatalog(t, limite)
        if (!cancelado) setResults(encontrados)
      } catch {
        if (!cancelado) setResults([])
      } finally {
        if (!cancelado) setLoading(false)
      }
    }, 300)

    return () => {
      cancelado = true
      clearTimeout(timer)
    }
  }, [termo, limite])

  function limpar() {
    setTermo('')
    setResults([])
    setLimite(PASSO)
    inputRef.current?.focus()
  }

  function escolher(item: CatalogItem) {
    onSelect(item)
    if (manterAberto) {
      inputRef.current?.focus()
      return
    }
    limpar()
  }

  async function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      limpar()
      return
    }

    if (e.key !== 'Enter') return

    e.preventDefault()

    const t = termo.trim()
    const soNumeros = /^\d+$/.test(t)

    if (t.length < (soNumeros ? 1 : 2) || lendo.current) return

    lendo.current = true

    try {
      const encontrados = await searchCatalog(t, limite)

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

  const podeMostrarMais = !loading && results.length >= limite

  return (
    <div className="relative">
      <input
        ref={inputRef}
        value={termo}
        onChange={(e) => {
          setTermo(e.target.value)
          setLimite(PASSO)
        }}
        onKeyDown={handleKeyDown}
        placeholder="Buscar no catálogo: código, barras ou descrição"
        autoFocus
        className="w-full rounded-md border border-gray-300 p-2 pr-9 outline-none focus:ring-2 focus:ring-[#079C9C]"
      />

      {termo && (
        <button
          type="button"
          onClick={limpar}
          aria-label="Limpar busca"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-700"
        >
          <X className="size-4" />
        </button>
      )}

      {termo.trim().length >= 2 && (
        <ul className="absolute z-10 mt-1 max-h-80 w-full overflow-y-auto rounded-md border bg-white shadow-lg">
          {loading && results.length === 0 && (
            <li className="p-2 text-sm text-gray-500">Buscando...</li>
          )}

          {!loading && results.length === 0 && (
            <li className="p-2 text-sm text-gray-500">
              Nada encontrado no catálogo.
            </li>
          )}

          {results.map((item) => {
            const exato =
              item.code === termo.trim() || item.barcode === termo.trim()
            const adicionado = jaAdicionado?.(item) ?? false

            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => escolher(item)}
                  className={`flex w-full items-center gap-2 border-b p-2 text-left last:border-b-0 hover:bg-gray-50 ${
                    adicionado
                      ? 'bg-emerald-50/60'
                      : exato
                        ? 'bg-[#079C9C]/5'
                        : ''
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-gray-900">
                      {item.name}
                    </span>
                    <span className="block text-xs text-gray-500">
                      Cód. {item.code}
                      {item.unit && ` · ${item.unit}`}
                      {item.price != null &&
                        ` · R$ ${item.price.toFixed(2).replace('.', ',')}`}
                      {item.stock != null && ` · Estoque: ${item.stock}`}
                    </span>
                  </span>

                  {adicionado && (
                    <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-700">
                      <Check className="size-3.5" />
                      Na lista
                    </span>
                  )}
                </button>
              </li>
            )
          })}

          {podeMostrarMais && (
            <li>
              <button
                type="button"
                onClick={() => setLimite((l) => l + PASSO)}
                className="w-full p-2 text-center text-sm font-semibold text-[#079C9C] hover:bg-gray-50"
              >
                Mostrar mais
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}