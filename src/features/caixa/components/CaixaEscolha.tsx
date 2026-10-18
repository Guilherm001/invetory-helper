'use client'

import { useState } from 'react'
import CaixaPage from './CaixaPage'
import CaixaPDV from './pdv/CaixaPDV'

type Layout = 'classico' | 'pdv'

export default function CaixaEscolha({ inicial }: { inicial: Layout }) {
  const [layout, setLayout] = useState<Layout>(inicial)

  const trocar = () => {
    const novo: Layout = layout === 'pdv' ? 'classico' : 'pdv'
    setLayout(novo)
    // o endereço acompanha, para você poder guardar o atalho do layout que escolher
    const url = new URL(window.location.href)
    url.searchParams.set('layout', novo)
    window.history.replaceState(null, '', url)
  }

  return layout === 'pdv' ? (
    <CaixaPDV onTrocarLayout={trocar} />
  ) : (
    <CaixaPage onTrocarLayout={trocar} />
  )
}