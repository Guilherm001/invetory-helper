'use client'

import { useEffect, useMemo, useState } from 'react'
import { listCotacoes } from '../services/historicoService'
import { referenciasExcluindo } from '../utils/referencias'
import { comprasComoCotacoes } from '@/features/compras/services/comprasService'
import type { Cotacao } from '../types'

export function useReferencias(comparacaoId: string) {
  const [cotacoes, setCotacoes] = useState<Cotacao[]>([])

  useEffect(() => {
    let cancelado = false

    Promise.all([
      listCotacoes(),
      // preços de pedidos já recebidos; se o módulo de compras não estiver pronto, ignora
      comprasComoCotacoes().catch((): Cotacao[] => []),
    ])
      .then(([cotadas, pagas]) => {
        if (!cancelado) setCotacoes([...cotadas, ...pagas])
      })
      .catch(() => {
        // o indicador é opcional: sem histórico, a tela funciona igual
      })

    return () => {
      cancelado = true
    }
  }, [])

  return useMemo(() => referenciasExcluindo(cotacoes, comparacaoId), [cotacoes, comparacaoId])
}