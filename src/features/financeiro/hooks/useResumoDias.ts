'use client'

import { useCallback, useEffect, useState } from 'react'
import { listarResumo, type ResumoDia } from '../services/financeiroService'

export function useResumoDias(limite = 14) {
  const [dias, setDias] = useState<ResumoDia[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    try {
      setDias(await listarResumo(limite))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar o financeiro')
    } finally {
      setLoading(false)
    }
  }, [limite])

  useEffect(() => {
    carregar()
  }, [carregar])

  return { dias, loading, error, recarregar: carregar }
}