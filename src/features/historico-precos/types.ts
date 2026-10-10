// uma cotação: o preço que um fornecedor passou para um item em uma comparação
export interface Cotacao {
  id: string
  itemNome: string
  unidade: string | null
  codigo: string | null // código do catálogo, quando o item veio de lá
  comparacaoId: string
  comparacaoNome: string
  fornecedorId: string
  fornecedorNome: string
  preco: number
  data: string // ISO
}

// o melhor preço do item dentro de uma comparação
export interface Rodada {
  comparacaoId: string
  comparacaoNome: string
  data: string
  menor: number
  fornecedorNome: string
}

export interface ProdutoHistorico {
  chave: string // identifica o produto (código do catálogo ou nome normalizado)
  nome: string
  unidade: string | null
  codigo: string | null

  cotacoes: Cotacao[] // da mais antiga para a mais recente
  rodadas: Rodada[] // da mais antiga para a mais recente

  ultimo: number // menor preço da última rodada
  anterior: number | null // menor preço da rodada anterior
  variacao: number | null // % da última rodada contra a anterior
  variacaoTotal: number | null // % da primeira rodada contra a última
  menor: { preco: number; fornecedorNome: string; data: string }
  media: number
  ultimaData: string

  ehMenorHistorico: boolean // a última rodada empatou ou bateu o menor já visto
  subiu: boolean // variação acima do limite de alerta
}

export interface SerieFornecedor {
  chave: string // nome do campo no gráfico
  nome: string
}

// um ponto do gráfico: data + um campo por fornecedor
export type PontoGrafico = { data: number } & Record<string, number>