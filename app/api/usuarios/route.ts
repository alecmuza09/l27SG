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

// GET /api/usuarios — Listar todos los usuarios
export async function GET(req: NextRequest) {
  const adminUser = await getAdminUser(req)
  if (!adminUser) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .select(`
      id,
      email,
      nombre,
      rol,
      sucursal_id,
      activo,
      created_at,
      updated_at,
      sucursal:sucursales(nombre)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Error obteniendo usuarios' }, { status: 500 })
  }

  const usuarios = (data || []).map((u: any) => ({
    id: u.id,
    email: u.email,
    nombre: u.nombre,
    rol: u.rol,
    sucursalId: u.sucursal_id || null,
    sucursalNombre: u.sucursal?.nombre || undefined,
    activo: u.activo ?? true,
    createdAt: u.created_at,
    updatedAt: u.updated_at,
  }))

  return NextResponse.json({ usuarios })
}

// POST /api/usuarios — Crear nuevo usuario
export async function POST(req: NextRequest) {
  const adminUser = await getAdminUser(req)
  if (!adminUser) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await req.json()
  const { email, nombre, rol, sucursalId, password } = body

  if (!email || !nombre || !rol || !password) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  // Crear usuario en Supabase Auth
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre, rol },
  })

  if (authError || !authData.user) {
    return NextResponse.json(
      { error: authError?.message || 'Error creando usuario en Auth' },
      { status: 500 }
    )
  }

  // Insertar en la tabla usuarios
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
    // Revertir: eliminar el usuario de Auth si falló la inserción en BD
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json(
      { error: dbError.message || 'Error guardando usuario en base de datos' },
      { status: 500 }
    )
  }

  const usuario = {
    id: (usuarioData as any).id,
    email: (usuarioData as any).email,
    nombre: (usuarioData as any).nombre,
    rol: (usuarioData as any).rol,
    sucursalId: (usuarioData as any).sucursal_id || null,
    sucursalNombre: (usuarioData as any).sucursal?.nombre || undefined,
    activo: (usuarioData as any).activo ?? true,
    createdAt: (usuarioData as any).created_at,
    updatedAt: (usuarioData as any).updated_at,
  }

  return NextResponse.json({ usuario }, { status: 201 })
}
