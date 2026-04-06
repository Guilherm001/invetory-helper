'use client'

import { Product } from '@/hooks/useProducts';

interface ProductsMobileProps {
    products: Product[];
    onEdit: (product: Product) => void;
    onDelete: (id: string) => void;
}

export function ProductsMobile({ products, onEdit, onDelete }: ProductsMobileProps) {
    const handleDelete = (id: string) => {
        if (confirm('Tem certeza que deseja deletar este produto?')) {
            onDelete(id);
        }
    };

    return (
        <div className="space-y-3">
            {products.map((product) => (
                <div
                    key={product.id}
                    className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm"
                >
                    <div className="mb-2">
                        <p className="text-sm font-medium text-gray-900">{product.name}</p>
                        <p className="text-xs text-gray-500 mt-1">Qtd: {product.quantity}</p>
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
            ))}
        </div>
    );
}
