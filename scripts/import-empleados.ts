import { createClient } from '@supabase/supabase-js'

// Configuración de Supabase
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

interface EmpleadoData {
  nombre: string
  apellido: string
  email: string
  telefono: string
  rol: 'terapeuta' | 'esteticista' | 'recepcionista' | 'manager'
  sucursal_nombre: string
  especialidades?: string[]
}

// Datos de sucursales y empleados
const sucursalesData = [
  { nombre: 'Luna27 La Aurora', direccion: 'La Aurora, Monterrey', telefono: '+52 81 1234 5602', email: 'laaurora@luna27.com' },
  { nombre: 'Luna27 Carrizalejo', direccion: 'Carrizalejo, Monterrey', telefono: '+52 81 1234 5601', email: 'carrizalejo@luna27.com' },
  { nombre: 'Luna27 Serena', direccion: 'Serena, Monterrey', telefono: '+52 81 1234 5603', email: 'serena@luna27.com' },
]

const empleadosPorSucursal: Record<string, EmpleadoData[]> = {
  'Luna27 La Aurora': [
    { nombre: 'Lidia', apellido: 'Herrera', email: 'lidia.herrera@luna27.com', telefono: '8110000001', rol: 'esteticista', sucursal_nombre: 'Luna27 La Aurora' },
    { nombre: 'Vanesa', apellido: 'López', email: 'vanesa.lopez@luna27.com', telefono: '8110000002', rol: 'esteticista', sucursal_nombre: 'Luna27 La Aurora' },
    { nombre: 'Mayra', apellido: 'Podóloga', email: 'mayra.podologa@luna27.com', telefono: '8110000003', rol: 'esteticista', sucursal_nombre: 'Luna27 La Aurora', especialidades: ['Pedicure Podológico'] },
    { nombre: 'Itzel', apellido: 'Martínez', email: 'itzel.martinez@luna27.com', telefono: '8110000004', rol: 'esteticista', sucursal_nombre: 'Luna27 La Aurora' },
    { nombre: 'Danna', apellido: 'Guevara', email: 'danna.guevara@luna27.com', telefono: '8110000005', rol: 'esteticista', sucursal_nombre: 'Luna27 La Aurora', especialidades: ['Pedicure Podológico'] },
  ],
  'Luna27 Carrizalejo': [
    { nombre: 'Mary', apellido: 'Serna', email: 'mary.serna@luna27.com', telefono: '8110000011', rol: 'esteticista', sucursal_nombre: 'Luna27 Carrizalejo' },
    { nombre: 'Aracely', apellido: 'Briones', email: 'aracely.briones@luna27.com', telefono: '8110000012', rol: 'esteticista', sucursal_nombre: 'Luna27 Carrizalejo' },
    { nombre: 'Itzel', apellido: 'Cruz', email: 'itzel.cruz@luna27.com', telefono: '8110000013', rol: 'esteticista', sucursal_nombre: 'Luna27 Carrizalejo' },
    { nombre: 'Eunice', apellido: 'Galván', email: 'eunice.galvan@luna27.com', telefono: '8110000014', rol: 'esteticista', sucursal_nombre: 'Luna27 Carrizalejo' },
    { nombre: 'Angela', apellido: 'Podóloga', email: 'angela.podologa@luna27.com', telefono: '8110000015', rol: 'esteticista', sucursal_nombre: 'Luna27 Carrizalejo', especialidades: ['Pedicure Podológico'] },
    { nombre: 'Thamara', apellido: 'Ruiz', email: 'thamara.ruiz@luna27.com', telefono: '8110000016', rol: 'esteticista', sucursal_nombre: 'Luna27 Carrizalejo' },
    { nombre: 'Erika', apellido: 'Ramos', email: 'erika.ramos@luna27.com', telefono: '8110000017', rol: 'esteticista', sucursal_nombre: 'Luna27 Carrizalejo' },
  ],
  'Luna27 Serena': [
    { nombre: 'Yahaira', apellido: 'Lara', email: 'yahaira.lara@luna27.com', telefono: '8110000021', rol: 'esteticista', sucursal_nombre: 'Luna27 Serena' },
    { nombre: 'Rubí', apellido: 'Martínez', email: 'rubi.martinez@luna27.com', telefono: '8110000022', rol: 'esteticista', sucursal_nombre: 'Luna27 Serena' },
    { nombre: 'Dayra', apellido: 'Lizcano', email: 'dayra.lizcano@luna27.com', telefono: '8110000023', rol: 'esteticista', sucursal_nombre: 'Luna27 Serena' },
    { nombre: 'Cindy', apellido: 'Podóloga', email: 'cindy.podologa@luna27.com', telefono: '8110000024', rol: 'esteticista', sucursal_nombre: 'Luna27 Serena', especialidades: ['Pedicure Podológico'] },
    { nombre: 'Dibanhi', apellido: 'Tovar', email: 'dibanhi.tovar@luna27.com', telefono: '8110000025', rol: 'esteticista', sucursal_nombre: 'Luna27 Serena' },
    { nombre: 'Liliana', apellido: 'García', email: 'liliana.garcia@luna27.com', telefono: '8110000026', rol: 'esteticista', sucursal_nombre: 'Luna27 Serena' },
    { nombre: 'Isabel', apellido: 'Podóloga', email: 'isabel.podologa@luna27.com', telefono: '8110000027', rol: 'esteticista', sucursal_nombre: 'Luna27 Serena', especialidades: ['Pedicure Podológico'] },
  ],
}

