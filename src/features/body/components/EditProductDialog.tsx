'use client'

import { useState, useEffect } from 'react'
import { Button } from "../../../../components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "../../../../components/ui/dialog"
import { Pencil, Plus, Minus, Loader2 } from 'lucide-react'
import { Product } from "../services/listService"

interface EditProductDialogProps {
    open: boolean
    product: Product | null
    onClose: () => void
    onSave: (id: string, data: Partial<Product>) => Promise<void>
}

interface Opcao {
    value: string
    dot?: string
}

const PRIORIDADES: Opcao[] = [
    { value: 'Baixa', dot: 'bg-slate-400' },
    { value: 'Média', dot: 'bg-amber-500' },
    { value: 'Alta', dot: 'bg-red-500' },
]

const STATUS: Opcao[] = [
    { value: 'Pendente', dot: 'bg-slate-400' },
    { value: 'Em progresso', dot: 'bg-amber-500' },
    { value: 'Concluído', dot: 'bg-emerald-500' },
]

const inputClass =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20'

const stepperClass =
    'flex size-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-[#079C9C] hover:text-[#079C9C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#079C9C]'

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-2">
            <span className="block text-sm font-semibold text-slate-700">{label}</span>
            {children}
        </div>
    )
}

function Segmentado({
    opcoes,
    valor,
    onChange,
    label,
}: {
    opcoes: Opcao[]
    valor: string
    onChange: (v: string) => void
    label: string
}) {
    return (
        <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
            {opcoes.map((op) => {
                const ativo = valor === op.value
                return (
                    <button
                        key={op.value}
                        type="button"
                        role="radio"
                        aria-checked={ativo}
                        onClick={() => onChange(op.value)}
                        className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#079C9C] ${
                            ativo
                                ? 'border-[#079C9C] bg-[#079C9C]/10 text-[#079C9C]'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                    >
                        <span className={`size-2 rounded-full ${op.dot}`} />
                        {op.value}
                    </button>
                )
            })}
        </div>
    )
}

export default function EditProductDialog({ open, product, onClose, onSave }: EditProductDialogProps) {
    const [formData, setFormData] = useState<Partial<Product>>({})
    const [loading, setLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')

    useEffect(() => {
        if (product) {
            setFormData({
                name: product.name,
                quantity: product.quantity,
                priority: product.priority,
                status: product.status,
                notes: product.notes || '',
            })
            setErrorMessage('')
        }
    }, [product])

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!product?.id) return

        setLoading(true)
        setErrorMessage('')
        try {
            await onSave(product.id, formData)
            onClose()
        } catch (error) {
            setErrorMessage(
                error instanceof Error && error.message
                    ? error.message
                    : 'Erro ao atualizar produto'
            )
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent
                className="top-[5%] flex max-h-[90vh] translate-y-0 flex-col gap-0 overflow-hidden border-slate-200 bg-white p-0 sm:max-w-[480px] [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:opacity-100"
            >
                {/* Cabeçalho */}
                <DialogHeader className="bg-[#079C9C] px-6 py-5 text-left">
                    <div className="flex items-center gap-3">
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/20">
                            <Pencil className="size-6 text-white" />
                        </div>
                        <div className="min-w-0">
                            <DialogTitle className="text-xl font-bold text-white">
                                Editar Produto
                            </DialogTitle>
                            <DialogDescription className="truncate text-sm text-white/80">
                                {product?.name ?? 'Altere os dados do item'}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
                    {/* Corpo com rolagem */}
                    <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
                        {/* Nome */}
                        <Campo label="Nome do produto">
                            <input
                                required
                                value={formData.name || ''}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className={inputClass}
                                placeholder="Ex: Cimento, Tijolo..."
                            />
                        </Campo>

                        {/* Quantidade */}
                        <Campo label="Quantidade">
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    aria-label="Diminuir quantidade"
                                    onClick={() =>
                                        setFormData((f) => ({
                                            ...f,
                                            quantity: Math.max(1, (f.quantity ?? 1) - 1),
                                        }))
                                    }
                                    className={stepperClass}
                                >
                                    <Minus className="size-4" />
                                </button>

                                <input
                                    type="number"
                                    min="1"
                                    required
                                    value={formData.quantity || 0}
                                    onChange={(e) =>
                                        setFormData({ ...formData, quantity: Number(e.target.value) })
                                    }
                                    className={`${inputClass} text-center font-semibold`}
                                />

                                <button
                                    type="button"
                                    aria-label="Aumentar quantidade"
                                    onClick={() =>
                                        setFormData((f) => ({
                                            ...f,
                                            quantity: (f.quantity ?? 0) + 1,
                                        }))
                                    }
                                    className={stepperClass}
                                >
                                    <Plus className="size-4" />
                                </button>

                                {product?.unit && (
                                    <span className="shrink-0 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600">
                                        {product.unit}
                                    </span>
                                )}
                            </div>
                        </Campo>

                        {/* Prioridade */}
                        <Campo label="Prioridade">
                            <Segmentado
                                label="Prioridade"
                                opcoes={PRIORIDADES}
                                valor={formData.priority || 'Média'}
                                onChange={(value) => setFormData({ ...formData, priority: value })}
                            />
                        </Campo>

                        {/* Status */}
                        <Campo label="Status">
                            <Segmentado
                                label="Status"
                                opcoes={STATUS}
                                valor={formData.status || 'Pendente'}
                                onChange={(value) => setFormData({ ...formData, status: value })}
                            />
                        </Campo>

                        {/* Notas */}
                        <Campo label="Notas">
                            <textarea
                                value={formData.notes || ''}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                className={`${inputClass} min-h-[88px] resize-none`}
                                placeholder="Observações adicionais..."
                            />
                        </Campo>

                        {errorMessage && (
                            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                                {errorMessage}
                            </p>
                        )}
                    </div>

                    {/* Rodapé fixo */}
                    <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={loading}
                            className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading}
                            className="min-w-40 gap-2 bg-[#079C9C] text-white shadow-sm hover:bg-[#079C9C]/90 active:bg-[#079C9C]/80"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="size-4 animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                'Salvar Alterações'
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}