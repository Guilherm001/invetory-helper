'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  createComparacao,
  deleteComparacao,
  listComparacoes,
} from '../services/comparacaoService'
import type { Comparacao, ComparacaoResumo, NovoItemComparacao } from '../types'

export function useComparacoes() {
  const [comparacoes, setComparacoes] = useState<ComparacaoResumo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setError(null)
    try {
      setComparacoes(await listComparacoes())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar comparações')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  const criar = async (nome: string, itens: NovoItemComparacao[]): Promise<Comparacao> => {
    const nova = await createComparacao(nome, itens)
    await carregar()
    return nova
  }

  const excluir = async (id: string) => {
    await deleteComparacao(id)
    setComparacoes((prev) => prev.filter((c) => c.id !== id))
  }

  return { comparacoes, loading, error, criar, excluir, recarregar: carregar }
}