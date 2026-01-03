/**
 * Ejemplos de uso del cliente de Supabase
 * Estos son ejemplos de referencia para usar en la aplicación
 */

import { supabase } from './client'

// ============================================
// EJEMPLO: Obtener todas las sucursales activas
// ============================================
export async function getSucursalesActivas() {
  const { data, error } = await supabase
    .from('sucursales')
    .select('*')
    .eq('activa', true)
    .order('nombre')

  if (error) {
    console.error('Error obteniendo sucursales:', error)
    return []
  }

  return data
}

// ============================================
// EJEMPLO: Obtener un cliente por ID
// ============================================
export async function getClienteById(id: string) {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error obteniendo cliente:', error)
    return null
  }

  return data
}

// ============================================
// EJEMPLO: Buscar clientes por nombre o email
// ============================================
export async function buscarClientes(query: string) {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .or(`nombre.ilike.%${query}%,apellido.ilike.%${query}%,email.ilike.%${query}%`)
    .limit(20)

  if (error) {
    console.error('Error buscando clientes:', error)
    return []
  }

  return data
}

// ============================================
// EJEMPLO: Crear una nueva cita
// ============================================
export async function crearCita(cita: {
  cliente_id: string
  empleado_id: string
  servicio_id: string
  sucursal_id: string
  fecha: string
  hora_inicio: string
  hora_fin: string
  duracion: number
  precio: number
  estado?: 'pendiente' | 'confirmada' | 'en-progreso' | 'completada' | 'cancelada' | 'no-asistio'
  notas?: string
}) {
  const { data, error } = await supabase
    .from('citas')
    .insert(cita)
    .select()
    .single()

  if (error) {
    console.error('Error creando cita:', error)
    return null
  }

  return data
}

// ============================================
// EJEMPLO: Obtener citas de un empleado en una fecha
// ============================================
export async function getCitasPorEmpleadoYFecha(empleadoId: string, fecha: string) {
  const { data, error } = await supabase
    .from('citas')
    .select(`
      *,
      cliente:clientes(*),
      servicio:servicios(*),
      sucursal:sucursales(*)
    `)
    .eq('empleado_id', empleadoId)
    .eq('fecha', fecha)
    .order('hora_inicio')

  if (error) {
    console.error('Error obteniendo citas:', error)
    return []
  }

  return data
}

// ============================================
// EJEMPLO: Obtener empleados de una sucursal
// ============================================
export async function getEmpleadosPorSucursal(sucursalId: string) {
  const { data, error } = await supabase
    .from('empleados')
    .select('*')
    .eq('sucursal_id', sucursalId)
    .eq('activo', true)
    .order('nombre')

  if (error) {
    console.error('Error obteniendo empleados:', error)
    return []
  }

  return data
}

// ============================================
// EJEMPLO: Crear un pago
// ============================================
export async function crearPago(pago: {
  cita_id?: string | null
  cliente_id: string
  empleado_id: string
  sucursal_id: string
  monto: number
  metodo_pago: 'efectivo' | 'tarjeta' | 'transferencia' | 'otro'
  estado?: 'pendiente' | 'completado' | 'reembolsado' | 'cancelado'
  servicios?: string[]
  notas?: string
  referencia?: string
}) {
  const { data, error } = await supabase
    .from('pagos')
    .insert({
      ...pago,
      fecha: new Date().toISOString().split('T')[0],
      hora: new Date().toTimeString().split(' ')[0].slice(0, 5),
    })
    .select()
    .single()

  if (error) {
    console.error('Error creando pago:', error)
    return null
  }

  return data
}

// ============================================
// EJEMPLO: Obtener servicios activos
// ============================================
export async function getServiciosActivos() {
  const { data, error } = await supabase
    .from('servicios')
    .select('*')
    .eq('activo', true)
    .order('categoria', { ascending: true })
    .order('nombre', { ascending: true })

  if (error) {
    console.error('Error obteniendo servicios:', error)
    return []
  }

  return data
}

// ============================================
// EJEMPLO: Actualizar estado de una cita
// ============================================
export async function actualizarEstadoCita(citaId: string, estado: 'pendiente' | 'confirmada' | 'en-progreso' | 'completada' | 'cancelada' | 'no-asistio') {
  const { data, error } = await supabase
    .from('citas')
    .update({ estado })
    .eq('id', citaId)
    .select()
    .single()

  if (error) {
    console.error('Error actualizando cita:', error)
    return null
  }

  return data
}

// ============================================
// EJEMPLO: Obtener inventario bajo stock
// ============================================
export async function getInventarioBajoStock(sucursalId?: string) {
  let query = supabase
    .from('inventario_productos')
    .select('*')
    .eq('activo', true)
    .filter('stock_actual', 'lte', supabase.raw('stock_minimo'))

  if (sucursalId) {
    query = query.eq('sucursal_id', sucursalId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error obteniendo inventario:', error)
    return []
  }

  return data
}





