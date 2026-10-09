'use client'

import { useState } from 'react'
import { Check, ChevronDown, Pencil, Trash2, StickyNote } from 'lucide-react'
import { Product } from "../services/listService"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "../../../../components/ui/alert-dialog";

interface ProductsMobileProps {
    products: Product[];
    onEdit: (product: Product) => void;
    onDelete: (id: string) => void;
    onToggle: (product: Product) => void;
    selecting: boolean;
    selectedIds: Set<string>;
    onSelect: (id: string) => void;
}

const BARRA_PRIORIDADE: Record<string, string> = {
    Alta: 'border-l-red-500',
    Média: 'border-l-amber-500',
    Baixa: 'border-l-slate-300',
}

const BADGE_PRIORIDADE: Record<string, string> = {
    Alta: 'bg-red-50 text-red-700',
    Média: 'bg-amber-50 text-amber-700',
    Baixa: 'bg-slate-100 text-slate-600',
}

const BADGE_STATUS: Record<string, string> = {
    Pendente: 'bg-slate-100 text-slate-600',
    'Em progresso': 'bg-amber-50 text-amber-700',
    Concluído: 'bg-emerald-50 text-emerald-700',
}

function vibrar() {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(10)
    }
}

export function ProductsMobile({
    products,
    onEdit,
    onDelete,
    onToggle,
    selecting,
    selectedIds,
    onSelect,
}: ProductsMobileProps) {
    // só um card expandido por vez
    const [expandido, setExpandido] = useState<string | null>(null)

    const handleDelete = (id: string | undefined) => {
        if (!id) {
            alert('Erro: ID do produto não encontrado.');
            return;
        }
        onDelete(id);
    };

    return (
        <div className="space-y-3 pb-24">
            {products.map((product) => {
                const id = product.id!
                const comprado = product.status === 'Concluído'
                const marcado = selecting ? selectedIds.has(id) : comprado
                const aberto = !selecting && expandido === id

                const aoTocarNoCard = () => {
                    if (selecting) {
                        vibrar()
                        onSelect(id)
                        return
                    }
                    setExpandido((atual) => (atual === id ? null : id))
                }

                return (
                    <div
                        key={id}
                        className={`overflow-hidden rounded-xl border border-l-4 shadow-sm transition-all duration-200 ${
                            BARRA_PRIORIDADE[product.priority] ?? 'border-l-slate-300'
                        } ${
                            selecting && marcado
                                ? 'border-[#079C9C] border-l-[#079C9C] bg-[#079C9C]/5 ring-1 ring-[#079C9C]/30'
                                : 'border-slate-200 bg-white'
                        } ${!selecting && comprado ? 'opacity-60' : ''}`}
                    >
                        <div className="flex items-center gap-3 p-3">
                            {/* Checkbox redondo */}
                            <button
                                type="button"
                                role="checkbox"
                                aria-checked={marcado}
                                aria-label={
                                    selecting
                                        ? `Selecionar ${product.name} para cotação`
                                        : `Marcar ${product.name} como comprado`
                                }
                                onClick={() => {
                                    vibrar()
                                    if (selecting) onSelect(id)
                                    else onToggle(product)
                                }}
                                className={`flex size-8 shrink-0 items-center justify-center rounded-full border-2 transition active:scale-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#079C9C] ${
                                    marcado
                                        ? 'border-[#079C9C] bg-[#079C9C] text-white'
                                        : 'border-slate-300 bg-white text-transparent'
                                }`}
                            >
                                <Check className="size-5" strokeWidth={3} />
                            </button>

                            {/* Área tocável: expande (ou seleciona, no modo cotação) */}
                            <button
                                type="button"
                                onClick={aoTocarNoCard}
                                aria-expanded={selecting ? undefined : aberto}
                                className="flex min-w-0 flex-1 items-center gap-2 text-left transition active:scale-[0.98]"
                            >
                                <div className="min-w-0 flex-1">
                                    <p
                                        className={`truncate text-[15px] font-semibold text-slate-900 ${
                                            !selecting && comprado ? 'line-through' : ''
                                        }`}
                                    >
                                        {product.name}
                                    </p>

                                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                        <span className="rounded-md bg-[#079C9C]/10 px-2 py-0.5 text-xs font-semibold text-[#079C9C]">
                                            {product.quantity}
                                            {product.unit ? ` ${product.unit}` : ''}
                                        </span>
                                        <span
                                            className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                                                BADGE_PRIORIDADE[product.priority] ?? 'bg-slate-100 text-slate-600'
                                            }`}
                                        >
                                            {product.priority}
                                        </span>
                                        <span
                                            className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                                                BADGE_STATUS[product.status] ?? 'bg-slate-100 text-slate-600'
                                            }`}
                                        >
                                            {product.status}
                                        </span>
                                    </div>
                                </div>

                                {!selecting && (
                                    <ChevronDown
                                        className={`size-5 shrink-0 text-slate-400 transition-transform duration-300 ${
                                            aberto ? 'rotate-180' : ''
                                        }`}
                                    />
                                )}
                            </button>
                        </div>

                        {/* Painel expansível */}
                        {!selecting && (
                            <div
                                className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                                    aberto ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                                }`}
                            >
                                <div className="overflow-hidden">
                                    <div className="space-y-3 border-t border-slate-100 bg-slate-50 p-3">
                                        <div className="flex items-start gap-2 text-sm text-slate-600">
                                            <StickyNote className="mt-0.5 size-4 shrink-0 text-slate-400" />
                                            <p className="min-w-0 break-words">
                                                {product.notes?.trim() ? product.notes : 'Sem observações.'}
                                            </p>
                                        </div>

                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                tabIndex={aberto ? 0 : -1}
                                                onClick={() => onEdit(product)}
                                                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-[#079C9C] bg-white px-3 py-2.5 text-sm font-semibold text-[#079C9C] transition active:scale-95 active:bg-[#079C9C]/10"
                                            >
                                                <Pencil className="size-4" />
                                                Editar
                                            </button>

                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <button
                                                        type="button"
                                                        tabIndex={aberto ? 0 : -1}
                                                        className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2.5 text-sm font-semibold text-red-600 transition active:scale-95 active:bg-red-50"
                                                    >
                                                        <Trash2 className="size-4" />
                                                        Excluir
                                                    </button>
                                                </AlertDialogTrigger>

                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Tem certeza que deseja excluir o produto{" "}
                                                            <strong>{product.name}</strong>? Essa ação não poderá ser desfeita.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>

                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction
                                                            onClick={() => handleDelete(product.id)}
                                                            className="bg-red-600 text-white hover:bg-red-700"
                                                        >
                                                            Excluir produto
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    );
}