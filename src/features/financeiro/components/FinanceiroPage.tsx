'use client'

import { Wallet } from 'lucide-react'
import { formatarReais } from '@/features/comparar-precos/utils/melhorPreco'
import { useResumoDias } from '../hooks/useResumoDias'
import ImportarDia from './ImportarDia'

const reais = (n: number | null) => (n === null ? '—' : formatarReais(n))

function rotuloDia(iso: string) {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a, m - 1, d).toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  })
}

function Celula({ rotulo, valor, tom }: { rotulo: string; valor: string; tom?: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{rotulo}</p>
      <p className={`text-sm font-semibold ${tom ?? 'text-slate-800'}`}>{valor}</p>
    </div>
  )
}

export default function FinanceiroPage() {
  const { dias, loading, error, recarregar } = useResumoDias(14)

  return (
    <div className="w-full space-y-6 pb-16">
      <div className="mt-7 py-4">
        <h3 className="text-2xl font-bold md:text-3xl">Financeiro</h3>
        <p className="text-sm text-gray-400">
          Importe o fechamento do dia e acompanhe vendas, custo e lucro.
        </p>
      </div>

      <ImportarDia onSalvo={recarregar} />

      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-slate-700">Últimos dias importados</h4>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        {loading ? (
          <p className="py-8 text-center text-sm text-slate-400">Carregando...</p>
        ) : dias.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
            <div className="flex size-11 items-center justify-center rounded-full bg-[#079C9C]/10 text-[#079C9C]">
              <Wallet className="size-5" />
            </div>
            <p className="text-sm font-semibold text-slate-700">Nenhum dia importado ainda</p>
            <p className="max-w-sm text-xs text-slate-500">
              Importe o primeiro fechamento acima. Os gráficos aparecem conforme os dias se
              acumulam.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {dias.map((d) => {
              const margem =
                d.lucro !== null && d.vendas ? Math.round((d.lucro / d.vendas) * 1000) / 10 : null
              return (
                <li
                  key={d.dia}
                  className="grid grid-cols-2 items-center gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm md:grid-cols-[9rem_repeat(4,minmax(0,1fr))]"
                >
                  <div className="col-span-2 md:col-span-1">
                    <p className="font-semibold capitalize text-slate-900">{rotuloDia(d.dia)}</p>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {!d.temCaixa && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                          sem caixa
                        </span>
                      )}
                      {!d.temItens && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                          sem movimentação
                        </span>
                      )}
                    </div>
                  </div>

                  <Celula rotulo="Vendas" valor={reais(d.vendas)} />
                  <Celula rotulo="Recebido" valor={reais(d.recebido)} />
                  <Celula rotulo="Custo" valor={reais(d.custo)} />
                  <Celula
                    rotulo="Lucro"
                    valor={
                      d.lucro === null
                        ? '—'
                        : `${formatarReais(d.lucro)}${margem !== null ? ` (${String(margem).replace('.', ',')}%)` : ''}`
                    }
                    tom={d.lucro === null ? undefined : d.lucro >= 0 ? 'text-emerald-700' : 'text-red-600'}
                  />
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}