'use client'

import { useCallback, useEffect, useState } from 'react'
import { estadoCaixa, pedidosAbertos } from '../services/caixaService'
import type { EstadoCaixa, PedidoAberto } from '../types'

export function useCaixa() {
  const [estado, setEstado] = useState<EstadoCaixa | null>(null)
  const [pedidos, setPedidos] = useState<PedidoAberto[]>([])
  const [erro, setErro] = useState<string | null>(null)

  const aberto = estado?.aberto === true

  const carregarEstado = useCallback(async () => {
    try {
      setEstado(await estadoCaixa())
      setErro(null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar o caixa')
    }
  }, [])

  const carregarPedidos = useCallback(async () => {
    try {
      setPedidos(await pedidosAbertos())
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar os pedidos')
    }
  }, [])

  useEffect(() => {
    carregarEstado()
  }, [carregarEstado])

  // pedidos novos chegam sozinhos enquanto o caixa está aberto
  useEffect(() => {
    if (!aberto) return
    carregarPedidos()
    const t = setInterval(carregarPedidos, 8000)
    return () => clearInterval(t)
  }, [aberto, carregarPedidos])

  const recarregar = useCallback(
    () => Promise.all([carregarEstado(), carregarPedidos()]).then(() => undefined),
    [carregarEstado, carregarPedidos]
  )

  return { estado, pedidos, erro, recarregar }
}