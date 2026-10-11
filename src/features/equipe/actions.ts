'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { donoAtual } from '@/lib/auth-dono'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

const LIMITE_FUNCIONARIOS = 5

export type Resultado = { ok: true } | { ok: false; erro: string }

const novoSchema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome'),
  email: z.string().trim().min(1, 'Informe o email').email('Email inválido'),
  senha: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
})

const senhaSchema = z.string().min(6, 'A senha deve ter pelo menos 6 caracteres')

async function ehFuncionarioDaEmpresa(
  admin: ReturnType<typeof createSupabaseAdmin>,
  empresaId: string,
  id: string
) {
  const { data } = await admin
    .from('perfis')
    .select('id')
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .eq('papel', 'funcionario')
    .maybeSingle()
  return !!data
}

function traduz(message: string) {
  const m = message.toLowerCase()
  if (m.includes('already') && m.includes('registered'))
    return 'Já existe uma conta com esse email'
  if (m.includes('password')) return 'Senha inválida. Use pelo menos 6 caracteres'
  return message
}

export async function criarFuncionario(input: {
  nome: string
  email: string
  senha: string
}): Promise<Resultado> {
  const dono = await donoAtual()
  if (!dono) return { ok: false, erro: 'Sem permissão' }

  const parsed = novoSchema.safeParse(input)
  if (!parsed.success) return { ok: false, erro: parsed.error.issues[0].message }

  const admin = createSupabaseAdmin()

  const { count, error: erroCount } = await admin
    .from('perfis')
    .select('id', { count: 'exact', head: true })
    .eq('empresa_id', dono.empresaId)
    .eq('papel', 'funcionario')

  if (erroCount) return { ok: false, erro: 'Não foi possível verificar o limite de funcionários' }

  if ((count ?? 0) >= LIMITE_FUNCIONARIOS)
    return { ok: false, erro: `Limite de ${LIMITE_FUNCIONARIOS} funcionários atingido` }

  const { error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.senha,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.nome },
    // app_metadata só pode ser definido pelo servidor: é o que o trigger confia
    app_metadata: { papel: 'funcionario', empresa_id: dono.empresaId },
  })

  if (error) return { ok: false, erro: traduz(error.message) }

  revalidatePath('/equipe')
  return { ok: true }
}

export async function removerFuncionario(id: string): Promise<Resultado> {
  const dono = await donoAtual()
  if (!dono) return { ok: false, erro: 'Sem permissão' }

  const admin = createSupabaseAdmin()
  if (!(await ehFuncionarioDaEmpresa(admin, dono.empresaId, id)))
    return { ok: false, erro: 'Funcionário não encontrado' }

  // o que ele cadastrou fica com o dono (senão sumiria junto com a conta dele)
  const { error: erroProdutos } = await admin
    .from('products')
    .update({ user_id: dono.userId })
    .eq('user_id', id)

  if (erroProdutos)
    return {
      ok: false,
      erro: 'Não foi possível transferir os produtos do funcionário. Nada foi removido.',
    }

  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) return { ok: false, erro: error.message }

  revalidatePath('/equipe')
  return { ok: true }
}

export async function redefinirSenhaFuncionario(
  id: string,
  senha: string
): Promise<Resultado> {
  const dono = await donoAtual()
  if (!dono) return { ok: false, erro: 'Sem permissão' }

  const parsed = senhaSchema.safeParse(senha)
  if (!parsed.success) return { ok: false, erro: parsed.error.issues[0].message }

  const admin = createSupabaseAdmin()
  if (!(await ehFuncionarioDaEmpresa(admin, dono.empresaId, id)))
    return { ok: false, erro: 'Funcionário não encontrado' }

  const { error } = await admin.auth.admin.updateUserById(id, { password: parsed.data })
  if (error) return { ok: false, erro: traduz(error.message) }

  return { ok: true }
}