'use client'

import { useCallback, useEffect, useState } from 'react'
import { excluirCotacao, listCotacoes, type CotacaoSalva } from '../services/cotacaoService'

export function useCotacoes() {
  const [cotacoes, setCotacoes] = useState<CotacaoSalva[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setError(null)
    try {
      setCotacoes(await listCotacoes())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar as cotações')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  const excluir = async (id: string) => {
    await excluirCotacao(id)
    setCotacoes((prev) => prev.filter((c) => c.id !== id))
  }

  return { cotacoes, loading, error, excluir, recarregar: carregar }
}