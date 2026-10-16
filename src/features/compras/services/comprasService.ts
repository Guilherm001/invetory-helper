import { supabase } from '@/lib/supabase'
import { hoje } from '@/features/loja/lib/formatar'
import { ErroSenha } from '@/features/loja/services/vendedorService'
import type { PedidoSugerido } from '@/features/comparar-precos/utils/melhorPreco'
import type { Cotacao } from '@/features/historico-precos/types'
import { numeroPedido, somarDias } from '../lib/compras'

export type StatusCompra = 'rascunho' | 'enviado' | 'confirmado' | 'recebido' | 'cancelado'
export type FiltroCompra =
  | 'todos'
  | 'rascunho'
  | 'andamento'
  | 'atrasado'
  | 'recebido'
  | 'cancelado'

export interface PedidoCompra {
  id: string
  numero: number
  status: StatusCompra
  recebido_parcial: boolean
  fornecedor_ref: string | null
  fornecedor_nome: string
  fornecedor_contato: string | null
  prazo_dias: number | null
  comparacao_ref: string | null
  comparacao_nome: string | null
  condicao_pagamento: string | null
  previsao_entrega: string | null
  frete: number
  desconto: number
  observacao: string | null
  total: number
  criado_por_nome: string | null
  criado_em: string
  enviado_em: string | null
  confirmado_em: string | null
  recebido_em: string | null
  cancelado_em: string | null
}

export interface ItemPedidoCompra {
  id: string
  produto_codigo: string | null
  produto_nome: string
  unidade: string | null
  quantidade: number
  quantidade_recebida: number
  preco_unitario: number
  subtotal: number
  observacao: string | null
}

// dados do cabeçalho que o formulário envia
export interface DadosPedidoCompra {
  fornecedor_ref: string | null
  fornecedor_nome: string
  fornecedor_contato: string | null
  prazo_dias: number | null
  comparacao_ref: string | null
  comparacao_nome: string | null
  condicao_pagamento: string | null
  previsao_entrega: string | null
  frete: number
  desconto: number
  observacao: string | null
}

export interface ItemEntrada {
  codigo: string
  nome: string
  unidade: string | null
  quantidade: number
  preco: number
  observacao: string
}

export interface PedidoDaComparacao {
  id: string
  numero: number
  status: StatusCompra
  fornecedor_ref: string | null
}

export interface UltimoPreco {
  preco: number
  criado_em: string
  fornecedor: string
}

export interface ResumoCompras {
  rascunhos: { n: number; total: number }
  andamento: { n: number; total: number }
  atrasados: { n: number; total: number }
}

// ---------- recebimento (nada aqui tem preço) ----------

export interface PedidoAReceber {
  id: string
  numero: number
  fornecedor_nome: string
  previsao_entrega: string | null
  status: StatusCompra
  recebido_parcial: boolean
  itens: number
  criado_em: string
}

export interface ItemAReceber {
  id: string
  produto_codigo: string | null
  produto_nome: string
  unidade: string | null
  quantidade: number
  quantidade_recebida: number
  observacao: string | null
}

export interface Recebimento {
  id: string
  recebido_em: string
  recebido_por_nome: string | null
  observacao: string | null
  deu_entrada: boolean
  encerrou: boolean
  itens: { item_id: string; quantidade: number }[]
}

export interface ResultadoRecebimento {
  numero: number
  status: StatusCompra
  completo: boolean
  encerrou: boolean
  sem_estoque: string[]
  recebido_por: string
}

export const TAMANHO_PAGINA = 20

const COLUNAS =
  'id, numero, status, recebido_parcial, fornecedor_ref, fornecedor_nome, fornecedor_contato, prazo_dias, comparacao_ref, comparacao_nome, condicao_pagamento, previsao_entrega, frete, desconto, observacao, total, criado_por_nome, criado_em, enviado_em, confirmado_em, recebido_em, cancelado_em'

const COL_ITEM =
  'id, produto_codigo, produto_nome, unidade, quantidade, quantidade_recebida, preco_unitario, subtotal, observacao'

