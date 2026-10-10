'use client'

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Cotacao } from '../types'
import { seriePorFornecedor } from '../utils/estatisticas'
import { formatarReais } from '@/features/comparar-precos/utils/melhorPreco'

// o teal da marca primeiro, depois cores bem distintas
const CORES = ['#079C9C', '#f59e0b', '#6366f1', '#ef4444', '#10b981', '#8b5cf6', '#64748b']

const DIA = 86_400_000
const dataCurta = (t: number) =>
  new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

export default function GraficoPrecos({ cotacoes }: { cotacoes: Cotacao[] }) {
  const { fornecedores, pontos } = seriePorFornecedor(cotacoes)

  return (
    <div className="h-64 w-full md:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={pontos} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="data"
            type="number"
            scale="time"
            domain={[(min: number) => min - DIA, (max: number) => max + DIA]}
            tickFormatter={dataCurta}
            tick={{ fontSize: 12, fill: '#64748b' }}
            tickCount={5}
          />
          <YAxis
            width={64}
            tick={{ fontSize: 12, fill: '#64748b' }}
            tickFormatter={(v) => formatarReais(Number(v))}
            domain={['auto', 'auto']}
          />
          <Tooltip
            labelFormatter={(l) => new Date(Number(l)).toLocaleDateString('pt-BR')}
            formatter={(v) => formatarReais(Number(v))}
          />
          {fornecedores.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {fornecedores.map((f, i) => (
            <Line
              key={f.chave}
              type="monotone"
              dataKey={f.chave}
              name={f.nome}
              stroke={CORES[i % CORES.length]}
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}