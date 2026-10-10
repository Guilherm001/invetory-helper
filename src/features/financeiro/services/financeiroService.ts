import { supabase } from '@/lib/supabase'
import type { DiaCaixa, ItemMovimento } from '../utils/tipos'

export interface ResumoDia {
  dia: string // AAAA-MM-DD
  temCaixa: boolean
  temItens: boolean
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

export async function listarResumo(limite = 14): Promise<ResumoDia[]> {
  const { data, error } = await supabase
    .from('fin_resumo_dia')
    .select(
      'dia, total_caixa, custo_saidas, recebido, vendas_liquidas, custo_liquido, lucro_bruto, pedidos, pendencia'
    )
    .order('dia', { ascending: false })
    .limit(limite)

  if (error) throw new Error(error.message)

  return (data ?? []).map((r) => ({
    dia: r.dia as string,
    temCaixa: r.total_caixa !== null,
    temItens: r.custo_saidas !== null,
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
export async function verificarDias(dias: string[], diaItens: string | null) {
  let caixa: string[] = []
  if (dias.length > 0) {
    const { data, error } = await supabase.from('fin_dias').select('dia').in('dia', dias)
    if (error) throw new Error(error.message)
    caixa = (data ?? []).map((r) => r.dia as string)
  }

  let itens = false
  if (diaItens) {
    const { count, error } = await supabase
      .from('fin_itens_dia')
      .select('codigo', { count: 'exact', head: true })
      .eq('dia', diaItens)
    if (error) throw new Error(error.message)
    itens = (count ?? 0) > 0
  }

  return { caixa, itens }
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
    updated_at: agora,
  })

  // se o fiado do dia não veio no arquivo, não mexe no que já estava gravado
  const comFiado = dias.filter((d) => d.pendencia !== null).map((d) => ({ ...base(d), pendencia: d.pendencia }))
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