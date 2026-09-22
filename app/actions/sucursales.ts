"use server"

import { supabaseAdmin } from "@/lib/supabase/server"

async function sucursalTieneDependencias(id: string): Promise<boolean> {
  const tablas = ["empleados", "citas", "pagos"] as const
  for (const tabla of tablas) {
    const { count, error } = await supabaseAdmin
      .from(tabla)
      .select("id", { count: "exact", head: true })
      .eq("sucursal_id", id)

    if (error) {
      console.warn(`No se pudo verificar ${tabla}:`, error.message)
      continue
    }
    if ((count ?? 0) > 0) return true
  }
  return false
}

async function desactivarSucursal(id: string): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabaseAdmin
    .from("sucursales")
    .update({ activa: false, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id")
    .maybeSingle()

  if (error) {
    console.error("Error desactivando sucursal:", error)
    return { success: false, error: error.message }
  }
  if (!data) {
    return { success: false, error: "No se encontró la sucursal o no se pudo desactivar." }
  }
  return { success: true }
}

export async function deleteSucursalAction(id: string): Promise<{
  success: boolean
  error?: string
  mode?: "deleted" | "deactivated"
}> {
  try {
    const tieneDeps = await sucursalTieneDependencias(id)

    if (tieneDeps) {
      const result = await desactivarSucursal(id)
      return result.success ? { success: true, mode: "deactivated" } : result
    }

    const { data: deleted, error } = await supabaseAdmin
      .from("sucursales")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle()

    if (!error && deleted) {
      return { success: true, mode: "deleted" }
    }

    const code = error && "code" in error ? String((error as { code?: string }).code) : ""
    const msg = (error?.message || "").toLowerCase()
    const fkBlocked =
      code === "23503" ||
      msg.includes("foreign key") ||
      msg.includes("violates foreign key constraint") ||
      msg.includes("still referenced") ||
      msg.includes("referencia")

    if (fkBlocked || !deleted) {
      const result = await desactivarSucursal(id)
      return result.success ? { success: true, mode: "deactivated" } : result
    }

    console.error("Error eliminando sucursal:", error)
    return { success: false, error: error?.message ?? "Error eliminando sucursal" }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error desconocido"
    console.error("Error inesperado eliminando sucursal:", error)
    return { success: false, error: msg }
  }
}

export async function updateSucursalAction(
  id: string,
  datos: {
    nombre: string
    direccion: string
    telefono: string
    email: string
    horario?: string | null
    ciudad?: string | null
    pais?: string | null
    activa?: boolean
  },
): Promise<{ success: boolean; error?: string }> {
  try {
    const patch: Record<string, unknown> = {
      nombre: datos.nombre.trim(),
      direccion: datos.direccion.trim(),
      telefono: datos.telefono.trim(),
      email: datos.email.trim(),
      horario: datos.horario?.trim() || null,
      ciudad: datos.ciudad?.trim() || null,
      pais: datos.pais?.trim() || "México",
      updated_at: new Date().toISOString(),
    }
    if (datos.activa !== undefined) {
      patch.activa = datos.activa
    }

    const { data, error } = await supabaseAdmin
      .from("sucursales")
      .update(patch)
      .eq("id", id)
      .select("id")
      .maybeSingle()

    if (error) {
      console.error("Error actualizando sucursal:", error)
      return { success: false, error: error.message }
    }
    if (!data) {
      return { success: false, error: "No se encontró la sucursal o no se pudo actualizar." }
    }
    return { success: true }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error desconocido"
    console.error("Error inesperado actualizando sucursal:", error)
    return { success: false, error: msg }
  }
}
