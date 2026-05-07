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

/** Actualiza una sucursal existente */
export async function updateSucursal(
  id: string,
  datos: {
    nombre: string
    direccion: string
    telefono: string
    email: string
    horario?: string | null
    ciudad?: string | null
    pais?: string | null
    activa?: boolean
  },
): Promise<{ success: boolean; error?: string }> {
  try {
    const patch: Record<string, unknown> = {
      nombre: datos.nombre.trim(),
      direccion: datos.direccion.trim(),
      telefono: datos.telefono.trim(),
      email: datos.email.trim(),
      horario: datos.horario?.trim() || null,
      ciudad: datos.ciudad?.trim() || null,
      pais: datos.pais?.trim() || 'México',
    }
    if (datos.activa !== undefined) {
      patch.activa = datos.activa
    }

    const { error } = await supabase.from('sucursales').update(patch).eq('id', id)

    if (error) {
      console.error('Error actualizando sucursal:', error)
      return { success: false, error: error.message }
    }
    return { success: true }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido'
    console.error('Error inesperado actualizando sucursal:', error)
    return { success: false, error: msg }
  }
}

/** Devuelve true si hay registros que impedirían un borrado seguro sin efectos en cascada */
async function sucursalTieneDependencias(id: string): Promise<boolean> {
  const tablas = ["empleados", "citas", "pagos"] as const
  for (const tabla of tablas) {
    const { count, error } = await supabase
      .from(tabla)
      .select("id", { count: "exact", head: true })
      .eq("sucursal_id", id)

    if (error) {
      console.warn(`No se pudo verificar ${tabla}:`, error.message)
      continue
    }
    if ((count ?? 0) > 0) return true
  }
  return false
}

/**
 * Quita una sucursal del uso activo.
 * Si no tiene empleados ni citas ni pagos enlazados, se borra el registro.
 * Si tiene datos asociados, solo se marca como inactiva (evita borrados en cascada destructivos).
 */
export async function deleteSucursal(id: string): Promise<{
  success: boolean
  error?: string
  mode?: "deleted" | "deactivated"
}> {
  try {
    const tieneDeps = await sucursalTieneDependencias(id)

    if (tieneDeps) {
      const { error } = await supabase.from("sucursales").update({ activa: false }).eq("id", id)
      if (!error) {
        return { success: true, mode: "deactivated" }
      }
      console.error("Error desactivando sucursal:", error)
      return { success: false, error: error.message }
    }

    const { error } = await supabase.from("sucursales").delete().eq("id", id)

    if (!error) {
      return { success: true, mode: "deleted" }
    }

    const code = "code" in error ? String((error as { code?: string }).code) : ""
    const msg = (error.message || "").toLowerCase()
    const fkBlocked =
      code === "23503" ||
      msg.includes("foreign key") ||
      msg.includes("violates foreign key constraint") ||
      msg.includes("still referenced") ||
      msg.includes("referencia")

    if (fkBlocked) {
      const { error: uErr } = await supabase.from("sucursales").update({ activa: false }).eq("id", id)
      if (!uErr) {
        return { success: true, mode: "deactivated" }
      }
      console.error("Error desactivando sucursal tras FK:", uErr)
      return {
        success: false,
        error:
          uErr.message ||
          "No se puede borrar esta sucursal porque tiene registros asociados; tampoco se pudo desactivar.",
      }
    }

    console.error("Error eliminando sucursal:", error)
    return { success: false, error: error.message }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error desconocido"
    console.error("Error inesperado eliminando sucursal:", error)
    return { success: false, error: msg }
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
