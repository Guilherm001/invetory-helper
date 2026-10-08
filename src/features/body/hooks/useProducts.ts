"use client"

import { supabase } from "@/lib/supabase"
import { useState, useEffect, useCallback, useRef } from "react"
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

  // guarda sempre a lista mais recente, para o rollback das ações otimistas
  const productsRef = useRef<Product[]>([])
  useEffect(() => {
    productsRef.current = products
  }, [products])

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

    const newProduct: Product = await response.json()

    // upsert: se o evento realtime já inseriu, não duplica
    setProducts((prev) => upsert(prev, newProduct))
    return newProduct
  }

  const updateProduct = async (id: string, data: Partial<Product>) => {
    const anterior = productsRef.current.find((p) => p.id === id)

    // 1. atualiza a tela na hora
    setProducts((prev) =>
      sortByPriority(prev.map((p) => (p.id === id ? { ...p, ...data } : p)))
    )

    try {
      const response = await fetch(`/api/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!response.ok) throw new Error("Erro ao atualizar produto")

      const updatedProduct: Product = await response.json()

      // 2. confirma com o que o servidor devolveu (só se o item ainda existir)
      setProducts((prev) =>
        sortByPriority(
          prev.map((p) => (p.id === id ? { ...p, ...updatedProduct } : p))
        )
      )
      return updatedProduct
    } catch (err) {
      // 3. deu erro: volta ao estado anterior
      if (anterior) {
        setProducts((prev) =>
          sortByPriority(prev.map((p) => (p.id === id ? anterior : p)))
        )
      }
      throw err
    }
  }

  const deleteProduct = async (id: string) => {
    const anterior = productsRef.current.find((p) => p.id === id)

    setProducts((prev) => prev.filter((p) => p.id !== id))

    try {
      const response = await fetch(`/api/products/${id}`, { method: "DELETE" })
      if (!response.ok) throw new Error("Erro ao excluir produto")
    } catch (err) {
      if (anterior) setProducts((prev) => upsert(prev, anterior))
      throw err
    }
  }

  const deleteMany = async (ids: string[]) => {
    if (ids.length === 0) return

    const anteriores = productsRef.current.filter(
      (p) => p.id && ids.includes(p.id)
    )

    setProducts((prev) => prev.filter((p) => !p.id || !ids.includes(p.id)))

    try {
      const response = await fetch("/api/products", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      })
      if (!response.ok) throw new Error("Erro ao excluir produtos")
    } catch (err) {
      setProducts((prev) => anteriores.reduce(upsert, prev))
      throw err
    }
  }

  return {
    products,
    loading,
    error,
    deleteProduct,
    deleteMany,
    updateProduct,
    addProduct,
    refetch: fetchProducts,
  }
}