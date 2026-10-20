import { normalizar } from '@/features/historico-precos/utils/estatisticas'

// formas de escrever "uma peça": UN, PC, PÇ, UND, UNID, UNIDADE, PEÇA...
// (PR de par, PT de pacote, CX de caixa etc. são outras unidades)
const PECA = new Set([
  'un', 'und', 'unid', 'unds', 'unidade', 'unidades',
  'pc', 'pcs', 'pca', 'pcas', 'peca', 'pecas',
])

export function unidadeCanonica(u: string | null | undefined) {
  const n = normalizar(u ?? '')
  return PECA.has(n) ? 'un' : n
}

export const mesmaUnidade = (a: string | null | undefined, b: string | null | undefined) =>
  unidadeCanonica(a) === unidadeCanonica(b)