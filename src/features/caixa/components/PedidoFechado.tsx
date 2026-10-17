'use client'

import { Check, FileCheck2 } from 'lucide-react'
import BotoesImpressao from '@/features/loja/components/BotoesImpressao'
import type { ResultadoFechamento } from '../types'
import { pedidoDoCaixa } from '../services/caixaService'
import { dataCurta, reais } from '../lib/formatar'

export default function PedidoFechado({
  resultado,
  onProximo,
}: {
  resultado: ResultadoFechamento
  onProximo: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-5 py-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
        <Check className="size-9" strokeWidth={3} />
      </div>

      <div>
        <h4 className="text-2xl font-bold text-slate-900">Pedido nº {resultado.numero} fechado</h4>
        <p className="mt-1 text-3xl font-bold text-[#079C9C]">{reais(resultado.total_liquido)}</p>
        {resultado.desconto > 0 && (
          <p className="text-sm text-slate-500">com desconto de {reais(resultado.desconto)}</p>
        )}
        {resultado.credito_usado > 0 && (
          <p className="text-sm text-slate-500">
            crédito do cliente usado: {reais(resultado.credito_usado)}
          </p>
        )}
      </div>

      {resultado.troco > 0 && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-8 py-4">
          <p className="text-sm text-emerald-700">Devolver de troco</p>
          <p className="text-4xl font-bold text-emerald-700">{reais(resultado.troco)}</p>
        </div>
      )}

      {resultado.a_prazo > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-8 py-4">
          <p className="text-sm text-amber-700">Ficou a prazo</p>
          <p className="text-3xl font-bold text-amber-700">{reais(resultado.a_prazo)}</p>
          {resultado.vencimento && (
            <p className="text-sm text-amber-700">vence em {dataCurta(resultado.vencimento)}</p>
          )}
        </div>
      )}

      <div className="w-full max-w-md space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          O cliente quer imprimir?
        </p>
        <BotoesImpressao centralizar carregar={() => pedidoDoCaixa(resultado.id)} />

        <button
          type="button"
          disabled
          title="A emissão fiscal ainda não está configurada"
          className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-400"
        >
          <FileCheck2 className="size-4" />
          Emitir cupom fiscal · em breve
        </button>
        <p className="text-xs text-slate-400">
          Se o cliente não quer nada, é só seguir para o próximo pedido.
        </p>
      </div>

      <button
        type="button"
        onClick={onProximo}
        autoFocus
        className="w-full max-w-md rounded-xl bg-[#079C9C] px-4 py-4 text-lg font-bold text-white shadow-sm transition hover:bg-[#079C9C]/90 active:scale-[0.99]"
      >
        Próximo pedido
      </button>
    </div>
  )
}