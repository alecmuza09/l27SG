/**
 * Script para verificar y corregir usuarios en Supabase
 * 
 * Este script:
 * 1. Lista todos los usuarios en Supabase Auth
 * 2. Verifica si existen en la tabla usuarios
 * 3. Muestra información sobre usuarios activos/inactivos
 * 4. Permite corregir emails normalizados
 * 
 * Uso:
 *   pnpm tsx scripts/verificar-usuarios.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'
import { normalizeEmail } from '../lib/utils'

// Cargar variables de entorno
dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Error: Faltan variables de entorno de Supabase')
  console.error('Asegúrate de tener NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function verificarUsuarios() {
  try {
    console.log('🔍 Verificando usuarios en Supabase...\n')

    // 1. Obtener todos los usuarios de Supabase Auth
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()

    if (authError) {
      console.error('❌ Error obteniendo usuarios de Auth:', authError.message)
      return
    }

    if (!authUsers || authUsers.users.length === 0) {
      console.log('⚠️  No hay usuarios en Supabase Auth')
      return
    }

    console.log(`📊 Total de usuarios en Auth: ${authUsers.users.length}\n`)

    // 2. Obtener todos los usuarios de la tabla usuarios
    const { data: dbUsers, error: dbError } = await supabase
      .from('usuarios')
      .select('*')
      .order('created_at', { ascending: false })

    if (dbError) {
      console.error('❌ Error obteniendo usuarios de BD:', dbError.message)
      return
    }

    console.log(`📊 Total de usuarios en tabla usuarios: ${dbUsers?.length || 0}\n`)

    // 3. Verificar cada usuario
    console.log('📋 Detalle de usuarios:\n')
    console.log('─'.repeat(100))

    for (const authUser of authUsers.users) {
      const email = authUser.email || 'sin-email'
      const emailNormalizado = normalizeEmail(email)
      const dbUser = dbUsers?.find(u => u.email === emailNormalizado || u.email === email)

      console.log(`\n👤 Usuario: ${email}`)
      console.log(`   ID Auth: ${authUser.id}`)
      console.log(`   Email normalizado: ${emailNormalizado}`)
      console.log(`   Email confirmado: ${authUser.email_confirmed_at ? '✅ Sí' : '❌ No'}`)
      console.log(`   Último acceso: ${authUser.last_sign_in_at ? new Date(authUser.last_sign_in_at).toLocaleString() : 'Nunca'}`)
      
      if (dbUser) {
        console.log(`   Estado en BD: ✅ Existe`)
        console.log(`   ID BD: ${dbUser.id}`)
        console.log(`   Nombre: ${dbUser.nombre}`)
        console.log(`   Rol: ${dbUser.rol}`)
        console.log(`   Activo: ${dbUser.activo ? '✅ Sí' : '❌ No'}`)
        console.log(`   Sucursal ID: ${dbUser.sucursal_id || 'N/A'}`)
        
        // Verificar si el email coincide
        if (dbUser.email !== emailNormalizado) {
          console.log(`   ⚠️  ADVERTENCIA: Email en BD (${dbUser.email}) no coincide con email normalizado (${emailNormalizado})`)
        }
      } else {
        console.log(`   Estado en BD: ❌ NO EXISTE`)
        console.log(`   ⚠️  Este usuario no puede iniciar sesión porque no está en la tabla usuarios`)
      }
    }

    console.log('\n' + '─'.repeat(100))
    console.log('\n📊 Resumen:')
    console.log(`   Usuarios en Auth: ${authUsers.users.length}`)
    console.log(`   Usuarios en BD: ${dbUsers?.length || 0}`)
    
    const usuariosSinBD = authUsers.users.filter(authUser => {
      const email = authUser.email || ''
      const emailNormalizado = normalizeEmail(email)
      return !dbUsers?.find(u => u.email === emailNormalizado || u.email === email)
    })
    
    if (usuariosSinBD.length > 0) {
      console.log(`   ⚠️  Usuarios sin registro en BD: ${usuariosSinBD.length}`)
      console.log('\n   Usuarios que necesitan ser creados en la tabla usuarios:')
      usuariosSinBD.forEach(u => {
        console.log(`      - ${u.email} (ID: ${u.id})`)
      })
    }

    const usuariosInactivos = dbUsers?.filter(u => !u.activo) || []
    if (usuariosInactivos.length > 0) {
      console.log(`   ⚠️  Usuarios inactivos en BD: ${usuariosInactivos.length}`)
      usuariosInactivos.forEach(u => {
        console.log(`      - ${u.email} (${u.nombre})`)
      })
    }

  } catch (error: any) {
    console.error('❌ Error inesperado:', error.message)
    console.error(error)
  }
}

// Ejecutar
verificarUsuarios()
  .then(() => {
    console.log('\n✅ Verificación completada\n')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Error fatal:', error)
    process.exit(1)
  })
