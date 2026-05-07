import type { User } from "@/lib/auth"

/** Sucursal "Paseo Tec": acceso al módulo de vacaciones solo con rol `branch-admin`. */
export const PASEO_TEC_SUCURSAL_ID = "b37b010f-6e12-4700-abde-f646956a271f"

function collectUserSucursalIds(user: User): string[] {
  const fromArray = user.sucursalIds?.filter(Boolean) ?? []
  if (user.sucursalId && !fromArray.includes(user.sucursalId)) {
    return [...fromArray, user.sucursalId]
  }
  return fromArray
}

/** Cuentas de sucursal (bloqueo de dashboard raíz y reportes), análogo a manager. */
export function userIsSucursalScopedLike(user: User | null): boolean {
  if (!user) return false
  return user.role === "manager" || user.role === "branch-admin"
}

/**
 * Acceso al módulo /dashboard/vacaciones.
 * En Paseo Tec solo `branch-admin`; resto de sucursales: permitido.
 * Admin/superadmin: siempre permitido.
 */
export function canAccessVacacionesModule(user: User | null): boolean {
  if (!user) return false
  if (user.role === "admin" || user.role === "superadmin") return true

  const ids = collectUserSucursalIds(user)
  const touchesPaseoTec = ids.includes(PASEO_TEC_SUCURSAL_ID)

  if (touchesPaseoTec && user.role !== "branch-admin") return false
  return true
}
