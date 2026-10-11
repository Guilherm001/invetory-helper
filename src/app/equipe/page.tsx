import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { donoAtual } from '@/lib/auth-dono'
import { EquipeManager } from '@/features/equipe/components/EquipeManager'

export default async function Page() {
  const supabase = await createSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/')

  // só o dono entra aqui; funcionário volta para os produtos
  const dono = await donoAtual()
  if (!dono) redirect('/dashboard')

  // as regras do banco já limitam isso à empresa do dono
  const { data, error } = await supabase
    .from('perfis')
    .select('id, nome, email')
    .eq('papel', 'funcionario')
    .order('criado_em')

  if (error) {
    console.error('Erro ao carregar a equipe:', error.message)
    return (
      <div className="mt-10 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 md:max-w-xl">
        Não foi possível carregar a equipe. Tente novamente em instantes.
      </div>
    )
  }

  return <EquipeManager funcionarios={data ?? []} />
}