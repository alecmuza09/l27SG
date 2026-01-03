/**
 * Script para crear usuario admin en Supabase Auth
 * 
 * Este script crea un usuario admin en Supabase Auth y también
 * lo registra en la tabla usuarios de la base de datos.
 * 
 * Uso:
 *   pnpm tsx scripts/crear-usuario-admin.ts
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

const EMAIL = 'alecmuza09@gmail.com'
const PASSWORD = 'alecmuza09'
const NOMBRE = 'Admin Alecmuza'

async function crearUsuarioAdmin() {
  try {
    console.log('🔐 Creando usuario admin en Supabase Auth...')
    console.log(`📧 Email: ${EMAIL}`)
    console.log(`👤 Nombre: ${NOMBRE}`)
    console.log('')

    // 1. Crear usuario en Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true, // Confirmar email automáticamente
      user_metadata: {
        nombre: NOMBRE,
        rol: 'admin'
      }
    })

    if (authError) {
      // Si el usuario ya existe, intentar obtenerlo
      if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
        console.log('⚠️  El usuario ya existe en Supabase Auth. Obteniendo información...')
        
        // Buscar usuario por email
        const { data: users, error: listError } = await supabase.auth.admin.listUsers()
        if (listError) {
          console.error('❌ Error listando usuarios:', listError.message)
          return
        }

        const existingUser = users.users.find(u => u.email === EMAIL)
        if (!existingUser) {
          console.error('❌ No se pudo encontrar el usuario existente')
          return
        }

        console.log('✅ Usuario encontrado en Supabase Auth')
        console.log(`   ID: ${existingUser.id}`)
        
        // Actualizar contraseña si es necesario
        const { error: updateError } = await supabase.auth.admin.updateUserById(
          existingUser.id,
          { password: PASSWORD }
        )
        
        if (updateError) {
          console.log('⚠️  No se pudo actualizar la contraseña:', updateError.message)
        } else {
          console.log('✅ Contraseña actualizada')
        }

        // 2. Verificar/crear registro en tabla usuarios
        await crearRegistroUsuario(existingUser.id)
        return
      }
      
      console.error('❌ Error creando usuario en Supabase Auth:', authError.message)
      return
    }

    if (!authData.user) {
      console.error('❌ No se recibió información del usuario creado')
      return
    }

    console.log('✅ Usuario creado exitosamente en Supabase Auth')
    console.log(`   ID: ${authData.user.id}`)
    console.log('')

    // 2. Crear registro en tabla usuarios
    await crearRegistroUsuario(authData.user.id)

  } catch (error: any) {
    console.error('❌ Error inesperado:', error.message)
    console.error(error)
  }
}

async function crearRegistroUsuario(authUserId: string) {
  try {
    console.log('📝 Creando registro en tabla usuarios...')

    // Verificar si ya existe
    const { data: existingUser, error: checkError } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', EMAIL)
      .maybeSingle()

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('❌ Error verificando usuario:', checkError.message)
      return
    }

    if (existingUser) {
      console.log('⚠️  El usuario ya existe en la tabla usuarios')
      console.log(`   ID: ${existingUser.id}`)
      
      // Actualizar si es necesario
      const { error: updateError } = await supabase
        .from('usuarios')
        .update({
          nombre: NOMBRE,
          rol: 'admin',
          activo: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingUser.id)

      if (updateError) {
        console.error('❌ Error actualizando usuario:', updateError.message)
        return
      }

      console.log('✅ Usuario actualizado en tabla usuarios')
      return
    }

    // Crear nuevo registro
    const { data: newUser, error: insertError } = await supabase
      .from('usuarios')
      .insert({
        id: authUserId, // Usar el mismo ID de Auth
        email: EMAIL,
        nombre: NOMBRE,
        rol: 'admin',
        activo: true
      })
      .select()
      .single()

    if (insertError) {
      console.error('❌ Error creando registro en tabla usuarios:', insertError.message)
      return
    }

    console.log('✅ Usuario creado en tabla usuarios')
    console.log(`   ID: ${newUser.id}`)
    console.log('')

  } catch (error: any) {
    console.error('❌ Error inesperado creando registro:', error.message)
  }
}

// Ejecutar
crearUsuarioAdmin()
  .then(() => {
    console.log('')
    console.log('✅ Proceso completado')
    console.log('')
    console.log('📋 Credenciales de acceso:')
    console.log(`   Email: ${EMAIL}`)
    console.log(`   Password: ${PASSWORD}`)
    console.log('')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Error fatal:', error)
    process.exit(1)
  })
