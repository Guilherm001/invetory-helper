import { createClient } from '@supabase/supabase-js'

// SÓ importe este arquivo em código de servidor (Server Actions, route handlers)
export function createSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}