import { supabase } from '@/lib/supabase'
import type { DiaCaixa, ItemMovimento } from '../utils/tipos'

export interface ResumoDia {
  dia: string // AAAA-MM-DD
  temCaixa: boolean
  temItens: boolean
  fechado: boolean // loja fechada: não é dia de venda zero, é dia sem expediente
  recebido: number | null
  vendas: number | null // vendas do dia, já sem devoluções
  custo: number | null // custo líquido
  lucro: number | null
  pedidos: number | null
  pendencia: number | null
}

const num = (v: unknown): number | null =>
  v === null || v === undefined ? null : Number(v)

async function usuarioId() {
  const { data } = await supabase.auth.getUser()
  if (!data.user) throw new Error('Não autenticado')
  return data.user.id
}

// ---------- leitura ----------

export async function listarResumo(limite = 30): Promise<ResumoDia[]> {
  const { data, error } = await supabase
    .from('fin_resumo_dia')
    .select(
      'dia, fechado, total_caixa, custo_saidas, recebido, vendas_liquidas, custo_liquido, lucro_bruto, pedidos, pendencia'
    )
    .order('dia', { ascending: false })
    .limit(limite)

  if (error) throw new Error(error.message)

  return (data ?? []).map((r) => ({
    dia: r.dia as string,
    temCaixa: r.total_caixa !== null,
    temItens: r.custo_saidas !== null,
    fechado: r.fechado === true,
    recebido: num(r.recebido),
    vendas: num(r.vendas_liquidas),
    custo: num(r.custo_liquido),
    lucro: num(r.lucro_bruto),
    pedidos: num(r.pedidos),
    pendencia: num(r.pendencia),
  }))
}

// preço do catálogo por código (só entram os códigos que existem no catálogo)
export async function precosDoCatalogo(codigos: string[]) {
  const mapa = new Map<string, number | null>()
  const unicos = [...new Set(codigos)]

  for (let i = 0; i < unicos.length; i += 100) {
    const { data, error } = await supabase
      .from('catalog_items')
      .select('code, price')
      .in('code', unicos.slice(i, i + 100))
    if (error) throw new Error(error.message)
    for (const r of data ?? []) mapa.set(r.code as string, num(r.price))
  }

  return mapa
}

// quais dias já foram importados (para avisar que serão substituídos)
export async function verificarDias(diasCaixa: string[], diasItens: string[]) {
  let caixa: string[] = []
  if (diasCaixa.length > 0) {
    const { data, error } = await supabase.from('fin_dias').select('dia').in('dia', diasCaixa)
    if (error) throw new Error(error.message)
    caixa = (data ?? []).map((r) => r.dia as string)
  }

  const comItens = await Promise.all(
    diasItens.map(async (dia) => {
      const { count, error } = await supabase
        .from('fin_itens_dia')
        .select('codigo', { count: 'exact', head: true })
        .eq('dia', dia)
      if (error) throw new Error(error.message)
      return (count ?? 0) > 0 ? dia : null
    })
  )

  return { caixa, itens: comItens.filter((d): d is string => d !== null) }
}

// ---------- gravação ----------

export async function gravarCaixa(dias: DiaCaixa[]) {
  const user_id = await usuarioId()
  const agora = new Date().toISOString()

  const base = (d: DiaCaixa) => ({
    user_id,
    dia: d.dia,
    dinheiro: d.dinheiro,
    pix: d.pix,
    cheque: d.cheque,
    duplicata: d.duplicata,
    cartao: d.cartao,
    credito_conta: d.creditoConta,
    total_caixa: d.totalCaixa,
    pedidos: d.pedidos,
    maior_pedido: d.maiorPedido,
    pdc_pago: d.pendenciasPagas,
    pdc_pedidos: d.pedidosPendencia,
    fechado: false, // um dia com movimento deixa de ser "loja fechada"
    updated_at: agora,
  })

  // se o fiado do dia não veio no arquivo, não mexe no que já estava gravado
  const comFiado = dias
    .filter((d) => d.pendencia !== null)
    .map((d) => ({ ...base(d), pendencia: d.pendencia }))
  const semFiado = dias.filter((d) => d.pendencia === null).map(base)

  for (const grupo of [comFiado, semFiado]) {
    if (grupo.length === 0) continue
    const { error } = await supabase.from('fin_dias').upsert(grupo, { onConflict: 'user_id,dia' })
    if (error) throw new Error(error.message)
  }
}

