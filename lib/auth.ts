// Authentication system — fully client-side via Supabase Auth

import { supabase } from "@/lib/supabase/client"

export interface User {
  id: string
  email: string
  name: string
  role: "superadmin" | "admin" | "manager" | "staff" | "branch-admin"
  sucursalId?: string
  sucursalIds?: string[]
}

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
}

const USER_KEY = "luna27_user"

/** UUID sucursal Paseo Tec (debe coincidir con BD y scripts). */
export const PASEO_TEC_SUCURSAL_ID = "b37b010f-6e12-4700-abde-f646956a271f"

/** Une junction + columna base; evita `sucursalIds: []` cuando `usuario_sucursales` viene vacío pero hay `sucursal_id`. */
function mergeSucursalIdsFromUsuarioRow(usuarioData: Record<string, unknown> | null | undefined): string[] {
  if (!usuarioData) return []
  const junction = usuarioData.usuario_sucursales as Array<{ sucursal_id: string }> | undefined
  const fromJunction =
    Array.isArray(junction) ? junction.map((r) => r.sucursal_id).filter(Boolean) : []
  const baseId = usuarioData.sucursal_id as string | null | undefined
  const merged = new Set<string>(fromJunction)
  if (baseId) merged.add(baseId)
  return [...merged]
}

/** IDs de sucursal efectivos para filtrado en UI (corrige objetos guardados antes del merge correcto). */
export function collectEffectiveSucursalIds(user: User | null): string[] {
  if (!user) return []
  const s = new Set<string>()
  for (const id of user.sucursalIds ?? []) if (id) s.add(id)
  if (user.sucursalId) s.add(user.sucursalId)
  const arr = [...s]
  if (arr.length === 0 && user.role === "branch-admin") return [PASEO_TEC_SUCURSAL_ID]
  return arr
}

/** Primera sucursal para consultas KPI / citas cuando el usuario no es admin global. */
export function effectivePrimarySucursalId(user: User | null): string | undefined {
  return collectEffectiveSucursalIds(user)[0]
}

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

  const usuarioData = usuarioRaw as Record<string, unknown> | undefined

  const sucursalIds = mergeSucursalIdsFromUsuarioRow(usuarioData)
  const primarySucursal =
    (usuarioData?.sucursal_id as string | undefined) ?? sucursalIds[0] ?? undefined

  const user: User = usuarioData
    ? {
        id: usuarioData.id as string,
        email: usuarioData.email as string,
        name: usuarioData.nombre as string,
        role: (usuarioData.rol as User["role"]) || "staff",
        sucursalId: primarySucursal,
        sucursalIds,
      }
    : {
        id: authData.user.id,
        email: authData.user.email!,
        name: authData.user.user_metadata?.nombre || authData.user.email!.split("@")[0],
        role: (authData.user.user_metadata?.rol as User["role"]) || "staff",
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

  const usuarioRefresh = usuarioRefreshRaw as Record<string, unknown> | undefined

  const sucursalIds = mergeSucursalIdsFromUsuarioRow(usuarioRefresh)
  const primarySucursal =
    (usuarioRefresh?.sucursal_id as string | undefined) ?? sucursalIds[0] ?? undefined

  const user: User = usuarioRefresh
    ? {
        id: usuarioRefresh.id as string,
        email: usuarioRefresh.email as string,
        name: usuarioRefresh.nombre as string,
        role: (usuarioRefresh.rol as User["role"]) || "staff",
        sucursalId: primarySucursal,
        sucursalIds,
      }
    : {
        id: data.session.user.id,
        email: data.session.user.email!,
        name: data.session.user.user_metadata?.nombre || data.session.user.email!.split("@")[0],
        role: (data.session.user.user_metadata?.rol as User["role"]) || "staff",
      }

  if (typeof window !== "undefined") {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  }

  return user
}

export function checkPermission(user: User | null, requiredRole: User["role"]): boolean {
  if (!user) return false
  const roleHierarchy: Record<User["role"], number> = {
    superadmin: 4,
    admin: 3,
    manager: 2,
    "branch-admin": 2,
    staff: 1,
  }
  return roleHierarchy[user.role] >= roleHierarchy[requiredRole]
}

/** Vista de todas las sucursales (roles admin / superadmin). No depende de sucursal_id. */
export function isGlobalAdministrator(user: User | null): boolean {
  return user?.role === "admin" || user?.role === "superadmin"
}

/** Usuario con más de una sucursal asignada (columna + usuario_sucursales), sin ser admin global. */
export function userHasMultiBranchScope(user: User | null): boolean {
  if (!user || isGlobalAdministrator(user)) return false
  return collectEffectiveSucursalIds(user).length > 1
}

/** Email de la cuenta operativa San Jerónimo (menú reducido y rutas acotadas). */
export const SAN_JERONIMO_RESTRICTED_NAV_EMAIL = "sanjeronimo@luna27.mx"

export function isSanJeronimoRestrictedNavUser(user: User | null): boolean {
  if (!user?.email) return false
  return user.email.trim().toLowerCase() === SAN_JERONIMO_RESTRICTED_NAV_EMAIL.toLowerCase()
}

/** Rutas bajo `/dashboard` permitidas para la cuenta San Jerónimo; cualquier otra redirige a citas. */
export const SAN_JERONIMO_ALLOWED_ROUTE_PREFIXES = [
  "/dashboard/citas",
  "/dashboard/clientes",
  "/dashboard/pagos",
  "/dashboard/gift-cards",
  "/dashboard/vacaciones",
  "/dashboard/ausencias",
  "/dashboard/reportes",
  "/dashboard/inventario/sucursal",
] as const

export function pathnameAllowedForSanJeronimoUser(pathname: string): boolean {
  return SAN_JERONIMO_ALLOWED_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

/**
 * Habilitado para cualquier usuario con una sucursal asignada (todas las sucursales).
 * Usado para mostrar/permitir el módulo de stock por sucursal (`/dashboard/inventario/sucursal`).
 */
export function usuarioPuedeVerStockSucursal(user: User | null): boolean {
  return !!effectivePrimarySucursalId(user)
}
