'use client'

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatarReais } from '@/features/comparar-precos/utils/melhorPreco'
import type { DiaFinanceiro } from '../services/financeiroService'
import type { ResumoMes } from '../utils/agregar'

const compacto = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })
const eixoY = (v: number | string) => compacto.format(Number(v))

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

const TEAL = '#079C9C'
const CINZA = '#cbd5e1'
const VERDE = '#10b981'

function Grafico({ dados }: { dados: Record<string, string | number | null>[] }) {
  return (
    <div className="h-64 w-full md:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={dados} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="rotulo" tick={{ fontSize: 12, fill: '#64748b' }} />
          <YAxis width={52} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={eixoY} />
          <Tooltip formatter={(v) => formatarReais(Number(v))} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="vendas" name="Vendas" fill={TEAL} radius={[4, 4, 0, 0]} maxBarSize={44} />
          <Bar dataKey="custo" name="Custo" fill={CINZA} radius={[4, 4, 0, 0]} maxBarSize={44} />
          <Line
            dataKey="lucro"
            name="Lucro"
            stroke={VERDE}
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// um dia por barra (só dias com caixa e que não foram "loja fechada")
export function GraficoDiario({ dias }: { dias: DiaFinanceiro[] }) {
  const dados = dias
    .filter((d) => d.temCaixa && !d.fechado)
    .map((d) => ({
      rotulo: `${d.dia.slice(8, 10)}/${d.dia.slice(5, 7)}`,
      vendas: d.vendas,
      custo: d.custo,
      lucro: d.lucro,
    }))

  return <Grafico dados={dados} />
}

// um mês por barra (últimos 12)
export function GraficoMensal({ meses }: { meses: ResumoMes[] }) {
  const dados = meses.slice(-12).map((m) => ({
    rotulo: `${MESES[Number(m.mes.slice(5, 7)) - 1]}/${m.mes.slice(2, 4)}`,
    vendas: m.vendas,
    custo: m.diasCompletos > 0 ? m.custo : null,
    lucro: m.diasCompletos > 0 ? m.lucro : null,
  }))

  return <Grafico dados={dados} />
}