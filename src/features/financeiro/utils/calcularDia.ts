import type { DiaCaixa, ResultadoMovimentacao } from './tipos'

const arredondar = (n: number) => Math.round(n * 100) / 100

export interface ResumoCalculado {
  vendas: number | null // vendas do dia, já sem as devoluções
  recebido: number | null // dinheiro que entrou de verdade
  custoLiquido: number | null // custo das saídas menos o das devoluções
  devolucoesVenda: number | null // valor de venda das devoluções (estimado)
  lucro: number | null
  margem: number | null // % sobre as vendas
}

// mesma conta da view fin_resumo_dia, para a prévia bater com o que será gravado
export function calcularResumo(
  dia: DiaCaixa | null,
  mov: ResultadoMovimentacao | null,
  precos: Map<string, number | null>
): ResumoCalculado {
  // devolução vale o preço do catálogo; sem preço, vale o custo
  const devolucoesVenda = mov
    ? arredondar(
        mov.itens.reduce((s, i) => {
          const p = precos.get(i.codigo)
          return s + i.entrada * (p != null && p > 0 ? p : i.custoMedio)
        }, 0)
      )
    : null

  const vendasBrutas = dia
    ? arredondar(dia.totalCaixa - dia.pendenciasPagas + (dia.pendencia ?? 0))
    : null
  const vendas = vendasBrutas !== null ? arredondar(vendasBrutas - (devolucoesVenda ?? 0)) : null
  const recebido = dia
    ? arredondar(dia.dinheiro + dia.pix + dia.cheque + dia.duplicata + dia.cartao)
    : null
  const custoLiquido = mov ? arredondar(mov.custoSaidas - mov.custoEntradas) : null

  const lucro = vendas !== null && custoLiquido !== null ? arredondar(vendas - custoLiquido) : null
  const margem = lucro !== null && vendas ? Math.round((lucro / vendas) * 1000) / 10 : null

  return { vendas, recebido, custoLiquido, devolucoesVenda, lucro, margem }
}