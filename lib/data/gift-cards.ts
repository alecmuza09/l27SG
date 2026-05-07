import type { GiftCard, GiftCardTransaccion } from "@/lib/types/gift-cards"
import { registrarPagoEmisionGiftCard } from "@/lib/data/pagos"
import { supabase } from '@/lib/supabase/client'
import {
  analizarFolioTiendaEnLinea,
  intentandoFormatoTiendaEnLinea,
  MSG_FOLIO_YA_REGISTRADO,
} from "@/lib/data/gift-card-folios-tienda"

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

// ─── Helper interno de mapeo ──────────────────────────────────────────────────
function mapGiftCard(gc: any): GiftCard {
  return {
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
    metodoPago: gc.metodo_pago || null,
  }
}

const GC_SELECT = `
  *,
  cliente:clientes(nombre, apellido),
  sucursal:sucursales(nombre),
  empleado:empleados(nombre, apellido)
`

// Obtener gift cards paginadas con filtros server-side
export async function getGiftCardsFromDB(params?: {
  sucursalId?: string
  estado?: string
  search?: string
  page?: number
  pageSize?: number
}): Promise<{ data: GiftCard[]; total: number }> {
  try {
    const { sucursalId, estado, search, page = 0, pageSize = 50 } = params ?? {}

    // Si hay búsqueda de texto, pre-obtener IDs de clientes que coincidan
    let clienteIds: string[] = []
    if (search) {
      const { data: clientes } = await supabase
        .from('clientes')
        .select('id')
        .or(`nombre.ilike.%${search}%,apellido.ilike.%${search}%`)
        .limit(200)
      clienteIds = (clientes ?? []).map((c: any) => c.id)
    }

    let query = supabase
      .from('gift_cards')
      .select(GC_SELECT, { count: 'exact' })
      .order('fecha_emision', { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1)

    if (sucursalId) query = query.eq('sucursal_id', sucursalId)
    if (estado && estado !== 'todos') query = query.eq('estado', estado)
    if (search) {
      const orParts = [`codigo.ilike.%${search}%`]
      if (clienteIds.length > 0) orParts.push(`cliente_id.in.(${clienteIds.join(',')})`)
      query = query.or(orParts.join(','))
    }

    const { data, error, count } = await query

    if (error) {
      console.error('Error obteniendo gift cards:', error)
      return { data: [], total: 0 }
    }

    return { data: (data ?? []).map(mapGiftCard), total: count ?? 0 }
  } catch (error) {
    console.error('Error inesperado obteniendo gift cards:', error)
    return { data: [], total: 0 }
  }
}

// Obtener una gift card por ID (para historial/detalle)
export async function getGiftCardByIdFromDB(id: string): Promise<GiftCard | null> {
  try {
    const { data, error } = await supabase
      .from('gift_cards')
      .select(GC_SELECT)
      .eq('id', id)
      .single()
    if (error || !data) return null
    return mapGiftCard(data)
  } catch {
    return null
  }
}

/** Verifica si ya existe una gift card con el mismo código exacto (antes de insert). */
export async function giftCardExisteConCodigo(codigo: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("gift_cards")
      .select("id")
      .eq("codigo", codigo)
      .maybeSingle()
    if (error) {
      console.error("Error comprobando código gift card:", error)
      return false
    }
    return !!data
  } catch {
    return false
  }
}

// Obtener una gift card por código (búsqueda rápida, case-insensitive)
export async function getGiftCardByCodigoFromDB(codigo: string): Promise<GiftCard | null> {
  try {
    const { data, error } = await (supabase as any)
      .from('gift_cards')
      .select(GC_SELECT)
      .ilike('codigo', codigo)
      .maybeSingle()
    if (error || !data) return null
    return mapGiftCard(data)
  } catch {
    return null
  }
}

