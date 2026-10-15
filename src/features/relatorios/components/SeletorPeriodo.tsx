'use client'

import type { Intervalo, PeriodoEscolhido, PeriodoId } from '../lib/periodo'
import { dataCurtaBR } from '../lib/relatorioUtils'

const OPCOES: [PeriodoId, string][] = [
  ['hoje', 'Hoje'],
  ['7d', '7 dias'],
  ['30d', '30 dias'],
  ['mes', 'Este mês'],
  ['mes_passado', 'Mês passado'],
  ['personalizado', 'Personalizado'],
]

const textoIntervalo = (i: Intervalo) =>
  i.ini === i.fim ? dataCurtaBR(i.ini) : `${dataCurtaBR(i.ini)} a ${dataCurtaBR(i.fim)}`

const campoData =
  'rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20'

export default function SeletorPeriodo({
  valor,
  onChange,
  atual,
  anterior,
}: {
  valor: PeriodoEscolhido
  onChange: (p: PeriodoEscolhido) => void
  atual: Intervalo
  anterior: Intervalo
}) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
        {OPCOES.map(([id, rotulo]) => (
          <button
            key={id}
            type="button"
            aria-pressed={valor.id === id}
            onClick={() =>
              onChange(
                id === 'personalizado'
                  ? { id, de: atual.ini, ate: atual.fim }
                  : { ...valor, id }
              )
            }
            className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
              valor.id === id
                ? 'border-[#079C9C] bg-[#079C9C]/10 text-[#079C9C]'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {valor.id === 'personalizado' && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          De
          <input
            type="date"
            value={valor.de}
            onChange={(e) => onChange({ ...valor, de: e.target.value })}
            className={campoData}
          />
          até
          <input
            type="date"
            value={valor.ate}
            onChange={(e) => onChange({ ...valor, ate: e.target.value })}
            className={campoData}
          />
        </div>
      )}

      <p className="text-xs text-slate-400">
        {textoIntervalo(atual)} · comparando com {textoIntervalo(anterior)}
      </p>
    </div>
  )
}