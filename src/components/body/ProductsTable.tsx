'use client';

import { Product} from '@/hooks/useProducts';
import { ProductsMobile } from './ProductsMobile';

interface ProductsTableProps {
    products: Product[];
    onEdit: (product: Product) => void;
    onDelete: (id: string) => void;
}

export function ProductsTable({ products, onEdit, onDelete }: ProductsTableProps) {
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
            <div className="hidden md:block overflow-x-auto">
                
                   
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="border-b text-left text-gray-700 font-medium">
                            <th className="py-2 px-2">Produto</th>
                            <th className="py-2 px-2">Qtd</th>
                            <th className="py-2 px-2">Prioridade</th>
                            <th className="py-2 px-2">Status</th>
                            <th className="py-2 px-2">Notas</th>
                            <th className="py-2 px-2 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {products?.map((product) => (
                            <tr key={product.id || Math.random().toString()} className="border-b hover:bg-gray-50">
                                <td className="py-2 px-2 font-medium text-gray-900">{product.name}</td>
                                <td className="py-2 px-2">{product.quantity}</td>
                                <td className="py-2 px-2">
                                    <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                                        {product.priority}
                                    </span>
                                </td>
                                <td className="py-2 px-2">{product.status}</td>
                                <td className="py-2 px-2 text-gray-500 text-sm max-w-xs truncate">
                                    {product.notes && product.notes.trim() !== "" ? product.notes : '-'}
                                </td>
                                <td className="py-2 px-2 text-right space-x-2">
                                    <button
                                        onClick={() => onEdit(product)}
                                        className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm transition font-medium"
                                    >
                                        Editar
                                    </button>
                                    <button
                                        onClick={() => handleDelete(product.id)}
                                        className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm transition font-medium"
                                    >
                                        Excluir
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Mobile */}
            <div className="md:hidden">
                <ProductsMobile
                    products={products}
                    onEdit={onEdit}
                    onDelete={onDelete}
                />
            </div>
        </>
    );
}
