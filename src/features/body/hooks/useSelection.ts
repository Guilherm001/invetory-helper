'use client'

import { useState } from 'react'

export function useSelection() {
  const [selecting, setSelecting] = useState(false)
  const [ids, setIds] = useState<Set<string>>(new Set())

  const toggle = (id: string) =>
    setIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // marca vários de uma vez (selecionar todos)
  const addMany = (novos: string[]) =>
    setIds((prev) => new Set([...prev, ...novos]))

  // desmarca vários de uma vez
  const removeMany = (remover: string[]) =>
    setIds((prev) => {
      const next = new Set(prev)
      remover.forEach((id) => next.delete(id))
      return next
    })

  const start = () => setSelecting(true)

  const cancel = () => {
    setSelecting(false)
    setIds(new Set())
  }

  return { selecting, ids, toggle, addMany, removeMany, start, cancel }
}