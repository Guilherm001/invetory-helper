import type { DiaFinanceiro } from '../services/financeiroService'

const arredondar = (n: number) => Math.round(n * 100) / 100
const soma = (dias: DiaFinanceiro[], f: (d: DiaFinanceiro) => number) =>
  arredondar(dias.reduce((s, d) => s + f(d), 0))

export interface ResumoMes {
  mes: string // AAAA-MM
  diasComVenda: number
  diasCompletos: number // dias com caixa e movimentação (só neles há lucro)
  diasSemMovimentacao: number
  vendas: number
  recebido: number
  fiadoFeito: number
  fiadoPago: number
  custo: number // só dos dias completos
  lucro: number // só dos dias completos
  vendasCompletas: number // vendas dos dias completos (base da margem)
  margem: number | null
  mediaVendas: number | null // média por dia com venda
  pagamentos: { dinheiro: number; pix: number; cartao: number; credito: number; outros: number }
}

export const mesDe = (dia: string) => dia.slice(0, 7)

const chaveMes = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

export function mesAnterior(mes: string) {
  const [a, m] = mes.split('-').map(Number)
  return chaveMes(new Date(a, m - 2, 1))
}

export function mesSeguinte(mes: string) {
  const [a, m] = mes.split('-').map(Number)
  return chaveMes(new Date(a, m, 1))
}

export const mesAtual = (hoje: Date) => chaveMes(hoje)

export function resumirMes(mes: string, todos: DiaFinanceiro[]): ResumoMes {
  // dia de loja fechada não conta como dia de venda zero
  const ativos = todos.filter((d) => mesDe(d.dia) === mes && !d.fechado && d.temCaixa)
  const completos = ativos.filter((d) => d.temItens && d.custo !== null && d.lucro !== null)

  const vendas = soma(ativos, (d) => d.vendas ?? 0)
  const vendasCompletas = soma(completos, (d) => d.vendas ?? 0)
  const lucro = soma(completos, (d) => d.lucro ?? 0)

  return {
    mes,
    diasComVenda: ativos.length,
    diasCompletos: completos.length,
    diasSemMovimentacao: ativos.length - completos.length,
    vendas,
    recebido: soma(ativos, (d) => d.recebido ?? 0),
    fiadoFeito: soma(ativos, (d) => d.fiadoFeito),
    fiadoPago: soma(ativos, (d) => d.fiadoPago),
    custo: soma(completos, (d) => d.custo ?? 0),
    lucro,
    vendasCompletas,
    margem: vendasCompletas > 0 ? Math.round((lucro / vendasCompletas) * 1000) / 10 : null,
    mediaVendas: ativos.length > 0 ? arredondar(vendas / ativos.length) : null,
    pagamentos: {
      dinheiro: soma(ativos, (d) => d.dinheiro),
      pix: soma(ativos, (d) => d.pix),
      cartao: soma(ativos, (d) => d.cartao),
      credito: soma(ativos, (d) => d.credito),
      outros: soma(ativos, (d) => d.outros),
    },
  }
}

// um resumo por mês, do mais antigo para o mais recente
export function agruparPorMes(todos: DiaFinanceiro[]): ResumoMes[] {
  const meses = [...new Set(todos.map((d) => mesDe(d.dia)))].sort()
  return meses.map((m) => resumirMes(m, todos))
}

// variação em % do atual contra o anterior (null se não dá para comparar)
export function variacaoPercentual(atual: number | null, anterior: number | null) {
  if (atual === null || anterior === null || anterior <= 0) return null
  return Math.round(((atual - anterior) / anterior) * 1000) / 10
}