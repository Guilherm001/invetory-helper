import { decodificarWindows1252 } from './decodificar'
import { lerMovimentacao, lerMovimentacaoXlsx } from './lerMovimentacao'
import { lerRelatorioCaixa } from './lerRelatorioCaixa'
import type { ResultadoCaixa, ResultadoMovimentacao } from './tipos'

export type ArquivoLido =
  | { tipo: 'caixa'; resultado: ResultadoCaixa }
  | { tipo: 'movimentacao'; resultado: ResultadoMovimentacao }

// descobre sozinho se é o relatório do caixa ou a movimentação de itens:
// - .xlsx / .xls: movimentação (planilha)
// - .txt / .csv: é o caixa se tiver o título "RELATORIO DO CAIXA"; senão, movimentação
export async function lerArquivoImportacao(
  nome: string,
  buffer: ArrayBuffer
): Promise<ArquivoLido> {
  const n = nome.toLowerCase()

  if (n.endsWith('.xlsx') || n.endsWith('.xls')) {
    return { tipo: 'movimentacao', resultado: await lerMovimentacaoXlsx(buffer) }
  }

  if (n.endsWith('.txt') || n.endsWith('.csv')) {
    const eCaixa = decodificarWindows1252(buffer).includes('RELATORIO DO CAIXA')
    return eCaixa
      ? { tipo: 'caixa', resultado: lerRelatorioCaixa(buffer) }
      : { tipo: 'movimentacao', resultado: lerMovimentacao(buffer) }
  }

  throw new Error('Use o .txt do caixa ou o .csv, .txt ou .xlsx da movimentação.')
}