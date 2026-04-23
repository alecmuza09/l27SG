// Mock data for appointments

export interface Cita {
  id: string
  clienteId: string
  clienteNombre: string
  empleadoId: string
  empleadoNombre: string
  servicioId: string
  servicioNombre: string
  sucursalId: string
  fecha: string
  horaInicio: string
  horaFin: string
  duracion: number
  precio: number
  estado: "pendiente" | "confirmada" | "en-progreso" | "completada" | "cancelada" | "no-asistio"
  notas?: string
  metodoPago?: string
  pagado: boolean
  // Auditoría
  createdAt?: string
  updatedAt?: string
  creadoPor?: string
  modificadoPor?: string
}

// Marcador interno para guardar auditoría dentro del campo notas
const META_PREFIX = "||CITA_META||"

interface CitaMeta {
  creadoPor?: string
  modificadoPor?: string
}

/** Extrae la metadata de auditoría del campo notas y devuelve {notas limpias, meta} */
function parsearNotasMeta(rawNotas: string | null): { notas?: string; creadoPor?: string; modificadoPor?: string } {
  if (!rawNotas) return {}

  const parseMeta = (jsonStr: string) => {
    try {
      const meta: CitaMeta = JSON.parse(jsonStr)
      return { creadoPor: meta.creadoPor, modificadoPor: meta.modificadoPor }
    } catch {
      return {}
    }
  }

  // Caso 1: toda la cadena ES el marcador (sin notas de usuario)
  if (rawNotas.startsWith(META_PREFIX)) {
    return { notas: undefined, ...parseMeta(rawNotas.slice(META_PREFIX.length)) }
  }

  // Caso 2: el marcador va al final, separado por \n
  const idx = rawNotas.lastIndexOf(`\n${META_PREFIX}`)
  if (idx === -1) return { notas: rawNotas.trim() || undefined }

  const notas = rawNotas.slice(0, idx).trim() || undefined
  return { notas, ...parseMeta(rawNotas.slice(idx + 1 + META_PREFIX.length)) }
}

/** Construye el valor de notas embebiendo metadata de auditoría al final */
export function construirNotasConMeta(
  notas: string | undefined,
  meta: CitaMeta,
): string | null {
  const base = notas?.trim() ?? ""
  const hayMeta = meta.creadoPor || meta.modificadoPor
  if (!hayMeta) return base || null
  // Si no hay notas de usuario, el marcador ocupa toda la cadena (sin \n inicial)
  const metaStr = `${META_PREFIX}${JSON.stringify(meta)}`
  return base ? `${base}\n${metaStr}` : metaStr
}

