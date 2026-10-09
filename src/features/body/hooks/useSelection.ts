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

  const start = () => setSelecting(true)

  const cancel = () => {
    setSelecting(false)
    setIds(new Set())
  }

  return { selecting, ids, toggle, start, cancel }
}