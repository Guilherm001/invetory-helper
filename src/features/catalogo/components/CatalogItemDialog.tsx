'use client'

import { useEffect, useState } from 'react'
import { Loader2, PackagePlus, Pencil } from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog'
import type { CatalogItem, NovoCatalogItem } from '../services/catalogService'

interface Props {
  open: boolean
  item: CatalogItem | null // null = criar
  onClose: () => void
  onSave: (data: NovoCatalogItem) => Promise<void>
}

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20'

function Campo({
  label,
  children,
  dica,
}: {
  label: string
  children: React.ReactNode
  dica?: string
}) {
  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-semibold text-slate-700">{label}</span>
      {children}
      {dica && <p className="text-xs text-slate-400">{dica}</p>}
    </div>
  )
}

// "12,50" -> 12.5 | vazio -> null | inválido -> NaN
function paraNumero(v: string): number | null {
  const t = v.trim()
  if (t === '') return null
  return Number(t.replace(',', '.'))
}

const emTexto = (n: number | null) => (n === null || n === undefined ? '' : String(n).replace('.', ','))

export default function CatalogItemDialog({ open, item, onClose, onSave }: Props) {
  const [barcode, setBarcode] = useState('')
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const editando = item !== null

  // preenche (ou limpa) sempre que o modal abre
  useEffect(() => {
    if (!open) return
    setBarcode(item?.barcode ?? '')
    setName(item?.name ?? '')
    setUnit(item?.unit ?? '')
    setPrice(emTexto(item?.price ?? null))
    setStock(emTexto(item?.stock ?? null))
    setErrorMessage('')
  }, [open, item])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const precoNum = paraNumero(price)
    const estoqueNum = paraNumero(stock)

    if (!name.trim()) {
      setErrorMessage('A descrição é obrigatória.')
      return
    }
    if (Number.isNaN(precoNum) || Number.isNaN(estoqueNum)) {
      setErrorMessage('Preço e estoque precisam ser números.')
      return
    }

    setSaving(true)
    setErrorMessage('')
    try {
      // o código não é enviado: o banco gera na criação e não muda na edição
      await onSave({
        barcode: barcode.trim() || null,
        name: name.trim(),
        unit: unit.trim().toUpperCase() || null,
        price: precoNum,
        stock: estoqueNum,
      })
      onClose()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="top-[5%] flex max-h-[90vh] translate-y-0 flex-col gap-0 overflow-hidden border-slate-200 bg-white p-0 sm:max-w-[480px] [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:opacity-100">
        <DialogHeader className="bg-[#079C9C] px-6 py-5 text-left">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/20">
              {editando ? (
                <Pencil className="size-6 text-white" />
              ) : (
                <PackagePlus className="size-6 text-white" />
              )}
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-xl font-bold text-white">
                {editando ? 'Editar item' : 'Novo item'}
              </DialogTitle>
              <DialogDescription className="truncate text-sm text-white/80">
                {editando ? item?.name : 'Cadastre um produto no catálogo'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <Campo label="Descrição">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                placeholder="Ex: Cimento CP-II 50kg"
                autoFocus
              />
            </Campo>

            <div className="grid grid-cols-2 gap-4">
              <Campo label="Código">
                <input
                  value={editando ? item?.code ?? '' : ''}
                  readOnly
                  disabled
                  tabIndex={-1}
                  className={`${inputClass} cursor-not-allowed bg-slate-50 text-slate-500`}
                  placeholder="Gerado automaticamente"
                />
              </Campo>
              <Campo label="Código de barras">
                <input
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  className={inputClass}
                  inputMode="numeric"
                  placeholder="Opcional"
                />
              </Campo>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Campo label="Unidade">
                <input
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className={`${inputClass} uppercase`}
                  placeholder="UN, SC, M"
                />
              </Campo>
              <Campo label="Preço (R$)">
                <input
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className={inputClass}
                  inputMode="decimal"
                  placeholder="0,00"
                />
              </Campo>
              <Campo label="Estoque">
                <input
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  className={inputClass}
                  inputMode="decimal"
                  placeholder="0"
                />
              </Campo>
            </div>

            {editando && (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                Para somar ao estoque guardando o histórico, use o botão de entrada na lista.
                Mudar o estoque aqui apenas substitui o valor.
              </p>
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
              disabled={saving}
              className="min-w-36 gap-2 bg-[#079C9C] text-white shadow-sm hover:bg-[#079C9C]/90"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Salvando...
                </>
              ) : editando ? (
                'Salvar alterações'
              ) : (
                'Criar item'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}