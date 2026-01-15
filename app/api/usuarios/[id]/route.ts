import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { supabaseAdmin } from "@/lib/supabase/server"

// PUT - Actualizar usuario (solo admin)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get("luna27_session")

    if (!sessionCookie) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const user = JSON.parse(sessionCookie.value)
    
    // Solo admin puede actualizar usuarios
    if (user.role !== 'admin') {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 })
    }

    const body = await request.json()
    const { nombre, rol, sucursalId, activo } = body

    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (nombre) updateData.nombre = nombre
    if (rol) updateData.rol = rol
    if (sucursalId !== undefined) updateData.sucursal_id = sucursalId
    if (activo !== undefined) updateData.activo = activo

    // Si se cambia el rol, actualizar también en Auth
    if (rol) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(params.id, {
        user_metadata: { rol }
      })
      if (authError) {
        console.error('Error actualizando usuario en Auth:', authError)
      }
    }

    const { data, error } = await supabaseAdmin
      .from('usuarios')
      .update(updateData)
      .eq('id', params.id)
      .select(`
        *,
        sucursal:sucursales(nombre)
      `)
      .single()

    if (error) {
      console.error('Error actualizando usuario:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const usuario = {
      id: data.id,
      email: data.email,
      nombre: data.nombre,
      rol: data.rol,
      sucursalId: data.sucursal_id || null,
      sucursalNombre: data.sucursal?.nombre || undefined,
      activo: data.activo ?? true,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }

    return NextResponse.json({ usuario })
  } catch (error: any) {
    console.error('Error actualizando usuario:', error)
    return NextResponse.json({ error: error.message || 'Error desconocido' }, { status: 500 })
  }
}

// DELETE - Desactivar usuario (solo admin)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get("luna27_session")

    if (!sessionCookie) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const user = JSON.parse(sessionCookie.value)
    
    // Solo admin puede desactivar usuarios
    if (user.role !== 'admin') {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 })
    }

    // Desactivar en lugar de eliminar
    const { error } = await supabaseAdmin
      .from('usuarios')
      .update({ 
        activo: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)

    if (error) {
      console.error('Error desactivando usuario:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error desactivando usuario:', error)
    return NextResponse.json({ error: error.message || 'Error desconocido' }, { status: 500 })
  }
}
