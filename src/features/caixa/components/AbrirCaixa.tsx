'use client'

import { useState } from 'react'
import { AlertCircle, Loader2, Lock } from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import { abrirCaixa } from '../services/caixaService'
import { paraNumero } from '../lib/calculos'
import { dataHora } from '../lib/formatar'
import CampoSenha from './CampoSenha'

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20'

export default function AbrirCaixa({
  ocupadoPor,
  ocupadoDesde,
  onAberto,
}: {
  ocupadoPor?: string
  ocupadoDesde?: string
  onAberto: () => void
}) {
  const [troco, setTroco] = useState('')
  const [pin, setPin] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    const valor = troco.trim() === '' ? 0 : paraNumero(troco)
    if (!Number.isFinite(valor) || valor < 0) {
      setErro('Valor de abertura inválido.')
      return
    }
    if (pin.length < 4) {
      setErro('Digite a senha do caixa (de 4 a 6 números).')
      return
    }

    setEnviando(true)
    setErro('')
    try {
      await abrirCaixa(pin, valor)
      onAberto()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível abrir o caixa')
      setPin('')
      setEnviando(false)
    }
  }

  return (
    <form
      onSubmit={enviar}
      className="mx-auto w-full max-w-md space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-xl bg-[#079C9C]/10 text-[#079C9C]">
          <Lock className="size-6" />
        </div>
        <div>
          <p className="text-xl font-bold text-slate-900">Caixa fechado</p>
          <p className="text-sm text-slate-500">Abra o caixa para receber os pedidos.</p>
        </div>
      </div>

      {ocupadoPor && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Já existe um caixa aberto por <strong>{ocupadoPor}</strong>
          {ocupadoDesde ? ` desde ${dataHora(ocupadoDesde)}` : ''}, em outro acesso. Ele precisa
          ser fechado antes de abrir um novo.
        </p>
      )}

      <div className="space-y-1.5">
        <span className="block text-sm font-semibold text-slate-700">Troco inicial (R$)</span>
        <input
          value={troco}
          onChange={(e) => setTroco(e.target.value)}
          inputMode="decimal"
          placeholder="0,00"
          aria-label="Troco inicial"
          className={inputClass}
        />
        <div className="flex flex-wrap gap-2 pt-1">
          {['0', '50', '100', '200'].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setTroco(v)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-medium text-slate-600 hover:border-[#079C9C] hover:text-[#079C9C]"
            >
              {v === '0' ? 'Sem troco' : `R$ ${v}`}
            </button>
          ))}
        </div>
      </div>

      <CampoSenha valor={pin} onChange={setPin} autoFocus />

      {erro && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {erro}
        </p>
      )}

      <Button
        type="submit"
        disabled={enviando || !!ocupadoPor}
        className="w-full gap-2 bg-[#079C9C] py-6 text-base text-white hover:bg-[#079C9C]/90"
      >
        {enviando && <Loader2 className="size-4 animate-spin" />}
        Abrir caixa
      </Button>
    </form>
  )
}