'use client'

import { useEffect, useState } from 'react'
import { ArrowDownToLine, Loader2, Minus, Plus } from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog'
import {
  listMovements,
  type CatalogItem,
  type CatalogMovement,
} from '../services/catalogService'

interface Props {
  item: CatalogItem | null
  onClose: () => void
  onConfirm: (id: string, quantidade: number, nota: string) => Promise<void>
}

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20'

const stepperClass =
  'flex size-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-[#079C9C] hover:text-[#079C9C] active:scale-90'

const formatarNumero = (n: number) =>
  Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ',')

export default function EntradaDialog({ item, onClose, onConfirm }: Props) {
  const [quantidade, setQuantidade] = useState('1')
  const [nota, setNota] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [historico, setHistorico] = useState<CatalogMovement[]>([])

  useEffect(() => {
    if (!item) return
    setQuantidade('1')
    setNota('')
    setErrorMessage('')
    setHistorico([])

    let cancelado = false
    listMovements(item.id)
      .then((m) => !cancelado && setHistorico(m))
      .catch(() => {
        // sem histórico (tabela ainda não criada, por exemplo): ignora
      })
    return () => {
      cancelado = true
    }
  }, [item])

  const qtd = Number(quantidade.replace(',', '.'))
  const valida = Number.isFinite(qtd) && qtd > 0
  const saldoAtual = item?.stock ?? 0
  const saldoNovo = valida ? saldoAtual + qtd : saldoAtual

  const ajustar = (delta: number) => {
    const base = Number.isFinite(qtd) ? qtd : 0
    setQuantidade(String(Math.max(1, base + delta)))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!item) return
    if (!valida) {
      setErrorMessage('Informe uma quantidade maior que zero.')
      return
    }

    setSaving(true)
    setErrorMessage('')
    try {
      await onConfirm(item.id, qtd, nota)
      onClose()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao registrar entrada')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="top-[5%] flex max-h-[90vh] translate-y-0 flex-col gap-0 overflow-hidden border-slate-200 bg-white p-0 sm:max-w-[440px] [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:opacity-100">
        <DialogHeader className="bg-[#079C9C] px-6 py-5 text-left">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/20">
              <ArrowDownToLine className="size-6 text-white" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-xl font-bold text-white">Dar entrada</DialogTitle>
              <DialogDescription className="truncate text-sm text-white/80">
                {item?.name}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <div className="space-y-2">
              <span className="block text-sm font-semibold text-slate-700">
                Quantidade recebida
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Diminuir"
                  onClick={() => ajustar(-1)}
                  className={stepperClass}
                >
                  <Minus className="size-4" />
                </button>
                <input
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  inputMode="decimal"
                  autoFocus
                  className={`${inputClass} text-center text-base font-semibold`}
                />
                <button
                  type="button"
                  aria-label="Aumentar"
                  onClick={() => ajustar(1)}
                  className={stepperClass}
                >
                  <Plus className="size-4" />
                </button>
                {item?.unit && (
                  <span className="shrink-0 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600">
                    {item.unit}
                  </span>
                )}
              </div>
            </div>

            {/* saldo antes e depois */}
            <div className="flex items-center justify-between rounded-xl border border-[#079C9C]/20 bg-[#079C9C]/5 px-4 py-3">
              <div>
                <p className="text-xs text-slate-500">Saldo atual</p>
                <p className="text-lg font-semibold text-slate-700">{formatarNumero(saldoAtual)}</p>
              </div>
              <span className="text-slate-300">→</span>
              <div className="text-right">
                <p className="text-xs text-slate-500">Novo saldo</p>
                <p className="text-lg font-bold text-[#079C9C]">{formatarNumero(saldoNovo)}</p>
              </div>
            </div>

            <div className="space-y-2">
              <span className="block text-sm font-semibold text-slate-700">Observação</span>
              <input
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                className={inputClass}
                placeholder="Ex: NF 1234, fornecedor X"
              />
            </div>

            {historico.length > 0 && (
              <div className="space-y-2">
                <span className="block text-sm font-semibold text-slate-700">
                  Últimas movimentações
                </span>
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {historico.map((m) => (
                    <li key={m.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate text-slate-700">{m.note || 'Entrada'}</p>
                        <p className="text-xs text-slate-400">
                          {new Date(m.created_at).toLocaleString('pt-BR', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </p>
                      </div>
                      <span className="shrink-0 font-semibold text-emerald-600">
                        +{formatarNumero(Number(m.quantity))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {errorMessage && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {errorMessage}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
              className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving || !valida}
              className="min-w-36 gap-2 bg-[#079C9C] text-white shadow-sm hover:bg-[#079C9C]/90"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Registrando...
                </>
              ) : (
                'Confirmar entrada'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}