import type { SupabaseClient } from "@supabase/supabase-js"

export interface Product {
  id?: string
  name: string
  quantity: number
  priority: string
  status: string
  notes?: string
  unit?: string | null
  catalog_code?: string | null
  created_at?: string
}

const priorityOrder: Record<string, number> = {
  Alta: 1,
  Média: 2,
  Baixa: 3,
}

export async function getAllProducts(client: SupabaseClient): Promise<Product[]> {
  const { data, error } = await client
    .from("products")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)

  return [...data].sort(
    (a, b) =>
      (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99)
  )
}

export async function createProduct(
  client: SupabaseClient,
  product: Omit<Product, "id" | "created_at">
): Promise<Product> {
  const { data, error } = await client
    .from("products")
    .insert(product)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function updateProduct(
  client: SupabaseClient,
  id: string,
  product: Partial<Product>
): Promise<Product> {
  const { data, error } = await client
    .from("products")
    .update(product)
    .eq("id", id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function deleteProduct(client: SupabaseClient, id: string) {
  const { error } = await client.from("products").delete().eq("id", id)

  if (error) throw new Error(error.message)
  return true
}