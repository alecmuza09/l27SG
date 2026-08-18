/**
 * Asignación temporal de sucursal por empleado y fecha (no modifica empleados.sucursal_id).
 */

import { supabase } from "@/lib/supabase/client"
import { transformEmpleado, type Empleado } from "@/lib/data/empleados"

export interface GuardarAsignacionParams {
  empleadoId: string
  fecha: string // YYYY-MM-DD
  sucursalId: string
  usuarioId?: string | null
}

export interface HistorialEmpleadoSucursalDiaItem {
  id: string
  empleadoId: string
  empleadoNombre: string
  fecha: string
  sucursalEfectivaAnteriorId: string | null
  sucursalEfectivaNuevaId: string | null
  accion: "asignar" | "cambiar" | "quitar"
  usuarioId: string | null
  createdAt: string
}

/** Override por empleado para una fecha (solo filas existentes). */
export async function getAsignacionesPorFecha(fecha: string): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  try {
    const { data, error } = await supabase
      .from("empleado_sucursal_dia")
      .select("empleado_id, sucursal_id")
      .eq("fecha", fecha)

    if (error || !data) return map
    for (const row of data as { empleado_id: string; sucursal_id: string }[]) {
      map.set(row.empleado_id, row.sucursal_id)
    }
    return map
  } catch {
    return map
  }
}

function efectivaDesdeMap(
  empleadoId: string,
  sucursalBaseId: string,
  overrides: Map<string, string>,
): string {
  return overrides.get(empleadoId) ?? sucursalBaseId
}

