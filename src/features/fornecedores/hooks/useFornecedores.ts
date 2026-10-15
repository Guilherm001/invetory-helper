'use client'

import { useCallback, useEffect, useState } from 'react'
import { listarFornecedores } from '../services/fornecedoresService'
import type { FornecedorCompleto } from '../types'

export function useFornecedores() {
  const [fornecedores, setFornecedores] = useState<FornecedorCompleto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    try {
      setFornecedores(await listarFornecedores())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar os fornecedores')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  return { fornecedores, loading, error, recarregar: carregar }
}