'use client'

import { useParams } from 'next/navigation'
import PedidoCompraPagina from '@/features/compras/components/PedidoCompraPagina'

export default function Page() {
  const { id } = useParams<{ id: string }>()
  return <PedidoCompraPagina key={id} id={id} />
}