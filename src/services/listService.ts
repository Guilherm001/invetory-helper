import { supabase } from "../lib/supabase"

export interface Product {
  id?: string
  name: string
  quantity: number
  priority: string
  status: string
  notes?: string
  created_at?: string
}

export async function getAllProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("name", { ascending: true })

  if (error) throw new Error(error.message)
  return data
}

export async function createProduct(product: Omit<Product, "id" | "created_at">) {
  const { data, error } = await supabase
    .from("products")
    .insert([product])
    .select()

  if (error) throw new Error(error.message)
  return data[0]
}

export async function updateProduct(id: string, product: Partial<Product>) {
  const { data, error } = await supabase
    .from("products")
    .update(product)
    .eq("id", id)
    .select()

  if (error) throw new Error(error.message)
  return data[0]
}

export async function deleteProduct(id: string) {
  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", id)

  if (error) throw new Error(error.message)
  return true
}
