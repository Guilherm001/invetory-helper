import { supabase } from '@/lib/supabase'
import type { Ideia, NovaIdeia } from '../lib/ideias'

const COL = 'id, texto, detalhes, area, tipo, status, destaque, created_at, updated_at'

function erro(e: { message: string }) {
  return new Error(e.message)
}

export async function listIdeias(): Promise<Ideia[]> {
  const { data, error } = await supabase
    .from('ideias')
    .select(COL)
    .order('created_at', { ascending: false })
    .limit(1000)

  if (error) throw erro(error)
  return (data ?? []) as Ideia[]
}

export async function createIdeia(nova: NovaIdeia): Promise<Ideia> {
  const { data, error } = await supabase
    .from('ideias')
    .insert({
      texto: nova.texto.trim(),
      detalhes: nova.detalhes?.trim() || null,
      area: nova.area ?? 'geral',
      tipo: nova.tipo ?? 'recurso',
      status: nova.status ?? 'nova',
      destaque: nova.destaque ?? false,
    })
    .select(COL)
    .single()

  if (error) throw erro(error)
  return data as Ideia
}

// só os campos que vierem em `patch` são alterados
export async function updateIdeia(id: string, patch: Partial<NovaIdeia>): Promise<Ideia> {
  const dados: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (patch.texto !== undefined) dados.texto = patch.texto.trim()
  if (patch.detalhes !== undefined) dados.detalhes = patch.detalhes?.trim() || null
  if (patch.area !== undefined) dados.area = patch.area
  if (patch.tipo !== undefined) dados.tipo = patch.tipo
  if (patch.status !== undefined) dados.status = patch.status
  if (patch.destaque !== undefined) dados.destaque = patch.destaque

  const { data, error } = await supabase
    .from('ideias')
    .update(dados)
    .eq('id', id)
    .select(COL)
    .single()

  if (error) throw erro(error)
  return data as Ideia
}

export async function deleteIdeia(id: string) {
  const { error } = await supabase.from('ideias').delete().eq('id', id)
  if (error) throw erro(error)
}