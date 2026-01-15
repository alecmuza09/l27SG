import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'

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

interface ClienteCSV {
  id: string
  nombre: string
  telefono: string
}

interface ClienteInsert {
  nombre: string
  apellido: string
  telefono: string
  email?: string | null
  estado?: 'activo' | 'inactivo' | 'vip'
}

// Función para separar nombre y apellido
function separarNombreApellido(nombreCompleto: string): { nombre: string; apellido: string } {
  const nombreLimpio = nombreCompleto.trim()
  const partes = nombreLimpio.split(/\s+/)
  
  if (partes.length === 1) {
    // Si solo hay un nombre, usarlo como nombre y dejar apellido vacío
    return { nombre: partes[0], apellido: '' }
  } else if (partes.length === 2) {
    // Si hay dos partes, primera es nombre, segunda es apellido
    return { nombre: partes[0], apellido: partes[1] }
  } else {
    // Si hay más de dos partes, primera es nombre, el resto es apellido
    return { 
      nombre: partes[0], 
      apellido: partes.slice(1).join(' ') 
    }
  }
}

// Función para limpiar y validar teléfono
function limpiarTelefono(telefono: string): string {
  // Remover espacios y caracteres especiales, mantener solo números
  return telefono.replace(/\D/g, '').trim()
}

// Función para leer CSV línea por línea
async function leerCSV(rutaArchivo: string): Promise<ClienteCSV[]> {
  const clientes: ClienteCSV[] = []
  const fileStream = fs.createReadStream(rutaArchivo)
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  })

  let primeraLinea = true

  for await (const linea of rl) {
    // Saltar la primera línea (header)
    if (primeraLinea) {
      primeraLinea = false
      continue
    }

    // Parsear la línea CSV
    const columnas = linea.split(',')
    if (columnas.length >= 3) {
      clientes.push({
        id: columnas[0].trim(),
        nombre: columnas[1].trim(),
        telefono: columnas[2].trim()
      })
    }
  }

  return clientes
}

// Función para insertar clientes en lotes
async function insertarClientes(clientes: ClienteInsert[], loteNumero: number): Promise<{ exitosos: number; errores: number }> {
  let exitosos = 0
  let errores = 0

  try {
    const { data, error } = await supabase
      .from('clientes')
      .insert(clientes)
      .select()

    if (error) {
      console.error(`❌ Error en lote ${loteNumero}:`, error.message)
      errores += clientes.length
    } else {
      exitosos += data?.length || 0
      console.log(`✅ Lote ${loteNumero}: ${data?.length || 0} clientes insertados`)
    }
  } catch (err: any) {
    console.error(`❌ Error inesperado en lote ${loteNumero}:`, err.message)
    errores += clientes.length
  }

  return { exitosos, errores }
}

// Función principal
async function importarClientes() {
  const rutaCSV = process.argv[2] || '/Users/alecmuza/Downloads/clientes_exportar.csv'
  
  console.log('🚀 Iniciando importación de clientes...')
  console.log(`📁 Archivo: ${rutaCSV}`)
  
  if (!fs.existsSync(rutaCSV)) {
    console.error(`❌ Error: El archivo ${rutaCSV} no existe`)
    process.exit(1)
  }

  try {
    // Leer CSV
    console.log('📖 Leyendo archivo CSV...')
    const clientesCSV = await leerCSV(rutaCSV)
    console.log(`📊 Total de registros encontrados: ${clientesCSV.length}`)

    // Procesar y transformar datos
    console.log('🔄 Procesando datos...')
    const clientesParaInsertar: ClienteInsert[] = []
    const telefonosVistos = new Set<string>()

    for (const clienteCSV of clientesCSV) {
      const telefonoLimpio = limpiarTelefono(clienteCSV.telefono)
      
      // Validar que tenga teléfono
      if (!telefonoLimpio || telefonoLimpio.length === 0) {
        console.warn(`⚠️  Cliente ${clienteCSV.nombre} (ID: ${clienteCSV.id}) sin teléfono válido, omitiendo...`)
        continue
      }

      // Evitar duplicados por teléfono
      if (telefonosVistos.has(telefonoLimpio)) {
        console.warn(`⚠️  Teléfono duplicado: ${telefonoLimpio} (${clienteCSV.nombre}), omitiendo...`)
        continue
      }

      telefonosVistos.add(telefonoLimpio)

      const { nombre, apellido } = separarNombreApellido(clienteCSV.nombre)

      clientesParaInsertar.push({
        nombre: nombre || 'Sin nombre',
        apellido: apellido || '',
        telefono: telefonoLimpio,
        email: null,
        estado: 'activo'
      })
    }

    console.log(`✅ Clientes válidos para insertar: ${clientesParaInsertar.length}`)

    // Insertar en lotes de 1000
    const TAMANO_LOTE = 1000
    const totalLotes = Math.ceil(clientesParaInsertar.length / TAMANO_LOTE)
    let totalExitosos = 0
    let totalErrores = 0

    console.log(`📦 Insertando en ${totalLotes} lotes de ${TAMANO_LOTE} registros...`)

    for (let i = 0; i < clientesParaInsertar.length; i += TAMANO_LOTE) {
      const lote = clientesParaInsertar.slice(i, i + TAMANO_LOTE)
      const loteNumero = Math.floor(i / TAMANO_LOTE) + 1
      
      const resultado = await insertarClientes(lote, loteNumero)
      totalExitosos += resultado.exitosos
      totalErrores += resultado.errores

      // Pequeña pausa entre lotes para no sobrecargar la base de datos
      if (i + TAMANO_LOTE < clientesParaInsertar.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    console.log('\n' + '='.repeat(50))
    console.log('📊 RESUMEN DE IMPORTACIÓN')
    console.log('='.repeat(50))
    console.log(`✅ Clientes insertados exitosamente: ${totalExitosos}`)
    console.log(`❌ Errores: ${totalErrores}`)
    console.log(`📝 Total procesado: ${clientesParaInsertar.length}`)
    console.log('='.repeat(50))

  } catch (error: any) {
    console.error('❌ Error fatal:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// Ejecutar importación
importarClientes()
  .then(() => {
    console.log('\n✅ Importación completada')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Error en la importación:', error)
    process.exit(1)
  })