// troca todos os itens do dia de uma vez (apaga e grava na mesma transação)
export async function gravarItens(
  dia: string,
  itens: ItemMovimento[],
  precos: Map<string, number | null>
) {
  const { error } = await supabase.rpc('fin_importar_itens', {
    p_dia: dia,
    p_itens: itens.map((i) => {
      const p = precos.get(i.codigo)
      return {
        codigo: i.codigo,
        descricao: i.descricao,
        entrada: i.entrada,
        saida: i.saida,
        custo_medio: i.custoMedio,
        preco_catalogo: p != null && p > 0 ? p : null,
      }
    }),
  })
  if (error) throw new Error(error.message)
}

// feriado ou dia sem expediente. Se o dia já tem dados, não mexe em nada (ignoreDuplicates)
export async function marcarFechado(dia: string) {
  const user_id = await usuarioId()
  const { error } = await supabase.from('fin_dias').upsert(
    {
      user_id,
      dia,
      dinheiro: 0,
      pix: 0,
      cheque: 0,
      duplicata: 0,
      cartao: 0,
      credito_conta: 0,
      total_caixa: 0,
      pedidos: 0,
      maior_pedido: 0,
      pdc_pago: 0,
      pdc_pedidos: 0,
      pendencia: 0,
      fechado: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,dia', ignoreDuplicates: true }
  )
  if (error) throw new Error(error.message)
}
// ---------- painel ----------

export interface DiaFinanceiro {
  dia: string // AAAA-MM-DD
  fechado: boolean
  temCaixa: boolean
  temItens: boolean
  pedidos: number
  vendas: number | null // vendas do dia, já sem devoluções
  recebido: number | null
  custo: number | null // custo líquido
  lucro: number | null
  fiadoFeito: number
  fiadoPago: number
  dinheiro: number
  pix: number
  cartao: number
  credito: number // crédito do cliente usado
  outros: number // cheque e duplicata
}

export interface ItemTop {
  codigo: string
  descricao: string
  unidades: number
  custo: number
  vendaEstimada: number | null
  lucroEstimado: number | null
}

// todos os dias desde uma data (o painel agrupa por mês no navegador)
export async function listarDias(desde: string): Promise<DiaFinanceiro[]> {
  const { data, error } = await supabase
    .from('fin_resumo_dia')
    .select(
      'dia, fechado, total_caixa, custo_saidas, pedidos, vendas_liquidas, recebido, custo_liquido, lucro_bruto, pendencia, pdc_pago, dinheiro, pix, cartao, credito_conta, cheque, duplicata'
    )
    .gte('dia', desde)
    .order('dia', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map((r) => ({
    dia: r.dia as string,
    fechado: r.fechado === true,
    temCaixa: r.total_caixa !== null,
    temItens: r.custo_saidas !== null,
    pedidos: num(r.pedidos) ?? 0,
    vendas: num(r.vendas_liquidas),
    recebido: num(r.recebido),
    custo: num(r.custo_liquido),
    lucro: num(r.lucro_bruto),
    fiadoFeito: num(r.pendencia) ?? 0,
    fiadoPago: num(r.pdc_pago) ?? 0,
    dinheiro: num(r.dinheiro) ?? 0,
    pix: num(r.pix) ?? 0,
    cartao: num(r.cartao) ?? 0,
    credito: num(r.credito_conta) ?? 0,
    outros: (num(r.cheque) ?? 0) + (num(r.duplicata) ?? 0),
  }))
}

export async function topItens(
  ini: string,
  fim: string,
  ordem: 'custo' | 'lucro',
  limite = 10
): Promise<ItemTop[]> {
  const { data, error } = await supabase.rpc('fin_top_itens', {
    p_ini: ini,
    p_fim: fim,
    p_ordem: ordem,
    p_limite: limite,
  })
  if (error) throw new Error(error.message)

  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    codigo: String(r.codigo),
    descricao: String(r.descricao),
    unidades: Number(r.unidades),
    custo: Number(r.custo),
    vendaEstimada: num(r.venda_estimada),
    lucroEstimado: num(r.lucro_estimado),
  }))
}