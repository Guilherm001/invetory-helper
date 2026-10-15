import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getPapel } from '@/lib/permissoes'
import PedidosCompraLista from '@/features/compras/components/PedidosCompraLista'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ abrir?: string }>
}) {
  const supabase = await createSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/')

  // preços de compra são só do dono
  const papel = await getPapel(supabase, user.id)
  if (papel !== 'dono') redirect('/dashboard')

  const { abrir } = await searchParams

  return <PedidosCompraLista abrirId={abrir ?? null} />
}