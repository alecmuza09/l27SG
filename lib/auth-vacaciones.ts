import type { User } from "@/lib/auth"
import { PASEO_TEC_SUCURSAL_ID, collectEffectiveSucursalIds } from "@/lib/auth"

export { PASEO_TEC_SUCURSAL_ID } from "@/lib/auth"

/** Cuentas de sucursal (bloqueo de dashboard raíz para manager/branch-admin), análogo a manager. */
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

  const ids = collectEffectiveSucursalIds(user)
  const touchesPaseoTec = ids.includes(PASEO_TEC_SUCURSAL_ID)

  if (touchesPaseoTec && user.role !== "branch-admin") return false
  return true
}
