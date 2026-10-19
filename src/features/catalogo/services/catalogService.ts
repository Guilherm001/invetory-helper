import { supabase } from '@/lib/supabase'
import type { SituacaoTributaria } from '../lib/fiscal'

export interface CatalogItem {
  id: string
  code: string
  barcode: string | null
  name: string
  unit: string | null
  price: number | null
  stock: number | null
}

// dados fiscais, de venda e de organização do produto (só carregados na edição)
export interface CatalogExtras {
  group_id: string | null
  ncm: string | null
  cest: string | null
  origem: number | null
  cst_icms: string | null
  situacao_trib: SituacaoTributaria | null
  aliq_icms: number | null
  aliq_ipi: number | null
  aliq_st: number | null
  comissao: number | null
  multiplo: number // de quanto em quanto pode vender (1 = inteiro, 0.5 = meio em meio...)
  custo: number | null // custo bruto
  margem: number | null // margem desejada (%) sobre o custo com impostos
}

export type CatalogItemDetalhe = CatalogItem & CatalogExtras

// code é opcional: na criação o banco gera sozinho
export type NovoCatalogItem = Omit<CatalogItem, 'id' | 'code'> & { code?: string } & Partial<CatalogExtras>

export interface CatalogMovement {
  id: string
  item_id: string
  type: string
  quantity: number
  note: string | null
  created_at: string
}

export interface GrupoCatalogo {
  id: string
  name: string
}

export interface FornecedorBasico {
  id: string
  name: string
}

export interface FornecedorDoItem {
  supplier_id: string
  principal: boolean
  custo: number | null
  codigo_fornecedor: string | null
}

const COLUNAS = 'id, code, barcode, name, unit, price, stock'
const COLUNAS_DETALHE = `${COLUNAS}, group_id, ncm, cest, origem, cst_icms, situacao_trib, aliq_icms, aliq_ipi, aliq_st, comissao, multiplo, custo, margem`
const LIMITE_BUSCA = 15

function traduzErro(error: { message: string; code?: string }) {
  if (error.code === '23505') return new Error('Já existe um item com esse código.')
  if (error.code === '23514')
    return new Error(
      'Algum campo fiscal está em formato inválido (NCM com 8 números, CEST com 7, alíquotas de 0 a 100, múltiplo maior que zero).'
    )
  if (error.code === '42703' || error.message.includes('does not exist'))
    return new Error(
      'O banco ainda não tem os campos novos do catálogo. Rode o SQL do catálogo completo.'
    )
  return new Error(error.message)
}

async function usuarioId() {
  const { data } = await supabase.auth.getUser()
  if (!data.user) throw new Error('Não autenticado')
  return data.user.id
}

// junta as listas na ordem recebida, sem repetir item e respeitando o limite
function juntar(listas: (CatalogItem[] | null)[], limite: number): CatalogItem[] {
  const vistos = new Set<string>()
  const saida: CatalogItem[] = []
  for (const lista of listas) {
    for (const item of lista ?? []) {
      if (vistos.has(item.id)) continue
      vistos.add(item.id)
      saida.push(item)
      if (saida.length >= limite) return saida
    }
  }
  return saida
}

const numeroOuNull = (v: unknown): number | null =>
  v === null || v === undefined ? null : Number(v)

// ---------- busca usada na lista de produtos ----------

