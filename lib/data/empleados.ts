// Mock data for employees

export interface Empleado {
  id: string
  nombre: string
  apellido: string
  email: string
  telefono: string
  rol: "terapeuta" | "esteticista" | "recepcionista" | "manager"
  sucursalId: string
  especialidades: string[]
  horarioInicio: string
  horarioFin: string
  diasTrabajo: number[]
  activo: boolean
  comision: number
  foto?: string
}

export const MOCK_EMPLEADOS: Empleado[] = [
  {
    id: "1",
    nombre: "María",
    apellido: "González",
    email: "maria.gonzalez@luna27.com",
    telefono: "+52 55 1111 2222",
    rol: "terapeuta",
    sucursalId: "1",
    especialidades: ["Masaje Relajante", "Masaje Deportivo", "Aromaterapia"],
    horarioInicio: "09:00",
    horarioFin: "18:00",
    diasTrabajo: [1, 2, 3, 4, 5],
    activo: true,
    comision: 40,
  },
  {
    id: "2",
    nombre: "Ana",
    apellido: "Garza",
    email: "ana.garza@luna27.com",
    telefono: "+52 55 2222 3333",
    rol: "esteticista",
    sucursalId: "1",
    especialidades: ["Facial Hidratante", "Tratamiento Corporal"],
    horarioInicio: "10:00",
    horarioFin: "19:00",
    diasTrabajo: [1, 2, 3, 4, 5, 6],
    activo: true,
    comision: 35,
  },
  {
    id: "3",
    nombre: "Gaby",
    apellido: "Pérez",
    email: "gaby.perez@luna27.com",
    telefono: "+52 55 3333 4444",
    rol: "esteticista",
    sucursalId: "1",
    especialidades: ["Manicure & Pedicure", "Facial Hidratante"],
    horarioInicio: "09:00",
    horarioFin: "17:00",
    diasTrabajo: [1, 2, 3, 4, 5],
    activo: true,
    comision: 30,
  },
  {
    id: "4",
    nombre: "Andrea",
    apellido: "Rodríguez",
    email: "andrea.rodriguez@luna27.com",
    telefono: "+52 55 4444 5555",
    rol: "terapeuta",
    sucursalId: "1",
    especialidades: ["Masaje Relajante", "Aromaterapia", "Masaje con Piedras Calientes"],
    horarioInicio: "11:00",
    horarioFin: "20:00",
    diasTrabajo: [2, 3, 4, 5, 6],
    activo: true,
    comision: 40,
  },
  {
    id: "5",
    nombre: "Laura",
    apellido: "Martínez",
    email: "laura.martinez@luna27.com",
    telefono: "+52 55 5555 6666",
    rol: "terapeuta",
    sucursalId: "2",
    especialidades: ["Masaje Deportivo", "Reflexología"],
    horarioInicio: "09:00",
    horarioFin: "18:00",
    diasTrabajo: [1, 2, 3, 4, 5],
    activo: true,
    comision: 40,
  },
]

export function getEmpleadoById(id: string): Empleado | undefined {
  return MOCK_EMPLEADOS.find((e) => e.id === id)
}

export function getEmpleadosBySucursal(sucursalId: string): Empleado[] {
  return MOCK_EMPLEADOS.filter((e) => e.sucursalId === sucursalId && e.activo)
}

// ============================================
// Funciones para Supabase
// ============================================

import { supabase } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'

type EmpleadoRow = Database['public']['Tables']['empleados']['Row']
type EmpleadoUpdate = Database['public']['Tables']['empleados']['Update']

// Función helper para transformar datos de la BD al formato de la interfaz
function transformEmpleado(empleado: EmpleadoRow): Empleado {
  return {
    id: empleado.id,
    nombre: empleado.nombre,
    apellido: empleado.apellido,
    email: empleado.email,
    telefono: empleado.telefono,
    rol: empleado.rol as "terapeuta" | "esteticista" | "recepcionista" | "manager",
    sucursalId: empleado.sucursal_id,
    especialidades: empleado.especialidades || [],
    horarioInicio: empleado.horario_inicio,
    horarioFin: empleado.horario_fin,
    diasTrabajo: empleado.dias_trabajo || [],
    activo: empleado.activo,
    comision: Number(empleado.comision),
    foto: empleado.foto || undefined,
  }
}

