'use client'

import { useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Banknote,
  ChevronLeft,
  ChevronRight,
  Info,
  Package,
  Receipt,
  ShoppingCart,
  TrendingUp,
  Upload,
} from 'lucide-react'
import { formatarReais } from '@/features/comparar-precos/utils/melhorPreco'
import type { DiaFinanceiro, ItemTop } from '../services/financeiroService'
import {
  agruparPorMes,
  mesAnterior,
  mesAtual,
  mesDe,
  mesSeguinte,
  resumirMes,
  variacaoPercentual,
} from '../utils/agregar'
import { useTopItens } from '../hooks/usePainel'
import { GraficoDiario, GraficoMensal } from './GraficosFinanceiro'

// só compara com o mês anterior quando ele tem dias suficientes
const MIN_DIAS_COMPARACAO = 5

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

const nomeMes = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1]} de ${mes.slice(0, 4)}`
const virgula = (n: number) => String(n).replace('.', ',')

function Delta({ valor, sufixo, invertido = false }: { valor: number | null; sufixo: string; invertido?: boolean }) {
  if (valor === null) return null
  const bom = invertido ? valor < 0 : valor > 0
  const cor = valor === 0 ? 'text-slate-500' : bom ? 'text-emerald-600' : 'text-red-600'
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${cor}`}>
      {valor > 0 && <ArrowUp className="size-3" />}
      {valor < 0 && <ArrowDown className="size-3" />}
      {virgula(Math.abs(valor))}
      {sufixo}
    </span>
  )
}

function Cartao({
  icone,
  rotulo,
  valor,
  tom,
  children,
  className = '',
}: {
  icone: React.ReactNode
  rotulo: string
  valor: string
  tom?: string
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      <div className="flex items-center gap-2 text-sm text-slate-500">
        {icone}
        {rotulo}
      </div>
      <p className={`mt-1 text-xl font-bold md:text-2xl ${tom ?? 'text-slate-900'}`}>{valor}</p>
      <div className="mt-0.5 space-y-0.5 text-xs text-slate-500">{children}</div>
    </div>
  )
}

function Secao({
  titulo,
  sub,
  children,
}: {
  titulo: string
  sub?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h4 className="text-sm font-semibold text-slate-700">{titulo}</h4>
      {sub && <p className="mb-3 text-xs text-slate-400">{sub}</p>}
      {!sub && <div className="mb-3" />}
      {children}
    </section>
  )
}

// ---------- itens que mais pesam ----------

