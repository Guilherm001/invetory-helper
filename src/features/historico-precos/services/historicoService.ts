import { supabase } from '@/lib/supabase'
import type { Cotacao } from '../types'

const PAGINA = 1000
const MAX_PAGINAS = 50 // trava de segurança: 50 mil cotações

interface LinhaBruta {
  id: string
  price: number | string
  updated_at: string
  supplier_id: string
  suppliers: { name: string } | { name: string }[] | null
  price_comparison_items:
    | ItemBruto
    | ItemBruto[]
    | null
}

interface ItemBruto {
  name: string
  unit: string | null
  catalog_code: string | null
  comparison_id: string
  price_comparisons: { name: string } | { name: string }[] | null
}

// o Supabase às vezes tipa relação "para um" como lista
function um<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null
  return v ?? null
}

export async function listCotacoes(): Promise<Cotacao[]> {
  const resultado: Cotacao[] = []

  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const de = pagina * PAGINA

    const { data, error } = await supabase
      .from('price_quotes')
      .select(
        `id, price, updated_at, supplier_id,
         suppliers(name),
         price_comparison_items(name, unit, catalog_code, comparison_id, price_comparisons(name))`
      )
      .order('updated_at', { ascending: true })
      .order('id', { ascending: true })
      .range(de, de + PAGINA - 1)

    if (error) throw new Error(error.message)

    const linhas = (data ?? []) as unknown as LinhaBruta[]

    for (const l of linhas) {
      const item = um(l.price_comparison_items)
      if (!item) continue // item apagado: não deveria acontecer (cascade), mas não quebra

      resultado.push({
        id: l.id,
        itemNome: item.name,
        unidade: item.unit,
        codigo: item.catalog_code,
        comparacaoId: item.comparison_id,
        comparacaoNome: um(item.price_comparisons)?.name ?? 'Comparação',
        fornecedorId: l.supplier_id,
        fornecedorNome: um(l.suppliers)?.name ?? 'Fornecedor',
        preco: Number(l.price),
        data: l.updated_at,
      })
    }

    if (linhas.length < PAGINA) break
  }

  return resultado
}