export const MOCK_CITAS: Cita[] = [
  {
    id: "1",
    clienteId: "1",
    clienteNombre: "Ana García",
    empleadoId: "1",
    empleadoNombre: "María González",
    servicioId: "1",
    servicioNombre: "Masaje Relajante",
    sucursalId: "1",
    fecha: "2024-01-18",
    horaInicio: "10:00",
    horaFin: "11:00",
    duracion: 60,
    precio: 850,
    estado: "confirmada",
    pagado: false,
  },
  {
    id: "2",
    clienteId: "2",
    clienteNombre: "Carlos López",
    empleadoId: "2",
    empleadoNombre: "Laura Martínez",
    servicioId: "2",
    servicioNombre: "Facial Hidratante",
    sucursalId: "1",
    fecha: "2024-01-18",
    horaInicio: "11:30",
    horaFin: "12:15",
    duracion: 45,
    precio: 650,
    estado: "confirmada",
    pagado: false,
  },
  {
    id: "3",
    clienteId: "3",
    clienteNombre: "Sofia Martínez",
    empleadoId: "3",
    empleadoNombre: "Carmen López",
    servicioId: "3",
    servicioNombre: "Manicure & Pedicure",
    sucursalId: "1",
    fecha: "2024-01-18",
    horaInicio: "13:00",
    horaFin: "14:30",
    duracion: 90,
    precio: 750,
    estado: "pendiente",
    pagado: false,
  },
  {
    id: "4",
    clienteId: "4",
    clienteNombre: "Roberto Díaz",
    empleadoId: "1",
    empleadoNombre: "María González",
    servicioId: "4",
    servicioNombre: "Tratamiento Corporal",
    sucursalId: "1",
    fecha: "2024-01-18",
    horaInicio: "14:30",
    horaFin: "16:00",
    duracion: 90,
    precio: 1200,
    estado: "confirmada",
    pagado: false,
  },
  {
    id: "5",
    clienteId: "5",
    clienteNombre: "Laura Hernández",
    empleadoId: "2",
    empleadoNombre: "Laura Martínez",
    servicioId: "1",
    servicioNombre: "Masaje Relajante",
    sucursalId: "1",
    fecha: "2024-01-18",
    horaInicio: "16:00",
    horaFin: "17:00",
    duracion: 60,
    precio: 850,
    estado: "confirmada",
    pagado: true,
    metodoPago: "tarjeta",
  },
  {
    id: "6",
    clienteId: "1",
    clienteNombre: "Ana García",
    empleadoId: "3",
    empleadoNombre: "Carmen López",
    servicioId: "5",
    servicioNombre: "Aromaterapia",
    sucursalId: "1",
    fecha: "2024-01-19",
    horaInicio: "10:00",
    horaFin: "11:30",
    duracion: 90,
    precio: 1100,
    estado: "confirmada",
    pagado: false,
  },
]

export function getCitasByDate(fecha: string): Cita[] {
  return MOCK_CITAS.filter((c) => c.fecha === fecha)
}

export function getCitasByEmpleado(empleadoId: string, fecha?: string): Cita[] {
  return MOCK_CITAS.filter((c) => c.empleadoId === empleadoId && (!fecha || c.fecha === fecha))
}

export function getCitaById(id: string): Cita | undefined {
  return MOCK_CITAS.find((c) => c.id === id)
}

// ============================================
// Funciones para Supabase
// ============================================

import { supabase } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'

type CitaRow = Database['public']['Tables']['citas']['Row']

// Función helper para calcular hora_fin basado en hora_inicio y duracion
function calcularHoraFin(horaInicio: string, duracionMinutos: number): string {
  const [horas, minutos] = horaInicio.split(':').map(Number)
  const fechaInicio = new Date()
  fechaInicio.setHours(horas, minutos, 0, 0)
  fechaInicio.setMinutes(fechaInicio.getMinutes() + duracionMinutos)
  
  const horasFin = fechaInicio.getHours().toString().padStart(2, '0')
  const minutosFin = fechaInicio.getMinutes().toString().padStart(2, '0')
  return `${horasFin}:${minutosFin}`
}

// Crear una nueva cita
export async function createCita(citaData: {
  cliente_id: string
  empleado_id: string
  servicio_id: string
  sucursal_id: string
  fecha: string
  hora_inicio: string
  duracion: number
  precio: number
  estado?: 'pendiente' | 'confirmada' | 'en-progreso' | 'completada' | 'cancelada' | 'no-asistio'
  notas?: string
  creadoPor?: string
}): Promise<{ success: boolean; cita?: CitaRow; error?: string }> {
  try {
    const hora_fin = calcularHoraFin(citaData.hora_inicio, citaData.duracion)

    const { data, error } = await supabase
      .from('citas')
      .insert({
        cliente_id: citaData.cliente_id,
        empleado_id: citaData.empleado_id,
        servicio_id: citaData.servicio_id,
        sucursal_id: citaData.sucursal_id,
        fecha: citaData.fecha,
        hora_inicio: citaData.hora_inicio,
        hora_fin: hora_fin,
        duracion: citaData.duracion,
        precio: citaData.precio,
        estado: citaData.estado || 'pendiente',
        notas: construirNotasConMeta(citaData.notas, { creadoPor: citaData.creadoPor }),
      })
      .select()
      .single()

    if (error) {
      console.error('Error creando cita:', error)
      return { success: false, error: error.message }
    }

    return { success: true, cita: data }
  } catch (error: any) {
    console.error('Error inesperado creando cita:', error)
    return { success: false, error: error.message || 'Error desconocido' }
  }
}

