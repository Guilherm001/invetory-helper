'use client'

import { Check, FileCheck2 } from 'lucide-react'
import BotoesImpressao from '@/features/loja/components/BotoesImpressao'
import type { ResultadoFechamento } from '../../types'
import { pedidoDoCaixa } from '../../services/caixaService'
import { dataCurta, reais } from '../../lib/formatar'

export default function PedidoFechadoPDV({
  resultado,
  onProximo,
}: {
  resultado: ResultadoFechamento
  onProximo: () => void
}) {
  return (
    <div
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          onProximo()
        }
      }}
      className="flex flex-col items-center gap-5 py-6 text-center"
    >
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

      <div className="w-full max-w-md space-y-3 rounded-md border border-slate-800 bg-slate-900 p-4">
        <p className="text-xs uppercase tracking-widest text-slate-500">O cliente quer imprimir?</p>
        <BotoesImpressao centralizar carregar={() => pedidoDoCaixa(resultado.id)} />

        <button
          type="button"
          disabled
          title="A emissão fiscal ainda não está configurada"
          className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-md border border-dashed border-slate-700 px-3 py-2.5 text-sm font-semibold text-slate-600"
        >
          <FileCheck2 className="size-4" />
          Emitir cupom fiscal · em breve
        </button>
      </div>

      <button
        type="button"
        onClick={onProximo}
        autoFocus
        className="w-full max-w-md rounded-md bg-emerald-500 px-4 py-4 text-lg font-bold text-slate-950 outline-none transition hover:bg-emerald-400 focus-visible:ring-4 focus-visible:ring-emerald-300/60"
      >
        PRÓXIMO PEDIDO ⏎
      </button>
    </div>
  )
}