'use client';

import { Check, Pencil, Trash2 } from 'lucide-react'
import { Product } from "../services/listService"
import { ProductsMobile } from './ProductsMobile';
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

interface ProductsTableProps {
    products: Product[];
    onEdit: (product: Product) => void;
    onDelete: (id: string) => void;
    onToggle: (product: Product) => void;
    selecting: boolean;
    selectedIds: Set<string>;
    onSelect: (id: string) => void;
}

const DOT_PRIORIDADE: Record<string, string> = {
    Alta: 'bg-red-500',
    Média: 'bg-amber-500',
    Baixa: 'bg-slate-400',
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

const thClass =
    'px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500'

export function ProductsTable({
    products,
    onEdit,
    onDelete,
    onToggle,
    selecting,
    selectedIds,
    onSelect,
}: ProductsTableProps) {
    const handleDelete = (id: string | undefined) => {
        if (!id) {
            alert('Erro: ID do produto não encontrado.');
            return;
        }
        onDelete(id);
    };

    return (
        <>
            {/* Desktop */}
            <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-left">
                                <th className={`${thClass} w-14`}>
                                    <span className="sr-only">
                                        {selecting ? 'Selecionar' : 'Comprado'}
                                    </span>
                                </th>
                                <th className={thClass}>Produto</th>
                                <th className={thClass}>Qtd</th>
                                <th className={thClass}>Prioridade</th>
                                <th className={thClass}>Status</th>
                                <th className={thClass}>Notas</th>
                                <th className={`${thClass} text-right`}>Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {products?.map((product) => {
                                const id = product.id!
                                const comprado = product.status === 'Concluído'
                                const marcado = selecting ? selectedIds.has(id) : comprado
                                const notas = product.notes?.trim() ?? ''

                                return (
                                    <tr
                                        key={product.id}
                                        onClick={selecting ? () => onSelect(id) : undefined}
                                        className={`group transition-colors ${
                                            selecting ? 'cursor-pointer' : ''
                                        } ${
                                            selecting && marcado
                                                ? 'bg-[#079C9C]/5 hover:bg-[#079C9C]/10'
                                                : 'hover:bg-slate-50'
                                        }`}
                                    >
                                        <td className="px-4 py-3">
                                            <button
                                                type="button"
                                                role="checkbox"
                                                aria-checked={marcado}
                                                aria-label={
                                                    selecting
                                                        ? `Selecionar ${product.name} para cotação`
                                                        : `Marcar ${product.name} como comprado`
                                                }
                                                onClick={(e) => {
                                                    // evita disparar o clique da linha duas vezes
                                                    e.stopPropagation()
                                                    if (selecting) onSelect(id)
                                                    else onToggle(product)
                                                }}
                                                className={`flex size-6 items-center justify-center rounded-full border-2 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#079C9C] ${
                                                    marcado
                                                        ? 'border-[#079C9C] bg-[#079C9C] text-white'
                                                        : 'border-slate-300 bg-white text-transparent hover:border-[#079C9C]'
                                                }`}
                                            >
                                                <Check className="size-4" strokeWidth={3} />
                                            </button>
                                        </td>

                                        <td className="px-4 py-3">
                                            <div
                                                className={`flex items-center gap-2.5 ${
                                                    !selecting && comprado ? 'opacity-60' : ''
                                                }`}
                                            >
                                                <span
                                                    className={`size-2.5 shrink-0 rounded-full ${
                                                        DOT_PRIORIDADE[product.priority] ?? 'bg-slate-400'
                                                    }`}
                                                />
                                                <span
                                                    className={`font-medium text-slate-900 ${
                                                        !selecting && comprado ? 'line-through' : ''
                                                    }`}
                                                >
                                                    {product.name}
                                                </span>
                                            </div>
                                        </td>

                                        <td className="px-4 py-3">
                                            <span className="inline-flex rounded-md bg-[#079C9C]/10 px-2.5 py-1 text-xs font-semibold text-[#079C9C]">
                                                {product.quantity}
                                                {product.unit ? ` ${product.unit}` : ''}
                                            </span>
                                        </td>

                                        <td className="px-4 py-3">
                                            <span
                                                className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium ${
                                                    BADGE_PRIORIDADE[product.priority] ?? 'bg-slate-100 text-slate-600'
                                                }`}
                                            >
                                                {product.priority}
                                            </span>
                                        </td>

                                        <td className="px-4 py-3">
                                            <span
                                                className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium ${
                                                    BADGE_STATUS[product.status] ?? 'bg-slate-100 text-slate-600'
                                                }`}
                                            >
                                                {product.status}
                                            </span>
                                        </td>

                                        <td
                                            className="max-w-xs truncate px-4 py-3 text-sm text-slate-500"
                                            title={notas || undefined}
                                        >
                                            {notas || '-'}
                                        </td>

                                        <td className="px-4 py-3">
                                            {!selecting && (
                                                <div className="flex justify-end gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                                                    <button
                                                        type="button"
                                                        aria-label={`Editar ${product.name}`}
                                                        onClick={() => onEdit(product)}
                                                        className="rounded-lg p-2 text-[#079C9C] transition hover:bg-[#079C9C]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#079C9C]"
                                                    >
                                                        <Pencil className="size-5" />
                                                    </button>

                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <button
                                                                type="button"
                                                                aria-label={`Excluir ${product.name}`}
                                                                className="rounded-lg p-2 text-red-600 transition hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600"
                                                            >
                                                                <Trash2 className="size-5" />
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
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile */}
            <div className="md:hidden">
                <ProductsMobile
                    products={products}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onToggle={onToggle}
                    selecting={selecting}
                    selectedIds={selectedIds}
                    onSelect={onSelect}
                />
            </div>
        </>
    );
}