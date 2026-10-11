import { supabase } from '@/lib/supabase'
import type { Documento } from './documentosService'

export type TipoEntrega = 'retirada' | 'entrega'

export interface ItemVenda {
  codigo: string
  nome: string
  unidade: string | null
  quantidade: number
  preco: number
  observacao: string
}

export interface DadosVenda {
  documento: Documento
  validade_dias?: number
  cliente_nome: string
  cliente_telefone: string
  tipo: TipoEntrega
  endereco: string
  bairro: string
  cidade: string
  complemento: string
  pagamento: string
  observacao: string
}

export interface VendaCriada {
  id: string
  numero: number
  total: number
  documento: Documento
  validade: string | null
}

function traduz(message: string) {
  const m = message.toLowerCase()
  if (m.includes('entrega_exige_endereco')) return 'Informe o endereço de entrega.'
  if (m.includes('sem permissão')) return 'Você não tem permissão para registrar vendas.'
  if (m.includes('could not find the function'))
    return 'A função de vendas ainda não foi criada no banco. Rode o SQL de vendas.'
  return message
}

export async function criarVenda(
  venda: DadosVenda,
  itens: ItemVenda[]
): Promise<VendaCriada> {
  const { data, error } = await supabase.rpc('criar_venda', {
    p_venda: venda,
    p_itens: itens,
  })
  if (error) throw new Error(traduz(error.message))
  return data as VendaCriada
}