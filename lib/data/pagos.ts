// Payments data from Supabase and mock data

import { supabase } from '@/lib/supabase/client'

export interface Pago {
  id: string
  citaId: string
  clienteId: string
  clienteNombre: string
  monto: number
  metodoPago: "efectivo" | "tarjeta" | "transferencia" | "otro"
  estado: "pendiente" | "completado" | "reembolsado" | "cancelado"
  fecha: string
  hora: string
  sucursalId: string
  empleadoId: string
  empleadoNombre: string
  servicios: string[]
  notas?: string
  referencia?: string
  // Campos de detalle de caja
  subtotal?: number
  descuentoMonto?: number
  descuentoTipo?: string
  descuentoCodigo?: string
  propina?: number
  montoEfectivo?: number
  montoTarjeta?: number
}

// ─── Tipos auxiliares de Caja ───────────────────────────────────────────────

export interface PromocionValidada {
  id: string
  nombre: string
  tipo: 'porcentaje' | 'monto_fijo'
  valor: number
  codigo: string
}

export interface GiftCardValidada {
  id: string
  codigo: string
  saldoActual: number
}

export interface RegistrarPagoParams {
  citaId: string
  clienteId: string
  empleadoId: string
  sucursalId: string
  servicioNombre: string
  subtotal: number
  descuentoMonto: number
  descuentoTipo?: string
  descuentoCodigo?: string
  propina: number
  total: number
  metodoPago: 'efectivo' | 'tarjeta' | 'transferencia' | 'otro'
  montoEfectivo?: number
  montoTarjeta?: number
  notas?: string
}

export const MOCK_PAGOS: Pago[] = [
  {
    id: "1",
    citaId: "1",
    clienteId: "1",
    clienteNombre: "Ana García",
    monto: 850,
    metodoPago: "tarjeta",
    estado: "completado",
    fecha: "2024-01-18",
    hora: "11:00",
    sucursalId: "1",
    empleadoId: "1",
    empleadoNombre: "María González",
    servicios: ["Masaje Relajante"],
    referencia: "TXN-2024-001",
  },
  {
    id: "2",
    citaId: "2",
    clienteId: "2",
    clienteNombre: "Carlos López",
    monto: 650,
    metodoPago: "efectivo",
    estado: "completado",
    fecha: "2024-01-18",
    hora: "12:15",
    sucursalId: "1",
    empleadoId: "2",
    empleadoNombre: "Laura Martínez",
    servicios: ["Facial Hidratante"],
  },
  {
    id: "3",
    citaId: "3",
    clienteId: "3",
    clienteNombre: "Sofia Martínez",
    monto: 750,
    metodoPago: "tarjeta",
    estado: "pendiente",
    fecha: "2024-01-18",
    hora: "14:30",
    sucursalId: "1",
    empleadoId: "3",
    empleadoNombre: "Carmen López",
    servicios: ["Manicure & Pedicure"],
  },
  {
    id: "4",
    citaId: "4",
    clienteId: "4",
    clienteNombre: "Roberto Díaz",
    monto: 1200,
    metodoPago: "transferencia",
    estado: "completado",
    fecha: "2024-01-18",
    hora: "16:00",
    sucursalId: "1",
    empleadoId: "1",
    empleadoNombre: "María González",
    servicios: ["Tratamiento Corporal"],
    referencia: "TRANS-2024-045",
  },
  {
    id: "5",
    citaId: "5",
    clienteId: "5",
    clienteNombre: "Laura Hernández",
    monto: 850,
    metodoPago: "tarjeta",
    estado: "completado",
    fecha: "2024-01-17",
    hora: "17:00",
    sucursalId: "1",
    empleadoId: "2",
    empleadoNombre: "Laura Martínez",
    servicios: ["Masaje Relajante"],
    referencia: "TXN-2024-002",
  },
]

export function getPagosByFecha(fecha: string): Pago[] {
  return MOCK_PAGOS.filter((p) => p.fecha === fecha)
}

export function getPagosPendientes(): Pago[] {
  return MOCK_PAGOS.filter((p) => p.estado === "pendiente")
}

