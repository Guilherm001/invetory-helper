// Cálculos de preço de venda a partir do custo.
// markup = % sobre o custo | margem = % sobre o preço de venda

export type BaseMargem = 'markup' | 'margem'

export const arred2 = (n: number) => Math.round(n * 100) / 100

// aceita "1.234,56", "12,5", "R$ 10", "40%"
export function lerDecimal(texto: string): number | null {
  let s = texto.trim().replace(/[R$\s%]/g, '')
  if (!s) return null
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export function vendaPorPercentual(custo: number, pct: number, base: BaseMargem): number | null {
  if (!(custo > 0) || !Number.isFinite(pct)) return null
  if (base === 'markup') return pct > -100 ? arred2(custo * (1 + pct / 100)) : null
  return pct < 100 ? arred2(custo / (1 - pct / 100)) : null
}

export function percentualPorVenda(custo: number, venda: number, base: BaseMargem): number | null {
  if (!(custo > 0) || !(venda > 0)) return null
  const p = base === 'markup' ? (venda / custo - 1) * 100 : (1 - custo / venda) * 100
  return Math.round(p * 10) / 10
}

export const textoMoeda = (n: number) => n.toFixed(2).replace('.', ',')
export const textoPct = (n: number) => String(n).replace('.', ',')
export const textoNum = (n: number) => String(n).replace('.', ',')