export async function searchCatalog(
  termo: string,
  limite = 50
): Promise<CatalogItem[]> {
  // vírgula, %, parênteses e * quebram o filtro .or()
  const t = termo
    .trim()
    .replace(/[%,()*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const soNumeros = /^\d+$/.test(t)

  // números aceitam 1 dígito (códigos 1 a 9); texto precisa de 2+
  if (t.length < (soNumeros ? 1 : 2)) return []

  if (soNumeros) {
    const [exatos, comecam, nomes] = await Promise.all([
      supabase
        .from('catalog_items')
        .select(COLUNAS)
        .or(`code.eq.${t},barcode.eq.${t}`)
        .limit(5),
      supabase
        .from('catalog_items')
        .select(COLUNAS)
        .or(`code.ilike.${t}%,barcode.ilike.${t}%`)
        .order('code')
        .limit(limite),
      supabase
        .from('catalog_items')
        .select(COLUNAS)
        .ilike('name', `%${t}%`)
        .order('name')
        .limit(limite * 2),
    ])

    if (exatos.error) throw new Error(exatos.error.message)
    if (comecam.error) throw new Error(comecam.error.message)
    if (nomes.error) throw new Error(nomes.error.message)

    return juntar(
      [
        exatos.data as CatalogItem[],
        comecam.data as CatalogItem[],
        nomes.data as CatalogItem[],
      ],
      limite
    )
  }

  const [primeira, ...demais] = t.split(' ')

  const exatos =
    demais.length === 0
      ? supabase
          .from('catalog_items')
          .select(COLUNAS)
          .or(`code.eq.${primeira},barcode.eq.${primeira}`)
          .limit(5)
      : null

  let comecam = supabase
    .from('catalog_items')
    .select(COLUNAS)
    .ilike('name', `${primeira}%`)
  for (const palavra of demais) comecam = comecam.ilike('name', `%${palavra}%`)

  let contem = supabase.from('catalog_items').select(COLUNAS)
  for (const palavra of [primeira, ...demais])
    contem = contem.ilike('name', `%${palavra}%`)

  const [rExatos, rComecam, rContem] = await Promise.all([
    exatos ?? Promise.resolve({ data: [] as CatalogItem[], error: null }),
    comecam.order('name').limit(limite),
    contem.order('name').limit(limite * 2),
  ])

  if (rExatos.error) throw new Error(rExatos.error.message)
  if (rComecam.error) throw new Error(rComecam.error.message)
  if (rContem.error) throw new Error(rContem.error.message)

  return juntar(
    [
      rExatos.data as CatalogItem[],
      rComecam.data as CatalogItem[],
      rContem.data as CatalogItem[],
    ],
    limite
  )
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

// o item com todos os dados fiscais e de venda (usado na janela de edição)
export async function getCatalogItemDetalhe(id: string): Promise<CatalogItemDetalhe> {
  const { data, error } = await supabase
    .from('catalog_items')
    .select(COLUNAS_DETALHE)
    .eq('id', id)
    .single()

  if (error) throw traduzErro(error)

  const r = data as unknown as Record<string, unknown>
  return {
    id: r.id as string,
    code: r.code as string,
    barcode: (r.barcode as string | null) ?? null,
    name: r.name as string,
    unit: (r.unit as string | null) ?? null,
    price: numeroOuNull(r.price),
    stock: numeroOuNull(r.stock),
    group_id: (r.group_id as string | null) ?? null,
    ncm: (r.ncm as string | null) ?? null,
    cest: (r.cest as string | null) ?? null,
    origem: numeroOuNull(r.origem),
    cst_icms: (r.cst_icms as string | null) ?? null,
    situacao_trib: (r.situacao_trib as SituacaoTributaria | null) ?? null,
    aliq_icms: numeroOuNull(r.aliq_icms),
    aliq_ipi: numeroOuNull(r.aliq_ipi),
    aliq_st: numeroOuNull(r.aliq_st),
    comissao: numeroOuNull(r.comissao),
    custo: numeroOuNull(r.custo),
    margem: numeroOuNull(r.margem),
    multiplo: r.multiplo === null || r.multiplo === undefined ? 1 : Number(r.multiplo),
  }
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

// ---------- grupos ----------

export async function listGrupos(): Promise<GrupoCatalogo[]> {
  const { data, error } = await supabase.from('catalog_groups').select('id, name').order('name')
  if (error) throw traduzErro(error)
  return (data ?? []) as GrupoCatalogo[]
}

export async function createGrupo(name: string): Promise<GrupoCatalogo> {
  const { data, error } = await supabase
    .from('catalog_groups')
    .insert({ name: name.trim() })
    .select('id, name')
    .single()

  if (error) {
    if (error.code === '23505') throw new Error('Já existe um grupo com esse nome.')
    throw traduzErro(error)
  }
  return data as GrupoCatalogo
}

// ---------- fornecedores do item ----------

export async function listFornecedoresBasicos(): Promise<FornecedorBasico[]> {
  const { data, error } = await supabase.from('suppliers').select('id, name').order('name')
  if (error) throw new Error(error.message)
  return (data ?? []) as FornecedorBasico[]
}

export async function listFornecedoresDoItem(itemId: string): Promise<FornecedorDoItem[]> {
  const { data, error } = await supabase
    .from('catalog_item_suppliers')
    .select('supplier_id, principal, custo, codigo_fornecedor')
    .eq('item_id', itemId)

  if (error) throw traduzErro(error)
  return (data ?? []).map((r) => ({
    supplier_id: r.supplier_id as string,
    principal: r.principal === true,
    custo: numeroOuNull(r.custo),
    codigo_fornecedor: (r.codigo_fornecedor as string | null) ?? null,
  }))
}

// grava a lista inteira: quem saiu é apagado, quem ficou é atualizado, quem entrou é criado
export async function salvarFornecedoresDoItem(itemId: string, lista: FornecedorDoItem[]) {
  // sempre um (e só um) principal quando há fornecedores
  const lidos = lista.map((f) => ({ ...f }))
  if (lidos.length > 0 && !lidos.some((f) => f.principal)) lidos[0].principal = true
  let achouPrincipal = false
  for (const f of lidos) {
    if (f.principal && achouPrincipal) f.principal = false
    if (f.principal) achouPrincipal = true
  }

  const ids = lidos.map((f) => f.supplier_id)

  let remover = supabase.from('catalog_item_suppliers').delete().eq('item_id', itemId)
  if (ids.length > 0) remover = remover.not('supplier_id', 'in', `(${ids.join(',')})`)
  const r1 = await remover
  if (r1.error) throw traduzErro(r1.error)

  if (ids.length === 0) return

  // tira o "principal" de todos antes, para a troca de principal não esbarrar no índice único
  const r2 = await supabase
    .from('catalog_item_suppliers')
    .update({ principal: false })
    .eq('item_id', itemId)
  if (r2.error) throw traduzErro(r2.error)

  const r3 = await supabase.from('catalog_item_suppliers').upsert(
    lidos.map((f) => ({
      item_id: itemId,
      supplier_id: f.supplier_id,
      principal: f.principal,
      custo: f.custo,
      codigo_fornecedor: f.codigo_fornecedor?.trim() || null,
    })),
    { onConflict: 'item_id,supplier_id' }
  )
  if (r3.error) throw traduzErro(r3.error)
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