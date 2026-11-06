import { supabase } from '@/lib/supabase'

export interface NovoItemEnviado {
  codigo: string
  nome: string
  unidade: string | null
  quantidade: number
  preco: number
}

export interface PrecoVendaEnviado {
  item_id: string
  preco_venda: number
  margem_pct: number | null
}

function traduz(error: { message: string; code?: string }) {
  const m = error.message.toLowerCase()
  if (m.includes('could not find the function') || m.includes('does not exist'))
    return new Error(
      'Falta atualizar o banco: rode o SQL de itens da nota e preço de venda (adicionar_itens_pedido_compra e definir_precos_venda_pedido).'
    )
  return new Error(error.message)
}

// adiciona ao pedido itens que vieram na nota e não estavam nele
export async function adicionarItensAoPedido(
  pedidoId: string,
  itens: NovoItemEnviado[]
): Promise<{ ids: string[]; total: number }> {
  const { data, error } = await supabase.rpc('adicionar_itens_pedido_compra', {
    p_pedido: pedidoId,
    p_itens: itens,
  })
  if (error) throw traduz(error)

  const r = data as { itens: { item_id: string }[]; total: number | string }
  return { ids: r.itens.map((i) => i.item_id), total: Number(r.total) }
}

export async function definirPrecosVenda(pedidoId: string, precos: PrecoVendaEnviado[]) {
  if (precos.length === 0) return
  const { error } = await supabase.rpc('definir_precos_venda_pedido', {
    p_pedido: pedidoId,
    p_precos: precos,
  })
  if (error) throw traduz(error)
}