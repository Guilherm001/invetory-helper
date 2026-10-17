import { supabase } from '@/lib/supabase'

const num = (v: unknown) => Number(v ?? 0)

function traduz(message: string) {
  if (message.toLowerCase().includes('could not find the function'))
    return 'A ficha do cliente ainda não foi criada no banco. Rode o SQL da ficha do cliente.'
  return message
}

async function rpc<T>(nome: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(nome, args)
  if (error) throw new Error(traduz(error.message))
  return data as T
}

// ---------- financeiro ----------

export interface ConfigPendencia {
  permitida: boolean
  dias: number
  limite: number
}

export interface Saldos {
  credito: number
  devendo: number
  vencido: number
  proximo_vencimento: string | null
}

export interface MovCredito {
  id: string
  tipo: 'devolucao' | 'manual_credito' | 'manual_debito' | 'uso'
  valor: number // + entra, - sai
  motivo: string | null
  feito_por: string
  venda_numero: number | null
  estornado: boolean
  criado_em: string
}

export interface MovPendencia {
  id: string
  tipo: 'venda' | 'pagamento'
  valor: number
  vencimento: string | null
  forma: string | null
  feito_por: string
  venda_numero: number | null
  estornado: boolean
  criado_em: string
}

export interface FichaFinanceira {
  config: ConfigPendencia
  saldos: Saldos
  credito: MovCredito[]
  pendencia: MovPendencia[]
}

export async function fichaFinanceira(id: string): Promise<FichaFinanceira> {
  const r = await rpc<FichaFinanceira>('cliente_financeiro', { p_cliente: id })
  return {
    config: {
      permitida: !!r.config.permitida,
      dias: num(r.config.dias),
      limite: num(r.config.limite),
    },
    saldos: {
      credito: num(r.saldos.credito),
      devendo: num(r.saldos.devendo),
      vencido: num(r.saldos.vencido),
      proximo_vencimento: r.saldos.proximo_vencimento ?? null,
    },
    credito: r.credito.map((m) => ({ ...m, valor: num(m.valor) })),
    pendencia: r.pendencia.map((m) => ({ ...m, valor: num(m.valor) })),
  }
}

export async function salvarConfig(id: string, cfg: ConfigPendencia) {
  await rpc('cliente_config_salvar', {
    p_cliente: id,
    p_permitida: cfg.permitida,
    p_dias: cfg.dias,
    p_limite: cfg.limite,
  })
}

export async function ajustarCredito(
  id: string,
  tipo: 'credito' | 'debito',
  valor: number,
  motivo: string
) {
  await rpc('cliente_credito_ajustar', {
    p_cliente: id,
    p_tipo: tipo,
    p_valor: valor,
    p_motivo: motivo,
  })
}

// ---------- pedidos do cliente ----------

export interface PedidoCliente {
  id: string
  numero: number
  documento: 'pedido' | 'orcamento'
  status: 'aberta' | 'entregue' | 'cancelada'
  tipo: 'retirada' | 'entrega'
  total: number
  desconto: number
  total_liquido: number | null
  pagamento: string | null
  vendedor_nome: string | null
  criado_em: string
  fechado_em: string | null
}

export const TAMANHO_PEDIDOS = 20

export async function pedidosDoCliente(
  id: string,
  tipo: 'todos' | 'pedido' | 'orcamento',
  pagina: number
): Promise<{ itens: PedidoCliente[]; total: number }> {
  const r = await rpc<{ total: number; itens: PedidoCliente[] }>('cliente_pedidos', {
    p_cliente: id,
    p_tipo: tipo,
    p_limite: TAMANHO_PEDIDOS,
    p_offset: pagina * TAMANHO_PEDIDOS,
  })
  return {
    total: num(r.total),
    itens: r.itens.map((p) => ({
      ...p,
      total: num(p.total),
      desconto: num(p.desconto),
      total_liquido: p.total_liquido === null ? null : num(p.total_liquido),
    })),
  }
}

