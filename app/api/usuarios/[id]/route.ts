import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

async function getAdminUser(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.slice(7)
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return null

  const { data: usuarioData } = await supabaseAdmin
    .from('usuarios')
    .select('rol')
    .eq('id', user.id)
    .eq('activo', true)
    .single()

  if (usuarioData?.rol !== 'admin') return null
  return user
}

// GET /api/usuarios/[id] — Obtener usuario por ID
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await getAdminUser(req)
  if (!adminUser) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id } = await params

  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .select(`
      id, email, nombre, rol, sucursal_id, activo, created_at, updated_at,
      sucursal:sucursales(nombre)
    `)
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }

  const usuario = {
    id: (data as any).id,
    email: (data as any).email,
    nombre: (data as any).nombre,
    rol: (data as any).rol,
    sucursalId: (data as any).sucursal_id || null,
    sucursalNombre: (data as any).sucursal?.nombre || undefined,
    activo: (data as any).activo ?? true,
    createdAt: (data as any).created_at,
    updatedAt: (data as any).updated_at,
  }

  return NextResponse.json({ usuario })
}

// PUT /api/usuarios/[id] — Actualizar usuario
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await getAdminUser(req)
  if (!adminUser) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()
  const { nombre, rol, sucursalId, activo } = body

  const updateData: Record<string, any> = {}
  if (nombre !== undefined) updateData.nombre = nombre
  if (rol !== undefined) updateData.rol = rol
  if (sucursalId !== undefined) updateData.sucursal_id = sucursalId
  if (activo !== undefined) updateData.activo = activo
  updateData.updated_at = new Date().toISOString()

  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .update(updateData)
    .eq('id', id)
    .select(`
      id, email, nombre, rol, sucursal_id, activo, created_at, updated_at,
      sucursal:sucursales(nombre)
    `)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Error actualizando usuario' }, { status: 500 })
  }

  const usuario = {
    id: (data as any).id,
    email: (data as any).email,
    nombre: (data as any).nombre,
    rol: (data as any).rol,
    sucursalId: (data as any).sucursal_id || null,
    sucursalNombre: (data as any).sucursal?.nombre || undefined,
    activo: (data as any).activo ?? true,
    createdAt: (data as any).created_at,
    updatedAt: (data as any).updated_at,
  }

  return NextResponse.json({ usuario })
}

// DELETE /api/usuarios/[id] — Desactivar usuario
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await getAdminUser(req)
  if (!adminUser) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id } = await params

  // No permitir auto-desactivación
  if (adminUser.id === id) {
    return NextResponse.json({ error: 'No puedes desactivarte a ti mismo' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('usuarios')
    .update({ activo: false, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: 'Error desactivando usuario' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
