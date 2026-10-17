'use client'

import { useState } from 'react'
import { AlertCircle, Banknote, Check, CreditCard, Loader2, QrCode, Wallet } from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog'
import SeletorCliente from '@/features/clientes/components/SeletorCliente'
import type { Cliente } from '@/features/clientes/services/clientesService'
import { clienteInfo, receberPendencia } from '../services/caixaService'
import type { ClienteInfo } from '../types'
import { paraNumero } from '../lib/calculos'
import { reais, virgula } from '../lib/formatar'
import CampoSenha from './CampoSenha'

type FormaReceber = 'dinheiro' | 'pix' | 'debito' | 'credito'

const FORMAS: { id: FormaReceber; rotulo: string; icone: typeof Banknote }[] = [
  { id: 'dinheiro', rotulo: 'Dinheiro', icone: Banknote },
  { id: 'pix', rotulo: 'PIX', icone: QrCode },
  { id: 'debito', rotulo: 'Débito', icone: CreditCard },
  { id: 'credito', rotulo: 'Crédito', icone: CreditCard },
]

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20'

function Conteudo({ onClose, onFeito }: { onClose: () => void; onFeito: () => void }) {
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [info, setInfo] = useState<ClienteInfo | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [valor, setValor] = useState('')
  const [forma, setForma] = useState<FormaReceber>('dinheiro')
  const [pin, setPin] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [feito, setFeito] = useState<{ nome: string; valor: number; restante: number } | null>(null)

  const escolher = async (c: Cliente) => {
    setCliente(c)
    setInfo(null)
    setErro('')
    setCarregando(true)
    try {
      const i = await clienteInfo(c.id)
      setInfo(i)
      setValor(i.devendo > 0 ? virgula(i.devendo) : '')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar o cliente')
    } finally {
      setCarregando(false)
    }
  }

  const limpar = () => {
    setCliente(null)
    setInfo(null)
    setValor('')
    setErro('')
  }

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cliente || !info) return setErro('Escolha o cliente.')
    const v = paraNumero(valor)
    if (!Number.isFinite(v) || v <= 0) return setErro('Informe um valor maior que zero.')
    if (v > info.devendo) return setErro(`O valor passa da dívida (${reais(info.devendo)}).`)
    if (pin.length < 4) return setErro('Digite a senha do caixa.')

    setEnviando(true)
    setErro('')
    try {
      const r = await receberPendencia(pin, cliente.id, v, forma)
      setFeito({ nome: cliente.nome, valor: v, restante: r.restante })
      onFeito()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível receber')
      setPin('')
    } finally {
      setEnviando(false)
    }
  }

  const header = (
    <DialogHeader className="shrink-0 bg-[#079C9C] px-6 py-4 text-left">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-white/20">
          <Wallet className="size-6 text-white" />
        </div>
        <div>
          <DialogTitle className="text-xl font-bold text-white">Receber pendência</DialogTitle>
          <DialogDescription className="text-sm text-white/80">
            O cliente paga o que deve da loja
          </DialogDescription>
        </div>
      </div>
    </DialogHeader>
  )

  if (feito) {
    return (
      <>
        {header}
        <div className="flex flex-col items-center gap-4 px-6 py-8 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <Check className="size-8" strokeWidth={3} />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-900">{reais(feito.valor)} recebidos</p>
            <p className="text-sm text-slate-500">de {feito.nome}</p>
          </div>
          <p className="text-sm text-slate-600">
            {feito.restante > 0
              ? `Ainda deve ${reais(feito.restante)}.`
              : 'Não deve mais nada. Pendência quitada.'}
          </p>
          <Button onClick={onClose} className="bg-[#079C9C] text-white hover:bg-[#079C9C]/90">
            Concluir
          </Button>
        </div>
      </>
    )
  }

  return (
    <>
      {header}
      <form onSubmit={enviar} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
        <div className="space-y-1.5">
          <span className="block text-sm font-semibold text-slate-700">Cliente</span>
          <SeletorCliente
            vinculo={cliente}
            carregando={false}
            onEscolher={escolher}
            onLimpar={limpar}
          />
        </div>

        {carregando && (
          <p className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="size-4 animate-spin" />
            Conferindo o que ele deve...
          </p>
        )}

        {info && (
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Deve</p>
              <p className={`text-xl font-bold ${info.devendo > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                {reais(info.devendo)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Vencido</p>
              <p className={`text-xl font-bold ${info.vencido > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                {reais(info.vencido)}
              </p>
            </div>
          </div>
        )}

        {info && info.devendo <= 0 && (
          <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">
            Este cliente não tem pendência em aberto.
          </p>
        )}

        {info && info.devendo > 0 && (
          <>
            <div className="space-y-1.5">
              <span className="block text-sm font-semibold text-slate-700">Valor recebido (R$)</span>
              <input
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                inputMode="decimal"
                placeholder="0,00"
                aria-label="Valor recebido"
                className={`${inputClass} text-xl font-bold`}
              />
              <button
                type="button"
                onClick={() => setValor(virgula(info.devendo))}
                className="text-sm font-semibold text-[#079C9C] hover:underline"
              >
                Pagar tudo ({reais(info.devendo)})
              </button>
              <p className="text-xs text-slate-400">
                O pagamento abate primeiro as dívidas mais antigas.
              </p>
            </div>

            <div className="space-y-1.5">
              <span className="block text-sm font-semibold text-slate-700">Como o cliente pagou</span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {FORMAS.map(({ id, rotulo, icone: Icone }) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={forma === id}
                    onClick={() => setForma(id)}
                    className={`flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-3 text-sm font-semibold transition active:scale-95 ${
                      forma === id
                        ? 'border-[#079C9C] bg-[#079C9C]/10 text-[#079C9C]'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <Icone className="size-6" />
                    {rotulo}
                  </button>
                ))}
              </div>
            </div>

            <CampoSenha valor={pin} onChange={setPin} />
          </>
        )}

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
            disabled={enviando || !info || info.devendo <= 0}
            className="min-w-40 gap-2 bg-[#079C9C] text-white hover:bg-[#079C9C]/90"
          >
            {enviando && <Loader2 className="size-4 animate-spin" />}
            Receber
          </Button>
        </div>
      </form>
    </>
  )
}

export default function ReceberPendenciaDialog({
  aberto,
  onClose,
  onFeito,
}: {
  aberto: boolean
  onClose: () => void
  onFeito: () => void
}) {
  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        className="top-[4%] flex max-h-[92dvh] translate-y-0 flex-col gap-0 overflow-hidden border-slate-200 bg-white p-0 sm:max-w-[520px] [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:opacity-100"
      >
        {aberto && <Conteudo onClose={onClose} onFeito={onFeito} />}
      </DialogContent>
    </Dialog>
  )
}