function traduz(error: { message: string; code?: string }) {
  const m = error.message.toLowerCase()

  if (error.code === '23505' || m.includes('pedidos_compra_comparacao_unico'))
    return new Error('Já existe um pedido ativo para esse fornecedor nesta comparação.')
  if (m.includes('could not find the function') || error.code === '42P01' || m.includes('does not exist'))
    return new Error(
      'O módulo de pedidos de compra ainda não foi atualizado no banco. Rode o SQL de recebimento.'
    )
  if (m.includes('violates check constraint'))
    return new Error('Algum campo está fora do permitido (nome, quantidade, preço ou valores negativos).')
  return new Error(error.message)
}

const num = (v: unknown) => Number(v ?? 0)

function normalizarPedido(r: unknown): PedidoCompra {
  const p = r as Record<string, unknown>
  return {
    ...(p as unknown as PedidoCompra),
    recebido_parcial: !!p.recebido_parcial,
    frete: num(p.frete),
    desconto: num(p.desconto),
    total: num(p.total),
  }
}

function normalizarItem(r: unknown): ItemPedidoCompra {
  const i = r as Record<string, unknown>
  return {
    ...(i as unknown as ItemPedidoCompra),
    quantidade: num(i.quantidade),
    quantidade_recebida: num(i.quantidade_recebida),
    preco_unitario: num(i.preco_unitario),
    subtotal: num(i.subtotal),
  }
}

// ---------- leitura ----------

