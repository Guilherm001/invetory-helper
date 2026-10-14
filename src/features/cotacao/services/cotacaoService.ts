import { supabase } from '@/lib/supabase'
import type { CotacaoData } from '../types'

export interface ItemCotacaoSalvo {
  id: string
  name: string
  quantity: string // texto, como foi digitado ("10", "2,5")
  unit: string | null
  catalog_code: string | null
  position: number
}

export interface CotacaoSalva {
  id: string
  fornecedor: string
  created_at: string
  itens: ItemCotacaoSalvo[]
}

const COL_ITEM = 'id, name, quantity, unit, catalog_code, position'

function erro(e: { message: string }) {
  return new Error(e.message)
}

// cotações guardadas, da mais nova para a mais antiga, já com os itens
export async function listCotacoes(limite = 200): Promise<CotacaoSalva[]> {
  const { data, error } = await supabase
    .from('cotacoes')
    .select(`id, fornecedor, created_at, cotacao_itens(${COL_ITEM})`)
    .order('created_at', { ascending: false })
    .limit(limite)

  if (error) throw erro(error)

  return (data ?? []).map((c) => {
    const row = c as unknown as {
      id: string
      fornecedor: string
      created_at: string
      cotacao_itens: ItemCotacaoSalvo[] | null
    }
    return {
      id: row.id,
      fornecedor: row.fornecedor,
      created_at: row.created_at,
      itens: [...(row.cotacao_itens ?? [])].sort((a, b) => a.position - b.position),
    }
  })
}

// guarda uma cotação. `codigos` segue a mesma ordem de `data.itens` (null = item sem código do catálogo)
export async function salvarCotacao(
  data: CotacaoData,
  codigos: (string | null)[] = []
): Promise<string> {
  const { data: cot, error } = await supabase
    .from('cotacoes')
    .insert({ fornecedor: data.fornecedor.trim() })
    .select('id')
    .single()

  if (error) throw erro(error)

  if (data.itens.length > 0) {
    const { error: errItens } = await supabase.from('cotacao_itens').insert(
      data.itens.map((it, i) => ({
        cotacao_id: cot.id,
        name: it.name,
        quantity: it.quantity,
        unit: it.unit,
        catalog_code: codigos[i] ?? null,
        position: i,
      }))
    )

    if (errItens) {
      // não deixa uma cotação vazia pela metade
      await supabase.from('cotacoes').delete().eq('id', cot.id)
      throw erro(errItens)
    }
  }

  return cot.id as string
}

export async function excluirCotacao(id: string) {
  const { error } = await supabase.from('cotacoes').delete().eq('id', id)
  if (error) throw erro(error)
}