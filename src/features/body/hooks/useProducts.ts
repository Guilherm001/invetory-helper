import { supabase } from "@/lib/supabase"
import { useState, useEffect, useCallback } from "react"
import { Product } from "../services/listService"



export function useProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      console.log('Fetching products...')
      const response = await fetch("/api/products")
      console.log('Response status:', response.status)
      if (!response.ok) throw new Error("Erro ao buscar produtos")
      const data = await response.json()
      console.log('Data received:', data)
      setProducts(data)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido'
      console.error('Error fetching products:', error)
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
  fetchProducts()

  const channel = supabase
  .channel("products-changes")
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "products",
    },
    (payload) => {
  console.log("Mudança detectada:", payload)

  if (payload.eventType === "INSERT") {
    const newProduct = payload.new as Product

    setProducts((prev) =>
      prev.some((product) => product.id === newProduct.id)
        ? prev
        : [newProduct, ...prev]
    )
  }

  if (payload.eventType === "UPDATE") {
    setProducts((prev) =>
      prev.map((product) =>
        product.id === payload.new.id
          ? { ...product, ...payload.new }
          : product
      )
    )
  }

  if (payload.eventType === "DELETE") {
    setProducts((prev) =>
      prev.filter((product) => product.id !== payload.old.id)
    )
  }
}
  )
  .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
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
    error,
    deleteProduct,
    updateProduct,
    addProduct,
    refetch: fetchProducts,
  }
}
