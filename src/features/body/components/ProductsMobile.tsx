'use client'

import { Product } from "../services/listService"

interface ProductsMobileProps {
    products: Product[];
    onEdit: (product: Product) => void;
    onDelete: (id: string) => void;
    onToggle: (product: Product) => void;
}

export function ProductsMobile({ products, onEdit, onDelete, onToggle }: ProductsMobileProps) {
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
                return (
                    <div
                        key={product.id}
                        className={`bg-white border border-gray-200 rounded-lg p-3 shadow-sm ${comprado ? 'opacity-60' : ''}`}
                    >
                        <div className="mb-2 flex items-start gap-3">
                            <input
                                type="checkbox"
                                checked={comprado}
                                onChange={() => onToggle(product)}
                                aria-label={`Marcar ${product.name} como comprado`}
                                className="mt-0.5 h-6 w-6 shrink-0 accent-[#079C9C]"
                            />
                            <div className="min-w-0">
                                <p className={`text-sm font-medium text-gray-900 ${comprado ? 'line-through' : ''}`}>
                                    {product.name}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    Qtd: {product.quantity} {product.unit ?? ''} · {product.priority}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => onEdit(product)}
                                className="flex-1 px-2 py-2 bg-blue-500 text-white rounded text-xs font-medium hover:bg-blue-600 transition"
                            >
                                Editar
                            </button>
                            <button
                                onClick={() => handleDelete(product.id)}
                                className="flex-1 px-2 py-2 bg-red-500 text-white rounded text-xs font-medium hover:bg-red-600 transition"
                            >
                                Excluir
                            </button>
                        </div>
                    </div>
                )
            })}
        </div>
    );
}