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
  citaId: string | null   // null = venta directa sin cita (punto de venta)
  clienteId: string
  empleadoId: string | null  // null = venta directa sin empleado asignado
  sucursalId: string
  servicioNombre: string
  subtotal: number
  descuentoMonto: number
  descuentoTipo?: string
  descuentoCodigo?: string
  descuentoGcId?: string    // ID de la gift card usada como descuento (evita búsqueda por código)
  propina: number
  total: number
  metodoPago: 'efectivo' | 'tarjeta' | 'transferencia' | 'otro'
  montoEfectivo?: number
  montoTarjeta?: number
  montoGiftCard?: number
  giftCardId?: string       // ID de la gift card usada para descontar saldo
  referencia?: string       // Referencia de transferencia
  notas?: string
}

// ─── Tipo para historial de cliente ────────────────────────────────────────
export interface HistorialCliente {
  id: string
  fecha: string
  hora: string
  servicios: string[]
  monto: number
  metodoPago: string
}

// ─── Tipo para resumen de caja diario ──────────────────────────────────────
export interface ResumenCajaDiario {
  fecha: string
  totalVentas: number
  cantidadTransacciones: number
  ticketPromedio: number
  totalPropinas: number
  totalDescuentos: number
  porMetodo: {
    efectivo: number
    tarjeta: number
    transferencia: number
    otro: number
  }
  porMetodoCantidad: {
    efectivo: number
    tarjeta: number
    transferencia: number
    otro: number
  }
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
export async function getPagosFromDB(sucursalId?: string, fecha?: string): Promise<Pago[]> {
  try {
    let query = supabase
      .from('pagos')
      .select(`
        id, cita_id, cliente_id, empleado_id, sucursal_id,
        monto, metodo_pago, estado, fecha, hora, servicios,
        notas, referencia, subtotal,
        descuento_monto, descuento_tipo, descuento_codigo,
        propina, monto_efectivo, monto_tarjeta,
        cliente:clientes(nombre, apellido),
        empleado:empleados(nombre, apellido)
      `)
      .order('hora', { ascending: false })

    if (sucursalId) query = query.eq('sucursal_id', sucursalId)
    if (fecha)      query = query.eq('fecha', fecha)

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
      subtotal: Number(pago.subtotal) || 0,
      descuentoMonto: Number(pago.descuento_monto) || 0,
      descuentoTipo: pago.descuento_tipo || undefined,
      descuentoCodigo: pago.descuento_codigo || undefined,
      propina: Number(pago.propina) || 0,
      montoEfectivo: Number(pago.monto_efectivo) || 0,
      montoTarjeta: Number(pago.monto_tarjeta) || 0,
    }))
  } catch (error) {
    console.error('Error inesperado obteniendo pagos:', error)
    return []
  }
}

