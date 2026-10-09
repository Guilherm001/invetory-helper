import { NextResponse } from "next/server"
import { createSupabaseServer } from "@/lib/supabase-server"
import { createProducts } from "@/features/body/services/listService"

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServer()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const body = await request.json()

    if (!Array.isArray(body) || body.length === 0) {
      return NextResponse.json(
        { error: "Envie uma lista com pelo menos 1 produto" },
        { status: 400 }
      )
    }

    if (body.length > 200) {
      return NextResponse.json(
        { error: "Máximo de 200 produtos por vez" },
        { status: 400 }
      )
    }

    // valida e normaliza cada item, igual ao POST de /api/products
    const produtos = []
    for (const item of body) {
      const name = typeof item?.name === "string" ? item.name.trim() : ""

      if (!name) {
        return NextResponse.json(
          { error: "Todos os produtos precisam ter nome" },
          { status: 400 }
        )
      }

      const quantity = Number(item.quantity)

      produtos.push({
        name,
        quantity: Number.isFinite(quantity) && quantity >= 1 ? quantity : 1,
        priority: item.priority || "Média",
        status: item.status || "Pendente",
        notes: item.notes || "",
        unit: item.unit ?? null,
        catalog_code: item.catalog_code ?? null,
      })
    }

    const created = await createProducts(supabase, produtos)
    return NextResponse.json(created, { status: 201 })
  } catch (err) {
    console.error("Erro ao criar produtos em massa:", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}