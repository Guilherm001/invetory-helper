'use client'

import { useEffect, useState } from 'react'
import { searchCatalog, type CatalogItem } from '../services/catalogService'

export function useCatalogSearch(termo: string) {
  const [results, setResults] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (termo.trim().length < 2) {
      setResults([])
      return
    }
    let cancelado = false
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const data = await searchCatalog(termo)
        if (!cancelado) setResults(data)
      } catch {
        if (!cancelado) setResults([])
      } finally {
        if (!cancelado) setLoading(false)
      }
    }, 300)

    return () => {
      cancelado = true
      clearTimeout(timer)
    }
  }, [termo])

  return { results, loading }
}