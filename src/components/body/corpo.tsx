'use client'

import { useState } from 'react'
import { Product } from '../../hooks/useProducts'
import { ProductsTable } from './ProductsTable'
import EditProductDialog from './EditProductDialog'

interface ProductsProps {
  products: Product[]
  loading: boolean
  error: string | null
  deleteProduct: (id: string) => Promise<void>
  updateProduct: (id: string, data: Partial<Product>) => Promise<Product>
}

export default function ListaProdutos({
  products,
  loading,
  error,
  deleteProduct,
  updateProduct,
}: ProductsProps) {
  const [actionLoading, setActionLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)

  const handleEdit = (product: Product) => {
    setEditingProduct(product)
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return
    setActionLoading(true)
    try {
      await deleteProduct(id)
    } catch (error) {
      alert('Erro ao excluir produto')
    } finally {
      setActionLoading(false)
    }
  }

  const handleSave = async (id: string, data: Partial<Product>) => {
    setActionLoading(true)
    try {
      await updateProduct(id, data)
      setDialogOpen(false)
    } catch (error) {
      alert('Erro ao salvar alterações')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading || actionLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return <div className="text-red-500 text-center py-4">{error}</div>
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
