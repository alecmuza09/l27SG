import type { GiftCard, GiftCardTransaccion } from "@/lib/types/gift-cards"
import { supabase } from '@/lib/supabase/client'

// Fecha local (no UTC) para evitar desfase después de las 6 PM
const fechaLocal = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// Generador de código único para gift cards
export function generarCodigoGiftCard(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  const part1 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
  const part2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
  return `GC-${part1}-${part2}`
}

// Obtener gift cards desde Supabase (pagina automáticamente para traer todos los registros)
export async function getGiftCardsFromDB(sucursalId?: string): Promise<GiftCard[]> {
  try {
    const PAGE_SIZE = 1000
    let allData: any[] = []
    let page = 0
    let keepGoing = true

    while (keepGoing) {
      const from = page * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      let query = supabase
        .from('gift_cards')
        .select(`
          *,
          cliente:clientes(nombre, apellido),
          sucursal:sucursales(nombre),
          empleado:empleados(nombre, apellido)
        `)
        .order('fecha_emision', { ascending: false })
        .range(from, to)

      if (sucursalId) {
        query = query.eq('sucursal_id', sucursalId)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error obteniendo gift cards:', error)
        return []
      }

      if (!data || data.length === 0) {
        keepGoing = false
      } else {
        allData = allData.concat(data)
        keepGoing = data.length === PAGE_SIZE
        page++
      }
    }

    return allData.map((gc: any) => ({
      id: gc.id,
      codigo: gc.codigo,
      saldoInicial: Number(gc.monto_inicial) || 0,
      saldoActual: Number(gc.saldo_actual) || 0,
      estado: gc.estado,
      fechaEmision: gc.fecha_emision || gc.created_at,
      fechaActivacion: gc.fecha_activacion || null,
      fechaExpiracion: gc.fecha_vencimiento || null,
      clienteId: gc.cliente_id || null,
      clienteNombre: gc.cliente ? `${gc.cliente.nombre} ${gc.cliente.apellido}` : null,
      sucursalId: gc.sucursal_id,
      sucursalNombre: gc.sucursal?.nombre || '',
      empleadoEmisorId: gc.empleado_emisor_id || '',
      empleadoEmisorNombre: gc.empleado ? `${gc.empleado.nombre} ${gc.empleado.apellido}` : '',
    }))
  } catch (error) {
    console.error('Error inesperado obteniendo gift cards:', error)
    return []
  }
}

// Obtener transacciones de gift card desde Supabase
export async function getGiftCardTransaccionesFromDB(giftCardId?: string): Promise<GiftCardTransaccion[]> {
  try {
    let query = supabase
      .from('gift_card_transacciones')
      .select(`
        *,
        empleado:empleados(nombre, apellido)
      `)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
    
    if (giftCardId) {
      query = query.eq('gift_card_id', giftCardId)
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('Error obteniendo transacciones de gift cards:', error)
      return []
    }
    
    if (!data) return []
    
    return data.map((t: any) => ({
      id: t.id,
      giftCardId: t.gift_card_id,
      tipo: t.tipo,
      monto: Number(t.monto) || 0,
      saldoAnterior: Number(t.saldo_anterior) || 0,
      saldoNuevo: Number(t.saldo_nuevo) || 0,
      ventaId: t.venta_id || null,
      empleadoId: t.empleado_id || '',
      empleadoNombre: t.empleado ? `${t.empleado.nombre} ${t.empleado.apellido}` : '',
      fecha: t.fecha || t.created_at,
      notas: t.notas || '',
    }))
  } catch (error) {
    console.error('Error inesperado obteniendo transacciones:', error)
    return []
  }
}

