import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getPapel } from '@/lib/permissoes'
import DocumentosLista from '@/features/loja/components/DocumentosLista'

export default async function Page() {
  const supabase = await createSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const papel = await getPapel(supabase, user.id)

  return <DocumentosLista documento="orcamento" ehDono={papel === 'dono'} />
}