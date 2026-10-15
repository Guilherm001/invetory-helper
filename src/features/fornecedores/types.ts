export interface Telefone {
  numero: string // só dígitos
  rotulo: string // "Vendas", "Financeiro"...
  whatsapp: boolean
}

export interface FornecedorCompleto {
  id: string
  name: string // nome do fornecedor
  razao_social: string | null
  documento: string | null // CPF ou CNPJ, sem pontuação
  telefones: Telefone[]
  emails: string[]
  endereco: string | null
  representante: string | null
  lead_time_days: number | null // prazo de entrega, em dias
  notes: string | null
  contact: string | null // campo antigo, ainda usado nas comparações
  ativo: boolean
  created_at: string
}

export type NovoFornecedorCompleto = Omit<FornecedorCompleto, 'id' | 'created_at' | 'contact'>

export interface UsoFornecedor {
  comparacoes: number
  precos: number
}