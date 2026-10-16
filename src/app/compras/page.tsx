import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getPapel } from '@/lib/permissoes'
import PainelCompras from '@/features/compras/components/PainelCompras'

export default async function Page() {
  const supabase = await createSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/')

  // valores de compra são só do dono
  const papel = await getPapel(supabase, user.id)
  if (papel !== 'dono') redirect('/dashboard')

  return <PainelCompras />
}