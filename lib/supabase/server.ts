import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SERVICE_ROLE_HINT =
  'Añade la clave secreta del servidor en .env.local: SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_SECRET_KEY) con el valor de Supabase → Project Settings → API → Secret keys → default (Reveal). Reinicia `npm run dev` después.'

let adminClient: SupabaseClient | null = null

/** Clave elevada: legacy JWT service_role o nueva `sb_secret_...`. */
export function getSupabaseServiceRoleKey(): string | undefined {
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim()
  return key || undefined
}

/** null si la config del servidor está completa; si no, mensaje para mostrar al usuario. */
export function getSupabaseAdminConfigError(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = getSupabaseServiceRoleKey()
  if (!url?.trim()) {
    return 'Falta NEXT_PUBLIC_SUPABASE_URL en .env.local.'
  }
  if (!key) {
    return SERVICE_ROLE_HINT
  }
  return null
}

export function getSupabaseAdmin(): SupabaseClient {
  const configError = getSupabaseAdminConfigError()
  if (configError) {
    throw new Error(configError)
  }
  if (!adminClient) {
    adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      getSupabaseServiceRoleKey()!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    )
  }
  return adminClient
}

/** Cliente service role (lazy). No falla al importar el módulo, solo al usarlo. */
export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseAdmin()
    const value = (client as unknown as Record<string | symbol, unknown>)[prop]
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(client) : value
  },
})
