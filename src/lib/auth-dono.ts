import 'server-only'
import { createSupabaseServer } from '@/lib/supabase-server'

// quem está chamando precisa ser dono; a empresa vem do banco, nunca do navegador
export async function donoAtual() {
  const supabase = await createSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('perfis')
    .select('empresa_id, papel')
    .eq('id', user.id)
    .maybeSingle()

  if (!data || data.papel !== 'dono') return null
  return { userId: user.id, empresaId: data.empresa_id as string }
}