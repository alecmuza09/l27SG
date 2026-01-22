import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { supabaseAdmin } from "@/lib/supabase/server"

// PUT - Actualizar contraseña de usuario (solo admin)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const id = resolvedParams.id
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get("luna27_session")

    if (!sessionCookie) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const user = JSON.parse(sessionCookie.value)
    
    // Solo admin puede cambiar contraseñas
    if (user.role !== 'admin') {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 })
    }

    const body = await request.json()
    const { password } = body

    if (!password || password.length < 6) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 })
    }

    // Actualizar contraseña en Supabase Auth
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
      password: password
    })

    if (authError) {
      console.error('Error actualizando contraseña:', authError)
      return NextResponse.json({ error: authError.message || 'Error al actualizar la contraseña' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Contraseña actualizada exitosamente' })
  } catch (error: any) {
    console.error('Error actualizando contraseña:', error)
    return NextResponse.json({ error: error.message || 'Error desconocido' }, { status: 500 })
  }
}
