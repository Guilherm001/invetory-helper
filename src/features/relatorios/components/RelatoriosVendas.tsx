'use client'

import { useState } from 'react'
import { resolver, type PeriodoEscolhido } from '../lib/periodo'
import SeletorPeriodo from './SeletorPeriodo'
import RelatorioVendedores from './RelatorioVendedores'
import RelatorioOrcamentos from './RelatorioOrcamentos'
import RelatorioItensVendidos from './RelatorioItensVendidos'

type Aba = 'vendedores' | 'orcamentos' | 'itens'

// [id, nome no celular, nome no PC]
const ABAS: [Aba, string, string][] = [
  ['vendedores', 'Vendedores', 'Vendas por vendedor'],
  ['orcamentos', 'Orçamentos', 'Orçamentos'],
  ['itens', 'Itens', 'Itens mais vendidos'],
]

export default function RelatoriosVendas() {
  const [aba, setAba] = useState<Aba>('vendedores')
  const [periodo, setPeriodo] = useState<PeriodoEscolhido>({ id: 'mes', de: '', ate: '' })
  const { atual, anterior } = resolver(periodo)

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4 md:p-5">
      <div>
        <h4 className="text-lg font-bold text-slate-900">Relatórios de vendas</h4>
        <p className="text-sm text-slate-500">
          Baseados nos pedidos e orçamentos registrados no sistema. Cancelados não entram.
        </p>
      </div>

      <SeletorPeriodo valor={periodo} onChange={setPeriodo} atual={atual} anterior={anterior} />

      <div className="grid grid-cols-3 border-b border-slate-200">
        {ABAS.map(([id, curto, longo]) => (
          <button
            key={id}
            type="button"
            onClick={() => setAba(id)}
            className={`py-2.5 text-sm font-semibold transition ${
              aba === id
                ? 'border-b-2 border-[#079C9C] text-[#079C9C]'
                : 'border-b-2 border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <span className="sm:hidden">{curto}</span>
            <span className="hidden sm:inline">{longo}</span>
          </button>
        ))}
      </div>

      {aba === 'vendedores' && <RelatorioVendedores atual={atual} anterior={anterior} />}
      {aba === 'orcamentos' && <RelatorioOrcamentos atual={atual} anterior={anterior} />}
      {aba === 'itens' && <RelatorioItensVendidos atual={atual} anterior={anterior} />}
    </section>
  )
}