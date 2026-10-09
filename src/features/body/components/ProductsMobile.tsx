'use client'

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

export function ProductsMobile({
    products,
    onEdit,
    onDelete,
    onToggle,
    selecting,
    selectedIds,
    onSelect,
}: ProductsMobileProps) {
    const handleDelete = (id: string | undefined) => {
        if (!id) {
            alert('Erro: ID do produto não encontrado.');
            return;
        }
        onDelete(id);
    };

    return (
        <div className="space-y-3 pb-20">
            {products.map((product) => {
                const comprado = product.status === 'Concluído'
                const marcado = selecting ? selectedIds.has(product.id!) : comprado

                return (
                    <div
                        key={product.id}
                        className={`bg-white border rounded-lg p-3 shadow-sm ${
                            selecting && marcado ? 'border-[#079C9C]' : 'border-gray-200'
                        } ${!selecting && comprado ? 'opacity-60' : ''}`}
                    >
                        <div className="mb-2 flex items-start gap-3">
                            <input
                                type="checkbox"
                                checked={marcado}
                                onChange={() =>
                                    selecting ? onSelect(product.id!) : onToggle(product)
                                }
                                aria-label={
                                    selecting
                                        ? `Selecionar ${product.name} para cotação`
                                        : `Marcar ${product.name} como comprado`
                                }
                                className="mt-0.5 h-6 w-6 shrink-0 accent-[#079C9C]"
                            />
                            <div className="min-w-0">
                                <p className={`text-sm font-medium text-gray-900 ${!selecting && comprado ? 'line-through' : ''}`}>
                                    {product.name}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    Qtd: {product.quantity}
                                    {product.unit ? ` ${product.unit}` : ''} · {product.priority}
                                </p>
                            </div>
                        </div>

                        {!selecting && (
                            <div className="flex gap-2">
                                <button
                                    onClick={() => onEdit(product)}
                                    className="flex-1 px-2 py-2.5 bg-blue-500 text-white rounded text-sm font-medium hover:bg-blue-600 transition"
                                >
                                    Editar
                                </button>

                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <button
                                            type="button"
                                            className="flex-1 px-2 py-2.5 bg-red-500 text-white rounded text-sm font-medium hover:bg-red-600 transition"
                                        >
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
                        )}
                    </div>
                )
            })}
        </div>
    );
}