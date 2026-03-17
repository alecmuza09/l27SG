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

// PUT /api/usuarios/[id]/password — Cambiar contraseña de un usuario
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
  const { password } = body

  if (!password || password.length < 6) {
    return NextResponse.json(
      { error: 'La contraseña debe tener al menos 6 caracteres' },
      { status: 400 }
    )
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { password })

  if (error) {
    return NextResponse.json(
      { error: error.message || 'Error actualizando contraseña' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
