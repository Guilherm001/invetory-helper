'use client'

import { useState } from 'react'
import { CalendarClock, Loader2, Wallet } from 'lucide-react'
import { formatarReais } from '@/features/comparar-precos/utils/melhorPreco'
import { useResumoDias } from '../hooks/useResumoDias'
import { useDiasFinanceiro } from '../hooks/usePainel'
import { marcarFechado } from '../services/financeiroService'
import { diasPendentes } from '../utils/diasPendentes'
import ImportarDia from './ImportarDia'
import PainelFinanceiro from './PainelFinanceiro'

type Aba = 'painel' | 'importar'

const reais = (n: number | null) => (n === null ? '—' : formatarReais(n))

function rotuloDia(iso: string, longo = false) {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a, m - 1, d).toLocaleDateString('pt-BR', {
    weekday: longo ? 'long' : 'short',
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
  const [hoje] = useState(() => new Date())
  const resumos = useResumoDias(30)
  const painel = useDiasFinanceiro(hoje)
  const [aba, setAba] = useState<Aba>('painel')
  const [atualizacao, setAtualizacao] = useState(0)
  const [fechando, setFechando] = useState<string | null>(null)
  const [erroAcao, setErroAcao] = useState('')

  const { dias, loading, error } = resumos
  const pendentes = diasPendentes(dias, hoje)

  // depois de importar ou marcar um dia, tudo recarrega
  const atualizarTudo = async () => {
    await Promise.all([resumos.recarregar(), painel.recarregar()])
    setAtualizacao((v) => v + 1)
  }

  const fechar = async (dia: string) => {
    setFechando(dia)
    setErroAcao('')
    try {
      await marcarFechado(dia)
      await atualizarTudo()
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : 'Erro ao marcar o dia')
    } finally {
      setFechando(null)
    }
  }

  return (
    <div className="w-full space-y-6 pb-16">
      <div className="mt-7 py-4">
        <h3 className="text-2xl font-bold md:text-3xl">Financeiro</h3>
        <p className="text-sm text-gray-400">
          Acompanhe vendas, custo e lucro e importe o fechamento do dia.
        </p>
      </div>

      {/* Dias que ficaram sem importar */}
      {pendentes.length > 0 && (
        <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <CalendarClock className="mt-0.5 size-5 shrink-0 text-amber-600" />
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-semibold text-amber-900">Dias para importar</h4>
              <p className="text-xs text-amber-800">
                Exporte um arquivo de cada dia e solte todos juntos. Se a loja não abriu em algum
                dia, marque como fechada.
              </p>
            </div>
            {aba === 'painel' && (
              <button
                type="button"
                onClick={() => setAba('importar')}
                className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
              >
                Importar
              </button>
            )}
          </div>

          <ul className="space-y-2">
            {pendentes.map((p) => (
              <li
                key={p.dia}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2"
              >
                <div>
                  <p className="text-sm font-semibold capitalize text-slate-900">
                    {rotuloDia(p.dia, true)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {p.faltaCaixa && p.faltaItens
                      ? 'falta o caixa e a movimentação'
                      : p.faltaCaixa
                        ? 'falta o caixa'
                        : 'falta a movimentação'}
                  </p>
                </div>

                {p.faltaCaixa && p.faltaItens && (
                  <button
                    type="button"
                    onClick={() => fechar(p.dia)}
                    disabled={fechando !== null}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    {fechando === p.dia && <Loader2 className="size-3.5 animate-spin" />}
                    Loja fechada
                  </button>
                )}
              </li>
            ))}
          </ul>

          {erroAcao && <p className="text-sm text-red-600">{erroAcao}</p>}
        </section>
      )}

      {/* Abas */}
      <div
        role="tablist"
        aria-label="Seções do financeiro"
        className="grid max-w-sm grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1"
      >
        {(
          [
            ['painel', 'Painel'],
            ['importar', 'Importar'],
          ] as [Aba, string][]
        ).map(([id, rotulo]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={aba === id}
            onClick={() => setAba(id)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              aba === id ? 'bg-white text-[#079C9C] shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {aba === 'painel' ? (
        <PainelFinanceiro
          dias={painel.dias}
          carregando={painel.loading}
          erro={painel.error}
          hoje={hoje}
          atualizacao={atualizacao}
          onImportar={() => setAba('importar')}
        />
      ) : (
        <>
          <ImportarDia onSalvo={atualizarTudo} pendentes={pendentes} />

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
                {dias.slice(0, 14).map((d) => {
                  const margem =
                    d.lucro !== null && d.vendas
                      ? Math.round((d.lucro / d.vendas) * 1000) / 10
                      : null

                  return (
                    <li
                      key={d.dia}
                      className="grid grid-cols-2 items-center gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm md:grid-cols-[9rem_repeat(4,minmax(0,1fr))]"
                    >
                      <div className="col-span-2 md:col-span-1">
                        <p className="font-semibold capitalize text-slate-900">
                          {rotuloDia(d.dia)}
                        </p>
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {d.fechado ? (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                              loja fechada
                            </span>
                          ) : (
                            <>
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
                            </>
                          )}
                        </div>
                      </div>

                      {d.fechado ? (
                        <p className="col-span-2 text-sm text-slate-400 md:col-span-4">
                          Sem expediente neste dia.
                        </p>
                      ) : (
                        <>
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
                            tom={
                              d.lucro === null
                                ? undefined
                                : d.lucro >= 0
                                  ? 'text-emerald-700'
                                  : 'text-red-600'
                            }
                          />
                        </>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}