import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getAdminUser } from '@/lib/supabase/auth-admin'

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
