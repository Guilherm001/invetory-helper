import { supabase } from '@/lib/supabase'
import { hoje } from '../lib/formatar'
import { ErroSenha } from './vendedorService'


export type Documento = 'pedido' | 'orcamento'
export type StatusDocumento = 'aberta' | 'entregue' | 'cancelada'
export type FiltroDocumento = 'todos' | 'aberta' | 'vencido' | 'entregue' | 'cancelada'

export interface DocumentoResumo {
  id: string
  numero: number
  documento: Documento
  status: StatusDocumento
  cliente_nome: string | null
  cliente_telefone: string | null
  tipo: 'retirada' | 'entrega'
  endereco: string | null
  bairro: string | null
  cidade: string | null
  complemento: string | null
  pagamento: string | null
  observacao: string | null
  total: number
  vendedor_nome: string | null
  validade: string | null
  orcamento_numero: number | null
  orcamento_em: string | null
    orcamento_vendedor: string | null
  editado_por: string | null
  editado_em: string | null
  criado_em: string
  cliente_id: string | null
}

export interface ItemDocumento {
  id: string
  produto_codigo: string | null
  produto_nome: string
  unidade: string | null
  quantidade: number
  preco_unitario: number
  subtotal: number
  observacao: string | null
}

export const TAMANHO_PAGINA = 20

const COLUNAS =
  'id, numero, documento, status, cliente_nome, cliente_telefone, tipo, endereco, bairro, cidade, complemento, pagamento, observacao, total, vendedor_nome, validade, orcamento_numero, orcamento_em, criado_em, orcamento_vendedor, editado_por, editado_em, cliente_id'

function traduz(message: string) {
  const m = message.toLowerCase()
  if (m.includes('could not find the function'))
    return 'As funções de pedidos ainda não existem no banco. Rode o SQL de orçamentos.'
  if (m.includes('senha_invalida')) return 'Senha incorreta.'
  if (m.includes('muitas_tentativas'))
    return 'Muitas tentativas erradas. Aguarde alguns minutos e tente de novo.'
  if (m.includes('senha_duplicada'))
    return 'Essa senha está repetida entre vendedores. Peça ao dono para trocar uma delas.'
  if (m.includes('sem_vendedor')) return 'Nenhum vendedor cadastrado. Cadastre em Equipe.'
  return message
}

export async function listarDocumentos(opts: {
  documento: Documento
  filtro: FiltroDocumento
  termo: string
  pagina: number
}): Promise<{ itens: DocumentoResumo[]; total: number }> {
  let q = supabase
    .from('vendas')
    .select(COLUNAS, { count: 'exact' })
    .eq('documento', opts.documento)

  if (opts.filtro === 'vencido') {
    q = q.eq('status', 'aberta').lt('validade', hoje())
  } else if (opts.filtro === 'aberta') {
    q = q.eq('status', 'aberta')
    if (opts.documento === 'orcamento') q = q.gte('validade', hoje())
  } else if (opts.filtro !== 'todos') {
    q = q.eq('status', opts.filtro)
  }

  // vírgula, %, parênteses e * quebram o filtro .or()
  const t = opts.termo.trim().replace(/[%,()*]/g, ' ').trim()
  if (t) {
    const partes = [`cliente_nome.ilike.%${t}%`, `cliente_telefone.ilike.%${t}%`]
    if (/^\d{1,9}$/.test(t)) partes.push(`numero.eq.${t}`)
    q = q.or(partes.join(','))
  }

  const de = opts.pagina * TAMANHO_PAGINA
  const { data, error, count } = await q
    .order('criado_em', { ascending: false })
    .order('id')
    .range(de, de + TAMANHO_PAGINA - 1)

  if (error) throw new Error(traduz(error.message))

  return {
    itens: (data ?? []).map((r) => ({ ...r, total: Number(r.total) })) as DocumentoResumo[],
    total: count ?? 0,
  }
}

export async function listarItensDocumento(vendaId: string): Promise<ItemDocumento[]> {
  const { data, error } = await supabase
    .from('venda_itens')
    .select('id, produto_codigo, produto_nome, unidade, quantidade, preco_unitario, subtotal, observacao')
    .eq('venda_id', vendaId)
    .order('ordem')
    .order('produto_nome')

  if (error) throw new Error(traduz(error.message))

  return (data ?? []).map((r) => ({
    ...r,
    quantidade: Number(r.quantidade),
    preco_unitario: Number(r.preco_unitario),
    subtotal: Number(r.subtotal),
  })) as ItemDocumento[]
}

export async function alterarStatus(id: string, status: StatusDocumento) {
  const { error } = await supabase.rpc('alterar_status_venda', {
    p_id: id,
    p_status: status,
  })
  if (error) throw new Error(traduz(error.message))
}

export async function converterOrcamento(id: string, pin: string): Promise<{ numero: number }> {
  const { data, error } = await supabase.rpc('converter_orcamento', {
    p_id: id,
    p_pin: pin,
  })
  if (error) throw new Error(traduz(error.message))

  const r = data as { ok?: boolean; erro?: string; numero?: number } | null
  if (!r || r.ok !== true) throw new Error(r?.erro || 'Não foi possível confirmar a senha.')
  return { numero: Number(r.numero) }
}
export async function buscarDocumento(id: string): Promise<DocumentoResumo> {
  const { data, error } = await supabase
    .from('vendas')
    .select(COLUNAS)
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(traduz(error.message))
  if (!data) throw new Error('Documento não encontrado.')
  return { ...data, total: Number(data.total) } as unknown as DocumentoResumo
}

export async function carregarDocumentoCompleto(id: string) {
  const [doc, itens] = await Promise.all([buscarDocumento(id), listarItensDocumento(id)])
  return { doc, itens }
}
