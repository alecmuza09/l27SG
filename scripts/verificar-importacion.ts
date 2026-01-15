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

async function verificarImportacion() {
  try {
    const { count, error } = await supabase
      .from('clientes')
      .select('*', { count: 'exact', head: true })

    if (error) {
      console.error('❌ Error al consultar:', error.message)
      return
    }

    console.log(`✅ Total de clientes en la base de datos: ${count}`)

    // Obtener algunos ejemplos
    const { data: ejemplos, error: errorEjemplos } = await supabase
      .from('clientes')
      .select('nombre, apellido, telefono, estado')
      .limit(10)

    if (!errorEjemplos && ejemplos) {
      console.log('\n📋 Ejemplos de clientes importados:')
      ejemplos.forEach((cliente, index) => {
        console.log(`${index + 1}. ${cliente.nombre} ${cliente.apellido} - ${cliente.telefono} (${cliente.estado})`)
      })
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message)
  }
}

verificarImportacion()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })



