
export interface CotacaoItem {
  name: string
  quantity: string
  unit: string | null
}

export interface CotacaoData {
  fornecedor: string
  itens: CotacaoItem[]
}