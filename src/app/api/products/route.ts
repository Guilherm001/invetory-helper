import { NextResponse } from "next/server"
import { getAllProducts, createProduct } from "@/services/listService"

export async function GET() {
  try {
    const products = await getAllProducts()
    return NextResponse.json(products)
  } catch (error: any) {
    console.error("Erro ao buscar produtos:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    if (!body.name) {
      return NextResponse.json({ error: "O nome do produto é obrigatório" }, { status: 400 })
    }

    const newProduct = await createProduct({
      name: body.name,
      quantity: body.quantity || 0,
      priority: body.priority || "Média",
      status: body.status || "Pendente",
      notes: body.notes || ""
    })

    return NextResponse.json(newProduct, { status: 201 })
  } catch (error: any) {
    console.error("Erro ao criar produto:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
