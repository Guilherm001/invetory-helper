import type { SupabaseClient } from '@supabase/supabase-js'

export type Papel = 'dono' | 'funcionario'

// para onde o funcionário volta quando tenta abrir uma página que não é dele
export const ROTA_INICIAL = '/dashboard'

// o funcionário só acessa o que estiver aqui; o dono acessa tudo.
// Página nova que não entrar nesta lista fica só para o dono.
const ROTAS_FUNCIONARIO = ['/dashboard', '/calculator', '/loja', '/orcamentos', '/pedidos','/clientes']

export function podeAcessar(papel: Papel | null, pathname: string) {
  if (papel === 'dono') return true
  if (papel === 'funcionario') {
    return ROTAS_FUNCIONARIO.some(
      (rota) => pathname === rota || pathname.startsWith(`${rota}/`)
    )
  }
  return false
}

export async function getPapel(
  supabase: SupabaseClient,
  userId: string
): Promise<Papel | null> {
  const { data } = await supabase
    .from('perfis')
    .select('papel')
    .eq('id', userId)
    .maybeSingle()

  return data?.papel === 'dono' || data?.papel === 'funcionario'
    ? data.papel
    : null
}