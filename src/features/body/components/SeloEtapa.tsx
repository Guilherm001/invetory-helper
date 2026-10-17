'use client'

import Link from 'next/link'
import { ClipboardCheck, PackageCheck, Send } from 'lucide-react'
import { STATUS_INFO, numeroPedido } from '@/features/compras/lib/compras'
import type { StatusCompra } from '@/features/compras/services/comprasService'
import type { EtapaDaFalta } from '@/features/compras/services/painelService'

const base =
  'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold'

export default function SeloEtapa({
  etapa,
  link = false,
}: {
  etapa: EtapaDaFalta
  link?: boolean
}) {
  // "sem cotação ou pedido" não ganha selo: quase todo item novo estaria assim
  if (etapa.etapa === 'pendente') return null

  if (etapa.etapa === 'em_cotacao') {
    return (
      <span
        title={
          etapa.cotacao_em
            ? `Cotado em ${new Date(etapa.cotacao_em).toLocaleDateString('pt-BR')}`
            : undefined
        }
        className={`${base} bg-sky-50 text-sky-700`}
      >
        <Send className="size-3 shrink-0" />
        Em cotação
      </span>
    )
  }

  const recebido = etapa.etapa === 'recebido'
  const numero = etapa.pedido_numero != null ? numeroPedido(etapa.pedido_numero) : 'pedido'
  const status = etapa.pedido_status
    ? STATUS_INFO[etapa.pedido_status as StatusCompra]
    : undefined

  const texto = recebido ? `Recebido · ${numero}` : `${numero} · ${status?.texto ?? 'Em pedido'}`
  const cor = recebido
    ? 'bg-emerald-50 text-emerald-700'
    : (status?.classe ?? 'bg-violet-50 text-violet-700')
  const Icone = recebido ? PackageCheck : ClipboardCheck

  const conteudo = (
    <>
      <Icone className="size-3 shrink-0" />
      {texto}
    </>
  )

  if (link && etapa.pedido_id) {
    return (
      <Link
        href={`/pedidos-compra?abrir=${etapa.pedido_id}`}
        // no modo seleção a linha inteira é clicável: o link não deve marcar o item
        onClick={(e) => e.stopPropagation()}
        title="Abrir o pedido de compra"
        className={`${base} ${cor} hover:underline`}
      >
        {conteudo}
      </Link>
    )
  }

  return <span className={`${base} ${cor}`}>{conteudo}</span>
}