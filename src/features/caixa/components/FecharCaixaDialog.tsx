'use client'

import { useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog'
import { fecharCaixa } from '../services/caixaService'
import { paraNumero } from '../lib/calculos'
import type { Relatorio } from '../types'
import CampoSenha from './CampoSenha'
import { BotoesRelatorio, RelatorioConteudo } from './RelatorioCaixa'

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20'

function Conteudo({ onClose }: { onClose: () => void }) {
  const [contado, setContado] = useState('')
  const [obs, setObs] = useState('')
  const [pin, setPin] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null)

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    const v = paraNumero(contado)
    if (!Number.isFinite(v) || v < 0) return setErro('Informe quanto dinheiro tem na gaveta (pode ser 0).')
    if (pin.length < 4) return setErro('Digite a senha do caixa.')

    setEnviando(true)
    setErro('')
    try {
      setRelatorio(await fecharCaixa(pin, v, obs.trim()))
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível fechar o caixa')
      setPin('')
    } finally {
      setEnviando(false)
    }
  }

  // depois de fechar: o relatório com a diferença
  if (relatorio) {
    return (
      <>
        <DialogHeader className="shrink-0 bg-[#079C9C] px-6 py-4 text-left">
          <DialogTitle className="text-xl font-bold text-white">Caixa fechado</DialogTitle>
          <DialogDescription className="text-sm text-white/80">Confira o relatório do turno</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <RelatorioConteudo rel={relatorio} parcial={false} />
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-3.5">
          <BotoesRelatorio rel={relatorio} parcial={false} />
          <Button type="button" onClick={onClose} className="bg-[#079C9C] text-white hover:bg-[#079C9C]/90">
            Concluir
          </Button>
        </div>
      </>
    )
  }

  return (
    <>
      <DialogHeader className="shrink-0 bg-[#079C9C] px-6 py-4 text-left">
        <DialogTitle className="text-xl font-bold text-white">Fechar o caixa</DialogTitle>
        <DialogDescription className="text-sm text-white/80">
          Conte o dinheiro da gaveta. O sistema compara depois.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={enviar} className="space-y-4 px-6 py-5">
        <div className="space-y-1.5">
          <span className="block text-sm font-semibold text-slate-700">Dinheiro contado na gaveta (R$)</span>
          <input
            value={contado}
            onChange={(e) => setContado(e.target.value)}
            inputMode="decimal"
            placeholder="0,00"
            autoFocus
            aria-label="Dinheiro contado"
            className={`${inputClass} text-xl font-bold`}
          />
          <p className="text-xs text-slate-400">
            Conte tudo o que está na gaveta, incluindo o troco inicial. O valor esperado só aparece
            depois de confirmar.
          </p>
        </div>

        <div className="space-y-1.5">
          <span className="block text-sm font-semibold text-slate-700">Observação (opcional)</span>
          <textarea
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Ex: diferença de troco, cliente voltou..."
            className={`${inputClass} resize-none`}
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
            className="min-w-40 gap-2 bg-[#079C9C] text-white hover:bg-[#079C9C]/90"
          >
            {enviando && <Loader2 className="size-4 animate-spin" />}
            Fechar o caixa
          </Button>
        </div>
      </form>
    </>
  )
}

export default function FecharCaixaDialog({ aberto, onClose }: { aberto: boolean; onClose: () => void }) {
  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        className="top-[3%] flex max-h-[94dvh] translate-y-0 flex-col gap-0 overflow-hidden border-slate-200 bg-white p-0 sm:max-w-[600px] [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:opacity-100"
      >
        {aberto && <Conteudo onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}