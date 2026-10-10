'use client'

import Link from 'next/link'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Calculator,
  Tag,
  TrendingDown,
  TrendingUp,
  Trophy,
} from 'lucide-react'
import { useHistorico } from '../hooks/useHistorico'
import { formatarVariacao } from '../utils/estatisticas'
import { formatarReais } from '@/features/comparar-precos/utils/melhorPreco'
import GraficoPrecos from './GraficoPrecos'

const data = (iso: string) => new Date(iso).toLocaleDateString('pt-BR')

// a URL pode chegar codificada (c%3A123); se já vier decodificada, mantém
function decodificar(chave: string) {
  try {
    return decodeURIComponent(chave)
  } catch {
    return chave
  }
}

function Variacao({ valor }: { valor: number | null }) {
  if (valor === null) return <span className="text-sm text-slate-400">sem comparação</span>
  if (valor === 0) return <span className="text-sm font-semibold text-slate-500">0%</span>
  const subiu = valor > 0
  return (
    <span
      className={`inline-flex items-center gap-1 text-sm font-semibold ${
        subiu ? 'text-red-600' : 'text-emerald-600'
      }`}
    >
      {subiu ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
      {formatarVariacao(valor)}
    </span>
  )
}

export default function HistoricoItem({ chave }: { chave: string }) {
  const { produtos, loading, error } = useHistorico()
  const produto = produtos.find((p) => p.chave === decodificar(chave))

  const voltar = (
    <Link
      href="/historico-precos"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-[#079C9C]"
    >
      <ArrowLeft className="size-4" />
      Todo o histórico
    </Link>
  )

  if (loading) {
    return <p className="py-16 text-center text-sm text-slate-400">Carregando histórico...</p>
  }

  if (error || !produto) {
    return (
      <div className="space-y-4 py-8">
        {voltar}
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error ?? 'Item não encontrado no histórico.'}
        </p>
      </div>
    )
  }

  // mais recentes primeiro
  const cotacoes = [...produto.cotacoes].reverse()
  const un = produto.unidade ? ` / ${produto.unidade}` : ''

  return (
    <div className="w-full space-y-6 pb-16">
      <div className="mt-7 space-y-3">
        {voltar}
        <div>
          <h3 className="text-2xl font-bold md:text-3xl">{produto.nome}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-400">
            {produto.codigo && <span>Cód. {produto.codigo}</span>}
            <span>
              {produto.rodadas.length}{' '}
              {produto.rodadas.length === 1 ? 'comparação' : 'comparações'} ·{' '}
              {produto.cotacoes.length} {produto.cotacoes.length === 1 ? 'cotação' : 'cotações'}
            </span>
            {produto.subiu && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                <TrendingUp className="size-3" />
                Preço subiu
              </span>
            )}
            {!produto.subiu && produto.ehMenorHistorico && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                <TrendingDown className="size-3" />
                Menor preço histórico
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Cartões */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Trophy className="size-4 text-[#079C9C]" />
            Menor já visto
          </div>
          <p className="mt-1 text-xl font-bold text-slate-900 md:text-2xl">
            {formatarReais(produto.menor.preco)}
          </p>
          <p className="truncate text-xs text-slate-500" title={produto.menor.fornecedorNome}>
            {produto.menor.fornecedorNome} · {data(produto.menor.data)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Calculator className="size-4 text-[#079C9C]" />
            Preço médio
          </div>
          <p className="mt-1 text-xl font-bold text-slate-900 md:text-2xl">
            {formatarReais(produto.media)}
          </p>
          <p className="text-xs text-slate-500">de todas as cotações{un}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Tag className="size-4 text-[#079C9C]" />
            Último preço
          </div>
          <p className="mt-1 text-xl font-bold text-slate-900 md:text-2xl">
            {formatarReais(produto.ultimo)}
          </p>
          <div className="text-xs">
            <Variacao valor={produto.variacao} />
            {produto.variacao !== null && (
              <span className="text-slate-400"> vs. comparação anterior</span>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <TrendingUp className="size-4 text-[#079C9C]" />
            Variação total
          </div>
          <p className="mt-1 text-xl font-bold md:text-2xl">
            {produto.variacaoTotal === null ? (
              <span className="text-slate-300">—</span>
            ) : (
              <Variacao valor={produto.variacaoTotal} />
            )}
          </p>
          <p className="text-xs text-slate-500">da primeira à última comparação</p>
        </div>
      </div>

      {/* Gráfico */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h4 className="mb-3 text-sm font-semibold text-slate-700">Evolução do preço</h4>
        <GraficoPrecos cotacoes={produto.cotacoes} />
      </div>

      {/* Cotações */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-slate-700">Todas as cotações</h4>

        <div className="hidden grid-cols-[6rem_minmax(0,1fr)_minmax(0,1fr)_8rem] gap-4 px-4 text-xs font-semibold uppercase tracking-wide text-slate-400 md:grid">
          <span>Data</span>
          <span>Comparação</span>
          <span>Fornecedor</span>
          <span className="text-right">Preço</span>
        </div>

        <ul className="space-y-2">
          {cotacoes.map((c) => {
            const menor = c.preco === produto.menor.preco
            return (
              <li
                key={c.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-0.5 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm md:grid-cols-[6rem_minmax(0,1fr)_minmax(0,1fr)_8rem]"
              >
                <span className="order-2 text-xs text-slate-400 md:order-none md:text-sm md:text-slate-600">
                  {data(c.data)}
                </span>

                <Link
                  href={`/comparar-precos/${c.comparacaoId}`}
                  className="order-1 min-w-0 truncate text-sm font-medium text-[#079C9C] hover:underline md:order-none"
                  title={c.comparacaoNome}
                >
                  {c.comparacaoNome}
                </Link>

                <span className="order-3 min-w-0 truncate text-sm text-slate-600 md:order-none">
                  {c.fornecedorNome}
                </span>

                <span
                  className={`order-1 row-span-2 text-right font-bold md:order-none md:row-span-1 ${
                    menor ? 'text-emerald-700' : 'text-slate-900'
                  }`}
                >
                  {formatarReais(c.preco)}
                  {menor && <Trophy className="ml-1 inline size-3.5" aria-label="Menor preço" />}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}