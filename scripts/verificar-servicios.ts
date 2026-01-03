import { createClient } from '@supabase/supabase-js'

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

async function verificarServicios() {
  try {
    const { data, error } = await supabase
      .from('servicios')
      .select('*')
      .order('categoria')
      .order('nombre')

    if (error) {
      console.error('❌ Error al consultar:', error.message)
      return
    }

    console.log(`✅ Total de servicios en la base de datos: ${data?.length || 0}\n`)
    
    if (data && data.length > 0) {
      // Agrupar por categoría
      const porCategoria: Record<string, any[]> = {}
      
      data.forEach((servicio: any) => {
        const categoria = servicio.categoria || 'Sin categoría'
        if (!porCategoria[categoria]) {
          porCategoria[categoria] = []
        }
        porCategoria[categoria].push(servicio)
      })

      for (const [categoria, servicios] of Object.entries(porCategoria)) {
        console.log(`📋 ${categoria} (${servicios.length} servicios):`)
        servicios.forEach((servicio: any) => {
          const activo = servicio.activo ? '✅' : '❌'
          console.log(`   ${activo} ${servicio.nombre} - $${servicio.precio} (${servicio.duracion} min)`)
        })
        console.log('')
      }

      const activos = data.filter((s: any) => s.activo).length
      const inactivos = data.length - activos
      console.log(`📊 Resumen: ${activos} activos, ${inactivos} inactivos`)
    } else {
      console.log('⚠️  No hay servicios en la base de datos')
      console.log('💡 Puedes importar los servicios desde MOCK_SERVICIOS en lib/data/servicios.ts')
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message)
  }
}

verificarServicios()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error fatal:', error)
    process.exit(1)
  })
