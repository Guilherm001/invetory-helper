'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { listCotacoes } from '../services/historicoService'
import { agrupar } from '../utils/estatisticas'

export function useHistorico() {
  const [cotacoes, setCotacoes] = useState<Awaited<ReturnType<typeof listCotacoes>>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setError(null)
    try {
      setCotacoes(await listCotacoes())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar o histórico')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  // o agrupamento só roda de novo quando as cotações mudam
  const produtos = useMemo(() => agrupar(cotacoes), [cotacoes])

  return { produtos, loading, error, recarregar: carregar }
}