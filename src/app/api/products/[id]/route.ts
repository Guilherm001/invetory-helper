import { NextResponse } from "next/server"
import { createSupabaseServer } from "@/lib/supabase-server"
import { updateProduct, deleteProduct } from "@/features/body/services/listService"

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServer()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    // só campos permitidos: evita o cliente tentar alterar user_id, id etc.
    const { name, quantity, priority, status, notes } = body
    const updatedProduct = await updateProduct(supabase, id, {
      name,
      quantity,
      priority,
      status,
      notes,
      unit: body.unit ?? null,
      catalog_code: body.catalog_code ?? null,
    })

    return NextResponse.json(updatedProduct)
  } catch (error: unknown) {
    console.error("Erro ao atualizar produto:", error)
    const message = error instanceof Error ? error.message : "Erro interno"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServer()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const { id } = await params
    await deleteProduct(supabase, id)

    return NextResponse.json({ message: "Produto excluído com sucesso" })
  } catch (error: unknown) {
    console.error("Erro ao excluir produto:", error)
    const message = error instanceof Error ? error.message : "Erro interno"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}