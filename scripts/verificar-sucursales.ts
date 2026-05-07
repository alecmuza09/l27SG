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

async function verificarSucursales() {
  try {
    const { data, error } = await supabase
      .from('sucursales')
      .select('id, nombre')
      .order('nombre')

    if (error) {
      console.error('❌ Error al consultar:', error.message)
      return
    }

    console.log(`✅ Total de sucursales en la base de datos: ${data?.length || 0}\n`)
    
    if (data && data.length > 0) {
      console.log('📋 Sucursales encontradas:')
      data.forEach((sucursal) => {
        console.log(`   - ${sucursal.nombre} (ID: ${sucursal.id})`)
      })
    } else {
      console.log('⚠️  No hay sucursales en la base de datos')
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message)
  }
}

verificarSucursales()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })


