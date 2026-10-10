export interface Fornecedor {
  id: string
  name: string
  contact: string | null
  lead_time_days: number | null
  notes: string | null
  created_at: string
}

export type NovoFornecedor = Omit<Fornecedor, 'id' | 'created_at'>

export interface Comparacao {
  id: string
  name: string
  created_at: string
}

export interface ItemComparacao {
  id: string
  comparison_id: string
  name: string
  quantity: number
  unit: string | null
  catalog_code: string | null
  position: number
}

// o que o diálogo de "Nova comparação" envia, venha de onde vier
// (lista de produtos, catálogo ou digitação)
export type NovoItemComparacao = Pick<
  ItemComparacao,
  'name' | 'quantity' | 'unit' | 'catalog_code'
>

export interface Preco {
  id: string
  item_id: string
  supplier_id: string
  price: number
}

// uma comparação aberta, com tudo junto
export interface ComparacaoCompleta {
  comparacao: Comparacao
  itens: ItemComparacao[]
  fornecedores: Fornecedor[] // só os que participam desta comparação
  precos: Preco[]
}
// linha da lista de comparações, com as contagens
export interface ComparacaoResumo extends Comparacao {
  itens_count: number
  fornecedores_count: number
}