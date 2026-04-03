// Mock data for sucursales (branches)

export interface Sucursal {
  id: string
  nombre: string
  direccion: string
  telefono: string
  email: string
  horario: string
  activa: boolean
  ciudad: string
  pais: string
}

export const MOCK_SUCURSALES: Sucursal[] = [
  {
    id: "1",
    nombre: "Luna27 Carrizalejo",
    direccion: "Carrizalejo, Monterrey",
    telefono: "+52 81 1234 5601",
    email: "carrizalejo@luna27.com",
    horario: "Lun-Sab: 9:00 - 20:00",
    activa: true,
    ciudad: "Monterrey",
    pais: "México",
  },
  {
    id: "2",
    nombre: "Luna27 La Aurora",
    direccion: "La Aurora, Monterrey",
    telefono: "+52 81 1234 5602",
    email: "laaurora@luna27.com",
    horario: "Lun-Sab: 9:00 - 20:00",
    activa: true,
    ciudad: "Monterrey",
    pais: "México",
  },
  {
    id: "3",
    nombre: "Luna27 Serena",
    direccion: "Serena, Monterrey",
    telefono: "+52 81 1234 5603",
    email: "serena@luna27.com",
    horario: "Lun-Sab: 9:00 - 20:00",
    activa: true,
    ciudad: "Monterrey",
    pais: "México",
  },
  {
    id: "4",
    nombre: "Luna27 Paseo Tec",
    direccion: "Paseo Tec, Monterrey",
    telefono: "+52 81 1234 5604",
    email: "paseotec@luna27.com",
    horario: "Lun-Sab: 9:00 - 20:00",
    activa: true,
    ciudad: "Monterrey",
    pais: "México",
  },
  {
    id: "5",
    nombre: "Luna27 Las Villas",
    direccion: "Las Villas, Monterrey",
    telefono: "+52 81 1234 5605",
    email: "lasvillas@luna27.com",
    horario: "Lun-Sab: 9:00 - 20:00",
    activa: true,
    ciudad: "Monterrey",
    pais: "México",
  },
  {
    id: "6",
    nombre: "Luna27 Park Point",
    direccion: "Park Point, Monterrey",
    telefono: "+52 81 1234 5606",
    email: "parkpoint@luna27.com",
    horario: "Lun-Sab: 9:00 - 20:00",
    activa: true,
    ciudad: "Monterrey",
    pais: "México",
  },
  {
    id: "7",
    nombre: "Luna27 Cumbres del Sol",
    direccion: "Cumbres del Sol, Monterrey",
    telefono: "+52 81 1234 5607",
    email: "cumbresdelsol@luna27.com",
    horario: "Lun-Sab: 9:00 - 20:00",
    activa: true,
    ciudad: "Monterrey",
    pais: "México",
  },
  {
    id: "8",
    nombre: "Luna27 Fundadores",
    direccion: "Fundadores, Monterrey",
    telefono: "+52 81 1234 5608",
    email: "fundadores@luna27.com",
    horario: "Lun-Sab: 9:00 - 20:00",
    activa: true,
    ciudad: "Monterrey",
    pais: "México",
  },
  {
    id: "9",
    nombre: "Luna27 Chepe Vera",
    direccion: "Chepe Vera, Monterrey",
    telefono: "+52 81 1234 5609",
    email: "chepevera@luna27.com",
    horario: "Lun-Sab: 9:00 - 20:00",
    activa: true,
    ciudad: "Monterrey",
    pais: "México",
  },
  {
    id: "10",
    nombre: "Luna27 Vía La Luz",
    direccion: "Vía La Luz, Monterrey",
    telefono: "+52 81 1234 5610",
    email: "vialaluz@luna27.com",
    horario: "Lun-Sab: 9:00 - 20:00",
    activa: true,
    ciudad: "Monterrey",
    pais: "México",
  },
  {
    id: "11",
    nombre: "Luna27 Amazonas San Jerónimo",
    direccion: "Amazonas San Jerónimo, Monterrey",
    telefono: "+52 81 1234 5611",
    email: "amazonas@luna27.com",
    horario: "Lun-Sab: 9:00 - 20:00",
    activa: true,
    ciudad: "Monterrey",
    pais: "México",
  },
]

export function getSucursalById(id: string): Sucursal | undefined {
  return MOCK_SUCURSALES.find((s) => s.id === id)
}

export function getSucursalesActivas(): Sucursal[] {
  return MOCK_SUCURSALES.filter((s) => s.activa)
}

// ============================================
// Funciones para Supabase
// ============================================

import { supabase } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'

type SucursalRow = Database['public']['Tables']['sucursales']['Row']

// Función helper para transformar datos de la BD al formato de la interfaz
function transformSucursal(sucursal: SucursalRow): Sucursal {
  return {
    id: sucursal.id,
    nombre: sucursal.nombre,
    direccion: sucursal.direccion,
    telefono: sucursal.telefono,
    email: sucursal.email,
    horario: sucursal.horario || '',
    activa: sucursal.activa,
    ciudad: sucursal.ciudad || '',
    pais: sucursal.pais || 'México',
  }
}

// Crear sucursal
export async function createSucursal(datos: {
  nombre: string
  direccion: string
  telefono: string
  email: string
  horario?: string | null
  ciudad?: string | null
  pais?: string | null
  activa?: boolean
}): Promise<{ success: boolean; sucursal?: SucursalRow; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('sucursales')
      .insert({
        nombre: datos.nombre.trim(),
        direccion: datos.direccion.trim(),
        telefono: datos.telefono.trim(),
        email: datos.email.trim(),
        horario: datos.horario?.trim() || null,
        ciudad: datos.ciudad?.trim() || null,
        pais: datos.pais?.trim() || 'México',
        activa: datos.activa ?? true,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creando sucursal:', error)
      return { success: false, error: error.message }
    }
    return { success: true, sucursal: data }
  } catch (error: any) {
    console.error('Error inesperado creando sucursal:', error)
    return { success: false, error: error.message || 'Error desconocido' }
  }
}

// Obtener todas las sucursales activas desde Supabase
export async function getSucursalesActivasFromDB(): Promise<Sucursal[]> {
  try {
    const { data, error } = await supabase
      .from('sucursales')
      .select('*')
      .eq('activa', true)
      .order('nombre')

    if (error) {
      console.error('Error obteniendo sucursales:', error)
      return []
    }

    return data.map(transformSucursal)
  } catch (error) {
    console.error('Error inesperado obteniendo sucursales:', error)
    return []
  }
}

// Obtener varias sucursales por lista de IDs
export async function getSucursalesByIdsFromDB(ids: string[]): Promise<Sucursal[]> {
  if (!ids || ids.length === 0) return []
  try {
    const { data, error } = await supabase
      .from('sucursales')
      .select('*')
      .in('id', ids)
      .eq('activa', true)
      .order('nombre')

    if (error) {
      console.error('Error obteniendo sucursales por IDs:', error)
      return []
    }

    return data.map(transformSucursal)
  } catch (error) {
    console.error('Error inesperado obteniendo sucursales por IDs:', error)
    return []
  }
}

// Obtener una sucursal por ID desde Supabase
export async function getSucursalByIdFromDB(id: string): Promise<Sucursal | null> {
  try {
    const { data, error } = await supabase
      .from('sucursales')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error obteniendo sucursal:', error)
      return null
    }

    return transformSucursal(data)
  } catch (error) {
    console.error('Error inesperado obteniendo sucursal:', error)
    return null
  }
}
