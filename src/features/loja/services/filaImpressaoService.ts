import { supabase } from '@/lib/supabase'

export type StatusImpressao = 'pendente' | 'imprimindo' | 'impresso' | 'erro' | 'expirado'

function traduz(message: string) {
  if (message.toLowerCase().includes('could not find the function'))
    return 'A fila de impressão ainda não foi criada no banco. Rode o SQL da fila.'
  return message
}

export async function enfileirarCupom(vendaId: string): Promise<string> {
  const { data, error } = await supabase.rpc('enfileirar_impressao', { p_venda: vendaId })
  if (error) throw new Error(traduz(error.message))
  return data as string
}

export async function statusDaImpressao(
  id: string
): Promise<{ status: StatusImpressao; erro: string | null }> {
  const { data, error } = await supabase
    .from('fila_impressao')
    .select('status, erro')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(traduz(error.message))
  if (!data) throw new Error('Pedido de impressão não encontrado.')
  return { status: data.status as StatusImpressao, erro: (data.erro as string | null) ?? null }
}