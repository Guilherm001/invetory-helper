// listas e ajudantes dos dados fiscais e do múltiplo de venda do catálogo

export type SituacaoTributaria =
  | 'tributado'
  | 'substituicao'
  | 'isento'
  | 'nao_tributado'
  | 'suspenso'
  | 'diferido'

export const SITUACOES_TRIB: { valor: SituacaoTributaria; rotulo: string }[] = [
  { valor: 'tributado', rotulo: 'Tributado' },
  { valor: 'substituicao', rotulo: 'Substituição tributária (ST)' },
  { valor: 'isento', rotulo: 'Isento' },
  { valor: 'nao_tributado', rotulo: 'Não tributado' },
  { valor: 'suspenso', rotulo: 'Suspensão' },
  { valor: 'diferido', rotulo: 'Diferimento' },
]

export const ORIGENS: { valor: number; rotulo: string }[] = [
  { valor: 0, rotulo: '0 - Nacional' },
  { valor: 1, rotulo: '1 - Estrangeira, importação direta' },
  { valor: 2, rotulo: '2 - Estrangeira, adquirida no mercado interno' },
  { valor: 3, rotulo: '3 - Nacional, conteúdo importado acima de 40% até 70%' },
  { valor: 4, rotulo: '4 - Nacional, processos produtivos básicos' },
  { valor: 5, rotulo: '5 - Nacional, conteúdo importado até 40%' },
  { valor: 6, rotulo: '6 - Estrangeira, importação direta, sem similar nacional' },
  { valor: 7, rotulo: '7 - Estrangeira, mercado interno, sem similar nacional' },
  { valor: 8, rotulo: '8 - Nacional, conteúdo importado acima de 70%' },
]

// regime normal
export const CST_NORMAL: { valor: string; rotulo: string }[] = [
  { valor: '00', rotulo: '00 - Tributada integralmente' },
  { valor: '10', rotulo: '10 - Tributada com cobrança do ICMS por ST' },
  { valor: '20', rotulo: '20 - Com redução de base de cálculo' },
  { valor: '30', rotulo: '30 - Isenta ou não tributada, com cobrança por ST' },
  { valor: '40', rotulo: '40 - Isenta' },
  { valor: '41', rotulo: '41 - Não tributada' },
  { valor: '50', rotulo: '50 - Suspensão' },
  { valor: '51', rotulo: '51 - Diferimento' },
  { valor: '60', rotulo: '60 - ICMS cobrado anteriormente por ST' },
  { valor: '70', rotulo: '70 - Redução de base de cálculo com cobrança por ST' },
  { valor: '90', rotulo: '90 - Outras' },
]

// Simples Nacional
export const CSOSN: { valor: string; rotulo: string }[] = [
  { valor: '101', rotulo: '101 - Tributada com permissão de crédito' },
  { valor: '102', rotulo: '102 - Tributada sem permissão de crédito' },
  { valor: '103', rotulo: '103 - Isenção do ICMS para faixa de receita bruta' },
  { valor: '201', rotulo: '201 - Com permissão de crédito e cobrança por ST' },
  { valor: '202', rotulo: '202 - Sem permissão de crédito e com cobrança por ST' },
  { valor: '203', rotulo: '203 - Isenção para faixa de receita bruta e com cobrança por ST' },
  { valor: '300', rotulo: '300 - Imune' },
  { valor: '400', rotulo: '400 - Não tributada' },
  { valor: '500', rotulo: '500 - ICMS cobrado anteriormente por ST' },
  { valor: '900', rotulo: '900 - Outros' },
]

// de quanto em quanto o produto pode ser vendido
export const MULTIPLOS_PADRAO: { valor: number; titulo: string }[] = [
  { valor: 1, titulo: 'Só inteiro' },
  { valor: 0.5, titulo: 'Meio em meio' },
  { valor: 0.25, titulo: 'Quarto em quarto' },
  { valor: 0.1, titulo: 'Décimo em décimo' },
  { valor: 0.001, titulo: 'Qualquer fração' },
]

export const soDigitos = (s: string) => s.replace(/\D/g, '')

// 12345678 -> 1234.56.78
export function formatarNcm(d: string) {
  const a = d.slice(0, 4)
  const b = d.slice(4, 6)
  const c = d.slice(6, 8)
  return [a, b, c].filter(Boolean).join('.')
}

// 1234567 -> 12.345.67
export function formatarCest(d: string) {
  const a = d.slice(0, 2)
  const b = d.slice(2, 5)
  const c = d.slice(5, 7)
  return [a, b, c].filter(Boolean).join('.')
}

export const textoNumero = (n: number) => String(Math.round(n * 1000) / 1000).replace('.', ',')

// mostra o que o múltiplo permite vender
export function exemploMultiplo(m: number) {
  if (!Number.isFinite(m) || m <= 0) return ''
  if (m < 0.1) return `Aceita qualquer quantidade, de ${textoNumero(m)} em ${textoNumero(m)}.`
  const lista = [1, 2, 3, 4].map((i) => textoNumero(Math.round(i * m * 1000) / 1000))
  return `Pode vender: ${lista.join(' · ')} ...`
}