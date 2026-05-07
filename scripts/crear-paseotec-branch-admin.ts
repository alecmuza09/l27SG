/**
 * Crea usuario Auth + fila en public.usuarios para Paseo Tec (rol branch-admin).
 *
 * Requiere en .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Contraseña solo por variable de entorno (no commitear):
 *   PASEOTEC_BRANCH_ADMIN_PASSWORD
 *
 * Uso:
 *   PASEOTEC_BRANCH_ADMIN_PASSWORD='...' pnpm tsx scripts/crear-paseotec-branch-admin.ts
 */

import { createClient } from "@supabase/supabase-js"
import { existsSync, readFileSync } from "fs"
import { resolve } from "path"

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local")
  if (!existsSync(envPath)) return
  const text = readFileSync(envPath, "utf8")
  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}

loadEnvLocal()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const password = process.env.PASEOTEC_BRANCH_ADMIN_PASSWORD!

const EMAIL = "paseotecnat@luna27.mx"
const NOMBRE = "Natalia — Paseo Tec (branch admin)"
const ROL = "branch-admin" as const
const SUCURSAL_ID = "b37b010f-6e12-4700-abde-f646956a271f"

async function main() {
  if (!supabaseUrl || !serviceKey) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local")
    process.exit(1)
  }
  if (!password || password.length < 6) {
    console.error("Define PASEOTEC_BRANCH_ADMIN_PASSWORD (mín. 6 caracteres)")
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: existing } = await supabase.from("usuarios").select("id").eq("email", EMAIL).maybeSingle()

  if (existing?.id) {
    const { error: uErr } = await supabase.auth.admin.updateUserById(existing.id as string, {
      password,
      user_metadata: { nombre: NOMBRE, rol: ROL },
    })
    if (uErr) {
      console.error("Error actualizando Auth:", uErr.message)
      process.exit(1)
    }
    const { error: dbErr } = await supabase
      .from("usuarios")
      .update({
        nombre: NOMBRE,
        rol: ROL,
        sucursal_id: SUCURSAL_ID,
        activo: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id as string)
    if (dbErr) {
      console.error("Error actualizando usuarios:", dbErr.message)
      process.exit(1)
    }
    console.log("Usuario ya existía; contraseña y datos actualizados:", EMAIL)
    return
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: EMAIL,
    password,
    email_confirm: true,
    user_metadata: { nombre: NOMBRE, rol: ROL },
  })

  if (authError || !authData.user) {
    console.error("Error creando en Auth:", authError?.message)
    process.exit(1)
  }

  const { error: insErr } = await supabase.from("usuarios").insert({
    id: authData.user.id,
    email: EMAIL,
    nombre: NOMBRE,
    rol: ROL,
    sucursal_id: SUCURSAL_ID,
    activo: true,
  })

  if (insErr) {
    await supabase.auth.admin.deleteUser(authData.user.id)
    console.error("Error insertando usuarios:", insErr.message)
    process.exit(1)
  }

  console.log("Creado:", EMAIL, "| id:", authData.user.id)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
