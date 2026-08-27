'use client';

import { Product} from '@/hooks/useProducts';
import { ProductsMobile } from './ProductsMobile';
import { CiTrash } from "react-icons/ci";
import { CiEdit } from "react-icons/ci";
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
} from "@/components/ui/alert-dialog";
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
            <div className="hidden md:block overflow-x-auto shadow-xl/20 rounded-lg">
                
                   
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
                                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                                            product.priority === "Baixa"
                                              ? "bg-green-100 text-green-700"
                                              : product.priority === "Média"
                                                ? "bg-yellow-100 text-yellow-700"
                                                : product.priority === "Alta"
                                                  ? "bg-red-100 text-red-700"
                                                  : "bg-gray-100 text-gray-600"
                                          }`}
                                        >
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
                                        className="px-3 py-1   rounded hover:bg-[#8ed6d6] text-sm transition font-medium"
                                    >
                                        <CiEdit className='h-8 w-8 ' color="#079C9C"/>
                                    </button>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <button
                                          type="button"
                                          className="px-3 py-1 rounded hover:bg-[#f8c1c1] text-sm transition font-medium"
                                        >
                                          <CiTrash className="h-8 w-8 text-red-700" />
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
