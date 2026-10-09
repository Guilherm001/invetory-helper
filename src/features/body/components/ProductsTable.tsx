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

const PILULA_STATUS: Record<string, { box: string; dot: string }> = {
    Pendente: { box: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400' },
    'Em progresso': { box: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
    Concluído: { box: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
}

// mesma grade no cabeçalho e nas linhas, para as colunas alinharem
const GRID =
    'grid grid-cols-[2.5rem_minmax(0,1fr)_7rem_6rem_9.5rem_5.5rem] items-center gap-4'

const thClass =
    'text-xs font-semibold uppercase tracking-wide text-slate-400'

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
            <div role="table" className="hidden md:block">
                {/* Cabeçalho */}
                <div role="row" className={`${GRID} px-5 pb-3`}>
                    <span role="columnheader" className="sr-only">
                        {selecting ? 'Selecionar' : 'Comprado'}
                    </span>
                    <span role="columnheader" className={thClass}>Produto</span>
                    <span role="columnheader" className={thClass}>Qtd</span>
                    <span role="columnheader" className={thClass}>Prioridade</span>
                    <span role="columnheader" className={thClass}>Status</span>
                    <span role="columnheader" className={`${thClass} text-right`}>Ação</span>
                </div>

                {/* Linhas */}
                <div className="space-y-2">
                    {products?.map((product) => {
                        const id = product.id!
                        const comprado = product.status === 'Concluído'
                        const marcado = selecting ? selectedIds.has(id) : comprado
                        const notas = product.notes?.trim() ?? ''
                        const pilula = PILULA_STATUS[product.status] ?? PILULA_STATUS.Pendente

                        return (
                            <div
                                key={id}
                                role="row"
                                onClick={selecting ? () => onSelect(id) : undefined}
                                className={`${GRID} rounded-xl border border-l-4 px-5 py-3.5 shadow-sm transition-all duration-150 ${
                                    BARRA_PRIORIDADE[product.priority] ?? 'border-l-slate-300'
                                } ${selecting ? 'cursor-pointer' : ''} ${
                                    selecting && marcado
                                        ? 'border-[#079C9C] border-l-[#079C9C] bg-[#079C9C]/5 ring-1 ring-[#079C9C]/30'
                                        : 'border-slate-200 bg-white hover:-translate-y-px hover:shadow-md'
                                }`}
                            >
                                {/* Checkbox */}
                                <div role="cell">
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
                                        className={`flex size-7 items-center justify-center rounded-full border-2 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#079C9C] ${
                                            marcado
                                                ? 'border-[#079C9C] bg-[#079C9C] text-white'
                                                : 'border-slate-300 bg-white text-transparent hover:border-[#079C9C]'
                                        }`}
                                    >
                                        <Check className="size-4" strokeWidth={3} />
                                    </button>
                                </div>

                                {/* Produto + notas embaixo */}
                                <div
                                    role="cell"
                                    className={`min-w-0 ${!selecting && comprado ? 'opacity-50' : ''}`}
                                >
                                    <p
                                        className={`truncate font-semibold text-slate-900 ${
                                            !selecting && comprado ? 'line-through' : ''
                                        }`}
                                    >
                                        {product.name}
                                    </p>
                                    {notas && (
                                        <p
                                            className="mt-0.5 truncate text-sm text-slate-500"
                                            title={notas}
                                        >
                                            {notas}
                                        </p>
                                    )}
                                </div>

                                {/* Quantidade */}
                                <div role="cell">
                                    <span className="inline-flex rounded-lg bg-[#079C9C]/10 px-2.5 py-1 text-sm font-semibold text-[#079C9C]">
                                        {product.quantity}
                                        {product.unit ? ` ${product.unit}` : ''}
                                    </span>
                                </div>

                                {/* Prioridade */}
                                <div role="cell">
                                    <span
                                        className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ${
                                            BADGE_PRIORIDADE[product.priority] ?? 'bg-slate-100 text-slate-600'
                                        }`}
                                    >
                                        {product.priority}
                                    </span>
                                </div>

                                {/* Status */}
                                <div role="cell">
                                    <span
                                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${pilula.box}`}
                                    >
                                        <span className={`size-1.5 rounded-full ${pilula.dot}`} />
                                        {product.status}
                                    </span>
                                </div>

                                {/* Ações */}
                                <div role="cell" className="flex justify-end gap-1">
                                    {!selecting && (
                                        <>
                                            <button
                                                type="button"
                                                aria-label={`Editar ${product.name}`}
                                                onClick={() => onEdit(product)}
                                                className="rounded-lg p-2 text-slate-400 transition hover:bg-[#079C9C]/10 hover:text-[#079C9C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#079C9C]"
                                            >
                                                <Pencil className="size-[18px]" />
                                            </button>

                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <button
                                                        type="button"
                                                        aria-label={`Excluir ${product.name}`}
                                                        className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600"
                                                    >
                                                        <Trash2 className="size-[18px]" />
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
                                        </>
                                    )}
                                </div>
                            </div>
                        )
                    })}
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