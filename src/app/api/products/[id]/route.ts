import { NextResponse } from "next/server"
import { updateProduct, deleteProduct } from "@/services/listService"

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const updatedProduct = await updateProduct(id, body)
    return NextResponse.json(updatedProduct)
  } catch (error: any) {
    console.error("Erro ao atualizar produto:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await deleteProduct(id)
    return NextResponse.json({ message: "Produto excluído com sucesso" })
  } catch (error: any) {
    console.error("Erro ao excluir produto:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
