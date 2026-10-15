import { supabase } from '@/lib/supabase'
import type {
  FornecedorCompleto,
  NovoFornecedorCompleto,
  Telefone,
  UsoFornecedor,
} from '../types'
import { formatarTelefone } from '../utils/formatos'

const COLUNAS =
  'id, name, razao_social, documento, telefones, emails, endereco, representante, lead_time_days, notes, contact, ativo, created_at'

function traduz(e: { message: string; code?: string }) {
  if (e.code === '23505') return new Error('Já existe um fornecedor cadastrado com este CNPJ/CPF.')
  if (e.code === '23514') return new Error('Algum dado não passou na conferência (CNPJ/CPF, telefones ou e-mails).')
  if (e.message.toLowerCase().includes('does not exist'))
    return new Error('O cadastro de fornecedores ainda não foi atualizado no banco. Rode o SQL de fornecedores.')
  return new Error(e.message)
}

function mapear(r: Record<string, unknown>): FornecedorCompleto {
  const tels = Array.isArray(r.telefones) ? (r.telefones as Partial<Telefone>[]) : []
  return {
    id: r.id as string,
    name: r.name as string,
    razao_social: (r.razao_social as string | null) ?? null,
    documento: (r.documento as string | null) ?? null,
    telefones: tels
      .map((t) => ({
        numero: String(t.numero ?? ''),
        rotulo: String(t.rotulo ?? ''),
        whatsapp: !!t.whatsapp,
      }))
      .filter((t) => t.numero),
    emails: Array.isArray(r.emails) ? (r.emails as string[]) : [],
    endereco: (r.endereco as string | null) ?? null,
    representante: (r.representante as string | null) ?? null,
    lead_time_days: r.lead_time_days == null ? null : Number(r.lead_time_days),
    notes: (r.notes as string | null) ?? null,
    contact: (r.contact as string | null) ?? null,
    ativo: r.ativo !== false,
    created_at: r.created_at as string,
  }
}

function paraBanco(d: NovoFornecedorCompleto, contactAntigo: string | null) {
  const primeiroTelefone = d.telefones[0] ? formatarTelefone(d.telefones[0].numero) : null
  return {
    name: d.name.trim(),
    razao_social: d.razao_social?.trim() || null,
    documento: d.documento || null,
    telefones: d.telefones,
    emails: d.emails,
    endereco: d.endereco?.trim() || null,
    representante: d.representante?.trim() || null,
    lead_time_days: d.lead_time_days,
    notes: d.notes?.trim() || null,
    // campo antigo: as comparações e os PDFs ainda leem este
    contact: primeiroTelefone ?? d.emails[0] ?? contactAntigo,
    ativo: d.ativo,
    updated_at: new Date().toISOString(),
  }
}

export async function listarFornecedores(): Promise<FornecedorCompleto[]> {
  const { data, error } = await supabase.from('suppliers').select(COLUNAS).order('name')
  if (error) throw traduz(error)
  return (data ?? []).map((r) => mapear(r as Record<string, unknown>))
}

export async function criarFornecedor(dados: NovoFornecedorCompleto) {
  const { error } = await supabase.from('suppliers').insert(paraBanco(dados, null))
  if (error) throw traduz(error)
}

export async function atualizarFornecedor(
  id: string,
  dados: NovoFornecedorCompleto,
  contactAtual: string | null
) {
  const { error } = await supabase
    .from('suppliers')
    .update(paraBanco(dados, contactAtual))
    .eq('id', id)
  if (error) throw traduz(error)
}

export async function alternarAtivo(id: string, ativo: boolean) {
  const { error } = await supabase
    .from('suppliers')
    .update({ ativo, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw traduz(error)
}

// em quantas comparações e preços o fornecedor aparece (excluir apaga tudo isso)
export async function usoDoFornecedor(id: string): Promise<UsoFornecedor> {
  const [comp, precos] = await Promise.all([
    supabase
      .from('price_comparison_suppliers')
      .select('comparison_id', { count: 'exact', head: true })
      .eq('supplier_id', id),
    supabase
      .from('price_quotes')
      .select('id', { count: 'exact', head: true })
      .eq('supplier_id', id),
  ])
  if (comp.error) throw traduz(comp.error)
  if (precos.error) throw traduz(precos.error)
  return { comparacoes: comp.count ?? 0, precos: precos.count ?? 0 }
}

export async function excluirFornecedor(id: string) {
  const { error } = await supabase.from('suppliers').delete().eq('id', id)
  if (error) throw traduz(error)
}