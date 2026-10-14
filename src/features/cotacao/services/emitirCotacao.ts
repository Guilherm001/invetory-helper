import type { CotacaoData } from '../types'
import { gerarCotacao } from './gerarCotacao'
import { salvarCotacao } from './cotacaoService'

// gera o PDF e guarda a cotação no histórico.
// Primeiro o PDF: se ele falhar, nada é guardado e dá para tentar de novo sem duplicar.
// Se só o histórico falhar, o PDF já foi gerado e o motivo volta em `avisoHistorico`.
export async function emitirCotacao(
  data: CotacaoData,
  codigos: (string | null)[] = []
): Promise<{ avisoHistorico: string | null }> {
  await gerarCotacao(data)

  try {
    await salvarCotacao(data, codigos)
    return { avisoHistorico: null }
  } catch (e) {
    return { avisoHistorico: e instanceof Error ? e.message : 'erro desconhecido' }
  }
}