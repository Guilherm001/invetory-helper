import { supabase } from '@/lib/supabase'

export type TipoCliente = 'fisica' | 'juridica'
export type IndIE = 1 | 2 | 9
export type SituacaoCliente = 'ativos' | 'inativos' | 'todos'

export interface Cliente {
  id: string
  tipo: TipoCliente
  nome: string // nome completo (PF) ou razão social (PJ)
  nome_fantasia: string | null
  documento: string // CPF ou CNPJ, só letras/números
  rg: string | null
  data_nascimento: string | null
  contato: string | null
  ind_ie: IndIE
  ie: string | null
  im: string | null
  suframa: string | null
  consumidor_final: boolean
  email: string | null
  telefone: string | null
  cep: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  municipio: string | null
  cod_municipio: string | null
  uf: string | null
  observacao: string | null
  ativo: boolean
  criado_em: string
  atualizado_em: string
}

// o "ativo" não entra no formulário: só o dono muda, pela ficha
export type DadosCliente = Omit<Cliente, 'id' | 'criado_em' | 'atualizado_em' | 'ativo'>

export type ClienteResumo = Pick<Cliente, 'id' | 'tipo' | 'nome' | 'documento'>

export const TAMANHO_PAGINA = 20

const COLUNAS =
  'id, tipo, nome, nome_fantasia, documento, rg, data_nascimento, contato, ind_ie, ie, im, suframa, consumidor_final, email, telefone, cep, logradouro, numero, complemento, bairro, municipio, cod_municipio, uf, observacao, ativo, criado_em, atualizado_em'

function traduz(error: { message: string; code?: string }) {
  const m = error.message

  if (error.code === '23505') return new Error('Já existe um cliente cadastrado com esse CPF/CNPJ.')
  if (error.code === '23503')
    return new Error(
      'Este cliente tem crédito, pendência ou outros registros e não pode ser excluído. Desative o cadastro.'
    )
  if (m.includes('Só o dono pode ativar'))
    return new Error('Só o dono pode ativar ou desativar clientes.')
  if (error.code === '42P01' || m.includes('does not exist'))
    return new Error(
      m.includes('column')
        ? 'O cadastro de clientes ainda não foi atualizado no banco. Rode o SQL da ficha do cliente.'
        : 'A tabela de clientes ainda não existe no banco. Rode o SQL de clientes.'
    )
  if (m.includes('clientes_documento_valido')) return new Error('CPF ou CNPJ inválido.')
  if (m.includes('clientes_ie_')) return new Error('Confira a inscrição estadual e a situação escolhida.')
  if (m.includes('clientes_nome_tam')) return new Error('O nome deve ter de 2 a 60 caracteres.')
  if (m.includes('clientes_textos_tam'))
    return new Error('Algum texto passou do tamanho que a nota fiscal aceita (60 caracteres).')
  if (m.includes('clientes_formato'))
    return new Error('Algum campo está em formato inválido (CEP, telefone, e-mail, UF ou código IBGE).')
  if (m.toLowerCase().includes('row-level security'))
    return new Error('Você não tem permissão para fazer isso.')

  return new Error(m)
}

export async function listarClientes(opts: {
  termo: string
  tipo?: TipoCliente | 'todos'
  situacao?: SituacaoCliente // padrão: só os ativos
  pagina: number
  tamanho?: number
}): Promise<{ itens: Cliente[]; total: number }> {
  const tamanho = opts.tamanho ?? TAMANHO_PAGINA

  let q = supabase.from('clientes').select(COLUNAS, { count: 'exact' })

  if (opts.tipo && opts.tipo !== 'todos') q = q.eq('tipo', opts.tipo)

  const situacao = opts.situacao ?? 'ativos'
  if (situacao === 'ativos') q = q.eq('ativo', true)
  else if (situacao === 'inativos') q = q.eq('ativo', false)

  // vírgula, %, parênteses, aspas e * quebram o filtro .or()
  const t = opts.termo.trim().replace(/[%,()*"\\]/g, ' ').trim()

  // cada palavra precisa aparecer no nome, no documento ou no telefone
  for (const palavra of t.split(/\s+/).filter(Boolean)) {
    const alfa = palavra.replace(/[^0-9A-Za-z]/g, '').toUpperCase()
    const partes = [`nome.ilike.%${palavra}%`, `nome_fantasia.ilike.%${palavra}%`]
    if (alfa.length >= 3) partes.push(`documento.ilike.%${alfa}%`)
    if (/^\d{4,}$/.test(alfa)) partes.push(`telefone.ilike.%${alfa}%`)
    q = q.or(partes.join(','))
  }

  const de = opts.pagina * tamanho
  const { data, error, count } = await q
    .order('nome')
    .order('id')
    .range(de, de + tamanho - 1)

  if (error) throw traduz(error)

  return { itens: (data ?? []) as unknown as Cliente[], total: count ?? 0 }
}

export async function obterCliente(id: string): Promise<Cliente | null> {
  const { data, error } = await supabase
    .from('clientes')
    .select(COLUNAS)
    .eq('id', id)
    .maybeSingle()

  if (error) throw traduz(error)
  return (data as unknown as Cliente) ?? null
}

export async function criarCliente(dados: DadosCliente): Promise<Cliente> {
  const { data, error } = await supabase
    .from('clientes')
    .insert(dados)
    .select(COLUNAS)
    .single()

  if (error) throw traduz(error)
  return data as unknown as Cliente
}

export async function atualizarCliente(id: string, dados: DadosCliente): Promise<Cliente> {
  const { data, error } = await supabase
    .from('clientes')
    .update(dados)
    .eq('id', id)
    .select(COLUNAS)
    .single()

  if (error) throw traduz(error)
  return data as unknown as Cliente
}

export async function alternarAtivoCliente(id: string, ativo: boolean) {
  const { data, error } = await supabase
    .from('clientes')
    .update({ ativo })
    .eq('id', id)
    .select('id')

  if (error) throw traduz(error)
  if (!data || data.length === 0)
    throw new Error('Não foi possível alterar. Só o dono pode ativar ou desativar clientes.')
}

export async function excluirCliente(id: string) {
  const { data, error } = await supabase.from('clientes').delete().eq('id', id).select('id')

  if (error) throw traduz(error)
  if (!data || data.length === 0)
    throw new Error('Não foi possível excluir. Só o dono pode excluir clientes.')
}