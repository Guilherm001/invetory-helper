export interface PedidoAberto {
  id: string
  numero: number
  cliente_nome: string | null
  cliente_telefone: string | null
  tipo: 'retirada' | 'entrega'
  total: number
  vendedor_nome: string | null
  criado_em: string
  itens: number
}

export interface MovimentoCaixa {
  id: string
  tipo: 'sangria' | 'suprimento' | 'recebimento_pendencia'
  valor: number
  forma: string
  motivo: string | null
  cliente_nome: string | null
  feito_por: string
  criado_em: string
}

export interface PedidoRelatorio {
  numero: number
  cliente_nome: string | null
  total: number
  desconto: number
  total_liquido: number
  pagamento: string | null
  fiscal_status: string
  fechado_em: string
}

export interface Relatorio {
  sessao: {
    id: string
    aberto_por: string
    aberto_em: string
    troco_inicial: number
    fechado_em: string | null
    fechado_por: string | null
    dinheiro_contado: number | null
    diferenca: number | null
    observacao: string | null
  }
  vendas: {
    quantidade: number
    bruto: number
    descontos: number
    liquido: number
    fiscal_emitidos: number
    sem_fiscal: number
  }
  formas: Record<string, { quantidade: number; valor: number }>
  parcelas_credito: { parcelas: number; quantidade: number; valor: number }[]
  dinheiro_vendas: number
  sangrias: number
  suprimentos: number
  pendencias_dinheiro: number
  dinheiro_esperado: number
  movimentos: MovimentoCaixa[]
  pedidos: PedidoRelatorio[]
}

export type EstadoCaixa =
  | { aberto: true; resumo: Relatorio }
  | { aberto: false; ocupado_por?: string; ocupado_desde?: string }

export interface SessaoResumo {
  id: string
  aberto_por: string
  aberto_em: string
  fechado_em: string | null
  diferenca: number | null
  liquido: number | null
}

export interface ResultadoFechamento {
  id: string
  numero: number
  total_liquido: number
  desconto: number
  troco: number
}

export interface VendedorCaixa {
  id: string
  nome: string
  caixa: boolean
}