/**
 * Script único (correr una sola vez) para inicializar el stock por sucursal.
 *
 * Pone `stock_actual = 5` y `stock_minimo = 5` en `inventario_stock` para
 * TODAS las combinaciones de sucursal activa x producto activo que aún no
 * tengan una fila (o que la tengan, forzando el valor a 5/5 sólo esta vez).
 *
 * A partir de este seed, cualquier edición manual (inline en la página de
 * stock por sucursal) o descuento por venta se respeta normalmente: este
 * script no se vuelve a correr automáticamente.
 *
 * Uso:
 *   pnpm tsx scripts/seed-stock-inicial-sucursales.ts
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

// Carga simple de .env.local sin depender del paquete `dotenv`
const envPath = resolve(process.cwd(), '.env.local')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1).trim()
    if (!(key in process.env)) process.env[key] = value
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Faltan variables de entorno de Supabase (.env.local)')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const STOCK_INICIAL = 5

async function seedStockInicial() {
  console.log('📦 Cargando sucursales activas...')
  const { data: sucursales, error: errSucursales } = await supabase
    .from('sucursales')
    .select('id, nombre')
    .eq('activa', true)

  if (errSucursales) {
    console.error('❌ Error obteniendo sucursales:', errSucursales.message)
    process.exit(1)
  }
  if (!sucursales || sucursales.length === 0) {
    console.error('⚠️  No se encontraron sucursales activas.')
    process.exit(1)
  }
  console.log(`   → ${sucursales.length} sucursales activas`)

  console.log('📦 Cargando productos activos...')
  const { data: productos, error: errProductos } = await supabase
    .from('inventario_productos')
    .select('id, nombre')
    .eq('activo', true)

  if (errProductos) {
    console.error('❌ Error obteniendo productos:', errProductos.message)
    process.exit(1)
  }
  if (!productos || productos.length === 0) {
    console.error('⚠️  No se encontraron productos activos.')
    process.exit(1)
  }
  console.log(`   → ${productos.length} productos activos`)

  const filas = sucursales.flatMap((s) =>
    productos.map((p) => ({
      sucursal_id: s.id,
      producto_id: p.id,
      stock_actual: STOCK_INICIAL,
      stock_minimo: STOCK_INICIAL,
      updated_at: new Date().toISOString(),
    })),
  )

  console.log(`🚀 Escribiendo ${filas.length} filas (sucursales × productos) en inventario_stock...`)

  const TAMANO_LOTE = 500
  let procesadas = 0
  for (let i = 0; i < filas.length; i += TAMANO_LOTE) {
    const lote = filas.slice(i, i + TAMANO_LOTE)
    const { error } = await supabase
      .from('inventario_stock')
      .upsert(lote, { onConflict: 'producto_id,sucursal_id' })

    if (error) {
      console.error(`❌ Error en lote ${i / TAMANO_LOTE + 1}:`, error.message)
      process.exit(1)
    }
    procesadas += lote.length
    console.log(`   ✓ ${procesadas}/${filas.length}`)
  }

  console.log('✅ Listo. Todas las combinaciones sucursal × producto quedaron con stock_actual = 5 y stock_minimo = 5.')
  console.log('   Cualquier edición manual o venta a partir de ahora se conserva normalmente.')
}

seedStockInicial()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error inesperado:', error)
    process.exit(1)
  })