// Datos mock de gift cards
export const giftCardsData: GiftCard[] = [
  {
    id: "gc-1",
    codigo: "GC-LUNA-2701",
    saldoInicial: 1000,
    saldoActual: 750,
    estado: "activa",
    fechaEmision: "2024-10-15T10:00:00",
    fechaActivacion: "2024-10-15T10:05:00",
    fechaExpiracion: "2025-10-15",
    clienteId: "c-1",
    clienteNombre: "María García López",
    sucursalId: "1",
    sucursalNombre: "Luna27 Cumbres",
    empleadoEmisorId: "e-1",
    empleadoEmisorNombre: "Ana Martínez",
  },
  {
    id: "gc-2",
    codigo: "GC-RELA-5432",
    saldoInicial: 500,
    saldoActual: 500,
    estado: "pendiente",
    fechaEmision: "2024-10-28T14:30:00",
    fechaActivacion: null,
    fechaExpiracion: null,
    clienteId: null,
    clienteNombre: null,
    sucursalId: "2",
    sucursalNombre: "Luna27 San Pedro",
    empleadoEmisorId: "e-2",
    empleadoEmisorNombre: "Carlos Ruiz",
  },
  {
    id: "gc-3",
    codigo: "GC-SPA7-8899",
    saldoInicial: 2000,
    saldoActual: 0,
    estado: "agotada",
    fechaEmision: "2024-08-01T09:00:00",
    fechaActivacion: "2024-08-01T09:10:00",
    fechaExpiracion: "2025-08-01",
    clienteId: "c-2",
    clienteNombre: "Roberto Hernández",
    sucursalId: "1",
    sucursalNombre: "Luna27 Cumbres",
    empleadoEmisorId: "e-1",
    empleadoEmisorNombre: "Ana Martínez",
  },
  {
    id: "gc-4",
    codigo: "GC-BIEN-1234",
    saldoInicial: 1500,
    saldoActual: 1500,
    estado: "cancelada",
    fechaEmision: "2024-09-10T11:00:00",
    fechaActivacion: "2024-09-10T11:30:00",
    fechaExpiracion: null,
    clienteId: "c-3",
    clienteNombre: "Laura Sánchez",
    sucursalId: "3",
    sucursalNombre: "Luna27 Valle",
    empleadoEmisorId: "e-3",
    empleadoEmisorNombre: "Patricia López",
  },
]

// Datos mock de transacciones
export const giftCardTransaccionesData: GiftCardTransaccion[] = [
  {
    id: "gct-1",
    giftCardId: "gc-1",
    tipo: "emision",
    monto: 1000,
    saldoAnterior: 0,
    saldoNuevo: 1000,
    ventaId: null,
    empleadoId: "e-1",
    empleadoNombre: "Ana Martínez",
    fecha: "2024-10-15T10:00:00",
    notas: "Emisión de gift card",
  },
  {
    id: "gct-2",
    giftCardId: "gc-1",
    tipo: "activacion",
    monto: 0,
    saldoAnterior: 1000,
    saldoNuevo: 1000,
    ventaId: "v-101",
    empleadoId: "e-1",
    empleadoNombre: "Ana Martínez",
    fecha: "2024-10-15T10:05:00",
    notas: "Activación por venta",
  },
  {
    id: "gct-3",
    giftCardId: "gc-1",
    tipo: "canje",
    monto: 250,
    saldoAnterior: 1000,
    saldoNuevo: 750,
    ventaId: "v-150",
    empleadoId: "e-2",
    empleadoNombre: "Carlos Ruiz",
    fecha: "2024-10-20T16:45:00",
    notas: "Pago parcial en servicios",
  },
  {
    id: "gct-4",
    giftCardId: "gc-3",
    tipo: "emision",
    monto: 2000,
    saldoAnterior: 0,
    saldoNuevo: 2000,
    ventaId: null,
    empleadoId: "e-1",
    empleadoNombre: "Ana Martínez",
    fecha: "2024-08-01T09:00:00",
    notas: "Gift card premium",
  },
  {
    id: "gct-5",
    giftCardId: "gc-3",
    tipo: "canje",
    monto: 2000,
    saldoAnterior: 2000,
    saldoNuevo: 0,
    ventaId: "v-200",
    empleadoId: "e-1",
    empleadoNombre: "Ana Martínez",
    fecha: "2024-09-15T14:00:00",
    notas: "Canje total - Paquete Spa Completo",
  },
]

// Store local para persistencia
const STORAGE_KEY = "luna27_gift_cards"
const TRANSACTIONS_STORAGE_KEY = "luna27_gift_card_transactions"

export function getGiftCards(): GiftCard[] {
  if (typeof window === "undefined") return giftCardsData
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    return JSON.parse(stored)
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(giftCardsData))
  return giftCardsData
}

export function saveGiftCards(cards: GiftCard[]): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cards))
  }
}

export function getGiftCardTransacciones(giftCardId?: string): GiftCardTransaccion[] {
  if (typeof window === "undefined") return giftCardTransaccionesData
  const stored = localStorage.getItem(TRANSACTIONS_STORAGE_KEY)
  let transactions: GiftCardTransaccion[]
  if (stored) {
    transactions = JSON.parse(stored)
  } else {
    localStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify(giftCardTransaccionesData))
    transactions = giftCardTransaccionesData
  }
  if (giftCardId) {
    return transactions.filter((t) => t.giftCardId === giftCardId)
  }
  return transactions
}

