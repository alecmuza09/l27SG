"use server"

import { supabaseAdmin } from '@/lib/supabase/server'

function mapUsuario(u: any) {
  return {
    id: u.id as string,
    email: u.email as string,
    nombre: u.nombre as string,
    rol: u.rol as 'admin' | 'manager' | 'staff',
    sucursalId: (u.sucursal_id as string | null) || null,
    sucursalNombre: (u.sucursal as any)?.nombre as string | undefined,
    activo: (u.activo as boolean) ?? true,
    createdAt: u.created_at as string,
    updatedAt: u.updated_at as string,
  }
}

export async function getUsuariosAction(): Promise<{
  usuarios: ReturnType<typeof mapUsuario>[]
  error?: string
}> {
  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .select(`
      id, email, nombre, rol, sucursal_id, activo, created_at, updated_at,
      sucursal:sucursales(nombre)
    `)
    .order('created_at', { ascending: false })

  if (error) return { usuarios: [], error: error.message }
  return { usuarios: (data || []).map(mapUsuario) }
}

export async function createUsuarioAction(datos: {
  email: string
  nombre: string
  rol: 'admin' | 'manager' | 'staff'
  sucursalId?: string | null
  password: string
}): Promise<{ success: boolean; usuario?: ReturnType<typeof mapUsuario>; error?: string }> {
  const { email, nombre, rol, sucursalId, password } = datos

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre, rol },
  })

  if (authError || !authData.user) {
    return { success: false, error: authError?.message || 'Error creando usuario en Auth' }
  }

  const { data: usuarioData, error: dbError } = await supabaseAdmin
    .from('usuarios')
    .insert({
      id: authData.user.id,
      email,
      nombre,
      rol,
      sucursal_id: sucursalId || null,
      activo: true,
    })
    .select(`
      id, email, nombre, rol, sucursal_id, activo, created_at, updated_at,
      sucursal:sucursales(nombre)
    `)
    .single()

  if (dbError) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    return { success: false, error: dbError.message }
  }

  return { success: true, usuario: mapUsuario(usuarioData) }
}

export async function updateUsuarioAction(
  usuarioId: string,
  datos: {
    nombre?: string
    rol?: 'admin' | 'manager' | 'staff'
    sucursalId?: string | null
    activo?: boolean
  }
): Promise<{ success: boolean; usuario?: ReturnType<typeof mapUsuario>; error?: string }> {
  const updateData: Record<string, any> = { updated_at: new Date().toISOString() }
  if (datos.nombre !== undefined) updateData.nombre = datos.nombre
  if (datos.rol !== undefined) updateData.rol = datos.rol
  if (datos.sucursalId !== undefined) updateData.sucursal_id = datos.sucursalId
  if (datos.activo !== undefined) updateData.activo = datos.activo

  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .update(updateData)
    .eq('id', usuarioId)
    .select(`
      id, email, nombre, rol, sucursal_id, activo, created_at, updated_at,
      sucursal:sucursales(nombre)
    `)
    .single()

  if (error || !data) return { success: false, error: error?.message || 'Error actualizando usuario' }
  return { success: true, usuario: mapUsuario(data) }
}

export async function deleteUsuarioAction(
  usuarioId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabaseAdmin
    .from('usuarios')
    .update({ activo: false, updated_at: new Date().toISOString() })
    .eq('id', usuarioId)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function updateUsuarioPasswordAction(
  usuarioId: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  if (!password || password.length < 6) {
    return { success: false, error: 'La contraseña debe tener al menos 6 caracteres' }
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(usuarioId, { password })
  if (error) return { success: false, error: error.message }
  return { success: true }
}