export async function listarPedidos(opts: {
  filtro: FiltroCompra
  termo: string
  pagina: number
}): Promise<{ itens: PedidoCompra[]; total: number }> {
  let q = supabase.from('pedidos_compra').select(COLUNAS, { count: 'exact' })

  switch (opts.filtro) {
    case 'rascunho':
      q = q.eq('status', 'rascunho')
      break
    case 'andamento':
      q = q.in('status', ['enviado', 'confirmado'])
      break
    case 'atrasado':
      q = q.in('status', ['enviado', 'confirmado']).lt('previsao_entrega', hoje())
      break
    case 'recebido':
      q = q.eq('status', 'recebido')
      break
    case 'cancelado':
      q = q.eq('status', 'cancelado')
      break
  }

  // vírgula, %, parênteses, aspas e * quebram o filtro .or()
  const t = opts.termo.trim().replace(/[%,()*"\\]/g, ' ').trim()
  if (t) {
    const partes = [`fornecedor_nome.ilike.%${t}%`]
    const digitos = t.replace(/^pc[-\s]*/i, '')
    if (/^\d{1,9}$/.test(digitos)) partes.push(`numero.eq.${Number(digitos)}`)
    q = q.or(partes.join(','))
  }

  const de = opts.pagina * TAMANHO_PAGINA
  const { data, error, count } = await q
    .order('criado_em', { ascending: false })
    .order('id')
    .range(de, de + TAMANHO_PAGINA - 1)

  if (error) throw traduz(error)

  return { itens: (data ?? []).map(normalizarPedido), total: count ?? 0 }
}

export async function resumoPedidos(): Promise<ResumoCompras> {
  const { data, error } = await supabase
    .from('pedidos_compra')
    .select('status, total, previsao_entrega')
    .in('status', ['rascunho', 'enviado', 'confirmado'])

  if (error) throw traduz(error)

  const h = hoje()
  const r: ResumoCompras = {
    rascunhos: { n: 0, total: 0 },
    andamento: { n: 0, total: 0 },
    atrasados: { n: 0, total: 0 },
  }

  for (const p of data ?? []) {
    const total = num(p.total)
    if (p.status === 'rascunho') {
      r.rascunhos.n++
      r.rascunhos.total += total
      continue
    }
    r.andamento.n++
    r.andamento.total += total
    if (p.previsao_entrega && p.previsao_entrega < h) {
      r.atrasados.n++
      r.atrasados.total += total
    }
  }
  return r
}

export async function obterPedido(
  id: string
): Promise<{ pedido: PedidoCompra; itens: ItemPedidoCompra[] } | null> {
  const [p, i] = await Promise.all([
    supabase.from('pedidos_compra').select(COLUNAS).eq('id', id).maybeSingle(),
    supabase.from('pedido_compra_itens').select(COL_ITEM).eq('pedido_id', id).order('ordem'),
  ])

  if (p.error) throw traduz(p.error)
  if (i.error) throw traduz(i.error)
  if (!p.data) return null

  return { pedido: normalizarPedido(p.data), itens: (i.data ?? []).map(normalizarItem) }
}

export async function pedidosDaComparacao(comparacaoRef: string): Promise<PedidoDaComparacao[]> {
  const { data, error } = await supabase
    .from('pedidos_compra')
    .select('id, numero, status, fornecedor_ref')
    .eq('comparacao_ref', comparacaoRef)
    .neq('status', 'cancelado')

  if (error) throw traduz(error)
  return (data ?? []) as PedidoDaComparacao[]
}

export async function nomeDaEmpresa(): Promise<string> {
  const { data } = await supabase.from('empresas').select('nome').maybeSingle()
  return (data?.nome as string | undefined) ?? ''
}

// ---------- escrita ----------

export async function criarPedidos(
  lote: { dados: DadosPedidoCompra; itens: ItemEntrada[] }[]
): Promise<{ id: string; numero: number; fornecedor_nome: string }[]> {
  const { data, error } = await supabase.rpc('criar_pedidos_compra', {
    p_lote: lote.map((l) => ({ pedido: l.dados, itens: l.itens })),
  })
  if (error) throw traduz(error)
  return data as { id: string; numero: number; fornecedor_nome: string }[]
}

export async function editarPedido(
  id: string,
  dados: DadosPedidoCompra,
  itens: ItemEntrada[]
): Promise<{ id: string; numero: number }> {
  const { data, error } = await supabase.rpc('editar_pedido_compra', {
    p_id: id,
    p_pedido: dados,
    p_itens: itens,
  })
  if (error) throw traduz(error)
  return data as { id: string; numero: number }
}

export async function alterarStatus(id: string, status: StatusCompra) {
  const { error } = await supabase.rpc('alterar_status_pedido_compra', {
    p_id: id,
    p_status: status,
  })
  if (error) throw traduz(error)
}

export async function excluirPedido(id: string) {
  const { error } = await supabase.rpc('excluir_pedido_compra', { p_id: id })
  if (error) throw traduz(error)
}

// ---------- recebimento ----------

export async function listarPedidosAReceber(): Promise<PedidoAReceber[]> {
  const { data, error } = await supabase.rpc('pedidos_a_receber')
  if (error) throw traduz(error)
  return ((data ?? []) as PedidoAReceber[]).map((p) => ({
    ...p,
    recebido_parcial: !!p.recebido_parcial,
    itens: Number(p.itens),
  }))
}

export async function itensAReceber(pedidoId: string): Promise<ItemAReceber[]> {
  const { data, error } = await supabase.rpc('itens_a_receber', { p_id: pedidoId })
  if (error) throw traduz(error)
  return ((data ?? []) as ItemAReceber[]).map((i) => ({
    ...i,
    quantidade: num(i.quantidade),
    quantidade_recebida: num(i.quantidade_recebida),
  }))
}

export async function receberPedido(opts: {
  pedidoId: string
  itens: { item_id: string; quantidade: number }[]
  estoque: boolean
  encerrar: boolean
  observacao: string
  vendedorId: string | null // só o balcão: quem está recebendo
  pin: string | null
}): Promise<ResultadoRecebimento> {
  const { data, error } = await supabase.rpc('receber_pedido_compra', {
    p_id: opts.pedidoId,
    p_itens: opts.itens,
    p_estoque: opts.estoque,
    p_encerrar: opts.encerrar,
    p_obs: opts.observacao,
    p_vendedor: opts.vendedorId,
    p_pin: opts.pin,
  })
  if (error) throw traduz(error)

  // senha errada volta como resposta (e não como erro) para o contador de tentativas valer
  const r = data as ({ ok: true } & ResultadoRecebimento) | { ok: false; erro: string }
  if (!r.ok) throw new ErroSenha(r.erro)
  return r
}

export async function listarRecebimentos(pedidoId: string): Promise<Recebimento[]> {
  const { data, error } = await supabase
    .from('pedido_compra_recebimentos')
    .select(
      'id, recebido_em, recebido_por_nome, observacao, deu_entrada, encerrou, itens:pedido_compra_recebimento_itens(item_id, quantidade)'
    )
    .eq('pedido_id', pedidoId)
    .order('recebido_em')

  if (error) throw traduz(error)

  return ((data ?? []) as unknown as Recebimento[]).map((r) => ({
    ...r,
    itens: (r.itens ?? []).map((i) => ({ item_id: i.item_id, quantidade: num(i.quantidade) })),
  }))
}

// ---------- alerta de variação de preço ----------

interface LinhaUltimoPreco {
  chave: string
  preco: number | string
  criado_em: string
  fornecedor: string
}

export async function ultimosPrecos(
  chaves: string[],
  excluirId?: string
): Promise<Map<string, UltimoPreco>> {
  if (chaves.length === 0) return new Map()

  const { data, error } = await supabase.rpc('ultimos_precos_compra', {
    p_chaves: chaves,
    p_excluir: excluirId ?? null,
  })
  if (error) throw traduz(error)

  return new Map(
    ((data ?? []) as LinhaUltimoPreco[]).map((r) => [
      r.chave,
      { preco: Number(r.preco), criado_em: r.criado_em, fornecedor: r.fornecedor },
    ])
  )
}

// ---------- preços pagos, no formato do Histórico de preços ----------

interface LinhaCompraPaga {
  produto_codigo: string | null
  produto_nome: string
  unidade: string | null
  preco_unitario: number | string
  pedidos_compra: {
    id: string
    numero: number
    fornecedor_ref: string | null
    fornecedor_nome: string
    comparacao_ref: string | null
    comparacao_nome: string | null
    recebido_em: string | null
    criado_em: string
  } | null
}

// itens de pedidos recebidos viram "cotações". Se o pedido veio de uma comparação, entra na
// mesma rodada dela; se foi um pedido direto, vira uma rodada própria.
export async function comprasComoCotacoes(): Promise<Cotacao[]> {
  const { data, error } = await supabase
    .from('pedido_compra_itens')
    .select(
      'produto_codigo, produto_nome, unidade, preco_unitario, pedidos_compra!inner(id, numero, fornecedor_ref, fornecedor_nome, comparacao_ref, comparacao_nome, recebido_em, criado_em)'
    )
    .eq('pedidos_compra.status', 'recebido')

  if (error) throw traduz(error)

  return ((data ?? []) as unknown as LinhaCompraPaga[])
    .filter((r) => r.pedidos_compra)
    .map((r) => {
      const p = r.pedidos_compra!
      return {
        codigo: r.produto_codigo,
        itemNome: r.produto_nome,
        unidade: r.unidade,
        preco: Number(r.preco_unitario),
        data: p.recebido_em ?? p.criado_em,
        comparacaoId: p.comparacao_ref ?? `pc:${p.id}`,
        comparacaoNome: p.comparacao_nome ?? `Pedido ${numeroPedido(p.numero)}`,
        fornecedorId: p.fornecedor_ref ?? `nome:${p.fornecedor_nome}`,
        fornecedorNome: p.fornecedor_nome,
      } as Cotacao
    })
}

// ---------- vindo do Comparar preços ----------

export function pedidoDeSugestao(
  p: PedidoSugerido,
  comparacao: { id: string; nome: string }
): { dados: DadosPedidoCompra; itens: ItemEntrada[] } {
  const prazo = p.fornecedor.lead_time_days

  return {
    dados: {
      fornecedor_ref: p.fornecedor.id,
      fornecedor_nome: p.fornecedor.name,
      fornecedor_contato: p.fornecedor.contact,
      prazo_dias: prazo,
      comparacao_ref: comparacao.id,
      comparacao_nome: comparacao.nome || null,
      condicao_pagamento: null,
      previsao_entrega: prazo != null ? somarDias(hoje(), prazo) : null,
      frete: 0,
      desconto: 0,
      observacao: null,
    },
    itens: p.itens.map(({ item, preco }) => ({
      codigo: item.catalog_code ?? '',
      nome: item.name,
      unidade: item.unit,
      quantidade: item.quantity,
      preco,
      observacao: '',
    })),
  }
}