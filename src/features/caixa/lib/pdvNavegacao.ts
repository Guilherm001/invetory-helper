// Navegação do PDV só com setas e Enter: o painel é uma pilha de "linhas".
// ↑ ↓ mudam de linha, ← → escolhem dentro da linha, Enter confirma.

export type LinhaId = 'voltar' | 'desconto' | 'formas' | 'detalhe' | 'lancados' | 'fechar'

export interface Visibilidade {
  desconto: boolean // linha de desconto aberta (F2)
  detalhe: boolean // troco, parcelas ou divisão
  lancados: boolean // já existe pagamento lançado
  fechar: boolean // pedido pago: dá para fechar
}

export function linhasVisiveis(v: Visibilidade): LinhaId[] {
  const linhas: LinhaId[] = ['voltar']
  if (v.desconto) linhas.push('desconto')
  linhas.push('formas')
  if (v.detalhe) linhas.push('detalhe')
  if (v.lancados) linhas.push('lancados')
  if (v.fechar) linhas.push('fechar')
  return linhas
}

export function moverLinha(linhas: LinhaId[], atual: LinhaId, dir: 1 | -1): LinhaId {
  const i = linhas.indexOf(atual)
  if (i < 0) return linhas.includes('formas') ? 'formas' : linhas[0]
  return linhas[Math.min(linhas.length - 1, Math.max(0, i + dir))]
}

// anda para o lado pulando o que está desabilitado; se não há para onde ir, fica
export function moverColuna(habilitados: boolean[], col: number, dir: 1 | -1): number {
  for (let i = col + dir; i >= 0 && i < habilitados.length; i += dir) {
    if (habilitados[i]) return i
  }
  return col
}

// garante que o cursor nunca fique parado em algo desabilitado
export function colunaValida(habilitados: boolean[], preferida: number): number {
  if (habilitados.length === 0) return 0
  const p = Math.min(Math.max(preferida, 0), habilitados.length - 1)
  if (habilitados[p]) return p
  const primeira = habilitados.findIndex(Boolean)
  return primeira >= 0 ? primeira : p
}