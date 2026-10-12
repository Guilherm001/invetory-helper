import { supabase } from '@/lib/supabase'

export interface Vendedor {
  id: string
  nome: string
}

// senha errada, vendedor bloqueado etc.
export class ErroSenha extends Error {}

function traduz(message: string) {
  const m = message.toLowerCase()
  if (m.includes('vendedores_nome_unico')) return 'Já existe um vendedor com esse nome.'
  if (m.includes('could not find the function'))
    return 'As funções de vendedores ainda não existem no banco. Rode o SQL de vendedores.'
  return message
}

export async function listarVendedores(): Promise<Vendedor[]> {
  const { data, error } = await supabase.rpc('listar_vendedores')
  if (error) throw new Error(traduz(error.message))
  return (data ?? []) as Vendedor[]
}

export async function criarVendedor(nome: string, pin: string) {
  const { error } = await supabase.rpc('criar_vendedor', { p_nome: nome, p_pin: pin })
  if (error) throw new Error(traduz(error.message))
}

export async function trocarPinVendedor(id: string, pin: string) {
  const { error } = await supabase.rpc('trocar_pin_vendedor', { p_id: id, p_pin: pin })
  if (error) throw new Error(traduz(error.message))
}

export async function removerVendedor(id: string) {
  const { error } = await supabase.rpc('remover_vendedor', { p_id: id })
  if (error) throw new Error(traduz(error.message))
}