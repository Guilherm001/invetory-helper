'use client'

import { Lock } from 'lucide-react'

export default function CampoSenha({
  valor,
  onChange,
  rotulo = 'Senha do caixa',
  autoFocus = false,
}: {
  valor: string
  onChange: (v: string) => void
  rotulo?: string
  autoFocus?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
        <Lock className="size-4 text-[#079C9C]" />
        {rotulo}
      </span>
      <input
        value={valor}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        type="password"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        autoFocus={autoFocus}
        placeholder="••••"
        aria-label={rotulo}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-center text-xl tracking-[0.5em] shadow-sm outline-none transition placeholder:tracking-normal focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20"
      />
    </div>
  )
}