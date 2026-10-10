import { supabase } from '@/lib/supabase'
import type {
  Comparacao,
  ComparacaoCompleta,
  ComparacaoResumo,
  Fornecedor,
  ItemComparacao,
  NovoFornecedor,
  NovoItemComparacao,
  Preco,
} from '../types'

const COL_FORNECEDOR = 'id, name, contact, lead_time_days, notes, created_at'
const COL_ITEM = 'id, comparison_id, name, quantity, unit, catalog_code, position'
const COL_PRECO = 'id, item_id, supplier_id, price'

function erro(e: { message: string }) {
  return new Error(e.message)
}

// ---------- comparações ----------

export async function listComparacoes(): Promise<ComparacaoResumo[]> {
  const { data, error } = await supabase
    .from('price_comparisons')
    .select(
      'id, name, created_at, price_comparison_items(count), price_comparison_suppliers(count)'
    )
    .order('created_at', { ascending: false })

  if (error) throw erro(error)

  return (data ?? []).map((c) => {
    const row = c as unknown as {
      id: string
      name: string
      created_at: string
      price_comparison_items: { count: number }[]
      price_comparison_suppliers: { count: number }[]
    }
    return {
      id: row.id,
      name: row.name,
      created_at: row.created_at,
      itens_count: row.price_comparison_items?.[0]?.count ?? 0,
      fornecedores_count: row.price_comparison_suppliers?.[0]?.count ?? 0,
    }
  })
}

export async function createComparacao(
  name: string,
  itens: NovoItemComparacao[]
): Promise<Comparacao> {
  const { data: comp, error } = await supabase
    .from('price_comparisons')
    .insert({ name: name.trim() })
    .select('id, name, created_at')
    .single()

  if (error) throw erro(error)

  if (itens.length > 0) {
    const { error: errItens } = await supabase.from('price_comparison_items').insert(
      itens.map((it, i) => ({
        comparison_id: comp.id,
        name: it.name.trim(),
        quantity: it.quantity > 0 ? it.quantity : 1,
        unit: it.unit,
        catalog_code: it.catalog_code,
        position: i,
      }))
    )

    if (errItens) {
      // não deixa uma comparação vazia pela metade
      await supabase.from('price_comparisons').delete().eq('id', comp.id)
      throw erro(errItens)
    }
  }

  return comp as Comparacao
}

export async function renameComparacao(id: string, name: string) {
  const { error } = await supabase
    .from('price_comparisons')
    .update({ name: name.trim() })
    .eq('id', id)
  if (error) throw erro(error)
}

export async function deleteComparacao(id: string) {
  const { error } = await supabase.from('price_comparisons').delete().eq('id', id)
  if (error) throw erro(error)
}

// uma comparação aberta, com itens, fornecedores participantes e preços
export async function getComparacao(id: string): Promise<ComparacaoCompleta> {
  const [comp, itens, forn] = await Promise.all([
    supabase.from('price_comparisons').select('id, name, created_at').eq('id', id).maybeSingle(),
    supabase
      .from('price_comparison_items')
      .select(COL_ITEM)
      .eq('comparison_id', id)
      .order('position'),
    supabase
      .from('price_comparison_suppliers')
      .select(`supplier_id, suppliers(${COL_FORNECEDOR})`)
      .eq('comparison_id', id),
  ])

  if (comp.error) throw erro(comp.error)
  if (!comp.data) throw new Error('Comparação não encontrada.')
  if (itens.error) throw erro(itens.error)
  if (forn.error) throw erro(forn.error)

  const listaItens = (itens.data ?? []) as ItemComparacao[]

  const fornecedores = (forn.data ?? [])
    .map((r) => (r as unknown as { suppliers: Fornecedor | null }).suppliers)
    .filter((f): f is Fornecedor => f !== null)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  let precos: Preco[] = []
  if (listaItens.length > 0) {
    const { data, error } = await supabase
      .from('price_quotes')
      .select(COL_PRECO)
      .in('item_id', listaItens.map((i) => i.id))
    if (error) throw erro(error)
    precos = (data ?? []) as Preco[]
  }

  return {
    comparacao: comp.data as Comparacao,
    itens: listaItens,
    fornecedores,
    precos,
  }
}

