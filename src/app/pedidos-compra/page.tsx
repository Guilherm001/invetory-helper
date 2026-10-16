import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getPapel } from '@/lib/permissoes'
import PedidosCompraLista from '@/features/compras/components/PedidosCompraLista'
import type { FiltroCompra } from '@/features/compras/services/comprasService'

const FILTROS: FiltroCompra[] = ['rascunho', 'andamento', 'atrasado', 'recebido', 'cancelado']

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ abrir?: string; filtro?: string }>
}) {
  const supabase = await createSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/')

  // preços de compra são só do dono
  const papel = await getPapel(supabase, user.id)
  if (papel !== 'dono') redirect('/dashboard')

  const { abrir, filtro } = await searchParams
  const filtroInicial = FILTROS.find((f) => f === filtro)

  return <PedidosCompraLista abrirId={abrir ?? null} filtroInicial={filtroInicial} />
}