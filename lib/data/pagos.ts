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
