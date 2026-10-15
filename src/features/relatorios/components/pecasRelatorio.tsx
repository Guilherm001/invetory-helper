'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { AlertCircle, ArrowDownRight, ArrowUpRight, Loader2, Minus } from 'lucide-react'
import { pct, variacao } from '../lib/relatorioUtils'

export const TH = 'px-3 py-2 text-left font-semibold'
export const THD = 'px-3 py-2 text-right font-semibold'
export const TD = 'px-3 py-2.5'
export const TDD = 'px-3 py-2.5 text-right tabular-nums'

// busca os dados sempre que a "chave" muda
export function useCarregar<T>(buscar: () => Promise<T>, chave: string) {
  const [dados, setDados] = useState<T | null>(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let vivo = true
    setCarregando(true)
    setErro('')
    buscar()
      .then((d) => {
        if (vivo) setDados(d)
      })
      .catch((e) => {
        if (vivo) setErro(e instanceof Error ? e.message : 'Erro ao carregar o relatório')
      })
      .finally(() => {
        if (vivo) setCarregando(false)
      })
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave])

  return { dados, erro, carregando }
}

export function Cartao({
  rotulo,
  valor,
  children,
}: {
  rotulo: string
  valor: string
  children?: ReactNode
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{rotulo}</p>
      <p className="text-xl font-bold text-slate-900">{valor}</p>
      {children && <div className="mt-0.5 text-xs text-slate-500">{children}</div>}
    </div>
  )
}

export function Variacao({ atual, anterior }: { atual: number; anterior: number }) {
  const v = variacao(atual, anterior)
  if (v === null) return <span className="text-xs text-slate-400">sem base anterior</span>
  if (Math.abs(v) < 0.05)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-slate-500">
        <Minus className="size-3" />
        igual ao anterior
      </span>
    )
  const sobe = v > 0
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
        sobe ? 'text-emerald-600' : 'text-red-600'
      }`}
    >
      {sobe ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
      {pct(Math.abs(v))} <span className="font-normal text-slate-400">vs anterior</span>
    </span>
  )
}

export function Barra({ valor, cor = 'bg-[#079C9C]' }: { valor: number; cor?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className={`h-full rounded-full ${cor}`}
        style={{ width: `${Math.min(100, Math.max(0, valor))}%` }}
      />
    </div>
  )
}

export function Estado({
  carregando,
  erro,
  vazio,
  textoVazio,
}: {
  carregando: boolean
  erro: string
  vazio: boolean
  textoVazio: string
}) {
  if (carregando)
    return (
      <p className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
        <Loader2 className="size-4 animate-spin" />
        Carregando...
      </p>
    )
  if (erro)
    return (
      <p
        role="alert"
        className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
      >
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        {erro}
      </p>
    )
  if (vazio) return <p className="py-10 text-center text-sm text-slate-400">{textoVazio}</p>
  return null
}