'use client'

import { useEffect, useMemo, useState } from 'react'
import { listCotacoes } from '../services/historicoService'
import { referenciasExcluindo } from '../utils/referencias'
import type { Cotacao } from '../types'

export function useReferencias(comparacaoId: string) {
  const [cotacoes, setCotacoes] = useState<Cotacao[]>([])

  useEffect(() => {
    let cancelado = false
    listCotacoes()
      .then((c) => {
        if (!cancelado) setCotacoes(c)
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