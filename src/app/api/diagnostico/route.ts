import { createSupabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const resultado: Record<string, string> = {}

  try {
    const admin = createSupabaseAdmin()

    const a = await admin.auth.admin.listUsers({ page: 1, perPage: 1 })
    resultado.listarUsuarios = a.error ? `ERRO: ${a.error.message}` : 'ok'

    const b = await admin
      .from('perfis')
      .select('id', { count: 'exact', head: true })
    resultado.lerPerfis = b.error ? `ERRO: ${b.error.message}` : 'ok'
  } catch (e) {
    resultado.excecao = e instanceof Error ? e.message : String(e)
  }

  return Response.json(resultado)
}