// Calcula el resumen de caja directamente desde los pagos ya cargados (sin extra roundtrip a DB)
export function calcularResumenDesdePagos(pagos: Pago[], fecha: string): ResumenCajaDiario {
  const completados = pagos.filter(p => p.estado === 'completado')
  const resumen: ResumenCajaDiario = {
    fecha,
    totalVentas: 0,
    cantidadTransacciones: completados.length,
    ticketPromedio: 0,
    totalPropinas: 0,
    totalDescuentos: 0,
    porMetodo: { efectivo: 0, tarjeta: 0, transferencia: 0, otro: 0 },
    porMetodoCantidad: { efectivo: 0, tarjeta: 0, transferencia: 0, otro: 0 },
  }
  for (const p of completados) {
    const metodo = (p.metodoPago || 'otro') as keyof ResumenCajaDiario['porMetodo']
    resumen.totalVentas += p.monto
    resumen.totalPropinas += p.propina ?? 0
    resumen.totalDescuentos += p.descuentoMonto ?? 0
    if (metodo in resumen.porMetodo) {
      resumen.porMetodo[metodo] += p.monto
      resumen.porMetodoCantidad[metodo] += 1
    } else {
      resumen.porMetodo.otro += p.monto
      resumen.porMetodoCantidad.otro += 1
    }
  }
  resumen.ticketPromedio = resumen.cantidadTransacciones > 0
    ? resumen.totalVentas / resumen.cantidadTransacciones
    : 0
  return resumen
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
    const codigoLimpio = codigo.trim()
    if (!codigoLimpio) return { valida: false, error: 'Ingresa un código de gift card' }

    // ilike = búsqueda case-insensitive; evita que códigos con minúsculas fallen
    // .limit(1) en lugar de .single() para no lanzar error cuando no existe
    const { data, error } = await (supabase as any)
      .from('gift_cards')
      .select('id, codigo, saldo_actual, estado, fecha_vencimiento')
      .ilike('codigo', codigoLimpio)
      .limit(1)

    if (error) {
      console.error('Error consultando gift card:', error)
      return { valida: false, error: 'Error al consultar la gift card' }
    }

    const row = Array.isArray(data) ? data[0] : null
    if (!row) return { valida: false, error: 'Gift card no encontrada' }

    if (row.estado === 'pendiente') return { valida: false, error: 'Gift card pendiente de activación' }
    if (row.estado === 'cancelada') return { valida: false, error: 'Gift card cancelada' }
    if (row.estado === 'expirada')  return { valida: false, error: 'Gift card expirada' }
    if (row.estado === 'agotada')   return { valida: false, error: 'Gift card sin saldo disponible' }

    // Verificar vencimiento por fecha aunque el estado no sea 'expirada' aún
    if (row.fecha_vencimiento) {
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)
      const vence = new Date(row.fecha_vencimiento + 'T00:00:00')
      if (vence < hoy) return { valida: false, error: 'Gift card vencida' }
    }

    if (Number(row.saldo_actual) <= 0) return { valida: false, error: 'Gift card sin saldo disponible' }

    return {
      valida: true,
      gc: { id: row.id, codigo: row.codigo, saldoActual: Number(row.saldo_actual) },
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
    // Usar fecha local para que pagos después de las 6 PM no queden en el día siguiente (UTC)
    const fecha = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
    const hora = now.toTimeString().slice(0, 8)

    // 1. Crear registro en tabla pagos
    const { data: pagoData, error: pagoError } = await supabase
      .from('pagos')
      .insert({
        cita_id: params.citaId || null,
        cliente_id: params.clienteId,
        empleado_id: params.empleadoId || null,
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

    // 2. Marcar cita como pagada y completada (solo si hay citaId)
    if (params.citaId) {
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
      }
    }

    // 3. Incrementar usos del cupón (si aplica)
    if (params.descuentoTipo === 'cupon' && params.descuentoCodigo) {
      await supabase.rpc('increment_promo_usos', { p_codigo: params.descuentoCodigo }).maybeSingle()
    }

    // 4. Descontar saldo de gift card usada como descuento
    if (params.descuentoTipo === 'gift_card' && (params.descuentoGcId || params.descuentoCodigo)) {
      // Preferir búsqueda por ID (exacto); fallback por código con ilike
      let gcRow: any = null
      if (params.descuentoGcId) {
        const { data } = await (supabase as any)
          .from('gift_cards').select('id, saldo_actual').eq('id', params.descuentoGcId).maybeSingle()
        gcRow = data
      } else {
        const { data } = await (supabase as any)
          .from('gift_cards').select('id, saldo_actual').ilike('codigo', params.descuentoCodigo!).limit(1)
        gcRow = Array.isArray(data) ? data[0] : null
      }
      if (gcRow) {
        const nuevoSaldo = Math.max(0, Number(gcRow.saldo_actual) - params.descuentoMonto)
        await (supabase as any)
          .from('gift_cards')
          .update({ saldo_actual: nuevoSaldo, estado: nuevoSaldo === 0 ? 'agotada' : undefined })
          .eq('id', gcRow.id)
      }
    }

    // 5. Descontar saldo de gift card usada como método de pago (pago mixto)
    if (params.giftCardId && (params.montoGiftCard ?? 0) > 0) {
      const { data: gcPago } = await (supabase as any)
        .from('gift_cards')
        .select('saldo_actual')
        .eq('id', params.giftCardId)
        .maybeSingle()
      if (gcPago) {
        const nuevoSaldo = Math.max(0, Number(gcPago.saldo_actual) - (params.montoGiftCard ?? 0))
        await (supabase as any)
          .from('gift_cards')
          .update({
            saldo_actual: nuevoSaldo,
            estado: nuevoSaldo === 0 ? 'agotada' : undefined,
          })
          .eq('id', params.giftCardId)
      }
    }

    return { success: true, pagoId: pagoData.id }
  } catch (err: any) {
    console.error('Error inesperado registrando pago:', err)
    return { success: false, error: err.message || 'Error desconocido' }
  }
}

// ─── Historial de compras de un cliente ────────────────────────────────────
export async function getHistorialClienteFromDB(
  clienteId: string,
  limit = 5
): Promise<HistorialCliente[]> {
  try {
    const { data, error } = await supabase
      .from('pagos')
      .select('id, fecha, hora, servicios, monto, metodo_pago')
      .eq('cliente_id', clienteId)
      .eq('estado', 'completado')
      .order('fecha', { ascending: false })
      .order('hora', { ascending: false })
      .limit(limit)

    if (error || !data) return []

    return data.map((p: any) => ({
      id: p.id,
      fecha: p.fecha,
      hora: p.hora || '',
      servicios: p.servicios || [],
      monto: Number(p.monto) || 0,
      metodoPago: p.metodo_pago || 'efectivo',
    }))
  } catch {
    return []
  }
}