// ---------- itens ----------

export async function addItens(
  comparacaoId: string,
  itens: NovoItemComparacao[],
  aPartirDe: number
) {
  if (itens.length === 0) return
  const { error } = await supabase.from('price_comparison_items').insert(
    itens.map((it, i) => ({
      comparison_id: comparacaoId,
      name: it.name.trim(),
      quantity: it.quantity > 0 ? it.quantity : 1,
      unit: it.unit,
      catalog_code: it.catalog_code,
      position: aPartirDe + i,
    }))
  )
  if (error) throw erro(error)
}

export async function updateItem(
  id: string,
  dados: Partial<Pick<ItemComparacao, 'name' | 'quantity'>>
) {
  const { error } = await supabase.from('price_comparison_items').update(dados).eq('id', id)
  if (error) throw erro(error)
}

export async function removeItem(id: string) {
  const { error } = await supabase.from('price_comparison_items').delete().eq('id', id)
  if (error) throw erro(error)
}

// ---------- fornecedores ----------

export async function listFornecedores(): Promise<Fornecedor[]> {
  const { data, error } = await supabase
    .from('suppliers')
    .select(COL_FORNECEDOR)
    .order('name')
  if (error) throw erro(error)
  return (data ?? []) as Fornecedor[]
}

export async function createFornecedor(f: NovoFornecedor): Promise<Fornecedor> {
  const { data, error } = await supabase
    .from('suppliers')
    .insert({ ...f, name: f.name.trim() })
    .select(COL_FORNECEDOR)
    .single()
  if (error) throw erro(error)
  return data as Fornecedor
}

export async function updateFornecedor(id: string, f: NovoFornecedor): Promise<Fornecedor> {
  const { data, error } = await supabase
    .from('suppliers')
    .update({ ...f, name: f.name.trim() })
    .eq('id', id)
    .select(COL_FORNECEDOR)
    .single()
  if (error) throw erro(error)
  return data as Fornecedor
}

export async function deleteFornecedor(id: string) {
  const { error } = await supabase.from('suppliers').delete().eq('id', id)
  if (error) throw erro(error)
}

export async function addFornecedorNaComparacao(comparacaoId: string, fornecedorId: string) {
  const { error } = await supabase
    .from('price_comparison_suppliers')
    .upsert(
      { comparison_id: comparacaoId, supplier_id: fornecedorId },
      { onConflict: 'comparison_id,supplier_id', ignoreDuplicates: true }
    )
  if (error) throw erro(error)
}

// tira o fornecedor só desta comparação e apaga os preços dele aqui
export async function removeFornecedorDaComparacao(
  comparacaoId: string,
  fornecedorId: string,
  itemIds: string[]
) {
  if (itemIds.length > 0) {
    const { error } = await supabase
      .from('price_quotes')
      .delete()
      .eq('supplier_id', fornecedorId)
      .in('item_id', itemIds)
    if (error) throw erro(error)
  }

  const { error } = await supabase
    .from('price_comparison_suppliers')
    .delete()
    .eq('comparison_id', comparacaoId)
    .eq('supplier_id', fornecedorId)
  if (error) throw erro(error)
}

// ---------- preços ----------

// valor preenchido: grava | null: apaga a linha (sem preço != preço zero)
export async function setPreco(
  itemId: string,
  fornecedorId: string,
  valor: number | null
): Promise<Preco | null> {
  if (valor === null) {
    const { error } = await supabase
      .from('price_quotes')
      .delete()
      .eq('item_id', itemId)
      .eq('supplier_id', fornecedorId)
    if (error) throw erro(error)
    return null
  }

  const { data, error } = await supabase
    .from('price_quotes')
    .upsert(
      {
        item_id: itemId,
        supplier_id: fornecedorId,
        price: valor,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'item_id,supplier_id' }
    )
    .select(COL_PRECO)
    .single()

  if (error) throw erro(error)
  return data as Preco
}