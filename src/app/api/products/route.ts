import { NextResponse } from "next/server"
import { ListProducts, createProduct } from "@/services/listService"

export async function GET() {
  try {
    const products = new ListProducts();
    const product = await products.getAllProducts()
    return NextResponse.json(product)
  } catch (err) {
    console.error("Erro ao buscar produtos:", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
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
  } catch (err) {
    console.error("Erro ao criar produto:", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
