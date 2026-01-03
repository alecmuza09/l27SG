import { createClient } from '@supabase/supabase-js'
import { MOCK_SERVICIOS } from '../lib/data/servicios'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Error: Faltan variables de entorno de Supabase')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function verificarServicioExiste(nombre: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('servicios')
    .select('id')
    .eq('nombre', nombre)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    console.error(`Error verificando servicio ${nombre}:`, error.message)
    return false
  }

  return !!data
}

async function importarServicios() {
  console.log('🚀 Iniciando importación de servicios...\n')
  console.log('='.repeat(50))

  let totalExitosos = 0
  let totalOmitidos = 0
  let totalErrores = 0

  for (const servicio of MOCK_SERVICIOS) {
    // Verificar si el servicio ya existe
    const existe = await verificarServicioExiste(servicio.nombre)
    if (existe) {
      console.log(`   ⚠️  Servicio "${servicio.nombre}" ya existe, omitiendo...`)
      totalOmitidos++
      continue
    }

    try {
      const { data, error } = await supabase
        .from('servicios')
        .insert({
          nombre: servicio.nombre,
          descripcion: servicio.descripcion,
          duracion: servicio.duracion,
          precio: servicio.precio,
          categoria: servicio.categoria,
          color: servicio.color || null,
          activo: servicio.activo,
        })
        .select()
        .single()

      if (error) {
        console.error(`   ❌ Error insertando "${servicio.nombre}":`, error.message)
        totalErrores++
      } else {
        console.log(`   ✅ "${servicio.nombre}" insertado exitosamente`)
        totalExitosos++
      }
    } catch (err: any) {
      console.error(`   ❌ Error inesperado con "${servicio.nombre}":`, err.message)
      totalErrores++
    }
  }

  console.log('')
  console.log('='.repeat(50))
  console.log('📊 RESUMEN DE IMPORTACIÓN')
  console.log('='.repeat(50))
  console.log(`✅ Servicios insertados exitosamente: ${totalExitosos}`)
  console.log(`⚠️  Servicios omitidos (ya existían): ${totalOmitidos}`)
  console.log(`❌ Errores: ${totalErrores}`)
  console.log(`📝 Total procesado: ${totalExitosos + totalOmitidos + totalErrores}`)
  console.log('='.repeat(50))
}

// Ejecutar importación
importarServicios()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error fatal:', error)
    process.exit(1)
  })
