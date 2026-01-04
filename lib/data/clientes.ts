import { supabase } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'

type ClienteRow = Database['public']['Tables']['clientes']['Row']
type ClienteInsert = Database['public']['Tables']['clientes']['Insert']

export interface Cliente {
  id: string
  nombre: string
  apellido: string
  email: string
  telefono: string
  fechaNacimiento?: string
  genero?: "masculino" | "femenino" | "otro"
  direccion?: string
  ciudad?: string
  notas?: string
  fechaRegistro: string
  ultimaVisita?: string
  totalVisitas: number
  totalGastado: number
  puntosFidelidad: number
  preferencias?: string[]
  alergias?: string[]
  sucursalPreferida?: string
  estado: "activo" | "inactivo" | "vip"
}

// Función helper para transformar datos de la BD al formato de la interfaz
function transformCliente(cliente: ClienteRow): Cliente {
  return {
    id: cliente.id,
    nombre: cliente.nombre,
    apellido: cliente.apellido,
    email: cliente.email || '',
    telefono: cliente.telefono,
    fechaNacimiento: cliente.fecha_nacimiento || undefined,
    genero: cliente.genero || undefined,
    direccion: cliente.direccion || undefined,
    ciudad: cliente.ciudad || undefined,
    notas: cliente.notas || undefined,
    fechaRegistro: cliente.fecha_registro,
    ultimaVisita: cliente.ultima_visita || undefined,
    totalVisitas: cliente.total_visitas,
    totalGastado: Number(cliente.total_gastado),
    puntosFidelidad: cliente.puntos_fidelidad,
    preferencias: cliente.preferencias || undefined,
    alergias: cliente.alergias || undefined,
    sucursalPreferida: cliente.sucursal_preferida || undefined,
    estado: cliente.estado,
  }
}

// Obtener clientes con paginación
export async function getClientesPaginated(
  page: number = 1,
  pageSize: number = 50
): Promise<{ clientes: Cliente[]; total: number; totalPages: number }> {
  try {
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    // Obtener el total de clientes
    const { count, error: countError } = await supabase
      .from('clientes')
      .select('*', { count: 'exact', head: true })

    if (countError) {
      console.error('Error obteniendo conteo de clientes:', countError)
      return { clientes: [], total: 0, totalPages: 0 }
    }

    const total = count || 0
    const totalPages = Math.ceil(total / pageSize)

    // Obtener los clientes de la página actual
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      console.error('Error obteniendo clientes:', error)
      return { clientes: [], total, totalPages }
    }

    return {
      clientes: data.map(transformCliente),
      total,
      totalPages,
    }
  } catch (error) {
    console.error('Error inesperado obteniendo clientes:', error)
    return { clientes: [], total: 0, totalPages: 0 }
  }
}

// Obtener todos los clientes (mantener para compatibilidad, pero con advertencia)
export async function getClientes(): Promise<Cliente[]> {
  console.warn('getClientes() está limitado a 1,000 registros. Usa getClientesPaginated() para obtener todos los clientes.')
  try {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000) // Límite explícito de Supabase

    if (error) {
      console.error('Error obteniendo clientes:', error)
      return []
    }

    return data.map(transformCliente)
  } catch (error) {
    console.error('Error inesperado obteniendo clientes:', error)
    return []
  }
}

// Obtener un cliente por ID
export async function getClienteById(id: string): Promise<Cliente | null> {
  try {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error obteniendo cliente:', error)
      return null
    }

    return transformCliente(data)
  } catch (error) {
    console.error('Error inesperado obteniendo cliente:', error)
    return null
  }
}

// Buscar clientes por query (sin límite de resultados, busca en toda la base de datos)
export async function searchClientes(query: string, limit: number = 1000): Promise<Cliente[]> {
  try {
    if (!query || query.trim() === '') {
      return []
    }

    const searchTerm = `%${query.trim()}%`
    
    // Buscar en toda la base de datos usando ilike para búsqueda case-insensitive
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .or(`nombre.ilike.${searchTerm},apellido.ilike.${searchTerm},email.ilike.${searchTerm},telefono.ilike.${searchTerm}`)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error buscando clientes:', error)
      return []
    }

    return data.map(transformCliente)
  } catch (error) {
    console.error('Error inesperado buscando clientes:', error)
    return []
  }
}

