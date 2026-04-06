'use client'

import { useState } from 'react'
import { useProducts, Product } from '../../hooks/useProducts'
import { ProductsTable } from './ProductsTable'
import EditProductDialog from './EditProductDialog'

export default function ListaProdutos() {
    const { products, loading, deleteProduct, updateProduct } = useProducts()
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingProduct, setEditingProduct] = useState<Product | null>(null)

    const handleEdit = (product: Product) => {
        setEditingProduct(product)
        setDialogOpen(true)
    }

    const handleDelete = async (id: string) => {
        try {
            await deleteProduct(id)
        } catch (error) {
            alert('Erro ao excluir produto')
        }
    }

    const handleSave = async (id: string, data: Partial<Product>) => {
        try {
            await updateProduct(id, data)
            setDialogOpen(false)
        } catch (error) {
            alert('Erro ao salvar alterações')
        }
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        )
    }

    return (
        <div className="py-6">
            <ProductsTable
                products={products}
                onEdit={handleEdit}
                onDelete={handleDelete}
            />

            <EditProductDialog
                open={dialogOpen}
                product={editingProduct}
                onClose={() => setDialogOpen(false)}
                onSave={handleSave}
            />
        </div>
    )
}
