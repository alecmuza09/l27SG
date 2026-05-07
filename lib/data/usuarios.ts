// Usuarios data from Supabase
import { supabase } from "@/lib/supabase/client"

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export interface Usuario {
  id: string
  email: string
  nombre: string
  rol: 'admin' | 'manager' | 'staff' | 'branch-admin'
  sucursalId: string | null
  sucursalNombre?: string
  sucursalIds: string[]
  sucursalesNombres: string[]
  activo: boolean
  createdAt: string
  updatedAt: string
}

// Obtener todos los usuarios (solo admin puede ver todos) - usando API route
export async function getUsuariosFromDB(): Promise<Usuario[]> {
  try {
    const response = await fetch('/api/usuarios', {
      method: 'GET',
      headers: await getAuthHeaders(),
    })

    if (!response.ok) {
      if (response.status === 403 || response.status === 401) {
        console.error('No autorizado para obtener usuarios')
        return []
      }
      throw new Error('Error obteniendo usuarios')
    }

    const data = await response.json()
    return data.usuarios || []
  } catch (error) {
    console.error('Error inesperado obteniendo usuarios:', error)
    return []
  }
}

// Obtener usuario por ID
export async function getUsuarioByIdFromDB(usuarioId: string): Promise<Usuario | null> {
  try {
    const response = await fetch(`/api/usuarios/${usuarioId}`, {
      method: 'GET',
      headers: await getAuthHeaders(),
    })
    if (!response.ok) return null
    const data = await response.json()
    return data.usuario || null
  } catch (error) {
    console.error('Error inesperado obteniendo usuario:', error)
    return null
  }
}

// Crear nuevo usuario (solo admin) - usando API route
export async function createUsuarioFromDB(datos: {
  email: string
  nombre: string
  rol: 'admin' | 'manager' | 'staff' | 'branch-admin'
  sucursalId?: string | null
  password: string
}): Promise<{ success: boolean; usuario?: Usuario; error?: string }> {
  try {
    const response = await fetch('/api/usuarios', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await getAuthHeaders()),
      },
      body: JSON.stringify(datos),
    })

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.error || 'Error creando usuario' }
    }

    return { success: true, usuario: data.usuario }
  } catch (error: any) {
    console.error('Error inesperado creando usuario:', error)
    return { success: false, error: error.message || 'Error desconocido' }
  }
}

// Actualizar usuario - usando API route
export async function updateUsuarioFromDB(
  usuarioId: string,
  datos: {
    nombre?: string
    rol?: 'admin' | 'manager' | 'staff' | 'branch-admin'
    sucursalId?: string | null
    sucursalIds?: string[]
    activo?: boolean
  }
): Promise<{ success: boolean; usuario?: Usuario; error?: string }> {
  try {
    const response = await fetch(`/api/usuarios/${usuarioId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(await getAuthHeaders()),
      },
      body: JSON.stringify(datos),
    })

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.error || 'Error actualizando usuario' }
    }

    return { success: true, usuario: data.usuario }
  } catch (error: any) {
    console.error('Error inesperado actualizando usuario:', error)
    return { success: false, error: error.message || 'Error desconocido' }
  }
}

// Eliminar/desactivar usuario - usando API route
export async function deleteUsuarioFromDB(usuarioId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`/api/usuarios/${usuarioId}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
    })

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.error || 'Error desactivando usuario' }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error inesperado desactivando usuario:', error)
    return { success: false, error: error.message || 'Error desconocido' }
  }
}

// Actualizar contraseña de usuario (solo admin) - usando API route
export async function updateUsuarioPassword(
  usuarioId: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`/api/usuarios/${usuarioId}/password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(await getAuthHeaders()),
      },
      body: JSON.stringify({ password }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.error || 'Error actualizando contraseña' }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error inesperado actualizando contraseña:', error)
    return { success: false, error: error.message || 'Error desconocido' }
  }
}
