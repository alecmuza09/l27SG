import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { supabaseAdmin } from "@/lib/supabase/server"

// Mock users removed - using only Supabase Auth

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    // Primero intentar autenticación con Supabase Auth
    try {
      const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password,
      })

      if (!authError && authData.user) {
        // Usuario autenticado en Supabase Auth
        // Obtener información del usuario de la tabla usuarios
        const { data: usuarioData, error: usuarioError } = await supabaseAdmin
          .from('usuarios')
          .select('*')
          .eq('email', email)
          .eq('activo', true)
          .maybeSingle()

        if (usuarioError && usuarioError.code !== 'PGRST116') {
          console.error('Error obteniendo usuario:', usuarioError)
        }

        const user = usuarioData ? {
          id: usuarioData.id,
          email: usuarioData.email,
          name: usuarioData.nombre,
          role: usuarioData.rol as "admin" | "manager" | "staff",
          sucursalId: usuarioData.sucursal_id || undefined,
        } : {
          id: authData.user.id,
          email: authData.user.email!,
          name: authData.user.user_metadata?.nombre || authData.user.email!.split('@')[0],
          role: (authData.user.user_metadata?.rol || 'admin') as "admin" | "manager" | "staff",
        }

        // Crear session token
        const sessionData = JSON.stringify(user)
        const cookieStore = await cookies()

        cookieStore.set("luna27_session", sessionData, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 7, // 7 days
          path: "/",
        })

        // También guardar token de Supabase Auth
        if (authData.session) {
          cookieStore.set("sb-access-token", authData.session.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 7,
            path: "/",
          })
          cookieStore.set("sb-refresh-token", authData.session.refresh_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 7,
            path: "/",
          })
        }

        return NextResponse.json({ user, success: true })
      }
    } catch (supabaseError) {
      console.error('Error en autenticación con Supabase:', supabaseError)
      return NextResponse.json({ error: "Error de autenticación. Por favor, verifica tus credenciales." }, { status: 401 })
    }

    // Si llegamos aquí, la autenticación falló
    return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 })
  } catch (error) {
    console.error("[v0] Login error:", error)
    return NextResponse.json({ error: "Error al procesar la solicitud" }, { status: 500 })
  }
}
