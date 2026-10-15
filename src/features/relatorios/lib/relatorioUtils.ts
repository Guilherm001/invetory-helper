export const reais = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const inteiro = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })

export const pct = (n: number, casas = 1) =>
  `${n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`

// variação percentual; null quando não há base para comparar
export const variacao = (atual: number, anterior: number): number | null =>
  anterior > 0 ? ((atual - anterior) / anterior) * 100 : null

export const arred2 = (n: number) => Math.round(n * 100) / 100

// "2026-10-18" -> "18/10/2026"
export const dataCurtaBR = (iso: string) => {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

// baixa um .csv com ";" e acentos corretos para abrir direto no Excel
export function baixarCsv(nome: string, cabecalho: string[], linhas: (string | number)[][]) {
  const celula = (v: string | number) =>
    typeof v === 'number' ? String(v).replace('.', ',') : `"${String(v).replace(/"/g, '""')}"`
  const texto = [cabecalho, ...linhas].map((l) => l.map(celula).join(';')).join('\r\n')
  const blob = new Blob(['\uFEFF' + texto], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${nome}.csv`
  a.click()
  URL.revokeObjectURL(url)
}