// Obtener pagos desde Supabase
export async function getPagosFromDB(sucursalId?: string): Promise<Pago[]> {
  try {
    let query = supabase
      .from('pagos')
      .select(`
        *,
        cliente:clientes(nombre, apellido),
        empleado:empleados(nombre, apellido)
      `)
      .order('fecha', { ascending: false })
      .order('hora', { ascending: false })
    
    if (sucursalId) {
      query = query.eq('sucursal_id', sucursalId)
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('Error obteniendo pagos:', error)
      return []
    }
    
    if (!data) return []
    
    return data.map((pago: any) => ({
      id: pago.id,
      citaId: pago.cita_id || '',
      clienteId: pago.cliente_id,
      clienteNombre: pago.cliente ? `${pago.cliente.nombre} ${pago.cliente.apellido}` : 'Cliente desconocido',
      monto: Number(pago.monto) || 0,
      metodoPago: pago.metodo_pago,
      estado: pago.estado,
      fecha: pago.fecha,
      hora: pago.hora || '',
      sucursalId: pago.sucursal_id,
      empleadoId: pago.empleado_id,
      empleadoNombre: pago.empleado ? `${pago.empleado.nombre} ${pago.empleado.apellido}` : 'Empleado desconocido',
      servicios: pago.servicios || [],
      notas: pago.notas || undefined,
      referencia: pago.referencia || undefined,
    }))
  } catch (error) {
    console.error('Error inesperado obteniendo pagos:', error)
    return []
  }
}

// Obtener pagos pendientes desde BD
export async function getPagosPendientesFromDB(sucursalId?: string): Promise<Pago[]> {
  try {
    let query = supabase
      .from('pagos')
      .select(`
        *,
        cliente:clientes(nombre, apellido),
        empleado:empleados(nombre, apellido)
      `)
      .eq('estado', 'pendiente')
      .order('fecha', { ascending: false })
      .order('hora', { ascending: false })
    
    if (sucursalId) {
      query = query.eq('sucursal_id', sucursalId)
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('Error obteniendo pagos pendientes:', error)
      return []
    }
    
    if (!data) return []
    
    return data.map((pago: any) => ({
      id: pago.id,
      citaId: pago.cita_id || '',
      clienteId: pago.cliente_id,
      clienteNombre: pago.cliente ? `${pago.cliente.nombre} ${pago.cliente.apellido}` : 'Cliente desconocido',
      monto: Number(pago.monto) || 0,
      metodoPago: pago.metodo_pago,
      estado: pago.estado,
      fecha: pago.fecha,
      hora: pago.hora || '',
      sucursalId: pago.sucursal_id,
      empleadoId: pago.empleado_id,
      empleadoNombre: pago.empleado ? `${pago.empleado.nombre} ${pago.empleado.apellido}` : 'Empleado desconocido',
      servicios: pago.servicios || [],
      notas: pago.notas || undefined,
      referencia: pago.referencia || undefined,
    }))
  } catch (error) {
    console.error('Error inesperado obteniendo pagos pendientes:', error)
    return []
  }
}

// ─── Validar cupón/promoción por código ────────────────────────────────────
export async function validarCuponByCode(
  codigo: string
): Promise<{ valido: boolean; promo?: PromocionValidada; error?: string }> {
  try {
    const hoy = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('promociones')
      .select('id, nombre, tipo, valor, codigo_promo, fecha_fin, usos_maximos, usos_actuales, activa')
      .eq('codigo_promo', codigo.toUpperCase().trim())
      .single()

    if (error || !data) return { valido: false, error: 'Código no encontrado' }
    if (!data.activa) return { valido: false, error: 'Esta promoción ya no está activa' }
    if (data.fecha_fin < hoy) return { valido: false, error: 'Esta promoción ya expiró' }
    if (data.usos_maximos && data.usos_actuales >= data.usos_maximos)
      return { valido: false, error: 'Esta promoción alcanzó el límite de usos' }

    const tipo = data.tipo === 'porcentaje' || data.tipo === 'descuento_porcentaje' ? 'porcentaje' : 'monto_fijo'
    return {
      valido: true,
      promo: {
        id: data.id,
        nombre: data.nombre,
        tipo,
        valor: Number(data.valor) || 0,
        codigo: data.codigo_promo,
      },
    }
  } catch (err) {
    return { valido: false, error: 'Error al consultar el cupón' }
  }
}

