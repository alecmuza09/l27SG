/**
 * Script de sincronización definitiva de empleados por sucursal.
 *
 * - Crea la sucursal Chepevera si no existe
 * - Inserta empleados nuevos
 * - Activa empleados que estaban inactivos pero vuelven a la lista
 * - Desactiva empleados que ya no están en la lista de su sucursal
 *
 * Uso:
 *   pnpm tsx scripts/sync-empleados.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ─── Lista autorizada de empleadas ──────────────────────────────────────────
// Formato: { sucursal: nombre corto para buscar en DB, empleados: lista de nombres completos }

type Bloque = { sucursalKey: string; empleados: string[] }

const BLOQUES: Bloque[] = [
  {
    sucursalKey: 'La Aurora',
    empleados: [
      'Lidia Herrera Podóloga',
      'Belinda Rdz',
      'Nancy Coach',
      'Mayra Podóloga',
      'Itzel Martinez',
      'Grecia Gonzalez',
      'Dulce Gonzalez',
    ],
  },
  {
    sucursalKey: 'Serena',
    empleados: [
      'Rubí Martínez',
      'Liliana García',
      'Isabel Podóloga',
      'Estrella Martínez',
      'Lizbeth Podóloga',
      'Andrea Mata Podóloga',
      'Dariana Hernandez',
      'Mitzy Podóloga',
    ],
  },
  {
    sucursalKey: 'Paseo Tec',
    empleados: [
      'Franceily Cisneros',
      'Mayte Arriaga',
    ],
  },
  {
    sucursalKey: 'Carrizalejo',
    empleados: [
      'Aracely Briones',
      'Itzel Cruz',
      'Eunice Galván',
      'Angela Podóloga',
      'Thamara Ruiz',
    ],
  },
  {
    sucursalKey: 'Cumbres del Sol',
    empleados: [
      'Dafne Razo',
      'Yanuri Aguilar',
      'Ahlien Aguilar',
      'Melany Córdova',
    ],
  },
  {
    sucursalKey: 'Fundadores',
    empleados: [
      'Karla Rocha',
      'Mary Angel',
      'Maribel García',
    ],
  },
  {
    sucursalKey: 'Chepevera',
    empleados: [
      'Carmen Cortez',
      'Katherine Santiago Reyes',
      'Yelena Matos',
      'Evelin Dorado',
    ],
  },
  {
    sucursalKey: 'Vía La Luz',
    empleados: [
      'Vanessa Garza',
      'Yareli Rodriguez',
      'Frida Perez',
      'Saraní Camarito',
      'Valeria Medrano',
    ],
  },
  {
    sucursalKey: 'San Jerónimo',
    empleados: [
      'Karla Aguilar',
      'Mary Serna',
      'Celia Balderas Podóloga',
      'Liliana Casillas',
      'Azucena Acosta',
    ],
  },
  {
    sucursalKey: 'Almendros',
    empleados: [
      'Daniela Romero',
      'Irene Salazar',
      'Maricruz Sanchez',
    ],
  },
  {
    sucursalKey: 'Cumbres San Blas',
    empleados: ['Aneth Ramírez'],
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function splitNombre(fullName: string): { nombre: string; apellido: string } {
  const parts = fullName.trim().split(/\s+/)
  return {
    nombre:   parts[0],
    apellido: parts.slice(1).join(' '),
  }
}

/** Normaliza texto para comparación: minúsculas, sin acentos */
function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function findSucursal(
  key: string,
  sucursales: Array<{ id: string; nombre: string }>
): { id: string; nombre: string } | undefined {
  const keyN = normalize(key)

  // Preferir coincidencia "Luna 27 X" (con espacio) sobre "Luna27 X" para evitar duplicados
  const candidates = sucursales.filter(s => normalize(s.nombre).includes(keyN))
  if (candidates.length === 0) return undefined
  // Preferir el que tiene espacio ("Luna 27") si hay varios
  const withSpace = candidates.find(s => s.nombre.includes('Luna 27'))
  return withSpace ?? candidates[0]
}

// ─── Crear sucursal si no existe ─────────────────────────────────────────────