function TopItens({ mes, atualizacao }: { mes: string; atualizacao: number }) {
  const { custo, lucro, erro, carregando } = useTopItens(mes, atualizacao)
  const [aba, setAba] = useState<'custo' | 'lucro'>('custo')

  const lista: ItemTop[] = aba === 'custo' ? custo : lucro.filter((i) => i.lucroEstimado !== null)
  const valorDe = (i: ItemTop) => (aba === 'custo' ? i.custo : (i.lucroEstimado ?? 0))
  const maior = Math.max(...lista.map(valorDe), 1)

  return (
    <Secao
      titulo="Itens que mais pesam"
      sub={
        aba === 'custo'
          ? 'Maior custo das saídas no mês.'
          : 'Lucro estimado pelo preço do catálogo, que pode diferir do preço vendido.'
      }
    >
      <div role="radiogroup" aria-label="Ordenar por" className="mb-3 flex gap-2">
        {(
          [
            ['custo', 'Maior custo'],
            ['lucro', 'Maior lucro'],
          ] as const
        ).map(([id, rotulo]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={aba === id}
            onClick={() => setAba(id)}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
              aba === id
                ? 'border-[#079C9C] bg-[#079C9C]/10 text-[#079C9C]'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {erro ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {erro}
        </p>
      ) : carregando ? (
        <p className="py-6 text-center text-sm text-slate-400">Carregando...</p>
      ) : lista.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">
          {aba === 'lucro'
            ? 'Sem itens com preço no catálogo neste mês.'
            : 'Sem movimentação importada neste mês.'}
        </p>
      ) : (
        <ol className="space-y-3">
          {lista.map((i, n) => (
            <li key={i.codigo}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-5 shrink-0 text-xs text-slate-400">{n + 1}º</span>
                  <span className="truncate font-medium text-slate-800" title={i.descricao}>
                    {i.descricao}
                  </span>
                </span>
                <span className="shrink-0 font-semibold text-slate-900">
                  {formatarReais(valorDe(i))}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-[#079C9C]/60"
                    style={{ width: `${Math.max(3, (valorDe(i) / maior) * 100)}%` }}
                  />
                </div>
                <span className="w-20 shrink-0 text-right text-[11px] text-slate-400">
                  {virgula(Math.round(i.unidades * 100) / 100)} un
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Secao>
  )
}

// ---------- painel ----------

export default function PainelFinanceiro({
  dias,
  carregando,
  erro,
  hoje,
  atualizacao,
  onImportar,
}: {
  dias: DiaFinanceiro[]
  carregando: boolean
  erro: string | null
  hoje: Date
  atualizacao: number
  onImportar: () => void
}) {
  const atual = mesAtual(hoje)
  const [mes, setMes] = useState(atual)

  const resumo = resumirMes(mes, dias)
  const anterior = resumirMes(mesAnterior(mes), dias)
  const meses = agruparPorMes(dias)
  const diasDoMes = dias.filter((d) => mesDe(d.dia) === mes)

  const comparar = anterior.diasComVenda >= MIN_DIAS_COMPARACAO
  const deltaMedia = comparar ? variacaoPercentual(resumo.mediaVendas, anterior.mediaVendas) : null
  const deltaMargem =
    comparar && resumo.margem !== null && anterior.margem !== null
      ? Math.round((resumo.margem - anterior.margem) * 10) / 10
      : null

  const fiadoVariacao = Math.round((resumo.fiadoFeito - resumo.fiadoPago) * 100) / 100

  const p = resumo.pagamentos
  const formas = (
    [
      ['Cartão', p.cartao, 'bg-[#079C9C]'],
      ['Dinheiro', p.dinheiro, 'bg-emerald-500'],
      ['PIX', p.pix, 'bg-indigo-500'],
      ['Crédito do cliente', p.credito, 'bg-amber-500'],
      ['Cheque e duplicata', p.outros, 'bg-slate-400'],
    ] as [string, number, string][]
  ).filter(([, v]) => v > 0)
  const totalFormas = formas.reduce((s, [, v]) => s + v, 0)

  const vazio = resumo.diasComVenda === 0

  return (
    <div className="space-y-4">
      {/* Mês */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          aria-label="Mês anterior"
          onClick={() => setMes(mesAnterior(mes))}
          className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:border-[#079C9C] hover:text-[#079C9C]"
        >
          <ChevronLeft className="size-5" />
        </button>
        <h4 className="text-lg font-bold capitalize text-slate-900">{nomeMes(mes)}</h4>
        <button
          type="button"
          aria-label="Próximo mês"
          disabled={mes >= atual}
          onClick={() => setMes(mesSeguinte(mes))}
          className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:border-[#079C9C] hover:text-[#079C9C] disabled:opacity-40"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      {erro && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {erro}
        </p>
      )}

      {carregando ? (
        <p className="py-10 text-center text-sm text-slate-400">Carregando painel...</p>
      ) : vazio ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
          <p className="text-base font-semibold text-slate-700">Sem dados neste mês</p>
          <p className="max-w-sm text-sm text-slate-500">
            Importe o fechamento dos dias para ver vendas, custo e lucro.
          </p>
          <button
            type="button"
            onClick={onImportar}
            className="flex items-center gap-2 rounded-lg bg-[#079C9C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#079C9C]/90"
          >
            <Upload className="size-4" />
            Importar fechamentos
          </button>
        </div>
      ) : (
        <>
          {/* Avisos de poucos dados */}
          {(resumo.diasComVenda < 7 || resumo.diasSemMovimentacao > 0) && (
            <div className="space-y-1 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
              {resumo.diasComVenda < 7 && (
                <p className="flex items-start gap-2">
                  <Info className="mt-0.5 size-3.5 shrink-0" />
                  {resumo.diasComVenda === 1
                    ? 'Só 1 dia neste mês.'
                    : `Só ${resumo.diasComVenda} dias neste mês.`}{' '}
                  Os números já valem, mas médias e comparações ficam mais confiáveis com mais
                  dias.
                </p>
              )}
              {resumo.diasSemMovimentacao > 0 && (
                <p className="flex items-start gap-2">
                  <Info className="mt-0.5 size-3.5 shrink-0" />
                  {resumo.diasSemMovimentacao}{' '}
                  {resumo.diasSemMovimentacao === 1 ? 'dia está' : 'dias estão'} sem movimentação
                  importada. Custo e lucro contam só os dias completos.
                </p>
              )}
            </div>
          )}

          {/* Cartões */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Cartao
              icone={<ShoppingCart className="size-4 text-[#079C9C]" />}
              rotulo="Vendas"
              valor={formatarReais(resumo.vendas)}
            >
              <p>
                {resumo.diasComVenda} {resumo.diasComVenda === 1 ? 'dia' : 'dias'}
                {resumo.mediaVendas !== null && ` · média ${formatarReais(resumo.mediaVendas)}/dia`}
              </p>
              {deltaMedia !== null && (
                <p>
                  <Delta valor={deltaMedia} sufixo="%" /> na média vs. {nomeMes(anterior.mes).split(' ')[0]}
                </p>
              )}
            </Cartao>

            <Cartao
              icone={<TrendingUp className="size-4 text-[#079C9C]" />}
              rotulo="Lucro bruto"
              valor={resumo.diasCompletos > 0 ? formatarReais(resumo.lucro) : '—'}
              tom={resumo.lucro >= 0 ? 'text-emerald-700' : 'text-red-600'}
            >
              {resumo.margem !== null ? (
                <p>
                  margem de {virgula(resumo.margem)}%
                  {deltaMargem !== null && (
                    <>
                      {' '}
                      <Delta valor={deltaMargem} sufixo=" p.p." />
                    </>
                  )}
                </p>
              ) : (
                <p>falta a movimentação</p>
              )}
              <p>
                {resumo.diasCompletos} de {resumo.diasComVenda} dias completos
              </p>
            </Cartao>

            <Cartao
              icone={<Package className="size-4 text-[#079C9C]" />}
              rotulo="Custo"
              valor={resumo.diasCompletos > 0 ? formatarReais(resumo.custo) : '—'}
            >
              <p>das saídas, já sem devoluções</p>
            </Cartao>

            <Cartao
              icone={<Banknote className="size-4 text-[#079C9C]" />}
              rotulo="Recebido"
              valor={formatarReais(resumo.recebido)}
            >
              <p>dinheiro + PIX + cartão</p>
            </Cartao>

            <Cartao
              icone={<Receipt className="size-4 text-[#079C9C]" />}
              rotulo="Fiado no mês"
              valor={`${fiadoVariacao >= 0 ? '+' : '−'}${formatarReais(Math.abs(fiadoVariacao))}`}
              tom={fiadoVariacao > 0 ? 'text-amber-600' : 'text-slate-900'}
              className="col-span-2 lg:col-span-1"
            >
              <p>
                feito {formatarReais(resumo.fiadoFeito)} · recebido {formatarReais(resumo.fiadoPago)}
              </p>
              <p>{fiadoVariacao > 0 ? 'o fiado cresceu' : fiadoVariacao < 0 ? 'o fiado diminuiu' : 'sem variação'}</p>
            </Cartao>
          </div>

          {/* Gráficos */}
          <Secao
            titulo="Dia a dia"
            sub="Vendas, custo e lucro de cada dia. Dias sem movimentação ficam sem custo e sem lucro."
          >
            <GraficoDiario dias={diasDoMes} />
          </Secao>

          <Secao
            titulo="Mês a mês"
            sub="Últimos 12 meses. Custo e lucro contam só os dias com movimentação importada."
          >
            <GraficoMensal meses={meses} />
          </Secao>

          {/* Formas de pagamento */}
          {formas.length > 0 && (
            <Secao
              titulo="Formas de pagamento"
              sub="Tudo que entrou no caixa, incluindo fiado antigo pago."
            >
              <div className="mb-4 flex h-3 overflow-hidden rounded-full bg-slate-100">
                {formas.map(([nome, valor, cor]) => (
                  <div
                    key={nome}
                    className={cor}
                    style={{ width: `${(valor / totalFormas) * 100}%` }}
                    title={`${nome}: ${formatarReais(valor)}`}
                  />
                ))}
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {formas.map(([nome, valor, cor]) => (
                  <li key={nome} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2 text-slate-600">
                      <span className={`size-2.5 rounded-full ${cor}`} />
                      {nome}
                    </span>
                    <span className="font-medium text-slate-900">
                      {formatarReais(valor)}{' '}
                      <span className="text-xs font-normal text-slate-400">
                        {virgula(Math.round((valor / totalFormas) * 1000) / 10)}%
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </Secao>
          )}

          <TopItens mes={mes} atualizacao={atualizacao} />
        </>
      )}
    </div>
  )
}