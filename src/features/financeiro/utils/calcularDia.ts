import type { DiaCaixa, ResultadoMovimentacao } from './tipos'

const arredondar = (n: number) => Math.round(n * 100) / 100

export interface ResumoCalculado {
  vendas: number | null // vendas do dia (caixa)
  recebido: number | null // dinheiro que entrou de verdade
  custoLiquido: number | null // custo total dos itens vendidos
  lucro: number | null
  margem: number | null // % sobre as vendas
}

// mesma conta da view fin_resumo_dia, para a prévia bater com o que será gravado
export function calcularResumo(
  dia: DiaCaixa | null,
  mov: ResultadoMovimentacao | null
): ResumoCalculado {
  const vendas = dia
    ? arredondar(dia.totalCaixa - dia.pendenciasPagas + (dia.pendencia ?? 0))
    : null
  const recebido = dia
    ? arredondar(dia.dinheiro + dia.pix + dia.cheque + dia.duplicata + dia.cartao)
    : null
  const custoLiquido = mov ? arredondar(mov.custoTotal) : null

  const lucro = vendas !== null && custoLiquido !== null ? arredondar(vendas - custoLiquido) : null
  const margem = lucro !== null && vendas ? Math.round((lucro / vendas) * 1000) / 10 : null

  return { vendas, recebido, custoLiquido, lucro, margem }
}