async function ensureSucursal(
  nombre: string,
  sucursales: Array<{ id: string; nombre: string }>
): Promise<{ id: string; nombre: string }> {
  const found = findSucursal(nombre, sucursales)
  if (found) return found

  const { data, error } = await supabase
    .from('sucursales')
    .insert({
      nombre:    `Luna 27 ${nombre}`,
      direccion: 'Monterrey, NL',
      telefono:  '',
      email:     '',
      ciudad:    'Monterrey',
      pais:      'México',
      activa:    true,
    })
    .select('id, nombre')
    .single()

  if (error || !data) throw new Error(`No se pudo crear sucursal "${nombre}": ${error?.message}`)
  console.log(`  🆕 Sucursal creada: ${data.nombre}`)
  sucursales.push(data)
  return data
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════')
  console.log('  Sync Empleadas por Sucursal')
  console.log('═══════════════════════════════════════════\n')

  // Cargar todas las sucursales
  const { data: sucursalesDB, error: errSuc } = await supabase
    .from('sucursales')
    .select('id, nombre')
  if (errSuc) { console.error('❌ Error cargando sucursales:', errSuc.message); process.exit(1) }
  const sucursales = sucursalesDB ?? []

  // Cargar todos los empleados activos/inactivos
  const { data: empleadosDB, error: errEmp } = await supabase
    .from('empleados')
    .select('id, nombre, apellido, sucursal_id, activo')
  if (errEmp) { console.error('❌ Error cargando empleados:', errEmp.message); process.exit(1) }
  const empleados = empleadosDB ?? []

  let insertados = 0, activados = 0, desactivados = 0

  for (const bloque of BLOQUES) {
    const suc = await ensureSucursal(bloque.sucursalKey, sucursales)
    console.log(`\n📍 ${suc.nombre}`)

    const empEnSucursal = empleados.filter(e => e.sucursal_id === suc.id)

    // Clave de comparación: nombre+apellido normalizado
    const claveNorm = (n: string, a: string) => normalize(`${n} ${a}`.trim())

    const autorizadasNorm = new Map<string, string>(
      bloque.empleados.map(full => {
        const { nombre, apellido } = splitNombre(full)
        return [claveNorm(nombre, apellido), full]
      })
    )

    // Desactivar empleadas que ya no están en la lista
    for (const e of empEnSucursal) {
      const clave = claveNorm(e.nombre, e.apellido)
      if (!autorizadasNorm.has(clave) && e.activo) {
        await supabase.from('empleados').update({ activo: false }).eq('id', e.id)
        console.log(`  ⛔ Desactivada: ${e.nombre} ${e.apellido}`)
        desactivados++
      }
    }

    // Insertar o activar empleadas de la lista
    for (const [clave, fullName] of autorizadasNorm) {
      const existing = empEnSucursal.find(e => claveNorm(e.nombre, e.apellido) === clave)

      if (existing) {
        if (!existing.activo) {
          await supabase.from('empleados').update({ activo: true }).eq('id', existing.id)
          console.log(`  ✅ Reactivada: ${existing.nombre} ${existing.apellido}`)
          activados++
        } else {
          console.log(`  ✓  Ya existe: ${existing.nombre} ${existing.apellido}`)
        }
      } else {
        const { nombre, apellido } = splitNombre(fullName)
        const { error } = await supabase.from('empleados').insert({
          nombre,
          apellido,
          rol:            'terapeuta',
          sucursal_id:    suc.id,
          horario_inicio: '09:00',
          horario_fin:    '20:00',
          activo:         true,
        })
        if (error) {
          console.error(`  ❌ Error insertando ${fullName}: ${error.message}`)
        } else {
          console.log(`  🆕 Insertada: ${nombre} ${apellido}`)
          insertados++
          // Agregar al array local para detectar duplicados en el mismo bloque
          empleados.push({ id: '', nombre, apellido, sucursal_id: suc.id, activo: true })
        }
      }
    }
  }

  console.log('\n═══════════════════════════════════════════')
  console.log(`  🆕 Insertadas:   ${insertados}`)
  console.log(`  ✅ Reactivadas:  ${activados}`)
  console.log(`  ⛔ Desactivadas: ${desactivados}`)
  console.log('═══════════════════════════════════════════\n')
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error('❌ Error fatal:', err); process.exit(1) })
