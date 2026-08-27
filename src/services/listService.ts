import { get } from "http"
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

export class ListProducts {
  async getAllProducts(): Promise<Product[]> {
      const { data, error } = await supabase
        .from("products")
        .select("*")
    
      if (error) {
        throw new Error(error.message)
      }

      const priorityOrder = {
      Alta: 1,
      Média: 2,
      Baixa: 3,
    }
      
      return data.sort(
      (a, b) =>
        priorityOrder[a.priority as keyof typeof priorityOrder] -
        priorityOrder[b.priority as keyof typeof priorityOrder]
    )
    }
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
