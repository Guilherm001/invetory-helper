// um dia do relatório de caixa (pedidos fechados)
export interface DiaCaixa {
  dia: string // AAAA-MM-DD
  dinheiro: number
  pix: number
  cheque: number
  duplicata: number
  cartao: number
  creditoConta: number // coluna "Déb/Cred": crédito do cliente usado no pedido
  totalCaixa: number // soma de todos os pedidos fechados (inclui PDC)
  pedidos: number // vendas fechadas no caixa (sem contar pagamentos de pendência)
  maiorPedido: number
  pendenciasPagas: number // PDC: fiado de outros dias que foi pago hoje (não é venda de hoje)
  pedidosPendencia: number
  pendencia: number | null // fiado feito hoje (só quando o relatório é de um dia)
}

export interface ResultadoCaixa {
  dias: DiaCaixa[]
  clientesEmAberto: number
  avisos: string[]
}

export interface ItemMovimento {
  codigo: string
  descricao: string
  entrada: number
  saida: number
  custoMedio: number
}

export interface ResultadoMovimentacao {
  itens: ItemMovimento[]
  custoSaidas: number // Σ saída × custo médio
  custoEntradas: number // devoluções de clientes, a custo
  unidadesSaidas: number
  avisos: string[]
}