export interface DetalhePedido {
  doc: {
    id: string
    numero: number
    documento: 'pedido' | 'orcamento'
    status: 'aberta' | 'entregue' | 'cancelada'
    tipo: 'retirada' | 'entrega'
    cliente_nome: string | null
    cliente_telefone: string | null
    endereco: string | null
    bairro: string | null
    cidade: string | null
    complemento: string | null
    pagamento: string | null
    observacao: string | null
    total: number
    desconto: number
    desconto_percentual: number | null
    total_liquido: number | null
    vendedor_nome: string | null
    validade: string | null
    orcamento_numero: number | null
    orcamento_vendedor: string | null
    editado_por: string | null
    editado_em: string | null
    fechado_em: string | null
    fechado_por: string | null
    fiscal_status: string
    criado_em: string
  }
  itens: {
    id: string
    produto_codigo: string | null
    produto_nome: string
    unidade: string | null
    quantidade: number
    preco_unitario: number
    subtotal: number
    observacao: string | null
  }[]
  pagamentos: {
    forma: string
    valor: number
    recebido: number | null
    troco: number
    parcelas: number | null
    estornado: boolean
  }[]
}

export async function detalhePedidoCliente(vendaId: string): Promise<DetalhePedido> {
  const r = await rpc<DetalhePedido>('cliente_pedido_detalhe', { p_venda: vendaId })
  return {
    doc: {
      ...r.doc,
      total: num(r.doc.total),
      desconto: num(r.doc.desconto),
      total_liquido: r.doc.total_liquido === null ? null : num(r.doc.total_liquido),
    },
    itens: r.itens.map((i) => ({
      ...i,
      quantidade: num(i.quantidade),
      preco_unitario: num(i.preco_unitario),
      subtotal: num(i.subtotal),
    })),
    pagamentos: r.pagamentos.map((p) => ({
      ...p,
      valor: num(p.valor),
      recebido: p.recebido === null ? null : num(p.recebido),
      troco: num(p.troco),
    })),
  }
}

// ---------- endereços extras ----------

export interface EnderecoCliente {
  id: string
  cliente_id: string
  apelido: string
  cep: string | null
  logradouro: string
  numero: string
  complemento: string | null
  bairro: string
  municipio: string
  uf: string
  cod_municipio: string | null
  observacao: string | null
  ativo: boolean
  criado_em: string
}

export type DadosEndereco = Omit<EnderecoCliente, 'id' | 'cliente_id' | 'criado_em' | 'ativo'>

const COL_END =
  'id, cliente_id, apelido, cep, logradouro, numero, complemento, bairro, municipio, uf, cod_municipio, observacao, ativo, criado_em'

function erroEndereco(e: { message: string; code?: string }) {
  if (e.message.toLowerCase().includes('row-level security'))
    return new Error('Só o dono pode alterar os endereços.')
  if (e.message.toLowerCase().includes('does not exist'))
    return new Error('Os endereços ainda não foram criados no banco. Rode o SQL da ficha do cliente.')
  if (e.code === '23514') return new Error('Algum campo do endereço está em formato inválido.')
  return new Error(e.message)
}

export async function listarEnderecos(clienteId: string): Promise<EnderecoCliente[]> {
  const { data, error } = await supabase
    .from('cliente_enderecos')
    .select(COL_END)
    .eq('cliente_id', clienteId)
    .order('ativo', { ascending: false })
    .order('criado_em')
  if (error) throw erroEndereco(error)
  return (data ?? []) as unknown as EnderecoCliente[]
}

export async function criarEndereco(clienteId: string, d: DadosEndereco) {
  const { error } = await supabase.from('cliente_enderecos').insert({ ...d, cliente_id: clienteId })
  if (error) throw erroEndereco(error)
}

export async function atualizarEndereco(id: string, d: DadosEndereco) {
  const { data, error } = await supabase.from('cliente_enderecos').update(d).eq('id', id).select('id')
  if (error) throw erroEndereco(error)
  if (!data || data.length === 0) throw new Error('Só o dono pode alterar os endereços.')
}

export async function alternarEnderecoAtivo(id: string, ativo: boolean) {
  const { data, error } = await supabase
    .from('cliente_enderecos')
    .update({ ativo })
    .eq('id', id)
    .select('id')
  if (error) throw erroEndereco(error)
  if (!data || data.length === 0) throw new Error('Só o dono pode alterar os endereços.')
}

export async function excluirEndereco(id: string) {
  const { data, error } = await supabase.from('cliente_enderecos').delete().eq('id', id).select('id')
  if (error) throw erroEndereco(error)
  if (!data || data.length === 0) throw new Error('Só o dono pode excluir endereços.')
}