// ─── Gift card activa de un cliente ────────────────────────────────────────
export async function getGiftCardActivaClienteFromDB(
  clienteId: string
): Promise<GiftCardValidada | null> {
  try {
    // .maybeSingle() no lanza error cuando hay 0 filas (a diferencia de .single())
    const { data, error } = await (supabase as any)
      .from('gift_cards')
      .select('id, codigo, saldo_actual')
      .eq('cliente_id', clienteId)
      .eq('estado', 'activa')
      .gt('saldo_actual', 0)
      .order('saldo_actual', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !data) return null

    return { id: data.id, codigo: data.codigo, saldoActual: Number(data.saldo_actual) }
  } catch {
    return null
  }
}

// ─── Balance pendiente de citas no pagadas de un cliente ───────────────────
export async function getSaldoPendienteClienteFromDB(
  clienteId: string
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('citas')
      .select('precio')
      .eq('cliente_id', clienteId)
      .eq('estado', 'completada')
      .eq('pagado', false)

    if (error || !data) return 0

    return data.reduce((sum: number, c: any) => sum + (Number(c.precio) || 0), 0)
  } catch {
    return 0
  }
}

// ─── Resumen de caja del día actual ────────────────────────────────────────
export async function getResumenCajaDiarioFromDB(
  sucursalId?: string,
  fecha?: string
): Promise<ResumenCajaDiario> {
  const fechaConsulta = fecha ?? new Date().toISOString().split('T')[0]

  const vacio: ResumenCajaDiario = {
    fecha: fechaConsulta,
    totalVentas: 0,
    cantidadTransacciones: 0,
    ticketPromedio: 0,
    totalPropinas: 0,
    totalDescuentos: 0,
    porMetodo: { efectivo: 0, tarjeta: 0, transferencia: 0, otro: 0 },
    porMetodoCantidad: { efectivo: 0, tarjeta: 0, transferencia: 0, otro: 0 },
  }

  try {
    let query = supabase
      .from('pagos')
      .select('monto, metodo_pago, propina, descuento_monto')
      .eq('fecha', fechaConsulta)
      .eq('estado', 'completado')

    if (sucursalId) query = query.eq('sucursal_id', sucursalId)

    const { data, error } = await query
    if (error || !data) return vacio

    const resumen: ResumenCajaDiario = { ...vacio }
    resumen.cantidadTransacciones = data.length

    for (const p of data as any[]) {
      const monto = Number(p.monto) || 0
      const metodo = (p.metodo_pago || 'otro') as keyof ResumenCajaDiario['porMetodo']
      resumen.totalVentas += monto
      resumen.totalPropinas += Number(p.propina) || 0
      resumen.totalDescuentos += Number(p.descuento_monto) || 0
      if (metodo in resumen.porMetodo) {
        resumen.porMetodo[metodo] += monto
        resumen.porMetodoCantidad[metodo] += 1
      } else {
        resumen.porMetodo.otro += monto
        resumen.porMetodoCantidad.otro += 1
      }
    }

    resumen.ticketPromedio = resumen.cantidadTransacciones > 0
      ? resumen.totalVentas / resumen.cantidadTransacciones
      : 0

    return resumen
  } catch {
    return vacio
  }
}

// ─── Resumen comparativo ayer vs hoy ───────────────────────────────────────
export async function getResumenCajaAyerFromDB(
  sucursalId?: string
): Promise<Pick<ResumenCajaDiario, 'totalVentas' | 'cantidadTransacciones' | 'ticketPromedio'>> {
  const ayerDate = new Date(Date.now() - 86400000)
  const ayer = `${ayerDate.getFullYear()}-${String(ayerDate.getMonth() + 1).padStart(2, "0")}-${String(ayerDate.getDate()).padStart(2, "0")}`
  try {
    let query = supabase
      .from('pagos')
      .select('monto')
      .eq('fecha', ayer)
      .eq('estado', 'completado')
    if (sucursalId) query = query.eq('sucursal_id', sucursalId)
    const { data } = await query
    if (!data) return { totalVentas: 0, cantidadTransacciones: 0, ticketPromedio: 0 }
    const totalVentas = data.reduce((s: number, p: any) => s + (Number(p.monto) || 0), 0)
    const cantidadTransacciones = data.length
    return {
      totalVentas,
      cantidadTransacciones,
      ticketPromedio: cantidadTransacciones > 0 ? totalVentas / cantidadTransacciones : 0,
    }
  } catch {
    return { totalVentas: 0, cantidadTransacciones: 0, ticketPromedio: 0 }
  }
}

// ─── Actualizar un pago existente ──────────────────────────────────────────
export async function updatePago(
  pagoId: string,
  datos: {
    propina?: number
    notas?: string
    referencia?: string
    metodo_pago?: string
    monto_efectivo?: number
    monto_tarjeta?: number
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('pagos')
      .update({ ...datos, updated_at: new Date().toISOString() })
      .eq('id', pagoId)
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error desconocido' }
  }
}
