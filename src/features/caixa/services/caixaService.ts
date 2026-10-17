import { supabase } from '@/lib/supabase'
import type { DocumentoResumo, ItemDocumento } from '@/features/loja/services/documentosService'
import type {
  ClienteInfo,
  EstadoCaixa,
  PedidoAberto,
  Relatorio,
  ResultadoFechamento,
  SessaoResumo,
  VendedorCaixa,
} from '../types'
import type { Forma, TipoDesconto } from '../lib/calculos'

// senha errada ou regra do caixa: a mensagem já vem pronta do banco
export class ErroCaixa extends Error {}

function traduz(message: string) {
  if (message.toLowerCase().includes('could not find the function'))
    return 'O caixa ainda não foi atualizado no banco. Rode o SQL do caixa (parte 2).'
  return message
}

async function rpc<T>(nome: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(nome, args)
  if (error) throw new Error(traduz(error.message))
  return data as T
}

function exigirOk<T extends { ok?: boolean; erro?: string }>(r: T | null): T {
  if (!r || r.ok !== true) throw new ErroCaixa(r?.erro || 'Não foi possível concluir.')
  return r
}

// relatórios de turnos antigos não têm estes campos
function normalizar(r: Relatorio): Relatorio {
  return {
    ...r,
    pendencias_recebidas: r.pendencias_recebidas ?? { total: 0, formas: {} },
    devolucoes: r.devolucoes ?? { quantidade: 0, total: 0 },
  }
}

export async function estadoCaixa(): Promise<EstadoCaixa> {
  const e = await rpc<EstadoCaixa>('caixa_estado')
  return e.aberto ? { ...e, resumo: normalizar(e.resumo) } : e
}

export async function abrirCaixa(pin: string, troco: number) {
  exigirOk(await rpc<{ ok?: boolean; erro?: string }>('caixa_abrir', { p_pin: pin, p_troco: troco }))
}

export async function pedidosAbertos(): Promise<PedidoAberto[]> {
  const lista = await rpc<PedidoAberto[] | null>('caixa_pedidos_abertos')
  return (lista ?? []).map((p) => ({ ...p, total: Number(p.total), itens: Number(p.itens) }))
}

// o pedido com os itens, no formato que as telas de impressão já conhecem
export async function pedidoDoCaixa(id: string) {
  const r = await rpc<{ doc: Record<string, unknown>; itens: Record<string, unknown>[] }>(
    'caixa_pedido',
    { p_id: id }
  )
  const doc = {
    ...r.doc,
    total: Number(r.doc.total),
    desconto: Number(r.doc.desconto ?? 0),
  } as unknown as DocumentoResumo
  const itens = r.itens.map((i) => ({
    ...i,
    quantidade: Number(i.quantidade),
    preco_unitario: Number(i.preco_unitario),
    subtotal: Number(i.subtotal),
  })) as unknown as ItemDocumento[]
  return { doc, itens }
}

export async function clienteInfo(id: string): Promise<ClienteInfo> {
  const r = await rpc<ClienteInfo>('caixa_cliente_info', { p_cliente: id })
  return {
    ...r,
    ativo: r.ativo !== false,
    credito: Number(r.credito),
    devendo: Number(r.devendo),
    vencido: Number(r.vencido),
    pendencia: {
      permitida: !!r.pendencia.permitida,
      dias: Number(r.pendencia.dias),
      limite: Number(r.pendencia.limite),
    },
  }
}

export interface PagamentoEnvio {
  forma: Forma
  valor: number
  recebido: number | null
  parcelas: number | null
}

export async function fecharPedido(
  id: string,
  total: number,
  desconto: { tipo: TipoDesconto; valor: number },
  pagamentos: PagamentoEnvio[],
  clienteId: string | null
): Promise<ResultadoFechamento> {
  const r = exigirOk(
    await rpc<{
      ok?: boolean
      erro?: string
      numero: number
      total_liquido: number
      desconto: number
      troco: number
      a_prazo: number
      vencimento: string | null
      credito_usado: number
    }>('caixa_fechar_pedido', {
      p_id: id,
      p_total: total,
      p_desconto: desconto,
      p_pagamentos: pagamentos,
      p_cliente: clienteId,
    })
  )
  return {
    id,
    numero: Number(r.numero),
    total_liquido: Number(r.total_liquido),
    desconto: Number(r.desconto),
    troco: Number(r.troco),
    a_prazo: Number(r.a_prazo ?? 0),
    vencimento: r.vencimento ?? null,
    credito_usado: Number(r.credito_usado ?? 0),
  }
}

export async function lancarMovimento(
  pin: string,
  tipo: 'sangria' | 'suprimento',
  valor: number,
  motivo: string
) {
  exigirOk(
    await rpc<{ ok?: boolean; erro?: string }>('caixa_movimento', {
      p_pin: pin,
      p_tipo: tipo,
      p_valor: valor,
      p_motivo: motivo,
    })
  )
}

export async function receberPendencia(
  pin: string,
  clienteId: string,
  valor: number,
  forma: 'dinheiro' | 'pix' | 'debito' | 'credito'
): Promise<{ restante: number }> {
  const r = exigirOk(
    await rpc<{ ok?: boolean; erro?: string; restante: number }>('caixa_receber_pendencia', {
      p_pin: pin,
      p_cliente: clienteId,
      p_valor: valor,
      p_forma: forma,
    })
  )
  return { restante: Number(r.restante) }
}

export interface ItemDevolucao {
  codigo: string | null
  nome: string
  unidade: string | null
  quantidade: number
  preco: number
}

export async function lancarDevolucao(
  pin: string,
  clienteId: string,
  itens: ItemDevolucao[],
  motivo: string,
  pedidoOrigem: number | null
): Promise<{ numero: number; total: number; saldo: number }> {
  const r = exigirOk(
    await rpc<{ ok?: boolean; erro?: string; numero: number; total: number; saldo: number }>(
      'caixa_devolucao',
      {
        p_pin: pin,
        p_cliente: clienteId,
        p_itens: itens,
        p_motivo: motivo,
        p_pedido_origem: pedidoOrigem,
      }
    )
  )
  return { numero: Number(r.numero), total: Number(r.total), saldo: Number(r.saldo) }
}

export async function fecharCaixa(pin: string, contado: number, obs: string): Promise<Relatorio> {
  const r = exigirOk(
    await rpc<{ ok?: boolean; erro?: string; relatorio: Relatorio }>('caixa_fechar', {
      p_pin: pin,
      p_contado: contado,
      p_obs: obs || null,
    })
  )
  return normalizar(r.relatorio)
}

export async function relatorioDaSessao(id: string): Promise<Relatorio> {
  return normalizar(await rpc<Relatorio>('caixa_relatorio', { p_sessao: id }))
}

export async function sessoesRecentes(): Promise<SessaoResumo[]> {
  return (await rpc<SessaoResumo[] | null>('caixa_sessoes_recentes')) ?? []
}

// ---------- quem pode operar o caixa (só o dono) ----------

export async function listarVendedoresCaixa(): Promise<VendedorCaixa[]> {
  return (await rpc<VendedorCaixa[] | null>('listar_vendedores_caixa')) ?? []
}

export async function definirVendedorCaixa(id: string, caixa: boolean) {
  await rpc('definir_vendedor_caixa', { p_id: id, p_caixa: caixa })
}