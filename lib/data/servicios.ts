// Mock data for services

export interface Servicio {
  id: string
  nombre: string
  descripcion: string
  duracion: number
  precio: number
  categoria: string
  activo: boolean
  color?: string
}

export const MOCK_SERVICIOS: Servicio[] = [
  {
    id: "1",
    nombre: "MANI CLÁSICO",
    descripcion: "Manicure clásico con esmaltado tradicional",
    duracion: 60,
    precio: 299,
    categoria: "Manicure",
    activo: true,
    color: "#d4a574",
  },
  {
    id: "2",
    nombre: "Mani Luna",
    descripcion: "Manicure premium con tratamiento especial Luna27",
    duracion: 90,
    precio: 420,
    categoria: "Manicure",
    activo: true,
    color: "#c9986a",
  },
  {
    id: "3",
    nombre: "MANI SPA",
    descripcion: "Manicure spa con exfoliación y masaje de manos",
    duracion: 75,
    precio: 349,
    categoria: "Manicure",
    activo: true,
    color: "#d4a574",
  },
  {
    id: "4",
    nombre: "Mani Vip 4 Lunas",
    descripcion: "Manicure VIP completo con tratamiento de lujo",
    duracion: 120,
    precio: 565,
    categoria: "Manicure",
    activo: true,
    color: "#b8895f",
  },
  {
    id: "5",
    nombre: "Pedi Clásico",
    descripcion: "Pedicure clásico con esmaltado tradicional",
    duracion: 60,
    precio: 420,
    categoria: "Pedicure",
    activo: true,
    color: "#a8956b",
  },
  {
    id: "6",
    nombre: "Pedi Luna",
    descripcion: "Pedicure premium con tratamiento especial Luna27",
    duracion: 90,
    precio: 599,
    categoria: "Pedicure",
    activo: true,
    color: "#9d8a60",
  },
  {
    id: "7",
    nombre: "Pedi Podológico",
    descripcion: "Pedicure podológico especializado para cuidado de pies",
    duracion: 120,
    precio: 679,
    categoria: "Pedicure",
    activo: true,
    color: "#8b7355",
  },
  {
    id: "8",
    nombre: "Pedi Spa",
    descripcion: "Pedicure spa con exfoliación y masaje de pies",
    duracion: 75,
    precio: 499,
    categoria: "Pedicure",
    activo: true,
    color: "#a8956b",
  },
  {
    id: "9",
    nombre: "Pedi Vip 4 Lunas",
    descripcion: "Pedicure VIP completo con tratamiento de lujo",
    duracion: 120,
    precio: 699,
    categoria: "Pedicure",
    activo: true,
    color: "#8b7355",
  },
]

export function getServicioById(id: string): Servicio | undefined {
  return MOCK_SERVICIOS.find((s) => s.id === id)
}

export function getServiciosActivos(): Servicio[] {
  return MOCK_SERVICIOS.filter((s) => s.activo)
}

// ============================================
// Funciones para Supabase
// ============================================

import { supabase } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'

type ServicioRow = Database['public']['Tables']['servicios']['Row']

// Función helper para transformar datos de la BD al formato de la interfaz
function transformServicio(servicio: ServicioRow): Servicio {
  return {
    id: servicio.id,
    nombre: servicio.nombre,
    descripcion: servicio.descripcion || '',
    duracion: servicio.duracion,
    precio: Number(servicio.precio),
    categoria: servicio.categoria,
    activo: servicio.activo,
    color: servicio.color || undefined,
  }
}

// Obtener todos los servicios activos desde Supabase
export async function getServiciosActivosFromDB(): Promise<Servicio[]> {
  try {
    const { data, error } = await supabase
      .from('servicios')
      .select('*')
      .eq('activo', true)
      .order('nombre')

    if (error) {
      console.error('Error obteniendo servicios:', error)
      return []
    }

    return data.map(transformServicio)
  } catch (error) {
    console.error('Error inesperado obteniendo servicios:', error)
    return []
  }
}

// Obtener un servicio por ID desde Supabase
export async function getServicioByIdFromDB(id: string): Promise<Servicio | null> {
  try {
    const { data, error } = await supabase
      .from('servicios')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error obteniendo servicio:', error)
      return null
    }

    return transformServicio(data)
  } catch (error) {
    console.error('Error inesperado obteniendo servicio:', error)
    return null
  }
}

// Actualizar un servicio
export async function updateServicio(
  servicioId: string,
  datos: {
    nombre?: string
    descripcion?: string
    duracion?: number
    precio?: number
    categoria?: string
    color?: string
    activo?: boolean
  }
): Promise<{ success: boolean; servicio?: ServicioRow; error?: string }> {
  try {
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (datos.nombre) updateData.nombre = datos.nombre
    if (datos.descripcion !== undefined) updateData.descripcion = datos.descripcion || null
    if (datos.duracion !== undefined) updateData.duracion = datos.duracion
    if (datos.precio !== undefined) updateData.precio = datos.precio
    if (datos.categoria) updateData.categoria = datos.categoria
    if (datos.color !== undefined) updateData.color = datos.color || null
    if (datos.activo !== undefined) updateData.activo = datos.activo

    const { data, error } = await supabase
      .from('servicios')
      .update(updateData)
      .eq('id', servicioId)
      .select()
      .single()

    if (error) {
      console.error('Error actualizando servicio:', error)
      return { success: false, error: error.message }
    }

    return { success: true, servicio: data }
  } catch (error: any) {
    console.error('Error inesperado actualizando servicio:', error)
    return { success: false, error: error.message || 'Error desconocido' }
  }
}