// Función helper para normalizar formato de hora (HH:MM:SS -> HH:MM)
function normalizarHora(hora: string): string {
  if (!hora) return ''
  // Si tiene segundos, removerlos
  if (hora.includes(':') && hora.split(':').length === 3) {
    return hora.substring(0, 5) // Toma solo HH:MM
  }
  return hora
}

// Función helper para transformar datos de la BD al formato de la interfaz
function transformCita(cita: CitaRow, cliente?: { nombre: string; apellido: string }, servicio?: { nombre: string }, empleado?: { nombre: string; apellido: string }): Cita {
  const { notas, creadoPor, modificadoPor } = parsearNotasMeta(cita.notas)
  return {
    id: cita.id,
    clienteId: cita.cliente_id,
    clienteNombre: cliente ? `${cliente.nombre} ${cliente.apellido}` : 'Cliente desconocido',
    empleadoId: cita.empleado_id,
    empleadoNombre: empleado ? `${empleado.nombre} ${empleado.apellido}` : 'Empleado desconocido',
    servicioId: cita.servicio_id,
    servicioNombre: servicio?.nombre || 'Servicio desconocido',
    sucursalId: cita.sucursal_id,
    fecha: cita.fecha,
    horaInicio: normalizarHora(cita.hora_inicio),
    horaFin: normalizarHora(cita.hora_fin),
    duracion: cita.duracion,
    precio: Number(cita.precio),
    estado: cita.estado,
    notas,
    metodoPago: cita.metodo_pago || undefined,
    pagado: cita.pagado,
    createdAt: cita.created_at || undefined,
    updatedAt: cita.updated_at || undefined,
    creadoPor,
    modificadoPor,
  }
}

// Obtener citas por fecha y sucursal desde Supabase
export async function getCitasByDateAndSucursalFromDB(fecha: string, sucursalId: string): Promise<Cita[]> {
  try {
    const { data, error } = await supabase
      .from('citas')
      .select(`
        *,
        cliente:clientes(nombre, apellido),
        servicio:servicios(nombre),
        empleado:empleados(nombre, apellido)
      `)
      .eq('fecha', fecha)
      .eq('sucursal_id', sucursalId)
      .order('hora_inicio')

    if (error) {
      console.error('Error obteniendo citas:', error)
      return []
    }

    if (!data) return []

    return data.map((cita: any) => 
      transformCita(
        cita,
        cita.cliente,
        cita.servicio,
        cita.empleado
      )
    )
  } catch (error) {
    console.error('Error inesperado obteniendo citas:', error)
    return []
  }
}

// Obtener citas por empleado y fecha desde Supabase
export async function getCitasByEmpleadoAndDateFromDB(empleadoId: string, fecha: string): Promise<Cita[]> {
  try {
    const { data, error } = await supabase
      .from('citas')
      .select(`
        *,
        cliente:clientes(nombre, apellido),
        servicio:servicios(nombre),
        empleado:empleados(nombre, apellido)
      `)
      .eq('empleado_id', empleadoId)
      .eq('fecha', fecha)
      .order('hora_inicio')

    if (error) {
      console.error('Error obteniendo citas:', error)
      return []
    }

    if (!data) return []

    return data.map((cita: any) => 
      transformCita(
        cita,
        cita.cliente,
        cita.servicio,
        cita.empleado
      )
    )
  } catch (error) {
    console.error('Error inesperado obteniendo citas:', error)
    return []
  }
}