// KPIs rápidos: 4 COUNT queries en paralelo (no transfieren filas completas)
export async function getGiftCardsKPIsFromDB(sucursalId?: string): Promise<{
  totalEmitidas: number
  totalActivas: number
  totalPendientes: number
  saldoTotal: number
}> {
  try {
    const base = () => {
      const q = supabase.from('gift_cards')
      return sucursalId ? (q as any).eq('sucursal_id', sucursalId) : q
    }

    const [
      { count: total },
      { count: activas },
      { count: pendientes },
      { data: activasData },
    ] = await Promise.all([
      base().select('*', { count: 'exact', head: true }),
      base().select('*', { count: 'exact', head: true }).eq('estado', 'activa'),
      base().select('*', { count: 'exact', head: true }).eq('estado', 'pendiente'),
      base().select('saldo_actual').eq('estado', 'activa'),
    ])

    const saldoTotal = (activasData ?? []).reduce(
      (s: number, r: any) => s + Number(r.saldo_actual), 0
    )

    return {
      totalEmitidas: total ?? 0,
      totalActivas: activas ?? 0,
      totalPendientes: pendientes ?? 0,
      saldoTotal,
    }
  } catch (error) {
    console.error('Error obteniendo KPIs de gift cards:', error)
    return { totalEmitidas: 0, totalActivas: 0, totalPendientes: 0, saldoTotal: 0 }
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
  metodoPago?: string | null
}): Promise<{ success: boolean; gc?: GiftCard; error?: string; advertenciaPago?: string }> {
  try {
    const customRaw = datos.codigoPersonalizado?.trim() ?? ""
    let codigo: string
    let montoInicialFinal = datos.montoInicial
    let servicioTiendaLinea: string | null = null

    if (customRaw) {
      if (intentandoFormatoTiendaEnLinea(customRaw)) {
        const a = analizarFolioTiendaEnLinea(customRaw)
        if (a.tipo === "error") {
          return { success: false, error: a.mensaje }
        }
        if (a.tipo === "valido") {
          codigo = a.codigoNormalizado
          montoInicialFinal = a.valor
          servicioTiendaLinea = a.servicio
        } else {
          codigo = customRaw.toUpperCase()
        }
      } else {
        codigo = customRaw.toUpperCase()
      }
    } else {
      codigo = generarCodigoGiftCard()
    }

    const existe = await giftCardExisteConCodigo(codigo)
    if (existe) {
      return { success: false, error: MSG_FOLIO_YA_REGISTRADO }
    }

    const hoy = fechaLocal()

    const insertPayload: Record<string, any> = {
      codigo,
      monto_inicial: montoInicialFinal,
      saldo_actual: montoInicialFinal,
      estado: 'activa',
      sucursal_id: datos.sucursalId,
      cliente_id: datos.clienteId || null,
      empleado_emisor_id: datos.empleadoEmisorId || null,
      fecha_emision: hoy,
      fecha_activacion: hoy,
      fecha_vencimiento: datos.fechaVencimiento || null,
    }
    if (datos.metodoPago) insertPayload.metodo_pago = datos.metodoPago

    const { data: gcData, error: gcError } = await (supabase as any)
      .from('gift_cards')
      .insert(insertPayload)
      .select(`*, cliente:clientes(nombre, apellido), sucursal:sucursales(nombre), empleado:empleados(nombre, apellido)`)
      .single()

    if (gcError || !gcData) {
      const msg = gcError?.message || "Error creando gift card"
      const dup =
        gcError &&
        typeof gcError === "object" &&
        (gcError as { code?: string }).code === "23505"
      if (dup) return { success: false, error: MSG_FOLIO_YA_REGISTRADO }
      return { success: false, error: msg }
    }

    const notasEmision = servicioTiendaLinea
      ? `Tienda en línea · ${servicioTiendaLinea} · ${gcData.codigo}${datos.metodoPago ? ` · Pago: ${datos.metodoPago}` : ""}`
      : datos.metodoPago
        ? `Emisión de gift card · Pago: ${datos.metodoPago}`
        : "Emisión de gift card"

    const pagoRes = await registrarPagoEmisionGiftCard({
      giftCardId: gcData.id,
      codigo: gcData.codigo,
      monto: montoInicialFinal,
      sucursalId: datos.sucursalId,
      clienteId: datos.clienteId ?? null,
      empleadoId: datos.empleadoEmisorId ?? null,
      metodoPagoRaw: datos.metodoPago ?? null,
      fecha: hoy,
      descripcionServicio: servicioTiendaLinea,
    })

    if (!pagoRes.success && !pagoRes.skipped) {
      console.error('[crearGiftCard] Cobro no registrado en pagos:', pagoRes.error)
    }

    await supabase.from('gift_card_transacciones').insert({
      gift_card_id: gcData.id,
      tipo: 'emision',
      monto: montoInicialFinal,
      saldo_anterior: 0,
      saldo_nuevo: montoInicialFinal,
      venta_id: pagoRes.pagoId ?? null,
      empleado_id: datos.empleadoEmisorId || null,
      fecha: hoy,
      notas: notasEmision,
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
      metodoPago: datos.metodoPago || gcData.metodo_pago || null,
    }

    const advertenciaPago =
      !pagoRes.success && !pagoRes.skipped
        ? (pagoRes.error ?? 'No se registró el cobro en caja')
        : undefined

    return advertenciaPago ? { success: true, gc, advertenciaPago } : { success: true, gc }
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
