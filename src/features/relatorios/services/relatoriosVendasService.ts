import { supabase } from '@/lib/supabase'
import type { Intervalo } from '../lib/periodo'

const n = (v: unknown) => Number(v ?? 0)

async function chamar(fn: string, args: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) {
    if (error.message.toLowerCase().includes('could not find the function'))
      throw new Error('Os relatórios ainda não existem no banco. Rode o SQL dos relatórios de vendas.')
    throw new Error(error.message)
  }
  return (data ?? []) as Record<string, unknown>[]
}

// ---------- vendas por vendedor ----------

export interface VendedorVenda {
  vendedor: string
  pedidos: number
  total: number
  maiorPedido: number
  entregas: number
}

export async function vendasPorVendedor(i: Intervalo): Promise<VendedorVenda[]> {
  const rows = await chamar('rel_vendas_vendedor', { p_ini: i.ini, p_fim: i.fim })
  return rows.map((r) => ({
    vendedor: String(r.vendedor),
    pedidos: n(r.pedidos),
    total: n(r.total),
    maiorPedido: n(r.maior_pedido),
    entregas: n(r.entregas),
  }))
}

// ---------- orçamentos ----------

export interface OrcamentoVendedor {
  vendedor: string
  feitos: number
  valorFeito: number
  convertidos: number
  valorConvertido: number
  emAberto: number
  valorAberto: number
  vencidos: number
  valorVencido: number
  recusados: number
  valorRecusado: number
  diasMedio: number | null
}

export async function orcamentosPorVendedor(i: Intervalo): Promise<OrcamentoVendedor[]> {
  const rows = await chamar('rel_orcamentos', { p_ini: i.ini, p_fim: i.fim })
  return rows.map((r) => ({
    vendedor: String(r.vendedor),
    feitos: n(r.feitos),
    valorFeito: n(r.valor_feito),
    convertidos: n(r.convertidos),
    valorConvertido: n(r.valor_convertido),
    emAberto: n(r.em_aberto),
    valorAberto: n(r.valor_aberto),
    vencidos: n(r.vencidos),
    valorVencido: n(r.valor_vencido),
    recusados: n(r.recusados),
    valorRecusado: n(r.valor_recusado),
    diasMedio: r.dias_medio_conversao == null ? null : Number(r.dias_medio_conversao),
  }))
}

// ---------- itens mais vendidos ----------

export interface ItemVendido {
  codigo: string
  nome: string
  unidade: string
  quantidade: number
  valor: number
  pedidos: number
  precoMedio: number
  participacao: number // % do faturamento em itens
  acumulado: number // % acumulado (base da curva ABC)
  classe: 'A' | 'B' | 'C'
  totalGeral: number
  quantidadeGeral: number
  itensDistintos: number
}

export async function itensMaisVendidos(
  i: Intervalo,
  ordem: 'valor' | 'quantidade',
  limite: number
): Promise<ItemVendido[]> {
  const rows = await chamar('rel_itens_vendidos', {
    p_ini: i.ini,
    p_fim: i.fim,
    p_ordem: ordem,
    p_limite: limite,
  })
  return rows.map((r) => ({
    codigo: r.codigo ? String(r.codigo) : '',
    nome: String(r.nome),
    unidade: r.unidade ? String(r.unidade) : '',
    quantidade: n(r.quantidade),
    valor: n(r.valor),
    pedidos: n(r.pedidos),
    precoMedio: n(r.preco_medio),
    participacao: n(r.participacao),
    acumulado: n(r.acumulado),
    classe: (r.classe === 'A' || r.classe === 'B' ? r.classe : 'C') as 'A' | 'B' | 'C',
    totalGeral: n(r.total_geral),
    quantidadeGeral: n(r.quantidade_geral),
    itensDistintos: n(r.itens_distintos),
  }))
}