import type { User } from "@/lib/auth"
import { PASEO_TEC_SUCURSAL_ID, collectEffectiveSucursalIds } from "@/lib/auth"

export { PASEO_TEC_SUCURSAL_ID } from "@/lib/auth"

/** Cuentas de sucursal (bloqueo de dashboard raíz típico). Manager / branch-admin con varias sedes: acceso tipo regional. */
export function userIsSucursalScopedLike(user: User | null): boolean {
  if (!user) return false
  const n = collectEffectiveSucursalIds(user).length
  if (user.role === "branch-admin") return n <= 1
  if (user.role === "manager") return n <= 1
  return false
}

/**
 * Acceso al módulo /dashboard/vacaciones.
 * En Paseo Tec solo `branch-admin`; resto de sucursales: permitido.
 * Admin/superadmin: siempre permitido.
 */
export function canAccessVacacionesModule(user: User | null): boolean {
  if (!user) return false
  if (user.role === "admin" || user.role === "superadmin") return true

  const ids = collectEffectiveSucursalIds(user)
  const touchesPaseoTec = ids.includes(PASEO_TEC_SUCURSAL_ID)

  if (touchesPaseoTec && user.role !== "branch-admin") return false
  return true
}