function sinAcentos(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

/**
 * FIX PUNTUAL: hoy ninguna pantalla de agenda respeta `dias_trabajo` (es un campo
 * puramente informativo), así que cualquier empleada activa aparece todos los días
 * sin importar qué días tenga marcados. Eso es invisible para quienes trabajan casi
 * toda la semana, pero rompe visiblemente el caso de Vanesa López, que solo debe
 * aparecer el/los día(s) que tiene marcados (p. ej. solo Sábado).
 *
 * Esto NO generaliza el filtrado por `dias_trabajo` a todo el equipo (para no
 * cambiar el comportamiento actual de otras empleadas ni su forma de almacenarse);
 * es un filtro acotado únicamente a esta empleada por nombre. Si en el futuro se
 * decide aplicar `dias_trabajo` a todas las empleadas, este filtro debe eliminarse
 * a favor de una solución general.
 */
function filtrarSoloDiasTrabajoVanesaLopez(empleados: Empleado[], fecha: string): Empleado[] {
  const diaSemana = new Date(fecha + "T12:00:00").getDay()
  return empleados.filter((e) => {
    const esVanesaLopez = sinAcentos(e.nombre) === "vanesa" && sinAcentos(e.apellido) === "lopez"
    if (!esVanesaLopez) return true
    if (!e.diasTrabajo || e.diasTrabajo.length === 0) return true
    return e.diasTrabajo.includes(diaSemana)
  })
}

/**
 * Empleadas activas cuya sucursal efectiva en `fecha` coincide con `sucursalId`.
 */
export async function getEmpleadosParaAgendaPorSucursalYDia(
  sucursalId: string,
  fecha: string,
): Promise<Empleado[]> {
  try {
    const overrides = await getAsignacionesPorFecha(fecha)

    const [{ data: baseAqui }, { data: overridesRows }] = await Promise.all([
      supabase.from("empleados").select("*").eq("activo", true).eq("sucursal_id", sucursalId),
      supabase.from("empleado_sucursal_dia").select("empleado_id").eq("fecha", fecha).eq("sucursal_id", sucursalId),
    ])

    const resultMap = new Map<string, (typeof baseAqui)[0]>()

    for (const row of baseAqui ?? []) {
      if (efectivaDesdeMap(row.id, row.sucursal_id, overrides) === sucursalId) {
        resultMap.set(row.id, row)
      }
    }

    const incomingIds = Array.from(
      new Set(
        (overridesRows as { empleado_id: string }[] | null)?.map((r) => r.empleado_id) ?? [],
      ),
    ).filter((id) => !resultMap.has(id))

    if (incomingIds.length > 0) {
      const { data: incomingRows } = await supabase
        .from("empleados")
        .select("*")
        .eq("activo", true)
        .in("id", incomingIds)

      for (const row of incomingRows ?? []) {
        if (efectivaDesdeMap(row.id, row.sucursal_id, overrides) === sucursalId) {
          resultMap.set(row.id, row)
        }
      }
    }

    const list = [...resultMap.values()].sort((a, b) =>
      `${a.nombre} ${a.apellido}`.localeCompare(`${b.nombre} ${b.apellido}`, "es"),
    )
    const fechaAgenda = fecha
    const conVigenciaValida = list.map(transformEmpleado).filter(e => {
      if (!e.fechaContratoHasta) return true
      return e.fechaContratoHasta >= fechaAgenda
    })
    return filtrarSoloDiasTrabajoVanesaLopez(conVigenciaValida, fecha)
  } catch (e) {
    console.error("getEmpleadosParaAgendaPorSucursalYDia:", e)
    return []
  }
}

async function insertHistorial(payload: {
  empleado_id: string
  fecha: string
  sucursal_efectiva_anterior: string | null
  sucursal_efectiva_nueva: string | null
  accion: "asignar" | "cambiar" | "quitar"
  usuario_id: string | null
}) {
  const { error } = await supabase.from("empleado_sucursal_dia_historial").insert(payload)
  if (error) console.error("empleado_sucursal_dia_historial:", error)
}

/**
 * Si sucursal destino = sucursal base del empleado, elimina override del día.
 */
export async function guardarAsignacionSucursalDia(
  params: GuardarAsignacionParams,
): Promise<{ success: boolean; error?: string }> {
  const { empleadoId, fecha, sucursalId, usuarioId } = params
  try {
    const { data: emp, error: empErr } = await supabase
      .from("empleados")
      .select("id, sucursal_id")
      .eq("id", empleadoId)
      .single()

    if (empErr || !emp) return { success: false, error: "Empleada no encontrada" }

    const baseId = emp.sucursal_id as string

    const { data: prevRow } = await supabase
      .from("empleado_sucursal_dia")
      .select("id, sucursal_id")
      .eq("empleado_id", empleadoId)
      .eq("fecha", fecha)
      .maybeSingle()

    const efectivaAntes = (prevRow?.sucursal_id as string | undefined) ?? baseId

    if (sucursalId === baseId) {
      if (!prevRow) return { success: true }
      const { error: delErr } = await supabase
        .from("empleado_sucursal_dia")
        .delete()
        .eq("empleado_id", empleadoId)
        .eq("fecha", fecha)
      if (delErr) return { success: false, error: delErr.message }
      await insertHistorial({
        empleado_id: empleadoId,
        fecha,
        sucursal_efectiva_anterior: efectivaAntes,
        sucursal_efectiva_nueva: baseId,
        accion: "quitar",
        usuario_id: usuarioId ?? null,
      })
      return { success: true }
    }

    const accion: "asignar" | "cambiar" = prevRow ? "cambiar" : "asignar"

    const { error: upErr } = await supabase.from("empleado_sucursal_dia").upsert(
      {
        empleado_id: empleadoId,
        fecha,
        sucursal_id: sucursalId,
        created_by: usuarioId ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "empleado_id,fecha" },
    )

    if (upErr) return { success: false, error: upErr.message }

    await insertHistorial({
      empleado_id: empleadoId,
      fecha,
      sucursal_efectiva_anterior: efectivaAntes,
      sucursal_efectiva_nueva: sucursalId,
      accion,
      usuario_id: usuarioId ?? null,
    })

    return { success: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error inesperado"
    return { success: false, error: msg }
  }
}

/** Elimina la asignación del día (vuelve a sucursal base). */
export async function quitarAsignacionSucursalDia(
  empleadoId: string,
  fecha: string,
  usuarioId?: string | null,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: emp, error: empErr } = await supabase
      .from("empleados")
      .select("sucursal_id")
      .eq("id", empleadoId)
      .single()

    if (empErr || !emp) return { success: false, error: "Empleada no encontrada" }

    const baseId = emp.sucursal_id as string

    const { data: prevRow } = await supabase
      .from("empleado_sucursal_dia")
      .select("sucursal_id")
      .eq("empleado_id", empleadoId)
      .eq("fecha", fecha)
      .maybeSingle()

    if (!prevRow) return { success: true }

    const efectivaAntes = prevRow.sucursal_id as string

    const { error: delErr } = await supabase
      .from("empleado_sucursal_dia")
      .delete()
      .eq("empleado_id", empleadoId)
      .eq("fecha", fecha)

    if (delErr) return { success: false, error: delErr.message }

    await insertHistorial({
      empleado_id: empleadoId,
      fecha,
      sucursal_efectiva_anterior: efectivaAntes,
      sucursal_efectiva_nueva: baseId,
      accion: "quitar",
      usuario_id: usuarioId ?? null,
    })

    return { success: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error inesperado"
    return { success: false, error: msg }
  }
}

export async function getHistorialEmpleadoSucursalDia(options?: {
  empleadoId?: string
  fechaDesde?: string
  fechaHasta?: string
  limit?: number
}): Promise<HistorialEmpleadoSucursalDiaItem[]> {
  const limit = options?.limit ?? 80
  try {
    let q = supabase
      .from("empleado_sucursal_dia_historial")
      .select(
        `
        id,
        empleado_id,
        fecha,
        sucursal_efectiva_anterior,
        sucursal_efectiva_nueva,
        accion,
        usuario_id,
        created_at,
        empleado:empleados(nombre, apellido)
      `,
      )
      .order("created_at", { ascending: false })
      .limit(limit)

    if (options?.empleadoId) q = q.eq("empleado_id", options.empleadoId)
    if (options?.fechaDesde) q = q.gte("fecha", options.fechaDesde)
    if (options?.fechaHasta) q = q.lte("fecha", options.fechaHasta)

    const { data, error } = await q
    if (error || !data) return []

    return (data as any[]).map((row) => {
      const emp = row.empleado as { nombre?: string; apellido?: string } | null
      const nombre = emp ? `${emp.nombre ?? ""} ${emp.apellido ?? ""}`.trim() : "—"
      return {
        id: row.id,
        empleadoId: row.empleado_id,
        empleadoNombre: nombre,
        fecha: row.fecha,
        sucursalEfectivaAnteriorId: row.sucursal_efectiva_anterior,
        sucursalEfectivaNuevaId: row.sucursal_efectiva_nueva,
        accion: row.accion,
        usuarioId: row.usuario_id,
        createdAt: row.created_at,
      }
    })
  } catch {
    return []
  }
}

/** Override explícito para ese día, o null si aplica sucursal base. */
export async function getOverrideSucursalDia(
  empleadoId: string,
  fecha: string,
): Promise<string | null> {
  try {
    const { data } = await supabase
      .from("empleado_sucursal_dia")
      .select("sucursal_id")
      .eq("empleado_id", empleadoId)
      .eq("fecha", fecha)
      .maybeSingle()
    return (data?.sucursal_id as string | undefined) ?? null
  } catch {
    return null
  }
}
