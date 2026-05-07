/**
 * Script para limpiar usuarios y dejar solo alec.muza@capacit.io activo como administrador
 * 
 * Ejecutar con: npx tsx scripts/limpiar-usuarios.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

// Cargar variables de entorno
dotenv.config({ path: resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Faltan variables de entorno')
  console.error('Asegúrate de tener NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function limpiarUsuarios() {
  try {
    console.log('🔄 Iniciando limpieza de usuarios...\n')

    // 1. Obtener todos los usuarios
    const { data: usuarios, error: usuariosError } = await supabase
      .from('usuarios')
      .select('*')

    if (usuariosError) {
      throw new Error(`Error obteniendo usuarios: ${usuariosError.message}`)
    }

    if (!usuarios || usuarios.length === 0) {
      console.log('ℹ️  No hay usuarios en la base de datos')
      return
    }

    console.log(`📋 Encontrados ${usuarios.length} usuarios:`)
    usuarios.forEach(u => {
      console.log(`   - ${u.email} (${u.rol}) - ${u.activo ? 'Activo' : 'Inactivo'}`)
    })
    console.log()

    // 2. Buscar el usuario objetivo
    const usuarioObjetivo = usuarios.find(u => u.email === 'alec.muza@capacit.io')

    if (!usuarioObjetivo) {
      console.log('⚠️  No se encontró el usuario alec.muza@capacit.io')
      console.log('   Asegúrate de que el usuario existe antes de ejecutar este script')
      return
    }

    console.log(`✅ Usuario objetivo encontrado: ${usuarioObjetivo.email}`)
    console.log(`   ID: ${usuarioObjetivo.id}`)
    console.log(`   Rol actual: ${usuarioObjetivo.rol}`)
    console.log(`   Estado actual: ${usuarioObjetivo.activo ? 'Activo' : 'Inactivo'}\n`)

    // 3. Desactivar todos los usuarios excepto el objetivo
    const usuariosADesactivar = usuarios.filter(u => u.id !== usuarioObjetivo.id)
    
    if (usuariosADesactivar.length > 0) {
      console.log(`🔄 Desactivando ${usuariosADesactivar.length} usuarios...`)
      
      for (const usuario of usuariosADesactivar) {
        const { error: updateError } = await supabase
          .from('usuarios')
          .update({ 
            activo: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', usuario.id)

        if (updateError) {
          console.error(`   ❌ Error desactivando ${usuario.email}: ${updateError.message}`)
        } else {
          console.log(`   ✓ Desactivado: ${usuario.email}`)
        }
      }
      console.log()
    }

    // 4. Asegurar que el usuario objetivo esté activo y sea admin
    console.log('🔄 Configurando usuario objetivo como administrador activo...')
    
    const { error: updateObjetivoError } = await supabase
      .from('usuarios')
      .update({
        rol: 'admin',
        activo: true,
        sucursal_id: null, // Admin no tiene sucursal asignada
        updated_at: new Date().toISOString()
      })
      .eq('id', usuarioObjetivo.id)

    if (updateObjetivoError) {
      throw new Error(`Error actualizando usuario objetivo: ${updateObjetivoError.message}`)
    }

    console.log('   ✓ Usuario objetivo configurado como administrador activo\n')

    // 5. Verificar resultado final
    const { data: usuariosFinales, error: finalError } = await supabase
      .from('usuarios')
      .select('*')
      .eq('activo', true)

    if (finalError) {
      throw new Error(`Error verificando usuarios finales: ${finalError.message}`)
    }

    console.log('📊 Resumen final:')
    console.log(`   Total de usuarios activos: ${usuariosFinales?.length || 0}`)
    
    if (usuariosFinales && usuariosFinales.length > 0) {
      usuariosFinales.forEach(u => {
        console.log(`   ✓ ${u.email} (${u.rol})`)
      })
    }

    console.log('\n✅ Limpieza completada exitosamente!')
    console.log('   Solo alec.muza@capacit.io está activo como administrador')

  } catch (error) {
    console.error('\n❌ Error durante la limpieza:', error)
    process.exit(1)
  }
}

// Ejecutar el script
limpiarUsuarios()
  .then(() => {
    console.log('\n✨ Proceso finalizado')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Error fatal:', error)
    process.exit(1)
  })
