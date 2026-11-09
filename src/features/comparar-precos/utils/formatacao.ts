// 10 -> "10" | 2.5 -> "2,5"
export const numero = (n: number) => (Number.isInteger(n) ? String(n) : String(n).replace('.', ','))

// sem acento, minúsculo, sem espaços nas pontas
export const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

// "10 cimento", "10x cimento" ou "- 10 cimento" -> quantidade 10
export function interpretar(texto: string): { name: string; quantity: number } {
  const t = texto.trim().replace(/^[-•*]\s*/, '')
  const m = t.match(/^(\d+)\s*x\s*(.+)$/i) || t.match(/^(\d+)\s+(.+)$/)
  if (m) {
    const q = Number(m[1])
    if (q >= 1) return { name: m[2].trim(), quantity: q }
  }
  return { name: t, quantity: 1 }
}