import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { EquipeManager } from '@/features/equipe/components/EquipeManager'

export default async function Page() {
  const supabase = await createSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/')

  // as regras do banco já limitam isso à empresa do dono
  const { data } = await supabase
    .from('perfis')
    .select('id, nome, email')
    .eq('papel', 'funcionario')
    .order('criado_em')

  return <EquipeManager funcionarios={data ?? []} />
}