// Función para obtener o crear sucursal
async function getOrCreateSucursal(nombre: string, direccion: string, telefono: string, email: string): Promise<string | null> {
  // Primero intentar obtener la sucursal
  const { data: existing } = await supabase
    .from('sucursales')
    .select('id')
    .eq('nombre', nombre)
    .maybeSingle()

  if (existing?.id) {
    return existing.id
  }

  // Si no existe, crearla
  console.log(`   📝 Creando sucursal: ${nombre}`)
  const { data, error } = await supabase
    .from('sucursales')
    .insert({
      nombre,
      direccion,
      telefono,
      email,
      ciudad: 'Monterrey',
      pais: 'México',
      horario: 'Lun-Sab: 9:00 - 20:00',
      activa: true,
    })
    .select('id')
    .single()

  if (error) {
    console.error(`   ❌ Error creando sucursal ${nombre}:`, error.message)
    return null
  }

  return data?.id || null
}

// Función para verificar si un email ya existe
async function emailExiste(email: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('empleados')
    .select('id')
    .eq('email', email)
    .single()

  return !error && data !== null
}

// Función para insertar empleados
async function insertarEmpleados() {
  console.log('🚀 Iniciando importación de empleados...\n')

  // Primero crear las sucursales si no existen
  console.log('📋 Verificando/Creando sucursales...\n')
  const sucursalesIds: Record<string, string> = {}

  for (const sucursal of sucursalesData) {
    const id = await getOrCreateSucursal(
      sucursal.nombre,
      sucursal.direccion,
      sucursal.telefono,
      sucursal.email
    )
    if (id) {
      sucursalesIds[sucursal.nombre] = id
      console.log(`   ✅ ${sucursal.nombre} (ID: ${id})`)
    }
  }
  console.log('')

  let totalExitosos = 0
  let totalErrores = 0
  let totalOmitidos = 0

  for (const [sucursalNombre, empleados] of Object.entries(empleadosPorSucursal)) {
    console.log(`📋 Procesando sucursal: ${sucursalNombre}`)
    
    const sucursalId = sucursalesIds[sucursalNombre]
    
    if (!sucursalId) {
      console.error(`❌ No se pudo obtener/crear la sucursal: ${sucursalNombre}`)
      totalErrores += empleados.length
      continue
    }

    console.log(`   ✓ Sucursal ID: ${sucursalId}`)

    for (const empleado of empleados) {
      // Verificar si el email ya existe
      const existe = await emailExiste(empleado.email)
      if (existe) {
        console.log(`   ⚠️  Empleado ${empleado.nombre} ${empleado.apellido} ya existe (email: ${empleado.email}), omitiendo...`)
        totalOmitidos++
        continue
      }

      try {
        const { data, error } = await supabase
          .from('empleados')
          .insert({
            nombre: empleado.nombre,
            apellido: empleado.apellido,
            email: empleado.email,
            telefono: empleado.telefono,
            rol: empleado.rol,
            sucursal_id: sucursalId,
            especialidades: empleado.especialidades || null,
            horario_inicio: '09:00',
            horario_fin: '18:00',
            dias_trabajo: [1, 2, 3, 4, 5, 6], // Lunes a Sábado
            comision: 0,
            activo: true,
          })
          .select()
          .single()

        if (error) {
          console.error(`   ❌ Error insertando ${empleado.nombre} ${empleado.apellido}:`, error.message)
          totalErrores++
        } else {
          console.log(`   ✅ ${empleado.nombre} ${empleado.apellido} insertado exitosamente`)
          totalExitosos++
        }
      } catch (err: any) {
        console.error(`   ❌ Error inesperado con ${empleado.nombre} ${empleado.apellido}:`, err.message)
        totalErrores++
      }
    }
    console.log('')
  }

  console.log('='.repeat(50))
  console.log('📊 RESUMEN DE IMPORTACIÓN')
  console.log('='.repeat(50))
  console.log(`✅ Empleados insertados exitosamente: ${totalExitosos}`)
  console.log(`⚠️  Empleados omitidos (ya existían): ${totalOmitidos}`)
  console.log(`❌ Errores: ${totalErrores}`)
  console.log(`📝 Total procesado: ${totalExitosos + totalOmitidos + totalErrores}`)
  console.log('='.repeat(50))
}

// Ejecutar importación
insertarEmpleados()
  .then(() => {
    console.log('\n✅ Importación completada')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Error en la importación:', error)
    process.exit(1)
  })


