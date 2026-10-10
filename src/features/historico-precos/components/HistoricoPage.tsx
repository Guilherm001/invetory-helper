'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  LineChart,
  Minus,
  Search,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react'
import { useHistorico } from '../hooks/useHistorico'
import { filtrar, formatarVariacao } from '../utils/estatisticas'
import { formatarReais } from '@/features/comparar-precos/utils/melhorPreco'
import type { ProdutoHistorico } from '../types'

type Filtro = 'todos' | 'subiu' | 'menor'

function Variacao({ valor }: { valor: number | null }) {
  if (valor === null) {
    return <span className="text-xs text-slate-400">sem comparação</span>
  }

  if (valor === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500">
        <Minus className="size-3.5" />
        0%
      </span>
    )
  }

  const subiu = valor > 0
  return (
    <span
      className={`inline-flex items-center gap-1 text-sm font-semibold ${
        subiu ? 'text-red-600' : 'text-emerald-600'
      }`}
    >
      {subiu ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
      {formatarVariacao(valor)}
    </span>
  )
}

function Selo({ produto }: { produto: ProdutoHistorico }) {
  if (produto.subiu) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
        <TrendingUp className="size-3" />
        Preço subiu
      </span>
    )
  }
  if (produto.ehMenorHistorico) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
        <TrendingDown className="size-3" />
        Menor preço histórico
      </span>
    )
  }
  return null
}

export default function HistoricoPage() {
  const { produtos, loading, error } = useHistorico()
  const [termo, setTermo] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')

  const contagem = useMemo(
    () => ({
      todos: produtos.length,
      subiu: produtos.filter((p) => p.subiu).length,
      menor: produtos.filter((p) => p.ehMenorHistorico).length,
    }),
    [produtos]
  )

  const visiveis = useMemo(() => {
    const porFiltro =
      filtro === 'subiu'
        ? produtos.filter((p) => p.subiu)
        : filtro === 'menor'
          ? produtos.filter((p) => p.ehMenorHistorico)
          : produtos
    return filtrar(porFiltro, termo)
  }, [produtos, filtro, termo])

  const filtros: { id: Filtro; label: string }[] = [
    { id: 'todos', label: 'Todos' },
    { id: 'subiu', label: 'Preço subiu' },
    { id: 'menor', label: 'Menor preço histórico' },
  ]

  return (
    <div className="w-full pb-10">
      <div className="mt-7 py-4">
        <h3 className="text-2xl font-bold md:text-3xl">Histórico de preços</h3>
        <p className="text-sm text-gray-400">
          Veja como o preço de cada item mudou nas suas comparações. Os valores são os que foram
          cotados, não necessariamente os pagos.
        </p>
      </div>

      {/* Busca */}
      <div className="relative mb-3 md:max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Buscar por nome ou código"
          className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20 md:text-sm"
        />
        {termo && (
          <button
            type="button"
            aria-label="Limpar busca"
            onClick={() => setTermo('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="-mx-4 mb-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <div role="radiogroup" aria-label="Filtro" className="flex gap-2">
          {filtros.map(({ id, label }) => {
            const ativo = filtro === id
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={ativo}
                onClick={() => setFiltro(id)}
                className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                  ativo
                    ? 'border-[#079C9C] bg-[#079C9C]/10 text-[#079C9C]'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {label}
                <span
                  className={`rounded-full px-1.5 text-xs ${
                    ativo ? 'bg-[#079C9C]/15' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {contagem[id]}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Carregando histórico...</p>
      ) : produtos.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-[#079C9C]/10 text-[#079C9C]">
            <LineChart className="size-6" />
          </div>
          <p className="text-base font-semibold text-slate-700">Ainda não há preços registrados</p>
          <p className="max-w-sm text-sm text-slate-500">
            O histórico aparece sozinho conforme você preenche preços nas comparações.
          </p>
          <Link
            href="/comparar-precos"
            className="rounded-lg bg-[#079C9C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#079C9C]/90"
          >
            Ir para Comparar preços
          </Link>
        </div>
      ) : visiveis.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500">
          Nenhum item encontrado.
        </p>
      ) : (
        <>
          {/* Cabeçalho (desktop) */}
          <div className="hidden grid-cols-[minmax(0,1fr)_8rem_9rem_7rem_2rem] items-center gap-4 px-5 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 md:grid">
            <span>Item</span>
            <span className="text-right">Último preço</span>
            <span>Variação</span>
            <span>Cotações</span>
            <span />
          </div>

          <ul className="space-y-2">
            {visiveis.map((p) => (
              <li key={p.chave}>
                <Link
                  href={`/historico-precos/${encodeURIComponent(p.chave)}`}
                  className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:-translate-y-px hover:border-[#079C9C]/40 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#079C9C] md:grid-cols-[minmax(0,1fr)_8rem_9rem_7rem_2rem] md:px-5"
                >
                  {/* nome e selo */}
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900" title={p.nome}>
                      {p.nome}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      {p.codigo && <span className="text-xs text-slate-400">Cód. {p.codigo}</span>}
                      <Selo produto={p} />
                    </div>
                  </div>

                  {/* preço */}
                  <div className="text-right">
                    <p className="font-bold text-slate-900">{formatarReais(p.ultimo)}</p>
                    {p.unidade && <p className="text-xs text-slate-400">por {p.unidade}</p>}
                  </div>

                  {/* variação */}
                  <div className="col-span-1 md:col-span-1">
                    <Variacao valor={p.variacao} />
                  </div>

                  {/* rodadas */}
                  <p className="text-right text-xs text-slate-500 md:text-left md:text-sm">
                    {p.rodadas.length} {p.rodadas.length === 1 ? 'comparação' : 'comparações'}
                  </p>

                  <ChevronRight className="hidden size-5 text-slate-300 transition group-hover:text-[#079C9C] md:block" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}