// Obtener todos los empleados desde Supabase (solo activos por defecto)
export async function getEmpleadosFromDB(includeEliminados: boolean = false): Promise<Empleado[]> {
  try {
    let query = supabase
      .from('empleados')
      .select('*')
      .order('nombre')

    if (!includeEliminados) {
      query = query.eq('activo', true)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error obteniendo empleados:', error)
      return []
    }

    return data.map(transformEmpleado)
  } catch (error) {
    console.error('Error inesperado obteniendo empleados:', error)
    return []
  }
}

// Obtener solo empleados eliminados (activo = false)
export async function getEmpleadosEliminadosFromDB(): Promise<Empleado[]> {
  try {
    const { data, error } = await supabase
      .from('empleados')
      .select('*')
      .eq('activo', false)
      .order('nombre')

    if (error) {
      console.error('Error obteniendo empleados eliminados:', error)
      return []
    }

    return data.map(transformEmpleado)
  } catch (error) {
    console.error('Error inesperado obteniendo empleados eliminados:', error)
    return []
  }
}

// Obtener empleados activos por sucursal desde Supabase
export async function getEmpleadosBySucursalFromDB(sucursalId: string): Promise<Empleado[]> {
  try {
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

    return data.map(transformEmpleado)
  } catch (error) {
    console.error('Error inesperado obteniendo empleados:', error)
    return []
  }
}

// Obtener un empleado por ID desde Supabase
export async function getEmpleadoByIdFromDB(id: string): Promise<Empleado | null> {
  try {
    const { data, error } = await supabase
      .from('empleados')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error obteniendo empleado:', error)
      return null
    }

    return transformEmpleado(data)
  } catch (error) {
    console.error('Error inesperado obteniendo empleado:', error)
    return null
  }
}

// Eliminar empleado (soft delete - marcar como inactivo)
export async function eliminarEmpleado(empleadoId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('empleados')
      .update({ 
        activo: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', empleadoId)

    if (error) {
      console.error('Error eliminando empleado:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error inesperado eliminando empleado:', error)
    return { success: false, error: error.message || 'Error desconocido' }
  }
}

// Restaurar empleado (marcar como activo)
export async function restaurarEmpleado(empleadoId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('empleados')
      .update({ 
        activo: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', empleadoId)

    if (error) {
      console.error('Error restaurando empleado:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error inesperado restaurando empleado:', error)
    return { success: false, error: error.message || 'Error desconocido' }
  }
}

// Actualizar empleado
export async function updateEmpleado(
  empleadoId: string,
  datos: {
    nombre?: string
    apellido?: string
    email?: string
    telefono?: string
    rol?: 'terapeuta' | 'esteticista' | 'recepcionista' | 'manager'
    sucursal_id?: string
    especialidades?: string[]
    horario_inicio?: string
    horario_fin?: string
    dias_trabajo?: number[]
    comision?: number
    activo?: boolean
  }
): Promise<{ success: boolean; empleado?: EmpleadoRow; error?: string }> {
  try {
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (datos.nombre) updateData.nombre = datos.nombre
    if (datos.apellido) updateData.apellido = datos.apellido
    if (datos.email) updateData.email = datos.email
    if (datos.telefono) updateData.telefono = datos.telefono
    if (datos.rol) updateData.rol = datos.rol
    if (datos.sucursal_id) updateData.sucursal_id = datos.sucursal_id
    if (datos.especialidades !== undefined) updateData.especialidades = datos.especialidades
    if (datos.horario_inicio) updateData.horario_inicio = datos.horario_inicio
    if (datos.horario_fin) updateData.horario_fin = datos.horario_fin
    if (datos.dias_trabajo !== undefined) updateData.dias_trabajo = datos.dias_trabajo
    if (datos.comision !== undefined) updateData.comision = datos.comision
    if (datos.activo !== undefined) updateData.activo = datos.activo

    const { data, error } = await supabase
      .from('empleados')
      .update(updateData)
      .eq('id', empleadoId)
      .select()
      .single()

    if (error) {
      console.error('Error actualizando empleado:', error)
      return { success: false, error: error.message }
    }

    return { success: true, empleado: data }
  } catch (error: any) {
    console.error('Error inesperado actualizando empleado:', error)
    return { success: false, error: error.message || 'Error desconocido' }
  }
}