// Obtener citas por cliente desde Supabase
export async function getCitasByClienteIdFromDB(clienteId: string): Promise<Cita[]> {
  try {
    const { data, error } = await supabase
      .from('citas')
      .select(`
        *,
        cliente:clientes(nombre, apellido),
        servicio:servicios(nombre),
        empleado:empleados(nombre, apellido)
      `)
      .eq('cliente_id', clienteId)
      .order('fecha', { ascending: false })
      .order('hora_inicio', { ascending: false })

    if (error) {
      console.error('Error obteniendo citas del cliente:', error)
      return []
    }

    if (!data) return []

    return data.map((cita: any) => 
      transformCita(
        cita,
        cita.cliente,
        cita.servicio,
        cita.empleado
      )
    )
  } catch (error) {
    console.error('Error inesperado obteniendo citas del cliente:', error)
    return []
  }
}

// Actualizar estado de una cita (usa estados de la BD: pendiente, confirmada, en-progreso, completada, cancelada, no-asistio)
// pagado: true cuando el estado UI es "pagado" (completada + pagado=true), false para "pendiente-por-pagar"
export async function updateCitaEstado(
  citaId: string,
  nuevoEstado: 'pendiente' | 'confirmada' | 'en-progreso' | 'completada' | 'cancelada' | 'no-asistio',
  pagado?: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const updateData: any = { 
      estado: nuevoEstado,
      updated_at: new Date().toISOString()
    }
    if (pagado !== undefined) updateData.pagado = pagado

    const { error } = await supabase
      .from('citas')
      .update(updateData)
      .eq('id', citaId)

    if (error) {
      console.error('Error actualizando estado de cita:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error inesperado actualizando estado:', error)
    return { success: false, error: error.message || 'Error desconocido' }
  }
}

// Actualizar una cita completa
export async function updateCita(
  citaId: string,
  datos: {
    fecha?: string
    hora_inicio?: string
    duracion?: number
    servicio_id?: string
    empleado_id?: string
    sucursal_id?: string
    precio?: number
    notas?: string
    estado?: 'pendiente' | 'confirmada' | 'en-progreso' | 'completada' | 'cancelada' | 'no-asistio'
    // Auditoría: nombre del creador original (para preservarlo) y del editor actual
    creadoPor?: string
    modificadoPor?: string
  }
): Promise<{ success: boolean; cita?: CitaRow; error?: string }> {
  try {
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (datos.fecha) updateData.fecha = datos.fecha
    if (datos.hora_inicio) {
      updateData.hora_inicio = datos.hora_inicio
      if (datos.duracion) {
        updateData.hora_fin = calcularHoraFin(datos.hora_inicio, datos.duracion)
      }
    }
    if (datos.duracion) updateData.duracion = datos.duracion
    if (datos.servicio_id) updateData.servicio_id = datos.servicio_id
    if (datos.empleado_id) updateData.empleado_id = datos.empleado_id
    if (datos.sucursal_id) updateData.sucursal_id = datos.sucursal_id
    if (datos.precio !== undefined) updateData.precio = datos.precio
    if (datos.estado) updateData.estado = datos.estado

    // Reconstruir notas preservando la meta de auditoría (creadoPor original + modificadoPor nuevo)
    if (datos.notas !== undefined || datos.creadoPor !== undefined || datos.modificadoPor !== undefined) {
      updateData.notas = construirNotasConMeta(datos.notas, {
        creadoPor: datos.creadoPor,
        modificadoPor: datos.modificadoPor,
      })
    }

    const { data, error } = await supabase
      .from('citas')
      .update(updateData)
      .eq('id', citaId)
      .select()
      .single()

    if (error) {
      console.error('Error actualizando cita:', error)
      return { success: false, error: error.message }
    }

    return { success: true, cita: data }
  } catch (error: any) {
    console.error('Error inesperado actualizando cita:', error)
    return { success: false, error: error.message || 'Error desconocido' }
  }
}
