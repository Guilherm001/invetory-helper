'use client'

import { useCallback, useEffect, useState } from 'react'
import type { PedidoSugerido } from '@/features/comparar-precos/utils/melhorPreco'
import {
  criarPedidos,
  pedidoDeSugestao,
  pedidosDaComparacao,
  type PedidoDaComparacao,
} from '../services/comprasService'

// quais fornecedores desta comparação já viraram pedido, e como criar os que faltam
export function usePedidosDaComparacao(comparacaoId?: string, nomeComparacao?: string) {
  const [criados, setCriados] = useState<Map<string, PedidoDaComparacao>>(new Map())
  const [criando, setCriando] = useState<string | null>(null)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    if (!comparacaoId) return
    try {
      const lista = await pedidosDaComparacao(comparacaoId)
      setCriados(
        new Map(
          lista
            .filter((p) => p.fornecedor_ref)
            .map((p) => [p.fornecedor_ref as string, p] as const)
        )
      )
    } catch {
      // módulo ainda não instalado no banco: o erro aparece ao tentar criar
    }
  }, [comparacaoId])

  useEffect(() => {
    carregar()
  }, [carregar])

  const criar = async (pedidos: PedidoSugerido[], marca: string) => {
    if (!comparacaoId || pedidos.length === 0 || criando) return
    setCriando(marca)
    setErro('')
    try {
      await criarPedidos(
        pedidos.map((p) => pedidoDeSugestao(p, { id: comparacaoId, nome: nomeComparacao ?? '' }))
      )
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao criar o pedido')
    } finally {
      setCriando(null)
    }
  }

  return { criados, criando, erro, criar, podeCriar: !!comparacaoId }
}