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
        notas: citaData.notas || null,
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
