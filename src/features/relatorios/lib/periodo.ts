export type PeriodoId = 'hoje' | '7d' | '30d' | 'mes' | 'mes_passado' | 'personalizado'

export interface Intervalo {
  ini: string // AAAA-MM-DD
  fim: string
}

export interface PeriodoEscolhido {
  id: PeriodoId
  de: string // só no personalizado
  ate: string
}

// data de hoje (AAAA-MM-DD) no horário de Brasília
export const hojeBR = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

const doTexto = (s: string) => new Date(`${s}T00:00:00Z`)
const paraTexto = (d: Date) => d.toISOString().slice(0, 10)

const somarDias = (s: string, n: number) => {
  const d = doTexto(s)
  d.setUTCDate(d.getUTCDate() + n)
  return paraTexto(d)
}

const diasEntre = (a: string, b: string) =>
  Math.round((doTexto(b).getTime() - doTexto(a).getTime()) / 86400000)

const dois = (n: number) => String(n).padStart(2, '0')
const ultimoDia = (ano: number, mes: number) => new Date(Date.UTC(ano, mes, 0)).getUTCDate()
const mesAnterior = (ano: number, mes: number): [number, number] =>
  mes === 1 ? [ano - 1, 12] : [ano, mes - 1]

// período escolhido + o período equivalente logo antes (para comparar)
export function resolver(p: PeriodoEscolhido): { atual: Intervalo; anterior: Intervalo } {
  const hoje = hojeBR()
  const [ano, mes, dia] = hoje.split('-').map(Number)

  if (p.id === 'hoje') {
    const ontem = somarDias(hoje, -1)
    return { atual: { ini: hoje, fim: hoje }, anterior: { ini: ontem, fim: ontem } }
  }

  if (p.id === '7d' || p.id === '30d') {
    const n = p.id === '7d' ? 7 : 30
    const ini = somarDias(hoje, -(n - 1))
    return {
      atual: { ini, fim: hoje },
      anterior: { ini: somarDias(ini, -n), fim: somarDias(ini, -1) },
    }
  }

  if (p.id === 'mes') {
    const [aa, am] = mesAnterior(ano, mes)
    return {
      atual: { ini: `${ano}-${dois(mes)}-01`, fim: hoje },
      // mesmos dias do mês passado (ex.: 1 a 15 contra 1 a 15)
      anterior: {
        ini: `${aa}-${dois(am)}-01`,
        fim: `${aa}-${dois(am)}-${dois(Math.min(dia, ultimoDia(aa, am)))}`,
      },
    }
  }

  if (p.id === 'mes_passado') {
    const [aa, am] = mesAnterior(ano, mes)
    const [ba, bm] = mesAnterior(aa, am)
    return {
      atual: { ini: `${aa}-${dois(am)}-01`, fim: `${aa}-${dois(am)}-${dois(ultimoDia(aa, am))}` },
      anterior: {
        ini: `${ba}-${dois(bm)}-01`,
        fim: `${ba}-${dois(bm)}-${dois(ultimoDia(ba, bm))}`,
      },
    }
  }

  // personalizado
  let ini = p.de || hoje
  let fim = p.ate || hoje
  if (ini > fim) [ini, fim] = [fim, ini]
  const n = diasEntre(ini, fim) + 1
  return {
    atual: { ini, fim },
    anterior: { ini: somarDias(ini, -n), fim: somarDias(ini, -1) },
  }
}