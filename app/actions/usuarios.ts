"use server"

import { supabaseAdmin } from '@/lib/supabase/server'

function mapUsuario(u: any) {
  const rows: Array<{ sucursal_id: string; sucursal?: { id: string; nombre: string } }> =
    Array.isArray(u.usuario_sucursales) ? u.usuario_sucursales : []

  const sucursalIds = rows.map((r) => r.sucursal_id).filter(Boolean)
  const sucursalesNombres = rows.map((r) => r.sucursal?.nombre).filter(Boolean) as string[]

  // Fallback para registros sin junction table todavía
  if (sucursalIds.length === 0 && u.sucursal_id) {
    sucursalIds.push(u.sucursal_id)
    const nombre = (u.sucursal as any)?.nombre as string | undefined
    if (nombre) sucursalesNombres.push(nombre)
  }

  return {
    id: u.id as string,
    email: u.email as string,
    nombre: u.nombre as string,
    rol: u.rol as 'admin' | 'manager' | 'staff' | 'branch-admin',
    sucursalId: sucursalIds[0] ?? (u.sucursal_id as string | null) ?? null,
    sucursalNombre: sucursalesNombres[0] as string | undefined,
    sucursalIds,
    sucursalesNombres,
    activo: (u.activo as boolean) ?? true,
    createdAt: u.created_at as string,
    updatedAt: u.updated_at as string,
  }
}

const USUARIO_SELECT = `
  id, email, nombre, rol, sucursal_id, activo, created_at, updated_at,
  sucursal:sucursales(nombre),
  usuario_sucursales(sucursal_id, sucursal:sucursales(id, nombre))
`

async function syncSucursales(usuarioId: string, sucursalIds: string[]) {
  await supabaseAdmin.from('usuario_sucursales').delete().eq('usuario_id', usuarioId)
  if (sucursalIds.length > 0) {
    await supabaseAdmin.from('usuario_sucursales').insert(
      sucursalIds.map((sid) => ({ usuario_id: usuarioId, sucursal_id: sid }))
    )
  }
}

export async function getUsuariosAction(): Promise<{
  usuarios: ReturnType<typeof mapUsuario>[]
  error?: string
}> {
  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .select(USUARIO_SELECT)
    .order('created_at', { ascending: false })

  if (error) return { usuarios: [], error: error.message }
  return { usuarios: (data || []).map(mapUsuario) }
}

export async function createUsuarioAction(datos: {
  email: string
  nombre: string
  rol: 'admin' | 'manager' | 'staff' | 'branch-admin'
  sucursalId?: string | null
  sucursalIds?: string[]
  password: string
}): Promise<{ success: boolean; usuario?: ReturnType<typeof mapUsuario>; error?: string }> {
  const { email, nombre, rol, password } = datos
  const sucursalIds = datos.sucursalIds ?? (datos.sucursalId ? [datos.sucursalId] : [])
  const primarySucursalId = sucursalIds[0] ?? null

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
    .insert({ id: authData.user.id, email, nombre, rol, sucursal_id: primarySucursalId, activo: true })
    .select(USUARIO_SELECT)
    .single()

  if (dbError) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    return { success: false, error: dbError.message }
  }

  await syncSucursales(authData.user.id, sucursalIds)

  const { data: finalData } = await supabaseAdmin
    .from('usuarios')
    .select(USUARIO_SELECT)
    .eq('id', authData.user.id)
    .single()

  return { success: true, usuario: mapUsuario(finalData ?? usuarioData) }
}

export async function updateUsuarioAction(
  usuarioId: string,
  datos: {
    nombre?: string
    rol?: 'admin' | 'manager' | 'staff' | 'branch-admin'
    sucursalId?: string | null
    sucursalIds?: string[]
    activo?: boolean
  }
): Promise<{ success: boolean; usuario?: ReturnType<typeof mapUsuario>; error?: string }> {
  const sucursalIds =
    datos.sucursalIds !== undefined
      ? datos.sucursalIds
      : datos.sucursalId !== undefined
        ? datos.sucursalId ? [datos.sucursalId] : []
        : undefined

  const updateData: Record<string, any> = { updated_at: new Date().toISOString() }
  if (datos.nombre !== undefined) updateData.nombre = datos.nombre
  if (datos.rol !== undefined) updateData.rol = datos.rol
  if (sucursalIds !== undefined) updateData.sucursal_id = sucursalIds[0] ?? null
  if (datos.activo !== undefined) updateData.activo = datos.activo

  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .update(updateData)
    .eq('id', usuarioId)
    .select(USUARIO_SELECT)
    .single()

  if (error || !data) return { success: false, error: error?.message || 'Error actualizando usuario' }

  if (sucursalIds !== undefined) {
    await syncSucursales(usuarioId, sucursalIds)
  }

  const { data: finalData } = await supabaseAdmin
    .from('usuarios')
    .select(USUARIO_SELECT)
    .eq('id', usuarioId)
    .single()

  return { success: true, usuario: mapUsuario(finalData ?? data) }
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

export async function getUsuariosBySucursalAction(sucursalId: string): Promise<{
  usuarios: ReturnType<typeof mapUsuario>[]
  error?: string
}> {
  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .select(USUARIO_SELECT)
    .eq('activo', true)
    .order('nombre', { ascending: true })

  if (error) return { usuarios: [], error: error.message }

  // Filtrar usuarios que tengan esta sucursal asignada (junction table o columna base)
  const filtrados = (data || [])
    .map(mapUsuario)
    .filter(u =>
      u.sucursalIds.includes(sucursalId) ||
      u.sucursalId === sucursalId
    )

  return { usuarios: filtrados }
}
