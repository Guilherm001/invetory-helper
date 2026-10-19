'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, FileCheck2 } from 'lucide-react'
import BotoesImpressao, { type AcoesImpressao } from '@/features/loja/components/BotoesImpressao'
import type { ResultadoFechamento } from '../../types'
import { pedidoDoCaixa } from '../../services/caixaService'
import { dataCurta, reais } from '../../lib/formatar'

const ACOES = ['Próximo pedido', 'Cupom', 'A4', 'PDF']

export default function PedidoFechadoPDV({
  resultado,
  onProximo,
}: {
  resultado: ResultadoFechamento
  onProximo: () => void
}) {
  const [col, setCol] = useState(0)
  const acoes = useRef<AcoesImpressao>(null)
  const montadoEm = useRef(0)

  useEffect(() => {
    montadoEm.current = Date.now()
  }, [])

  const ativar = (i: number) => {
    if (i === 0) onProximo()
    else if (i === 1) acoes.current?.cupom()
    else if (i === 2) acoes.current?.a4()
    else acoes.current?.pdf()
  }

  // ← → escolhem, Enter confirma
  const teclaRef = useRef<(e: KeyboardEvent) => void>(() => {})
  useEffect(() => {
    teclaRef.current = (e) => {
      if (e.defaultPrevented || document.querySelector('[role="dialog"]')) return
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        setCol((c) => Math.min(ACOES.length - 1, c + 1))
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        setCol((c) => Math.max(0, c - 1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        // ignora o Enter que fechou o pedido, se ele ainda estiver chegando
        if (!e.repeat && Date.now() - montadoEm.current > 400) ativar(col)
      }
    }
  })
  useEffect(() => {
    const f = (e: KeyboardEvent) => teclaRef.current(e)
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [])

  return (
    <div className="flex flex-col items-center gap-5 py-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
        <Check className="size-8" strokeWidth={3} />
      </div>

      <div>
        <p className="text-xs uppercase tracking-widest text-slate-500">Pedido fechado</p>
        <h4 className="font-mono text-2xl font-bold tabular-nums text-slate-100">Nº {resultado.numero}</h4>
        <p className="mt-1 font-mono text-5xl font-bold tabular-nums text-emerald-400">
          {reais(resultado.total_liquido)}
        </p>
        {resultado.desconto > 0 && (
          <p className="text-sm text-slate-400">com desconto de {reais(resultado.desconto)}</p>
        )}
        {resultado.credito_usado > 0 && (
          <p className="text-sm text-slate-400">crédito do cliente usado: {reais(resultado.credito_usado)}</p>
        )}
      </div>

      {resultado.troco > 0 && (
        <div className="rounded-md border border-emerald-600/60 bg-emerald-500/10 px-10 py-4">
          <p className="text-xs uppercase tracking-widest text-emerald-300">Devolver de troco</p>
          <p className="font-mono text-5xl font-bold tabular-nums text-emerald-400">{reais(resultado.troco)}</p>
        </div>
      )}

      {resultado.a_prazo > 0 && (
        <div className="rounded-md border border-amber-600/60 bg-amber-500/10 px-10 py-4">
          <p className="text-xs uppercase tracking-widest text-amber-300">Ficou a prazo</p>
          <p className="font-mono text-4xl font-bold tabular-nums text-amber-300">{reais(resultado.a_prazo)}</p>
          {resultado.vencimento && (
            <p className="text-sm text-amber-300">vence em {dataCurta(resultado.vencimento)}</p>
          )}
        </div>
      )}

      <div className="w-full max-w-lg space-y-3 rounded-md border border-slate-800 bg-slate-900 p-4">
        <p className="text-xs uppercase tracking-widest text-slate-500">
          ← → escolhem · Enter confirma
        </p>

        <div className="flex flex-wrap justify-center gap-2">
          {ACOES.map((nome, i) => (
            <button
              key={nome}
              type="button"
              tabIndex={-1}
              onClick={() => {
                setCol(i)
                ativar(i)
              }}
              className={`rounded-md border px-5 py-3 text-sm font-bold outline-none transition ${
                i === 0 ? 'min-w-44 text-base' : ''
              } ${
                col === i
                  ? 'border-emerald-400 bg-emerald-500/25 text-emerald-100 ring-2 ring-emerald-400/60'
                  : i === 0
                    ? 'border-emerald-700 bg-emerald-500/10 text-emerald-300 hover:border-emerald-500'
                    : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
              }`}
            >
              {i === 0 ? 'PRÓXIMO PEDIDO' : nome}
            </button>
          ))}
        </div>

        <BotoesImpressao
          ref={acoes}
          semBotoes
          centralizar
          carregar={() => pedidoDoCaixa(resultado.id)}
        />

        <p className="flex items-center justify-center gap-2 text-xs text-slate-600">
          <FileCheck2 className="size-3.5" />
          Cupom fiscal · em breve
        </p>
      </div>
    </div>
  )
}