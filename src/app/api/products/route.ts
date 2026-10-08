import { NextResponse } from "next/server"
import { createSupabaseServer } from "@/lib/supabase-server"
import { getAllProducts, createProduct } from "@/features/body/services/listService"

export async function GET() {
  try {
    const supabase = await createSupabaseServer()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const products = await getAllProducts(supabase)
    return NextResponse.json(products)
  } catch (err) {
    console.error("Erro ao buscar produtos:", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServer()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const body = await request.json()

    if (!body.name) {
      return NextResponse.json({ error: "O nome do produto é obrigatório" }, { status: 400 })
    }

    const newProduct = await createProduct(supabase, {
      name: body.name,
      quantity: body.quantity || 0,
      priority: body.priority || "Média",
      status: body.status || "Pendente",
      notes: body.notes || "",
    })

    return NextResponse.json(newProduct, { status: 201 })
  } catch (err) {
    console.error("Erro ao criar produto:", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}