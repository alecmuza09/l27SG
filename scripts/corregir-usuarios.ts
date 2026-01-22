/**
 * Script para corregir usuarios existentes
 * 
 * Este script:
 * 1. Normaliza los emails en la tabla usuarios para que coincidan con Supabase Auth
 * 2. Crea registros faltantes en la tabla usuarios para usuarios que existen en Auth
 * 3. Activa usuarios que estén inactivos
 * 
 * Uso:
 *   pnpm tsx scripts/corregir-usuarios.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

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

function normalizeEmail(email: string): string {
  if (!email) return email
  
  const [localPart, ...domainParts] = email.toLowerCase().split('@')
  
  if (!localPart || domainParts.length === 0) {
    return email
  }
  
  const domain = domainParts.join('@')
  
  const normalizedLocal = localPart
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._+-]/g, '')
  
  return `${normalizedLocal}@${domain}`
}

async function corregirUsuarios() {
  try {
    console.log('🔧 Corrigiendo usuarios...\n')

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

    // 2. Obtener todos los usuarios de la tabla usuarios
    const { data: dbUsers, error: dbError } = await supabase
      .from('usuarios')
      .select('*')

    if (dbError) {
      console.error('❌ Error obteniendo usuarios de BD:', dbError.message)
      return
    }

    let correcciones = 0
    let creados = 0
    let activados = 0

    // 3. Procesar cada usuario de Auth
    for (const authUser of authUsers.users) {
      const email = authUser.email
      if (!email) continue

      const emailNormalizado = normalizeEmail(email)
      
      // Buscar usuario en BD por ID o email
      let dbUser = dbUsers?.find(u => u.id === authUser.id)
      
      if (!dbUser) {
        // Buscar por email (normalizado o original)
        dbUser = dbUsers?.find(u => 
          normalizeEmail(u.email) === emailNormalizado || 
          u.email === email || 
          u.email === emailNormalizado
        )
      }

      if (dbUser) {
        // Usuario existe, verificar y corregir si es necesario
        
        // 1. Corregir email si no está normalizado
        if (dbUser.email !== emailNormalizado) {
          console.log(`📝 Corrigiendo email: ${dbUser.email} → ${emailNormalizado}`)
          const { error: updateError } = await supabase
            .from('usuarios')
            .update({ email: emailNormalizado })
            .eq('id', dbUser.id)

          if (updateError) {
            console.error(`   ❌ Error actualizando email: ${updateError.message}`)
          } else {
            console.log(`   ✅ Email corregido`)
            correcciones++
          }
        }

        // 2. Activar usuario si está inactivo
        if (!dbUser.activo) {
          console.log(`🔄 Activando usuario: ${emailNormalizado}`)
          const { error: activateError } = await supabase
            .from('usuarios')
            .update({ activo: true })
            .eq('id', dbUser.id)

          if (activateError) {
            console.error(`   ❌ Error activando usuario: ${activateError.message}`)
          } else {
            console.log(`   ✅ Usuario activado`)
            activados++
          }
        }

        // 3. Corregir ID si no coincide
        if (dbUser.id !== authUser.id) {
          console.log(`⚠️  ADVERTENCIA: ID de BD (${dbUser.id}) no coincide con ID de Auth (${authUser.id})`)
          console.log(`   Esto puede causar problemas. Considera eliminar y recrear el registro.`)
        }

      } else {
        // Usuario no existe en BD, crearlo
        console.log(`➕ Creando registro en BD para: ${emailNormalizado}`)
        
        const nombre = authUser.user_metadata?.nombre || email.split('@')[0]
        const rol = authUser.user_metadata?.rol || 'staff'

        const { data: newUser, error: createError } = await supabase
          .from('usuarios')
          .insert({
            id: authUser.id,
            email: emailNormalizado,
            nombre: nombre,
            rol: rol,
            activo: true,
          })
          .select()
          .single()

        if (createError) {
          console.error(`   ❌ Error creando usuario: ${createError.message}`)
        } else {
          console.log(`   ✅ Usuario creado en BD`)
          creados++
        }
      }
    }

    console.log('\n' + '─'.repeat(100))
    console.log('\n📊 Resumen de correcciones:')
    console.log(`   Emails corregidos: ${correcciones}`)
    console.log(`   Usuarios creados: ${creados}`)
    console.log(`   Usuarios activados: ${activados}`)
    console.log(`   Total procesados: ${authUsers.users.length}`)

  } catch (error: any) {
    console.error('❌ Error inesperado:', error.message)
    console.error(error)
  }
}

// Ejecutar
corregirUsuarios()
  .then(() => {
    console.log('\n✅ Corrección completada\n')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Error fatal:', error)
    process.exit(1)
  })
