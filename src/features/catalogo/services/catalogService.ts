import { supabase } from '@/lib/supabase'

export interface CatalogItem {
  id: string
  code: string
  barcode: string | null
  name: string
  unit: string | null
  price: number | null
  stock: number | null
}

export async function searchCatalog(termo: string): Promise<CatalogItem[]> {
  // vírgula, %, parênteses e * quebram o filtro .or()
  const t = termo.trim().replace(/[%,()*]/g, ' ').trim()
  if (t.length < 2) return []

  let q = supabase
    .from('catalog_items')
    .select('id, code, barcode, name, unit, price, stock')

  if (/^\d+$/.test(t)) {
    // só números: código, código de barras ou parte da descrição
    q = q.or(
      `code.eq.${t},barcode.eq.${t},code.ilike.${t}%,barcode.ilike.${t}%,name.ilike.%${t}%`
    )
  } else {
    // texto: todas as palavras precisam estar na descrição, em qualquer ordem
    for (const palavra of t.split(/\s+/)) q = q.ilike('name', `%${palavra}%`)
  }

  const { data, error } = await q.order('name').limit(15)
  if (error) throw new Error(error.message)
  return (data ?? []) as CatalogItem[]
}

export async function lastImportDate(): Promise<string | null> {
  const { data } = await supabase
    .from('catalog_items')
    .select('updated_at')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.updated_at ?? null
}