import type { Cotacao } from '../types'
import { agrupar } from './estatisticas'

export interface Referencia {
  ultimo: number // menor preço da última comparação anterior
  menor: number // menor preço já visto
  data: string // data dessa última comparação
}

// referência de cada produto, sem contar a comparação que está aberta
export function referenciasExcluindo(
  cotacoes: Cotacao[],
  comparacaoId: string
): Map<string, Referencia> {
  const mapa = new Map<string, Referencia>()

  for (const p of agrupar(cotacoes.filter((c) => c.comparacaoId !== comparacaoId))) {
    mapa.set(p.chave, {
      ultimo: p.ultimo,
      menor: p.menor.preco,
      data: p.rodadas[p.rodadas.length - 1].data,
    })
  }

  return mapa
}

// % do preço atual contra a última vez (null se não dá para calcular)
export function variacaoContra(ref: Referencia, preco: number): number | null {
  if (!(ref.ultimo > 0)) return null
  return Math.round(((preco - ref.ultimo) / ref.ultimo) * 1000) / 10
}