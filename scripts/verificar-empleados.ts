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

async function verificarEmpleados() {
  try {
    const { data, error } = await supabase
      .from('empleados')
      .select(`
        id,
        nombre,
        apellido,
        email,
        rol,
        activo,
        sucursales: sucursal_id (
          nombre
        )
      `)
      .order('nombre')

    if (error) {
      console.error('❌ Error al consultar:', error.message)
      return
    }

    console.log(`✅ Total de empleados en la base de datos: ${data?.length || 0}\n`)
    
    if (data && data.length > 0) {
      // Agrupar por sucursal
      const porSucursal: Record<string, any[]> = {}
      
      data.forEach((empleado: any) => {
        const sucursalNombre = empleado.sucursales?.nombre || 'Sin sucursal'
        if (!porSucursal[sucursalNombre]) {
          porSucursal[sucursalNombre] = []
        }
        porSucursal[sucursalNombre].push(empleado)
      })

      for (const [sucursal, empleados] of Object.entries(porSucursal)) {
        console.log(`📋 ${sucursal} (${empleados.length} empleados):`)
        empleados.forEach((emp: any) => {
          console.log(`   - ${emp.nombre} ${emp.apellido} (${emp.rol}) - ${emp.email}`)
        })
        console.log('')
      }
    } else {
      console.log('⚠️  No hay empleados en la base de datos')
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message)
  }
}

verificarEmpleados()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })


