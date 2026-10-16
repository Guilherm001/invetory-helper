'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createIdeia, deleteIdeia, listIdeias, updateIdeia } from '../services/ideiasService'
import type { Ideia, NovaIdeia } from '../lib/ideias'

export function useIdeias() {
  const [ideias, setIdeias] = useState<Ideia[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // sempre aponta para a lista mais recente, mesmo dentro de funções async
  const ref = useRef(ideias)
  ref.current = ideias

  const carregar = useCallback(async () => {
    setError(null)
    try {
      setIdeias(await listIdeias())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar as ideias')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  const adicionar = async (nova: NovaIdeia) => {
    const criada = await createIdeia(nova)
    setIdeias((prev) => [criada, ...prev])
    return criada
  }

  // a tela muda na hora; se o banco recusar, volta ao que era antes
  const atualizar = async (id: string, patch: Partial<NovaIdeia>) => {
    const antes = ref.current.find((i) => i.id === id)
    if (!antes) return

    const { detalhes, ...resto } = patch
    const local: Partial<Ideia> = { ...resto }
    if (detalhes !== undefined) local.detalhes = detalhes?.trim() || null

    setIdeias((prev) => prev.map((i) => (i.id === id ? { ...i, ...local } : i)))

    try {
      const salva = await updateIdeia(id, patch)
      setIdeias((prev) => prev.map((i) => (i.id === id ? salva : i)))
    } catch (err) {
      setIdeias((prev) => prev.map((i) => (i.id === id ? antes : i)))
      throw err
    }
  }

  const excluir = async (id: string) => {
    await deleteIdeia(id)
    setIdeias((prev) => prev.filter((i) => i.id !== id))
  }

  return { ideias, loading, error, adicionar, atualizar, excluir, recarregar: carregar }
}