// Buscar clientes con paginación
export async function searchClientesPaginated(
  query: string,
  page: number = 1,
  pageSize: number = 50
): Promise<{ clientes: Cliente[]; total: number; totalPages: number }> {
  try {
    if (!query || query.trim() === '') {
      return { clientes: [], total: 0, totalPages: 0 }
    }

    const searchTerm = query.trim()
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    // Obtener el total de resultados de búsqueda
    const { count, error: countError } = await supabase
      .from('clientes')
      .select('*', { count: 'exact', head: true })
      .or(`nombre.ilike.%${searchTerm}%,apellido.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,telefono.ilike.%${searchTerm}%`)

    if (countError) {
      console.error('Error obteniendo conteo de búsqueda:', countError)
      return { clientes: [], total: 0, totalPages: 0 }
    }

    const total = count || 0
    const totalPages = Math.ceil(total / pageSize)

    // Obtener los resultados de la página actual
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .or(`nombre.ilike.%${searchTerm}%,apellido.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,telefono.ilike.%${searchTerm}%`)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      console.error('Error buscando clientes:', error)
      return { clientes: [], total, totalPages }
    }

    return {
      clientes: data.map(transformCliente),
      total,
      totalPages,
    }
  } catch (error) {
    console.error('Error inesperado buscando clientes:', error)
    return { clientes: [], total: 0, totalPages: 0 }
  }
}

// Obtener estadísticas de clientes
export async function getClientesStats(): Promise<{
  total: number
  activos: number
  vip: number
  nuevos: number
}> {
  try {
    const { data, error } = await supabase
      .from('clientes')
      .select('estado, fecha_registro')

    if (error) {
      console.error('Error obteniendo estadísticas:', error)
      return { total: 0, activos: 0, vip: 0, nuevos: 0 }
    }

    const total = data.length
    const activos = data.filter((c: any) => c.estado === 'activo').length
    const vip = data.filter((c: any) => c.estado === 'vip').length
    
    // Clientes nuevos en los últimos 30 días
    const hoy = new Date()
    const hace30Dias = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000)
    const nuevos = data.filter((c: any) => {
      const fechaRegistro = new Date(c.fecha_registro)
      return fechaRegistro >= hace30Dias
    }).length

    return { total, activos, vip, nuevos }
  } catch (error) {
    console.error('Error inesperado obteniendo estadísticas:', error)
    return { total: 0, activos: 0, vip: 0, nuevos: 0 }
  }
}

// Crear un nuevo cliente
export async function createCliente(clienteData: {
  nombre: string
  apellido: string
  telefono: string
  email?: string
  fechaNacimiento?: string
  genero?: 'masculino' | 'femenino' | 'otro'
  notas?: string
}): Promise<{ success: boolean; cliente?: Cliente; error?: string }> {
  try {
    const insertData: any = {
      nombre: clienteData.nombre,
      apellido: clienteData.apellido,
      telefono: clienteData.telefono,
      email: clienteData.email || null,
      fecha_nacimiento: clienteData.fechaNacimiento || null,
      genero: clienteData.genero || null,
      notas: clienteData.notas || null,
      estado: 'activo',
    }

    const { data, error } = await supabase
      .from('clientes')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('Error creando cliente:', error)
      return { success: false, error: error.message }
    }

    if (!data) {
      return { success: false, error: 'No se recibieron datos del servidor' }
    }

    return { success: true, cliente: transformCliente(data as ClienteRow) }
  } catch (error: any) {
    console.error('Error inesperado creando cliente:', error)
    return { success: false, error: error.message || 'Error desconocido' }
  }
}