export function saveGiftCardTransacciones(transactions: GiftCardTransaccion[]): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify(transactions))
  }
}

export function addTransaccion(transaccion: GiftCardTransaccion): void {
  const transactions = getGiftCardTransacciones()
  transactions.push(transaccion)
  saveGiftCardTransacciones(transactions)
}

// ─────────────────────────────────────────────────────────────────────────────
// Operaciones CRUD contra Supabase
// ─────────────────────────────────────────────────────────────────────────────

/** Crea una nueva gift card en BD y registra la transacción de emisión */
export async function eliminarGiftCard(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Primero eliminar transacciones relacionadas
    await supabase.from('gift_card_transacciones').delete().eq('gift_card_id', id)
    const { error } = await supabase.from('gift_cards').delete().eq('id', id)
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message || 'Error eliminando gift card' }
  }
}

export async function crearGiftCard(datos: {
  montoInicial: number
  sucursalId: string
  clienteId?: string | null
  fechaVencimiento?: string | null
  empleadoEmisorId?: string | null
  codigoPersonalizado?: string | null
}): Promise<{ success: boolean; gc?: GiftCard; error?: string }> {
  try {
    const codigo = datos.codigoPersonalizado?.trim().toUpperCase() || generarCodigoGiftCard()
    const hoy = fechaLocal()

    const { data: gcData, error: gcError } = await supabase
      .from('gift_cards')
      .insert({
        codigo,
        monto_inicial: datos.montoInicial,
        saldo_actual: datos.montoInicial,
        estado: 'pendiente',
        sucursal_id: datos.sucursalId,
        cliente_id: datos.clienteId || null,
        empleado_emisor_id: datos.empleadoEmisorId || null,
        fecha_emision: hoy,
        fecha_vencimiento: datos.fechaVencimiento || null,
      })
      .select(`*, cliente:clientes(nombre, apellido), sucursal:sucursales(nombre), empleado:empleados(nombre, apellido)`)
      .single()

    if (gcError || !gcData) {
      return { success: false, error: gcError?.message || 'Error creando gift card' }
    }

    // Registrar transacción de emisión
    await supabase.from('gift_card_transacciones').insert({
      gift_card_id: gcData.id,
      tipo: 'emision',
      monto: datos.montoInicial,
      saldo_anterior: 0,
      saldo_nuevo: datos.montoInicial,
      empleado_id: datos.empleadoEmisorId || null,
      fecha: hoy,
      notas: 'Emisión de gift card',
    })

    const gc: GiftCard = {
      id: gcData.id,
      codigo: gcData.codigo,
      saldoInicial: Number(gcData.monto_inicial),
      saldoActual: Number(gcData.saldo_actual),
      estado: gcData.estado,
      fechaEmision: gcData.fecha_emision,
      fechaActivacion: gcData.fecha_activacion || null,
      fechaExpiracion: gcData.fecha_vencimiento || null,
      clienteId: gcData.cliente_id || null,
      clienteNombre: gcData.cliente ? `${gcData.cliente.nombre} ${gcData.cliente.apellido}` : null,
      sucursalId: gcData.sucursal_id,
      sucursalNombre: gcData.sucursal?.nombre || '',
      empleadoEmisorId: gcData.empleado_emisor_id || '',
      empleadoEmisorNombre: gcData.empleado ? `${gcData.empleado.nombre} ${gcData.empleado.apellido}` : '',
    }

    return { success: true, gc }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error inesperado' }
  }
}

/** Activa una gift card (cambia de pendiente → activa) */
export async function activarGiftCard(
  giftCardId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const hoy = fechaLocal()

    const { data: gc, error: fetchError } = await supabase
      .from('gift_cards')
      .select('saldo_actual, estado')
      .eq('id', giftCardId)
      .single()

    if (fetchError || !gc) return { success: false, error: 'Gift card no encontrada' }
    if (gc.estado !== 'pendiente') return { success: false, error: 'Solo se pueden activar tarjetas en estado Pendiente' }

    const { error } = await supabase
      .from('gift_cards')
      .update({ estado: 'activa', fecha_activacion: hoy, updated_at: new Date().toISOString() })
      .eq('id', giftCardId)

    if (error) return { success: false, error: error.message }

    await supabase.from('gift_card_transacciones').insert({
      gift_card_id: giftCardId,
      tipo: 'activacion',
      monto: 0,
      saldo_anterior: Number(gc.saldo_actual),
      saldo_nuevo: Number(gc.saldo_actual),
      fecha: hoy,
      notas: 'Activación de gift card',
    })

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error inesperado' }
  }
}

