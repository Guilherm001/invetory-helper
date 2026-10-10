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

// code é opcional: na criação o banco gera sozinho
export type NovoCatalogItem = Omit<CatalogItem, 'id' | 'code'> & { code?: string }

export interface CatalogMovement {
  id: string
  item_id: string
  type: string
  quantity: number
  note: string | null
  created_at: string
}

const COLUNAS = 'id, code, barcode, name, unit, price, stock'

function traduzErro(error: { message: string; code?: string }) {
  if (error.code === '23505') return new Error('Já existe um item com esse código.')
  return new Error(error.message)
}

async function usuarioId() {
  const { data } = await supabase.auth.getUser()
  if (!data.user) throw new Error('Não autenticado')
  return data.user.id
}

// ---------- busca usada na lista de produtos ----------

export async function searchCatalog(termo: string): Promise<CatalogItem[]> {
  // vírgula, %, parênteses e * quebram o filtro .or()
  const t = termo.trim().replace(/[%,()*]/g, ' ').trim()
  const soNumeros = /^\d+$/.test(t)

  // números aceitam 1 dígito (códigos 1 a 9); texto precisa de 2+
  if (t.length < (soNumeros ? 1 : 2)) return []

  if (soNumeros) {
    // exatos em uma busca própria, para nunca ficarem de fora do limite
    const [exatos, parecidos] = await Promise.all([
      supabase
        .from('catalog_items')
        .select(COLUNAS)
        .or(`code.eq.${t},barcode.eq.${t}`)
        .limit(5),
      supabase
        .from('catalog_items')
        .select(COLUNAS)
        .or(`code.ilike.${t}%,barcode.ilike.${t}%,name.ilike.%${t}%`)
        .order('name')
        .limit(15),
    ])

    if (exatos.error) throw new Error(exatos.error.message)
    if (parecidos.error) throw new Error(parecidos.error.message)

    const listaExatos = (exatos.data ?? []) as CatalogItem[]
    const idsExatos = new Set(listaExatos.map((i) => i.id))
    const resto = ((parecidos.data ?? []) as CatalogItem[]).filter(
      (i) => !idsExatos.has(i.id)
    )

    // exatos primeiro, depois os semelhantes
    return [...listaExatos, ...resto]
  }

  // texto: todas as palavras precisam estar na descrição, em qualquer ordem
  let q = supabase.from('catalog_items').select(COLUNAS)
  for (const palavra of t.split(/\s+/)) q = q.ilike('name', `%${palavra}%`)

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

// ---------- gestão do catálogo ----------

export async function listCatalog(opts: {
  termo: string
  page: number
  pageSize: number
  semEstoque: boolean
}): Promise<{ items: CatalogItem[]; total: number }> {
  let q = supabase.from('catalog_items').select(COLUNAS, { count: 'exact' })

  const t = opts.termo.trim().replace(/[%,()*]/g, ' ').trim()
  if (t) {
    // cada palavra precisa aparecer no nome, código ou código de barras
    for (const palavra of t.split(/\s+/)) {
      q = q.or(
        `name.ilike.%${palavra}%,code.ilike.${palavra}%,barcode.ilike.${palavra}%`
      )
    }
  }

  if (opts.semEstoque) q = q.or('stock.is.null,stock.lte.0')

  const from = opts.page * opts.pageSize
  const { data, error, count } = await q
    .order('name')
    .range(from, from + opts.pageSize - 1)

  if (error) throw new Error(error.message)
  return { items: (data ?? []) as CatalogItem[], total: count ?? 0 }
}

export async function getCatalogStats(): Promise<{ total: number; semEstoque: number }> {
  const [todos, sem] = await Promise.all([
    supabase.from('catalog_items').select('id', { count: 'exact', head: true }),
    supabase
      .from('catalog_items')
      .select('id', { count: 'exact', head: true })
      .or('stock.is.null,stock.lte.0'),
  ])
  if (todos.error) throw new Error(todos.error.message)
  if (sem.error) throw new Error(sem.error.message)
  return { total: todos.count ?? 0, semEstoque: sem.count ?? 0 }
}

export async function createCatalogItem(item: NovoCatalogItem): Promise<CatalogItem> {
  const user_id = await usuarioId()

  // sem código informado, o trigger do banco gera o próximo número
  const { code, ...resto } = item
  const payload = {
    ...resto,
    ...(code?.trim() ? { code: code.trim() } : {}),
    user_id,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('catalog_items')
    .insert(payload)
    .select(COLUNAS)
    .single()

  if (error) throw traduzErro(error)
  return data as CatalogItem
}

export async function updateCatalogItem(
  id: string,
  item: NovoCatalogItem
): Promise<CatalogItem> {
  // o código nunca é alterado na edição
  const { code: _ignorado, ...resto } = item
  void _ignorado

  const { data, error } = await supabase
    .from('catalog_items')
    .update({ ...resto, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(COLUNAS)
    .single()

  if (error) throw traduzErro(error)
  return data as CatalogItem
}

export async function deleteCatalogItems(ids: string[]) {
  if (ids.length === 0) return
  const { error } = await supabase.from('catalog_items').delete().in('id', ids)
  if (error) throw new Error(error.message)
}

// ---------- estoque ----------

export async function registrarEntrada(id: string, quantidade: number, nota: string) {
  const { error } = await supabase.rpc('catalog_entrada', {
    p_item_id: id,
    p_qty: quantidade,
    p_note: nota.trim() || null,
  })
  if (error) throw new Error(error.message)
}

export async function listMovements(itemId: string, limit = 5): Promise<CatalogMovement[]> {
  const { data, error } = await supabase
    .from('catalog_movements')
    .select('id, item_id, type, quantity, note, created_at')
    .eq('item_id', itemId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return (data ?? []) as CatalogMovement[]
}