// ─── Validar gift card por código ──────────────────────────────────────────
export async function validarGiftCard(
  codigo: string
): Promise<{ valida: boolean; gc?: GiftCardValidada; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('gift_cards')
      .select('id, codigo, saldo_actual, estado')
      .eq('codigo', codigo.toUpperCase().trim())
      .single()

    if (error || !data) return { valida: false, error: 'Gift card no encontrada' }
    if (data.estado === 'cancelada') return { valida: false, error: 'Gift card cancelada' }
    if (data.estado === 'expirada') return { valida: false, error: 'Gift card expirada' }
    if (Number(data.saldo_actual) <= 0) return { valida: false, error: 'Gift card sin saldo disponible' }

    return {
      valida: true,
      gc: { id: data.id, codigo: data.codigo, saldoActual: Number(data.saldo_actual) },
    }
  } catch (err) {
    return { valida: false, error: 'Error al consultar la gift card' }
  }
}

// ─── Registrar pago completo desde Caja ───────────────────────────────────
export async function registrarPago(
  params: RegistrarPagoParams
): Promise<{ success: boolean; pagoId?: string; error?: string }> {
  try {
    const now = new Date()
    const fecha = now.toISOString().split('T')[0]
    const hora = now.toTimeString().slice(0, 8)

    // 1. Crear registro en tabla pagos
    const { data: pagoData, error: pagoError } = await supabase
      .from('pagos')
      .insert({
        cita_id: params.citaId,
        cliente_id: params.clienteId,
        empleado_id: params.empleadoId,
        sucursal_id: params.sucursalId,
        monto: params.total,
        metodo_pago: params.metodoPago,
        estado: 'completado',
        fecha,
        hora,
        servicios: [params.servicioNombre],
        notas: params.notas || null,
        subtotal: params.subtotal,
        descuento_monto: params.descuentoMonto,
        descuento_tipo: params.descuentoTipo || null,
        descuento_codigo: params.descuentoCodigo || null,
        propina: params.propina,
        monto_efectivo: params.montoEfectivo || 0,
        monto_tarjeta: params.montoTarjeta || 0,
      })
      .select('id')
      .single()

    if (pagoError) {
      console.error('Error creando pago:', pagoError)
      return { success: false, error: pagoError.message }
    }

    // 2. Marcar cita como pagada y completada
    const { error: citaError } = await supabase
      .from('citas')
      .update({
        pagado: true,
        estado: 'completada',
        metodo_pago: params.metodoPago,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.citaId)

    if (citaError) {
      console.error('Error actualizando cita tras cobro:', citaError)
      // No fallamos: el pago ya se registró
    }

    // 3. Incrementar usos del cupón (si aplica)
    if (params.descuentoTipo === 'cupon' && params.descuentoCodigo) {
      await supabase.rpc('increment_promo_usos', { p_codigo: params.descuentoCodigo }).maybeSingle()
    }

    // 4. Descontar saldo de gift card (si aplica)
    if (params.descuentoTipo === 'gift_card' && params.descuentoCodigo) {
      const { data: gc } = await supabase
        .from('gift_cards')
        .select('saldo_actual')
        .eq('codigo', params.descuentoCodigo)
        .single()
      if (gc) {
        const nuevoSaldo = Math.max(0, Number(gc.saldo_actual) - params.descuentoMonto)
        await supabase
          .from('gift_cards')
          .update({
            saldo_actual: nuevoSaldo,
            estado: nuevoSaldo === 0 ? 'agotada' : undefined,
          })
          .eq('codigo', params.descuentoCodigo)
      }
    }

    return { success: true, pagoId: pagoData.id }
  } catch (err: any) {
    console.error('Error inesperado registrando pago:', err)
    return { success: false, error: err.message || 'Error desconocido' }
  }
}
