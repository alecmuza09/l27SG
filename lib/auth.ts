// Authentication system — fully client-side via Supabase Auth

import { supabase } from "@/lib/supabase/client"

export interface User {
  id: string
  email: string
  name: string
  role: "superadmin" | "admin" | "manager" | "staff"
  sucursalId?: string
  sucursalIds?: string[]
}

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
}

const USER_KEY = "luna27_user"

export async function login(email: string, password: string): Promise<User> {
  // 1. Autenticar con Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })

  if (authError || !authData.user) {
    throw new Error(authError?.message || "Credenciales inválidas")
  }

  // 2. Obtener datos del usuario desde la tabla usuarios
  const { data: usuarioRaw } = await supabase
    .from("usuarios")
    .select("*, usuario_sucursales(sucursal_id)")
    .eq("email", email)
    .eq("activo", true)
    .maybeSingle()

  const usuarioData = usuarioRaw as any

  const sucursalIds: string[] = usuarioData?.usuario_sucursales
    ? (usuarioData.usuario_sucursales as Array<{ sucursal_id: string }>)
        .map((r: { sucursal_id: string }) => r.sucursal_id)
        .filter(Boolean)
    : usuarioData?.sucursal_id
      ? [usuarioData.sucursal_id]
      : []

  const user: User = usuarioData
    ? {
        id: usuarioData.id,
        email: usuarioData.email,
        name: usuarioData.nombre,
        role: (usuarioData.rol as User["role"]) || "staff",
        sucursalId: sucursalIds[0] ?? usuarioData.sucursal_id ?? undefined,
        sucursalIds,
      }
    : {
        id: authData.user.id,
        email: authData.user.email!,
        name: authData.user.user_metadata?.nombre || authData.user.email!.split("@")[0],
        role: (authData.user.user_metadata?.rol || "admin") as User["role"],
      }

  if (typeof window !== "undefined") {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  }

  return user
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut()
  if (typeof window !== "undefined") {
    localStorage.removeItem(USER_KEY)
  }
}

export async function getCurrentUserFromServer(): Promise<User | null> {
  return getCurrentUser()
}

export function getCurrentUser(): User | null {
  if (typeof window === "undefined") return null
  const stored = localStorage.getItem(USER_KEY)
  if (!stored) return null
  try {
    return JSON.parse(stored)
  } catch {
    return null
  }
}

// Verifica sesión activa con Supabase y re-sincroniza datos desde la BD.
// Siempre consulta la tabla `usuarios` para que sucursalId esté actualizado.
export async function refreshSession(): Promise<User | null> {
  const { data } = await supabase.auth.getSession()
  if (!data.session) {
    if (typeof window !== "undefined") localStorage.removeItem(USER_KEY)
    return null
  }

  const email = data.session.user.email!
  const { data: usuarioRefreshRaw } = await supabase
    .from("usuarios")
    .select("*, usuario_sucursales(sucursal_id)")
    .eq("email", email)
    .eq("activo", true)
    .maybeSingle()

  const usuarioRefresh = usuarioRefreshRaw as any

  const sucursalIds: string[] = usuarioRefresh?.usuario_sucursales
    ? (usuarioRefresh.usuario_sucursales as Array<{ sucursal_id: string }>)
        .map((r: { sucursal_id: string }) => r.sucursal_id)
        .filter(Boolean)
    : usuarioRefresh?.sucursal_id
      ? [usuarioRefresh.sucursal_id]
      : []

  const user: User = usuarioRefresh
    ? {
        id: usuarioRefresh.id,
        email: usuarioRefresh.email,
        name: usuarioRefresh.nombre,
        role: (usuarioRefresh.rol as User["role"]) || "staff",
        sucursalId: sucursalIds[0] ?? usuarioRefresh.sucursal_id ?? undefined,
        sucursalIds,
      }
    : {
        id: data.session.user.id,
        email: data.session.user.email!,
        name: data.session.user.user_metadata?.nombre || data.session.user.email!.split("@")[0],
        role: (data.session.user.user_metadata?.rol || "admin") as User["role"],
      }

  if (typeof window !== "undefined") {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  }

  return user
}

export function checkPermission(user: User | null, requiredRole: User["role"]): boolean {
  if (!user) return false
  const roleHierarchy = { superadmin: 4, admin: 3, manager: 2, staff: 1 }
  return roleHierarchy[user.role] >= roleHierarchy[requiredRole]
}
