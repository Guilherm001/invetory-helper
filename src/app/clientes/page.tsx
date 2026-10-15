import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getPapel } from '@/lib/permissoes'
import ClientesLista from '@/features/clientes/components/ClientesLista'

export default async function Page() {
  const supabase = await createSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const papel = await getPapel(supabase, user.id)

  return <ClientesLista ehDono={papel === 'dono'} />
}