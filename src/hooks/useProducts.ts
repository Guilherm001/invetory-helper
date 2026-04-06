import { useState, useEffect, useCallback } from "react"

export interface Product {
  id: string
  name: string
  quantity: number
  priority: string
  status: string
  notes?: string
  created_at?: string
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/products")
      if (!response.ok) throw new Error("Erro ao buscar produtos")
      const data = await response.json()
      setProducts(data)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  const addProduct = async (product: Omit<Product, "id" | "created_at">) => {
    const response = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(product),
    })
    if (!response.ok) throw new Error("Erro ao adicionar produto")
    const newProduct = await response.json()
    setProducts((prev) => [newProduct, ...prev])
    return newProduct
  }

  const deleteProduct = async (id: string) => {
    const response = await fetch(`/api/products/${id}`, {
      method: "DELETE",
    })
    if (!response.ok) throw new Error("Erro ao excluir produto")
    setProducts((prev) => prev.filter((p) => p.id !== id))
  }

  const updateProduct = async (id: string, data: Partial<Product>) => {
    const response = await fetch(`/api/products/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!response.ok) throw new Error("Erro ao atualizar produto")
    const updatedProduct = await response.json()
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updatedProduct } : p))
    )
    return updatedProduct
  }

  return {
    products,
    loading,
    deleteProduct,
    updateProduct,
    addProduct,
    refetch: fetchProducts,
  }
}
