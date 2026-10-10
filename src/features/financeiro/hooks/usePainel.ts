'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  listarDias,
  topItens,
  type DiaFinanceiro,
  type ItemTop,
} from '../services/financeiroService'

// últimos 13 meses, para o gráfico mensal e a comparação com o mês anterior
export function useDiasFinanceiro(hoje: Date) {
  const desde = (() => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - 12, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })()

  const [dias, setDias] = useState<DiaFinanceiro[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    try {
      setDias(await listarDias(desde))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar o painel')
    } finally {
      setLoading(false)
    }
  }, [desde])

  useEffect(() => {
    carregar()
  }, [carregar])

  return { dias, loading, error, recarregar: carregar }
}

interface DadosTop {
  mes: string
  custo: ItemTop[]
  lucro: ItemTop[]
  erro: string | null
}

export function useTopItens(mes: string, atualizacao: number) {
  const [dados, setDados] = useState<DadosTop | null>(null)

  useEffect(() => {
    let cancelado = false
    const [a, m] = mes.split('-').map(Number)
    const ini = `${mes}-01`
    const fim = `${mes}-${String(new Date(a, m, 0).getDate()).padStart(2, '0')}`

    Promise.all([topItens(ini, fim, 'custo'), topItens(ini, fim, 'lucro')])
      .then(([custo, lucro]) => {
        if (!cancelado) setDados({ mes, custo, lucro, erro: null })
      })
      .catch((e) => {
        if (!cancelado) {
          setDados({
            mes,
            custo: [],
            lucro: [],
            erro: e instanceof Error ? e.message : 'Erro ao carregar os itens',
          })
        }
      })

    return () => {
      cancelado = true
    }
  }, [mes, atualizacao])

  const atual = dados && dados.mes === mes ? dados : null
  return {
    custo: atual?.custo ?? [],
    lucro: atual?.lucro ?? [],
    erro: atual?.erro ?? null,
    carregando: atual === null,
  }
}