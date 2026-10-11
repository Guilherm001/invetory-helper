'use client'

import { useEffect, useState } from 'react'
import { codigosNaLista } from '../services/lojaCatalogoService'

// o que já está pendente na lista de compras, por código do catálogo
export function useListaCompras() {
  const [mapa, setMapa] = useState<Map<string, number>>(new Map())

  useEffect(() => {
    let cancelado = false
    codigosNaLista()
      .then((m) => {
        if (!cancelado) setMapa(m)
      })
      .catch(() => {
        // o aviso "já está na lista" é opcional: sem ele, a tela funciona igual
      })
    return () => {
      cancelado = true
    }
  }, [])

  // depois de pedir, atualiza na hora sem buscar de novo
  const somar = (codigo: string, quantidade: number) =>
    setMapa((prev) => {
      const novo = new Map(prev)
      novo.set(codigo, (novo.get(codigo) ?? 0) + quantidade)
      return novo
    })

  return { mapa, somar }
}