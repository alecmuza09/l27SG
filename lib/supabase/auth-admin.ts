import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

/**
 * Verifica que la petición venga de un usuario admin válido.
 * Acepta el rol desde la tabla `usuarios` o desde los metadatos de Supabase Auth
 * (fallback para el primer admin creado directamente en Supabase).
 */
export async function getAdminUser(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.slice(7)
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return null

  // Buscar en la tabla usuarios (maybeSingle para no romper si no existe)
  const { data: usuarioData } = await supabaseAdmin
    .from('usuarios')
    .select('rol, activo')
    .eq('id', user.id)
    .maybeSingle()

  if (usuarioData) {
    if (!usuarioData.activo) return null
    if (usuarioData.rol === 'admin') return user
    return null
  }

  // Fallback: el admin fue creado directamente en Supabase Auth sin registro en la tabla
  const metaRole = user.user_metadata?.rol || user.user_metadata?.role
  if (metaRole === 'admin') return user

  // Segundo fallback: email del usuario existe en la tabla por email (en vez de por id)
  const { data: byEmail } = await supabaseAdmin
    .from('usuarios')
    .select('rol, activo')
    .eq('email', user.email!)
    .maybeSingle()

  if (byEmail?.activo && byEmail?.rol === 'admin') return user

  return null
}
