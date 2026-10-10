import type { ResumoDia } from '../services/financeiroService'

// dias em que a loja costuma abrir (0 = domingo ... 6 = sábado). Ajuste se precisar.
export const DIAS_DE_FUNCIONAMENTO = [1, 2, 3, 4, 5, 6]

export interface DiaPendente {
  dia: string // AAAA-MM-DD
  faltaCaixa: boolean
  faltaItens: boolean
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// dias recentes (sem contar hoje) que ainda não foram importados por completo
export function diasPendentes(resumos: ResumoDia[], hoje: Date, janela = 14): DiaPendente[] {
  if (resumos.length === 0) return []

  // não cobra o que veio antes do primeiro dia importado
  const primeiro = resumos.reduce((m, r) => (r.dia < m ? r.dia : m), resumos[0].dia)
  const porDia = new Map(resumos.map((r) => [r.dia, r]))
  const lista: DiaPendente[] = []

  for (let i = janela; i >= 1; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - i)
    const dia = iso(d)
    if (dia < primeiro) continue

    const r = porDia.get(dia)
    if (!r) {
      if (DIAS_DE_FUNCIONAMENTO.includes(d.getDay())) {
        lista.push({ dia, faltaCaixa: true, faltaItens: true })
      }
      continue
    }
    if (r.fechado) continue
    if (!r.temCaixa || !r.temItens) {
      lista.push({ dia, faltaCaixa: !r.temCaixa, faltaItens: !r.temItens })
    }
  }

  return lista
}