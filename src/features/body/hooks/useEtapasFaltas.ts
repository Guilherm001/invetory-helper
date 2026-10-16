'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  etapasDasFaltas,
  type EtapaDaFalta,
} from '@/features/compras/services/painelService'

// em que etapa está cada falta (cotação, pedido, recebido). Só o dono consulta.
export function useEtapasFaltas(ativo: boolean, chave: string) {
  const [etapas, setEtapas] = useState<Map<string, EtapaDaFalta>>(new Map())
  const [disponivel, setDisponivel] = useState(false)
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    if (!ativo) return
    let cancelado = false

    etapasDasFaltas()
      .then((m) => {
        if (cancelado) return
        setEtapas(m)
        setDisponivel(true)
      })
      .catch(() => {
        // SQL do painel ainda não rodou: a lista funciona sem as etapas
        if (cancelado) return
        setEtapas(new Map())
        setDisponivel(false)
      })

    return () => {
      cancelado = true
    }
  }, [ativo, chave, versao])

  // voltou para a aba: confere de novo (um pedido pode ter sido recebido em outro aparelho)
  useEffect(() => {
    if (!ativo) return
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') setVersao((v) => v + 1)
    }
    document.addEventListener('visibilitychange', aoVoltar)
    return () => document.removeEventListener('visibilitychange', aoVoltar)
  }, [ativo])

  const recarregar = useCallback(() => setVersao((v) => v + 1), [])

  return { etapas, disponivel, recarregar }
}