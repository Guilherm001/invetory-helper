'use client'

import { useEffect, useState } from 'react'
import type { Cliente } from '@/features/clientes/services/clientesService'
import { clienteInfo } from '../services/caixaService'
import type { ClienteInfo } from '../types'
import { arredonda } from '../lib/calculos'

export function useClienteCaixa(clienteDoPedido: string | null) {
  const [escolhido, setEscolhido] = useState<Cliente | null>(null)
  const [st, setSt] = useState<{ id: string; info: ClienteInfo | null; erro: string } | null>(null)

  const clienteId = clienteDoPedido ?? escolhido?.id ?? null

  useEffect(() => {
    if (!clienteId) return
    let cancelado = false
    clienteInfo(clienteId)
      .then((info) => {
        if (!cancelado) setSt({ id: clienteId, info, erro: '' })
      })
      .catch((e) => {
        if (!cancelado)
          setSt({
            id: clienteId,
            info: null,
            erro: e instanceof Error ? e.message : 'Erro ao carregar o cliente',
          })
      })
    return () => {
      cancelado = true
    }
  }, [clienteId])

  const atual = st && st.id === clienteId ? st : null
  const info = atual?.info ?? null
  const carregando = !!clienteId && atual === null

  const credito = info?.credito ?? 0
  const pendDisp =
    info && info.ativo && info.pendencia.permitida && info.vencido <= 0
      ? Math.max(0, arredonda(info.pendencia.limite - info.devendo))
      : 0

  const semCliente = !clienteId
    ? 'Vincule um cliente'
    : carregando
      ? 'Carregando...'
      : !info
        ? 'Indisponível'
        : null

  const motivoCredito = semCliente ?? (credito <= 0 ? 'Sem crédito' : null)
  const motivoPendencia =
    semCliente ??
    (info && !info.ativo
      ? 'Cliente desativado'
      : info && !info.pendencia.permitida
        ? 'Bloqueada'
        : info && info.vencido > 0
          ? 'Tem pendência vencida'
          : pendDisp <= 0
            ? 'Limite esgotado'
            : null)

  return {
    escolhido,
    setEscolhido,
    clienteId,
    info,
    carregando,
    erro: atual?.erro ?? '',
    credito,
    pendDisp,
    motivoCredito,
    motivoPendencia,
  }
}