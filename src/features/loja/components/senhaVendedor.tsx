'use client'

import { useRef, useState } from 'react'
import { AlertCircle, Loader2, Lock } from 'lucide-react'
import { Button } from '../../../../components/ui/button'

export default function SenhaVendedor({
  titulo,
  descricao,
  textoBotao,
  onConfirmar,
  onCancelar,
}: {
  titulo: string
  descricao?: string
  textoBotao: string
  // se der erro, lance uma Error: a mensagem aparece aqui
  onConfirmar: (pin: string) => Promise<void>
  onCancelar: () => void
}) {
  const [pin, setPin] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const pinRef = useRef<HTMLInputElement>(null)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (enviando) return
    if (pin.length < 4) {
      setErro('Digite a sua senha (de 4 a 6 números).')
      return
    }

    setEnviando(true)
    setErro('')
    try {
      await onConfirmar(pin)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível confirmar')
      setPin('')
      pinRef.current?.focus()
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form
      onSubmit={enviar}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancelar()
      }}
      className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#079C9C]/10 text-[#079C9C]">
          <Lock className="size-5" />
        </div>
        <div>
          <p className="text-lg font-bold text-slate-900">{titulo}</p>
          {descricao && <p className="mt-0.5 text-sm text-slate-500">{descricao}</p>}
        </div>
      </div>

      <input
        ref={pinRef}
        autoFocus
        value={pin}
        onChange={(e) => {
          setPin(e.target.value.replace(/\D/g, '').slice(0, 6))
          setErro('')
        }}
        type="password"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="Sua senha"
        aria-label="Senha do vendedor"
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-center text-2xl tracking-[0.5em] shadow-sm outline-none transition placeholder:text-base placeholder:tracking-normal placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20"
      />

      {erro && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {erro}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancelar} disabled={enviando}>
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={enviando || pin.length < 4}
          className="min-w-36 gap-2 bg-[#079C9C] text-white hover:bg-[#079C9C]/90"
        >
          {enviando ? <Loader2 className="size-4 animate-spin" /> : null}
          {textoBotao}
        </Button>
      </div>
    </form>
  )
}