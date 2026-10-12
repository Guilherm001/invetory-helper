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
  pin: string // a senha do vendedor: o banco descobre quem é
}

export interface VendaCriada {
  id: string
  numero: number
  total: number
  documento: Documento
  validade: string | null
  vendedor_nome: string
}

// senha errada, bloqueio ou senha repetida: a mensagem já vem pronta do banco
export class ErroSenha extends Error {}

function traduz(message: string) {
  const m = message.toLowerCase()
  if (m.includes('entrega_exige_endereco')) return 'Informe o endereço de entrega.'
  if (m.includes('sem permissão')) return 'Você não tem permissão para registrar vendas.'
  if (m.includes('could not find the function'))
    return 'A função de vendas ainda não foi criada no banco. Rode o SQL de vendas.'
  return message
}

// o banco responde { ok: false, erro } quando a senha não confere
function conferir(data: unknown): VendaCriada {
  const r = data as ({ ok?: boolean; erro?: string } & Partial<VendaCriada>) | null
  if (!r || r.ok !== true) throw new ErroSenha(r?.erro || 'Não foi possível confirmar a senha.')
  return r as VendaCriada
}

export async function criarVenda(venda: DadosVenda, itens: ItemVenda[]): Promise<VendaCriada> {
  const { data, error } = await supabase.rpc('criar_venda', {
    p_venda: venda,
    p_itens: itens,
  })
  if (error) throw new Error(traduz(error.message))
  return conferir(data)
}

export async function editarOrcamento(
  id: string,
  venda: DadosVenda,
  itens: ItemVenda[]
): Promise<VendaCriada> {
  const { data, error } = await supabase.rpc('editar_orcamento', {
    p_id: id,
    p_venda: venda,
    p_itens: itens,
  })
  if (error) throw new Error(traduz(error.message))
  return conferir(data)
}