/** Canjea (descuenta) saldo de una gift card */
export async function canjearGiftCard(
  giftCardId: string,
  monto: number,
  notas?: string,
  empleadoId?: string | null
): Promise<{ success: boolean; saldoNuevo?: number; error?: string }> {
  try {
    const { data: gc, error: fetchError } = await supabase
      .from('gift_cards')
      .select('saldo_actual, estado')
      .eq('id', giftCardId)
      .single()

    if (fetchError || !gc) return { success: false, error: 'Gift card no encontrada' }
    if (gc.estado !== 'activa') return { success: false, error: 'La tarjeta no está activa' }
    if (Number(gc.saldo_actual) < monto) return { success: false, error: 'Saldo insuficiente' }

    const saldoAnterior = Number(gc.saldo_actual)
    const saldoNuevo = saldoAnterior - monto
    const nuevoEstado = saldoNuevo <= 0 ? 'agotada' : 'activa'

    const { error } = await supabase
      .from('gift_cards')
      .update({ saldo_actual: saldoNuevo, estado: nuevoEstado, updated_at: new Date().toISOString() })
      .eq('id', giftCardId)

    if (error) return { success: false, error: error.message }

    await supabase.from('gift_card_transacciones').insert({
      gift_card_id: giftCardId,
      tipo: 'canje',
      monto,
      saldo_anterior: saldoAnterior,
      saldo_nuevo: saldoNuevo,
      empleado_id: empleadoId || null,
      fecha: fechaLocal(),
      notas: notas || 'Canje de saldo',
    })

    return { success: true, saldoNuevo }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error inesperado' }
  }
}

/** Recarga saldo a una gift card */
export async function recargarGiftCard(
  giftCardId: string,
  monto: number,
  notas?: string,
  empleadoId?: string | null
): Promise<{ success: boolean; saldoNuevo?: number; error?: string }> {
  try {
    const { data: gc, error: fetchError } = await supabase
      .from('gift_cards')
      .select('saldo_actual, estado')
      .eq('id', giftCardId)
      .single()

    if (fetchError || !gc) return { success: false, error: 'Gift card no encontrada' }
    if (gc.estado === 'cancelada' || gc.estado === 'expirada') {
      return { success: false, error: 'No se puede recargar una tarjeta cancelada o expirada' }
    }

    const saldoAnterior = Number(gc.saldo_actual)
    const saldoNuevo = saldoAnterior + monto
    const nuevoEstado = gc.estado === 'agotada' ? 'activa' : gc.estado

    const { error } = await supabase
      .from('gift_cards')
      .update({ saldo_actual: saldoNuevo, estado: nuevoEstado, updated_at: new Date().toISOString() })
      .eq('id', giftCardId)

    if (error) return { success: false, error: error.message }

    await supabase.from('gift_card_transacciones').insert({
      gift_card_id: giftCardId,
      tipo: 'recarga',
      monto,
      saldo_anterior: saldoAnterior,
      saldo_nuevo: saldoNuevo,
      empleado_id: empleadoId || null,
      fecha: fechaLocal(),
      notas: notas || 'Recarga de saldo',
    })

    return { success: true, saldoNuevo }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error inesperado' }
  }
}

/** Cancela una gift card */
export async function cancelarGiftCard(
  giftCardId: string,
  motivo?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: gc, error: fetchError } = await supabase
      .from('gift_cards')
      .select('saldo_actual, estado')
      .eq('id', giftCardId)
      .single()

    if (fetchError || !gc) return { success: false, error: 'Gift card no encontrada' }

    const { error } = await supabase
      .from('gift_cards')
      .update({ estado: 'cancelada', updated_at: new Date().toISOString() })
      .eq('id', giftCardId)

    if (error) return { success: false, error: error.message }

    await supabase.from('gift_card_transacciones').insert({
      gift_card_id: giftCardId,
      tipo: 'cancelacion',
      monto: Number(gc.saldo_actual),
      saldo_anterior: Number(gc.saldo_actual),
      saldo_nuevo: 0,
      fecha: fechaLocal(),
      notas: motivo || 'Cancelación de gift card',
    })

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error inesperado' }
  }
}
