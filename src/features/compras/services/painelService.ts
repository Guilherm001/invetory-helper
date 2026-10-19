import { supabase } from '@/lib/supabase'

export type EtapaFalta = 'pendente' | 'em_cotacao' | 'em_pedido' | 'recebido'

export interface EtapaDaFalta {
  falta_id: string
  etapa: EtapaFalta
  pedido_id: string | null
  pedido_numero: number | null
  pedido_status: string | null
  cotacao_em: string | null
}

export interface Painel {
  dias: number
  comprado: { total: number; n: number; anterior: number }
  abertos: { n: number; total: number }
  atrasados: { n: number; total: number }
  hoje: { n: number }
  semana: { n: number }
  rascunhos: { n: number; total: number; parados: number }
  parciais: number
  faltas: { abertas: number; alta: number; sem_etapa: number }
  cotacoes: number
  lista_atrasados: {
    id: string
    numero: number
    fornecedor_nome: string
    fornecedor_contato: string | null
    previsao_entrega: string
    total: number
    dias: number
  }[]
  lista_chegando: {
    id: string
    numero: number
    fornecedor_nome: string
    previsao_entrega: string
    total: number
    recebido_parcial: boolean
  }[]
  lista_rascunhos: {
    id: string
    numero: number
    fornecedor_nome: string
    total: number
    criado_em: string
  }[]
  meses: { mes: string; total: number; n: number }[]
  fornecedores: { nome: string; total: number; n: number }[]
  altas: {
    nome: string
    anterior: number
    atual: number
    variacao: number
    fornecedor: string
    em: string
  }[]
  entregas: {
    recebidos: number
    com_previsao: number
    no_prazo: number
    prazo_medio: number | null
  }
  sem_nota: { n: number }
  lista_sem_nota: {
    id: string
    numero: number
    fornecedor_nome: string
    total: number
    recebido_em: string
  }[]
  divergentes: { n: number }
  lista_divergentes: {
    id: string
    numero: number
    fornecedor_nome: string
    esperado: number
    notas: number
    dif: number
  }[]
  vencimentos: { n: number; total: number; dias: number }
  lista_vencimentos: {
    vencimento: string
    valor: number
    nf: number
    pedido_id: string
    pedido_numero: number
    fornecedor_nome: string
  }[]
}

function traduz(error: { message: string; code?: string }) {
  const m = error.message.toLowerCase()
  if (m.includes('could not find the function') || error.code === '42P01' || m.includes('does not exist'))
    return new Error('O painel de compras ainda não está completo no banco. Rode o SQL mais recente do painel.')
  if (m.includes('sem permissão')) return new Error('Só o dono acessa o painel de compras.')
  return new Error(error.message)
}

export async function etapasDasFaltas(): Promise<Map<string, EtapaDaFalta>> {
  const { data, error } = await supabase.rpc('etapas_faltas')
  if (error) throw traduz(error)

  return new Map(((data ?? []) as EtapaDaFalta[]).map((e) => [e.falta_id, e] as const))
}

export async function vincularFaltas(pedidoId: string, faltaIds: string[]) {
  if (faltaIds.length === 0) return
  const { error } = await supabase.rpc('vincular_faltas_pedido', {
    p_pedido: pedidoId,
    p_faltas: faltaIds,
  })
  if (error) throw traduz(error)
}

export async function carregarPainel(dias: number): Promise<Painel> {
  const { data, error } = await supabase.rpc('painel_compras', { p_dias: dias })
  if (error) throw traduz(error)

  const d = data as Partial<Painel>

  // se o SQL novo ainda não rodou, as partes novas vêm vazias em vez de quebrar a tela
  return {
    ...(d as Painel),
    sem_nota: d.sem_nota ?? { n: 0 },
    lista_sem_nota: d.lista_sem_nota ?? [],
    divergentes: d.divergentes ?? { n: 0 },
    lista_divergentes: d.lista_divergentes ?? [],
    vencimentos: d.vencimentos ?? { n: 0, total: 0, dias: 15 },
    lista_vencimentos: d.lista_vencimentos ?? [],
  }
}

// marca (ou desmarca) pedidos recebidos como "sem nota fiscal"
export async function dispensarNotas(ids: string[], dispensar = true): Promise<number> {
  const { data, error } = await supabase.rpc('dispensar_nota_compra', {
    p_ids: ids,
    p_dispensar: dispensar,
  })
  if (error) throw traduz(error)
  return Number(data ?? 0)
}

export async function dispensarTodasSemNota(dias: number): Promise<number> {
  const { data, error } = await supabase.rpc('dispensar_todas_sem_nota', { p_dias: dias })
  if (error) throw traduz(error)
  return Number(data ?? 0)
}