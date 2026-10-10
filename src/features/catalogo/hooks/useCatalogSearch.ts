'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  listCatalog,
  getCatalogStats,
  type CatalogItem,
} from '../services/catalogService'

export const PAGE_SIZE = 25

export function useCatalogo() {
  const [termo, setTermoState] = useState('')
  const [termoBusca, setTermoBusca] = useState('')
  const [semEstoque, setSemEstoque] = useState(false)
  const [page, setPage] = useState(0)

  const [items, setItems] = useState<CatalogItem[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState({ total: 0, semEstoque: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ignora respostas antigas se o usuário digitar rápido
  const requisicao = useRef(0)

  // espera o usuário parar de digitar
  useEffect(() => {
    const timer = setTimeout(() => {
      setTermoBusca(termo)
      setPage(0)
    }, 300)
    return () => clearTimeout(timer)
  }, [termo])

  const carregar = useCallback(async () => {
    const id = ++requisicao.current
    setLoading(true)
    setError(null)
    try {
      const [lista, estatisticas] = await Promise.all([
        listCatalog({ termo: termoBusca, page, pageSize: PAGE_SIZE, semEstoque }),
        getCatalogStats(),
      ])
      if (id !== requisicao.current) return

      // apagou tudo da última página: volta uma
      if (lista.items.length === 0 && page > 0) {
        setPage(page - 1)
        return
      }

      setItems(lista.items)
      setTotal(lista.total)
      setStats(estatisticas)
    } catch (err) {
      if (id !== requisicao.current) return
      setError(err instanceof Error ? err.message : 'Erro ao carregar o catálogo')
    } finally {
      if (id === requisicao.current) setLoading(false)
    }
  }, [termoBusca, page, semEstoque])

  useEffect(() => {
    carregar()
  }, [carregar])

  return {
    items,
    total,
    stats,
    loading,
    error,
    termo,
    setTermo: setTermoState,
    semEstoque,
    alternarSemEstoque: () => {
      setSemEstoque((v) => !v)
      setPage(0)
    },
    page,
    setPage,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    recarregar: carregar,
  }
}