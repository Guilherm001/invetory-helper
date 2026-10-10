import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServer } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LIMITE_FUNCIONARIOS = 5

const novoSchema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome'),
  email: z.string().trim().min(1, 'Informe o email').email('Email inválido'),
  senha: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
})

const senhaSchema = z.object({
  id: z.string().min(1),
  senha: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
})

const idSchema = z.object({ id: z.string().min(1) })

const ok = () => NextResponse.json({ ok: true })
const falha = (erro: string, status = 400) =>
  NextResponse.json({ ok: false, erro }, { status })

function traduz(message: string) {
  const m = message.toLowerCase()
  if (m.includes('already') && m.includes('registered'))
    return 'Já existe uma conta com esse email'
  if (m.includes('database error'))
    return 'O banco recusou a criação da conta. Confira as regras e o trigger do Supabase'
  if (m.includes('password')) return 'Senha inválida. Use pelo menos 6 caracteres'
  return message
}

// quem está chamando precisa ser dono; a empresa vem do banco, nunca do navegador
async function donoAtual() {
  const supabase = await createSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('perfis')
    .select('empresa_id, papel')
    .eq('id', user.id)
    .maybeSingle()

  if (!data || data.papel !== 'dono') return null
  return { userId: user.id, empresaId: data.empresa_id as string }
}

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

async function lerCorpo(request: Request) {
  try {
    return await request.json()
  } catch {
    return null
  }
}

// POST: criar funcionário
export async function POST(request: Request) {
  try {
    const dono = await donoAtual()
    if (!dono) return falha('Sem permissão', 403)

    const parsed = novoSchema.safeParse(await lerCorpo(request))
    if (!parsed.success) return falha(parsed.error.issues[0].message)

    const admin = createSupabaseAdmin()

    const { count } = await admin
      .from('perfis')
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', dono.empresaId)
      .eq('papel', 'funcionario')

    if ((count ?? 0) >= LIMITE_FUNCIONARIOS)
      return falha(`Limite de ${LIMITE_FUNCIONARIOS} funcionários atingido`)

    const { data: criado, error } = await admin.auth.admin.createUser({
      email: parsed.data.email,
      password: parsed.data.senha,
      email_confirm: true,
      user_metadata: { full_name: parsed.data.nome },
      app_metadata: { papel: 'funcionario', empresa_id: dono.empresaId },
    })

    if (error || !criado.user)
      return falha(traduz(error?.message ?? 'Não foi possível criar a conta'))

    const novoId = criado.user.id

    // o trigger pode ter criado uma empresa avulsa antes de o app_metadata valer
    const { data: antes } = await admin
      .from('perfis')
      .select('empresa_id')
      .eq('id', novoId)
      .maybeSingle()

    // coloca o funcionário na empresa do dono, com o papel certo
    const { error: perfilErro } = await admin.from('perfis').upsert(
      {
        id: novoId,
        empresa_id: dono.empresaId,
        papel: 'funcionario',
        nome: parsed.data.nome,
        email: parsed.data.email,
      },
      { onConflict: 'id' }
    )

    // confere o resultado final antes de dizer que deu certo
    const { data: depois } = await admin
      .from('perfis')
      .select('papel, empresa_id')
      .eq('id', novoId)
      .maybeSingle()

    if (
      perfilErro ||
      !depois ||
      depois.papel !== 'funcionario' ||
      depois.empresa_id !== dono.empresaId
    ) {
      await admin.auth.admin.deleteUser(novoId)
      console.error('[equipe] vínculo falhou', perfilErro, depois)
      return falha(
        `Não foi possível vincular o funcionário à empresa${
          perfilErro ? `: ${perfilErro.message}` : ''
        }`,
        500
      )
    }

    // apaga a empresa vazia que o trigger criou por engano
    if (antes && antes.empresa_id !== dono.empresaId) {
      await admin.from('empresas').delete().eq('id', antes.empresa_id)
    }

    return ok()
  } catch (err) {
    console.error('[equipe] POST', err)
    return falha(err instanceof Error ? err.message : 'Erro inesperado', 500)
  }
}

// PATCH: trocar a senha de um funcionário
export async function PATCH(request: Request) {
  try {
    const dono = await donoAtual()
    if (!dono) return falha('Sem permissão', 403)

    const parsed = senhaSchema.safeParse(await lerCorpo(request))
    if (!parsed.success) return falha(parsed.error.issues[0].message)

    const admin = createSupabaseAdmin()
    if (!(await ehFuncionarioDaEmpresa(admin, dono.empresaId, parsed.data.id)))
      return falha('Funcionário não encontrado', 404)

    const { error } = await admin.auth.admin.updateUserById(parsed.data.id, {
      password: parsed.data.senha,
    })
    if (error) return falha(traduz(error.message))

    return ok()
  } catch (err) {
    console.error('[equipe] PATCH', err)
    return falha(err instanceof Error ? err.message : 'Erro inesperado', 500)
  }
}

// DELETE: remover um funcionário
export async function DELETE(request: Request) {
  try {
    const dono = await donoAtual()
    if (!dono) return falha('Sem permissão', 403)

    const parsed = idSchema.safeParse(await lerCorpo(request))
    if (!parsed.success) return falha('Funcionário inválido')

    const admin = createSupabaseAdmin()
    if (!(await ehFuncionarioDaEmpresa(admin, dono.empresaId, parsed.data.id)))
      return falha('Funcionário não encontrado', 404)

    // o que ele cadastrou fica com o dono (senão sumiria junto com a conta dele)
    await admin
      .from('products')
      .update({ user_id: dono.userId })
      .eq('user_id', parsed.data.id)

    const { error } = await admin.auth.admin.deleteUser(parsed.data.id)
    if (error) return falha(error.message, 500)

    return ok()
  } catch (err) {
    console.error('[equipe] DELETE', err)
    return falha(err instanceof Error ? err.message : 'Erro inesperado', 500)
  }
}