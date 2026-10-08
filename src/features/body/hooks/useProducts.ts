"use client"

import { supabase } from "@/lib/supabase"
import { useState, useEffect, useCallback } from "react"
import { Product } from "../services/listService"

const priorityOrder: Record<string, number> = { Alta: 1, Média: 2, Baixa: 3 }

function sortByPriority(list: Product[]) {
  return [...list].sort(
    (a, b) =>
      (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99)
  )
}

// insere sem duplicar e mantém a ordem por prioridade
function upsert(list: Product[], item: Product) {
  const exists = list.some((p) => p.id === item.id)
  const next = exists
    ? list.map((p) => (p.id === item.id ? { ...p, ...item } : p))
    : [item, ...list]
  return sortByPriority(next)
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/products")
      if (!response.ok) throw new Error("Erro ao buscar produtos")
      const data = await response.json()
      setProducts(data)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro desconhecido"
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
        { event: "*", schema: "public", table: "products" },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            setProducts((prev) => upsert(prev, payload.new as Product))
          }

          if (payload.eventType === "DELETE") {
            const id = (payload.old as Product).id
            setProducts((prev) => prev.filter((p) => p.id !== id))
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
    setProducts((prev) => upsert(prev, newProduct))
    return newProduct
  }

  const deleteProduct = async (id: string) => {
    const response = await fetch(`/api/products/${id}`, { method: "DELETE" })
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
    setProducts((prev) => upsert(prev, { ...updatedProduct, id }))
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