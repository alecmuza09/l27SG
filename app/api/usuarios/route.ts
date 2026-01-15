import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { supabaseAdmin } from "@/lib/supabase/server"

// GET - Obtener usuarios (solo admin)
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get("luna27_session")

    if (!sessionCookie) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const user = JSON.parse(sessionCookie.value)
    
    // Solo admin puede ver todos los usuarios
    if (user.role !== 'admin') {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 })
    }

    const { data, error } = await supabaseAdmin
      .from('usuarios')
      .select(`
        *,
        sucursal:sucursales(nombre)
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error obteniendo usuarios:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const usuarios = data?.map((u: any) => ({
      id: u.id,
      email: u.email,
      nombre: u.nombre,
      rol: u.rol,
      sucursalId: u.sucursal_id || null,
      sucursalNombre: u.sucursal?.nombre || undefined,
      activo: u.activo ?? true,
      createdAt: u.created_at,
      updatedAt: u.updated_at,
    })) || []

    return NextResponse.json({ usuarios })
  } catch (error: any) {
    console.error('Error obteniendo usuarios:', error)
    return NextResponse.json({ error: error.message || 'Error desconocido' }, { status: 500 })
  }
}

// POST - Crear nuevo usuario (solo admin)
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get("luna27_session")

    if (!sessionCookie) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const user = JSON.parse(sessionCookie.value)
    
    // Solo admin puede crear usuarios
    if (user.role !== 'admin') {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 })
    }

    const body = await request.json()
    const { email, nombre, rol, sucursalId, password } = body

    if (!email || !nombre || !rol || !password) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 })
    }

    // Crear usuario en Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        nombre,
        rol,
      }
    })

    if (authError) {
      console.error('Error creando usuario en Auth:', authError)
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'No se pudo crear el usuario en Auth' }, { status: 500 })
    }

    // Crear registro en la tabla usuarios
    const { data: usuarioData, error: usuarioError } = await supabaseAdmin
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
        *,
        sucursal:sucursales(nombre)
      `)
      .single()

    if (usuarioError) {
      console.error('Error creando registro de usuario:', usuarioError)
      // Intentar eliminar el usuario de Auth si falla
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: usuarioError.message }, { status: 500 })
    }

    const usuario = {
      id: usuarioData.id,
      email: usuarioData.email,
      nombre: usuarioData.nombre,
      rol: usuarioData.rol,
      sucursalId: usuarioData.sucursal_id || null,
      sucursalNombre: usuarioData.sucursal?.nombre || undefined,
      activo: usuarioData.activo ?? true,
      createdAt: usuarioData.created_at,
      updatedAt: usuarioData.updated_at,
    }

    return NextResponse.json({ usuario }, { status: 201 })
  } catch (error: any) {
    console.error('Error creando usuario:', error)
    return NextResponse.json({ error: error.message || 'Error desconocido' }, { status: 500 })
  }
}
