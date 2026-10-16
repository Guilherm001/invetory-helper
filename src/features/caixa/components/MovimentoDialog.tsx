'use client'

import { useState } from 'react'
import { AlertCircle, ArrowDownToLine, ArrowUpFromLine, Loader2 } from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog'
import { lancarMovimento } from '../services/caixaService'
import { paraNumero } from '../lib/calculos'
import CampoSenha from './CampoSenha'

type Tipo = 'sangria' | 'suprimento'

const MOTIVOS: Record<Tipo, string[]> = {
  sangria: ['Depósito no banco', 'Pagamento de fornecedor', 'Despesa da loja', 'Retirada do dono'],
  suprimento: ['Troco', 'Reforço de caixa'],
}

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20'

function Conteudo({ tipo, onClose, onFeito }: { tipo: Tipo; onClose: () => void; onFeito: () => void }) {
  const [valor, setValor] = useState('')
  const [motivo, setMotivo] = useState('')
  const [pin, setPin] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const sangria = tipo === 'sangria'

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    const v = paraNumero(valor)
    if (!Number.isFinite(v) || v <= 0) return setErro('Informe um valor maior que zero.')
    if (motivo.trim().length < 3) return setErro('Informe o motivo.')
    if (pin.length < 4) return setErro('Digite a senha do caixa.')

    setEnviando(true)
    setErro('')
    try {
      await lancarMovimento(pin, tipo, v, motivo.trim())
      onFeito()
      onClose()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível lançar')
      setPin('')
      setEnviando(false)
    }
  }

  return (
    <>
      <DialogHeader className="shrink-0 bg-[#079C9C] px-6 py-4 text-left">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-white/20">
            {sangria ? (
              <ArrowUpFromLine className="size-6 text-white" />
            ) : (
              <ArrowDownToLine className="size-6 text-white" />
            )}
          </div>
          <div>
            <DialogTitle className="text-xl font-bold text-white">
              {sangria ? 'Sangria' : 'Suprimento'}
            </DialogTitle>
            <DialogDescription className="text-sm text-white/80">
              {sangria ? 'Retirada de dinheiro do caixa' : 'Entrada de dinheiro no caixa'}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <form onSubmit={enviar} className="space-y-4 px-6 py-5">
        <div className="space-y-1.5">
          <span className="block text-sm font-semibold text-slate-700">Valor (R$)</span>
          <input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            inputMode="decimal"
            placeholder="0,00"
            autoFocus
            aria-label="Valor"
            className={inputClass}
          />
        </div>

        <div className="space-y-1.5">
          <span className="block text-sm font-semibold text-slate-700">Motivo</span>
          <div className="flex flex-wrap gap-2">
            {MOTIVOS[tipo].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMotivo(m)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                  motivo === m
                    ? 'border-[#079C9C] bg-[#079C9C]/10 text-[#079C9C]'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={200}
            placeholder="Ou escreva o motivo"
            aria-label="Motivo"
            className={inputClass}
          />
        </div>

        <CampoSenha valor={pin} onChange={setPin} />

        {erro && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {erro}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={enviando}>
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={enviando}
            className="min-w-36 gap-2 bg-[#079C9C] text-white hover:bg-[#079C9C]/90"
          >
            {enviando && <Loader2 className="size-4 animate-spin" />}
            Lançar {sangria ? 'sangria' : 'suprimento'}
          </Button>
        </div>
      </form>
    </>
  )
}

export default function MovimentoDialog({
  tipo,
  onClose,
  onFeito,
}: {
  tipo: Tipo | null
  onClose: () => void
  onFeito: () => void
}) {
  return (
    <Dialog open={tipo !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="top-[6%] flex max-h-[92dvh] translate-y-0 flex-col gap-0 overflow-hidden border-slate-200 bg-white p-0 sm:max-w-[460px] [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:opacity-100">
        {tipo && <Conteudo key={tipo} tipo={tipo} onClose={onClose} onFeito={onFeito} />}
      </DialogContent>
    </Dialog>
  )
}