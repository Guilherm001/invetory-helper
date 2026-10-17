import { supabase } from '@/lib/supabase'
import type { Documento } from './documentosService'
import { ErroSenha } from './vendedorService'

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
  // orçamento: dias de validade a partir de hoje (na edição, null mantém a validade atual)
  validade_dias?: number | null
  // opcional: se vier, a senha é conferida só contra esse vendedor; sem ele, a senha identifica o vendedor
  vendedor_id?: string
  pin: string
  cliente_id: string | null // cliente cadastrado (opcional)
  cliente_nome: string
  cliente_telefone: string
  tipo: TipoEntrega
  endereco: string
  bairro: string
  cidade: string
  complemento: string
  pagamento: string
  observacao: string
  desconto?: number // valor em reais abatido do total (0 = sem desconto)
}

export interface VendaCriada {
  id: string
  numero: number
  total: number
  documento: Documento
  validade: string | null
  vendedor_nome: string | null
    desconto?: number
  total_liquido?: number
}

type Resposta = ({ ok: true } & VendaCriada) | { ok: false; erro: string }

function traduz(message: string) {
  const m = message.toLowerCase()
  if (m.includes('entrega_exige_endereco')) return 'Informe o endereço de entrega.'
  if (m.includes('cliente não encontrado')) return 'O cliente escolhido não foi encontrado. Escolha outro.'
  if (m.includes('sem permissão')) return 'Você não tem permissão para fazer isso.'
  if (m.includes('could not find the function'))
    return 'As funções de vendas ainda não foram atualizadas no banco. Rode o SQL de clientes.'
  return message
}

// senha errada volta como resposta (e não como erro do banco) para o contador de tentativas valer
function resultado(data: unknown): VendaCriada {
  const r = data as Resposta
  if (!r.ok) throw new ErroSenha(r.erro)
  return r
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
  return resultado(data)
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
  return resultado(data)
}