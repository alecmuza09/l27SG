/**
 * Script de sincronización completa de usuarios Luna27
 *
 * - Crea o actualiza todos los usuarios del sistema con rol y contraseña correctos
 * - Elimina usuarios marcados para borrar
 * - No toca: alecmuza09@gmail.com, alec.muza@capacit.io
 *
 * Uso:
 *   pnpm tsx scripts/sync-usuarios.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// ─── Catálogo de usuarios ───────────────────────────────────────────────────

const USUARIOS: Array<{ email: string; password: string; rol: 'admin' | 'manager'; nombre: string }> = [
  // Admins
  { email: 'direccion@luna27.mx',      password: 'Luna27+',            rol: 'admin',   nombre: 'Dirección' },
  { email: 'veronica@luna27.mx',       password: 'Luna27+',            rol: 'admin',   nombre: 'Verónica' },
  { email: 'adriana@luna27.mx',        password: 'Luna27+',            rol: 'admin',   nombre: 'Adriana' },
  { email: 'gris@luna27.mx',           password: 'Luna27+',            rol: 'admin',   nombre: 'Gris' },
  // Managers
  { email: 'almendros@luna27.mx',      password: 'Almendros26+',       rol: 'manager', nombre: 'Manager Almendros' },
  { email: 'cumbredelsol@luna27.mx',   password: 'Cumbresdesol26+',    rol: 'manager', nombre: 'Manager Cumbre del Sol' },
  { email: 'cumbressanblas@luna27.mx', password: 'Cumbressanblas26+',  rol: 'manager', nombre: 'Manager Cumbres San Blas' },
  { email: 'fundadores@luna27.mx',     password: 'Fundadores26+',      rol: 'manager', nombre: 'Manager Fundadores' },
  { email: 'paseotec@luna27.mx',       password: 'Paseotec26+',        rol: 'manager', nombre: 'Manager Paseo Tec' },
  { email: 'sanjeronimo@luna27.mx',    password: 'Sanjeronimo26+',     rol: 'manager', nombre: 'Manager San Jerónimo' },
  { email: 'serena@luna27.mx',         password: 'Serena26+',          rol: 'manager', nombre: 'Manager Serena' },
  { email: 'vialuz@luna27.mx',         password: 'Vialuz26+',          rol: 'manager', nombre: 'Manager Vía La Luz' },
  { email: 'carrizalejo@luna27.mx',    password: 'Carrizalejo26+',     rol: 'manager', nombre: 'Manager Carrizalejo' },
  { email: 'aurora@luna72.mx',         password: 'Aurora26+',          rol: 'manager', nombre: 'Manager La Aurora' },
  { email: 'aurora@luna27.mx',         password: 'Aurora27+',          rol: 'manager', nombre: 'Suc. La Aurora' },
]

// Usuarios a eliminar definitivamente
const ELIMINAR: string[] = [
  'sanjeronimo2@luna27.mx',
]

// Usuarios protegidos (nunca se tocan)
const PROTEGIDOS = new Set(['alecmuza09@gmail.com', 'alec.muza@capacit.io'])

// ─── Helpers ────────────────────────────────────────────────────────────────

let authUsersCache: Array<{ id: string; email: string }> | null = null

async function getAuthUsers() {
  if (authUsersCache) return authUsersCache
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  if (error) throw new Error(`listUsers: ${error.message}`)
  authUsersCache = data.users.map(u => ({ id: u.id, email: u.email ?? '' }))
  return authUsersCache
}

// ─── Upsert usuario ─────────────────────────────────────────────────────────

async function upsertUsuario(email: string, password: string, rol: 'admin' | 'manager', nombre: string): Promise<boolean> {
  console.log(`\n👤 ${email}  [${rol}]`)

  const authUsers = await getAuthUsers()
  const existing = authUsers.find(u => u.email === email)
  let authUserId: string

  if (existing) {
    // Actualizar contraseña y metadata
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      user_metadata: { nombre, rol },
    })
    if (error) {
      console.error(`   ❌ Auth update: ${error.message}`)
      return false
    }
    authUserId = existing.id
    console.log('   ✅ Auth: contraseña y metadata actualizados')
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre, rol },
    })
    if (error || !data.user) {
      console.error(`   ❌ Auth create: ${error?.message}`)
      return false
    }
    authUserId = data.user.id
    // Actualizar cache
    authUsersCache!.push({ id: authUserId, email })
    console.log(`   ✅ Auth: creado (${authUserId})`)
  }

  // Tabla usuarios
  const { data: dbRow } = await supabase
    .from('usuarios')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (dbRow) {
    const { error } = await supabase
      .from('usuarios')
      .update({ nombre, rol, activo: true, updated_at: new Date().toISOString() })
      .eq('id', dbRow.id)
    if (error) { console.error(`   ❌ DB update: ${error.message}`); return false }
    console.log('   ✅ DB: registro actualizado')
  } else {
    const { error } = await supabase
      .from('usuarios')
      .insert({ id: authUserId, email, nombre, rol, activo: true })
    if (error) { console.error(`   ❌ DB insert: ${error.message}`); return false }
    console.log('   ✅ DB: registro creado')
  }

  return true
}

// ─── Eliminar usuario ────────────────────────────────────────────────────────

async function eliminarUsuario(email: string): Promise<void> {
  console.log(`\n🗑️  Eliminando: ${email}`)

  const authUsers = await getAuthUsers()
  const authUser = authUsers.find(u => u.email === email)

  if (authUser) {
    const { error } = await supabase.auth.admin.deleteUser(authUser.id)
    if (error) {
      console.error(`   ❌ Auth delete: ${error.message}`)
    } else {
      console.log('   ✅ Eliminado de Supabase Auth')
    }
  } else {
    console.log('   ℹ️  No encontrado en Auth')
  }

  const { error: dbError } = await supabase
    .from('usuarios')
    .delete()
    .eq('email', email)

  if (dbError) {
    console.error(`   ❌ DB delete: ${dbError.message}`)
  } else {
    console.log('   ✅ Eliminado de tabla usuarios')
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════')
  console.log('  Sync Usuarios Luna27')
  console.log('═══════════════════════════════════════')

  // 1. Upsert todos
  console.log(`\n📋 Procesando ${USUARIOS.length} usuarios...`)
  let ok = 0, fail = 0
  for (const u of USUARIOS) {
    const result = await upsertUsuario(u.email, u.password, u.rol, u.nombre)
    result ? ok++ : fail++
  }

  // 2. Eliminar
  console.log(`\n🗑️  Eliminando ${ELIMINAR.length} usuario(s)...`)
  for (const email of ELIMINAR) {
    if (PROTEGIDOS.has(email)) {
      console.log(`   ⚠️  ${email} está protegido, se omite`)
      continue
    }
    await eliminarUsuario(email)
  }

  // 3. Resumen
  console.log('\n═══════════════════════════════════════')
  console.log(`✅ Exitosos: ${ok}  ❌ Fallidos: ${fail}`)
  console.log('═══════════════════════════════════════')
  console.log('\n📋 Resumen de credenciales:')
  const maxEmail = Math.max(...USUARIOS.map(u => u.email.length))
  USUARIOS.forEach(u => {
    const pad = ' '.repeat(maxEmail - u.email.length + 2)
    console.log(`   ${u.email}${pad}${u.password.padEnd(22)}  [${u.rol}]`)
  })
  console.log(`\n🛡️  Protegidos (sin cambios):`)
  PROTEGIDOS.forEach(e => console.log(`   ${e}`))
  console.log('')
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error('❌ Error fatal:', err); process.exit(1) })
