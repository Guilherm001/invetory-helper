'use client'

import { useEffect, useId, useRef, useState } from 'react'
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
  const [ativo, setAtivo] = useState(-1) // índice do item destacado pelas setas
  const lendo = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const opcoes = useRef<Map<number, HTMLElement>>(new Map())
  const baseId = useId()

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

  const podeMostrarMais = !loading && results.length >= limite
  // o "Mostrar mais" também entra na navegação, como último item
  const total = results.length + (podeMostrarMais ? 1 : 0)
  const ativoValido = ativo >= 0 && ativo < total ? ativo : -1
  const listaAberta = termo.trim().length >= 2

  // mantém o item destacado visível quando a lista rola
  useEffect(() => {
    if (ativoValido < 0) return
    opcoes.current.get(ativoValido)?.scrollIntoView({ block: 'nearest' })
  }, [ativoValido])

  function limpar() {
    setTermo('')
    setResults([])
    setLimite(PASSO)
    setAtivo(-1)
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
      // com texto: só limpa a busca. Sem texto: deixa o Esc seguir (fecha o diálogo)
      if (termo) {
        e.preventDefault()
        limpar()
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!listaAberta || total === 0) return
      setAtivo(ativoValido < total - 1 ? ativoValido + 1 : 0)
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!listaAberta || total === 0) return
      // no primeiro item, "subir" volta para o campo (sem destaque)
      setAtivo(ativoValido <= 0 ? -1 : ativoValido - 1)
      return
    }

    if (e.key !== 'Enter') return

    e.preventDefault()

    // item destacado pelas setas
    if (ativoValido >= 0) {
      if (ativoValido < results.length) escolher(results[ativoValido])
      else setLimite((l) => l + PASSO)
      return
    }

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
        // vários resultados: já destaca o primeiro, o próximo Enter escolhe
        if (encontrados.length > 0) setAtivo(0)
      }
    } catch {
      // mantém a interface disponível em caso de erro
    } finally {
      lendo.current = false
    }
  }

  return (
    <div className="relative" data-busca-catalogo>
      <input
        ref={inputRef}
        value={termo}
        onChange={(e) => {
          setTermo(e.target.value)
          setLimite(PASSO)
          setAtivo(-1)
        }}
        onKeyDown={handleKeyDown}
        placeholder="Buscar no catálogo: código, barras ou descrição"
        autoFocus
        role="combobox"
        aria-expanded={listaAberta}
        aria-controls={`${baseId}-lista`}
        aria-autocomplete="list"
        aria-activedescendant={
          ativoValido >= 0 ? `${baseId}-opt-${ativoValido}` : undefined
        }
        className="w-full rounded-md border border-gray-300 p-2 pr-9 outline-none focus:ring-2 focus:ring-[#079C9C]"
      />

      {termo && (
        <button
          type="button"
          tabIndex={-1}
          onClick={limpar}
          aria-label="Limpar busca"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-700"
        >
          <X className="size-4" />
        </button>
      )}

      {listaAberta && (
        <ul
          id={`${baseId}-lista`}
          role="listbox"
          className="absolute z-10 mt-1 max-h-80 w-full overflow-y-auto rounded-md border bg-white shadow-lg"
        >
          {loading && results.length === 0 && (
            <li className="p-2 text-sm text-gray-500">Buscando...</li>
          )}

          {!loading && results.length === 0 && (
            <li className="p-2 text-sm text-gray-500">
              Nada encontrado no catálogo.
            </li>
          )}

          {results.map((item, i) => {
            const exato =
              item.code === termo.trim() || item.barcode === termo.trim()
            const adicionado = jaAdicionado?.(item) ?? false
            const selecionado = i === ativoValido

            return (
              <li
                key={item.id}
                id={`${baseId}-opt-${i}`}
                role="option"
                aria-selected={selecionado}
                ref={(el) => {
                  if (el) opcoes.current.set(i, el)
                  else opcoes.current.delete(i)
                }}
              >
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => escolher(item)}
                  className={`flex w-full items-center gap-2 border-b p-2 text-left last:border-b-0 ${
                    selecionado
                      ? 'bg-[#079C9C]/15 shadow-[inset_3px_0_0_#079C9C]'
                      : adicionado
                        ? 'bg-emerald-50/60 hover:bg-gray-50'
                        : exato
                          ? 'bg-[#079C9C]/5 hover:bg-gray-50'
                          : 'hover:bg-gray-50'
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
            <li
              id={`${baseId}-opt-${results.length}`}
              role="option"
              aria-selected={ativoValido === results.length}
              ref={(el) => {
                if (el) opcoes.current.set(results.length, el)
                else opcoes.current.delete(results.length)
              }}
            >
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setLimite((l) => l + PASSO)}
                className={`w-full p-2 text-center text-sm font-semibold text-[#079C9C] hover:bg-gray-50 ${
                  ativoValido === results.length ? 'bg-[#079C9C]/15' : ''
                }`}
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