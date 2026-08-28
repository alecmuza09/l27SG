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
  /** Hora de inicio del rango (HH:mm), opcional. undefined = no tocar; null/"" = sin horario específico. */
  horaInicio?: string | null
  /** Hora de fin del rango (HH:mm), opcional. undefined = no tocar; null/"" = sin horario específico. */
  horaFin?: string | null
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
  horaInicio: string | null
  horaFin: string | null
}

/** Override de sucursal (y horario opcional) para un empleado en una fecha. */
export interface AsignacionSucursalDiaInfo {
  sucursalId: string
  horaInicio: string | null
  horaFin: string | null
}

function normalizarHora(hora: string | null | undefined): string | null {
  if (!hora) return null
  return hora.substring(0, 5)
}

/** Override por empleado para una fecha (solo filas existentes). */
export async function getAsignacionesPorFecha(fecha: string): Promise<Map<string, AsignacionSucursalDiaInfo>> {
  const map = new Map<string, AsignacionSucursalDiaInfo>()
  try {
    const { data, error } = await supabase
      .from("empleado_sucursal_dia")
      .select("empleado_id, sucursal_id, hora_inicio, hora_fin")
      .eq("fecha", fecha)

    if (error || !data) return map
    console.log("[empleado_sucursal_dia] getAsignacionesPorFecha", fecha, data)
    for (const row of data as {
      empleado_id: string
      sucursal_id: string
      hora_inicio: string | null
      hora_fin: string | null
    }[]) {
      map.set(row.empleado_id, {
        sucursalId: row.sucursal_id,
        horaInicio: normalizarHora(row.hora_inicio),
        horaFin: normalizarHora(row.hora_fin),
      })
    }
    return map
  } catch {
    return map
  }
}

function horaEnRango(hora: string, inicio: string, fin: string): boolean {
  return hora >= inicio && hora < fin
}

/** Asignación con rango horario parcial (p. ej. 15:00–20:00 en otra sucursal). */
export function esAsignacionParcial(ov: AsignacionSucursalDiaInfo | null | undefined): boolean {
  return !!(ov?.horaInicio && ov?.horaFin)
}

/**
 * ¿La empleada debe aparecer en la columna de la sucursal vista ese día?
 * - Sin override: solo en sucursal base.
 * - Override día completo: solo en sucursal asignada.
 * - Override parcial: en sucursal base Y en sucursal asignada (slots bloqueados por hora en la UI).
 */
export function empleadoVisibleEnSucursalAgenda(
  sucursalBaseId: string,
  sucursalVistaId: string,
  override: AsignacionSucursalDiaInfo | null | undefined,
): boolean {
  if (!override) return sucursalBaseId === sucursalVistaId
  if (esAsignacionParcial(override)) {
    return sucursalVistaId === sucursalBaseId || sucursalVistaId === override.sucursalId
  }
  return sucursalVistaId === override.sucursalId
}

/**
 * ¿El slot HH:mm está disponible en la sucursal vista según la asignación del día?
 * Solo aplica bloqueos cuando hay override parcial; día completo se resuelve por visibilidad de columna.
 */
export function isSlotDisponiblePorAsignacionSucursal(
  slot: string,
  sucursalVistaId: string,
  sucursalBaseId: string,
  override: AsignacionSucursalDiaInfo | null | undefined,
): boolean {
  if (!override || !esAsignacionParcial(override)) return true
  const enRango = horaEnRango(slot, override.horaInicio!, override.horaFin!)
  if (sucursalVistaId === override.sucursalId) return enRango
  if (sucursalVistaId === sucursalBaseId) return !enRango
  return true
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
 * Empleadas activas visibles en la agenda de `sucursalId` para `fecha`.
 * - Asignación día completo: solo en sucursal destino.
 * - Asignación parcial: en sucursal base y destino (bloqueo por slot en la UI).
 * Si `hora` (HH:mm) se provee, filtra además por disponibilidad en ese momento
 * (útil al reservar citas en un horario concreto).
 */
export async function getEmpleadosParaAgendaPorSucursalYDia(
  sucursalId: string,
  fecha: string,
  hora?: string,
): Promise<Empleado[]> {
  try {
    const overrides = await getAsignacionesPorFecha(fecha)

    const incluir = (empleadoId: string, sucursalBaseId: string): boolean => {
      const ov = overrides.get(empleadoId) ?? null
      if (!empleadoVisibleEnSucursalAgenda(sucursalBaseId, sucursalId, ov)) return false
      if (hora) {
        return isSlotDisponiblePorAsignacionSucursal(hora, sucursalId, sucursalBaseId, ov)
      }
      return true
    }

    const [{ data: baseAqui }, { data: overridesRows }] = await Promise.all([
      supabase.from("empleados").select("*").eq("activo", true).eq("sucursal_id", sucursalId),
      supabase.from("empleado_sucursal_dia").select("empleado_id").eq("fecha", fecha).eq("sucursal_id", sucursalId),
    ])

    const resultMap = new Map<string, (typeof baseAqui)[0]>()

    for (const row of baseAqui ?? []) {
      if (incluir(row.id, row.sucursal_id)) {
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
        if (incluir(row.id, row.sucursal_id)) {
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
  hora_inicio: string | null
  hora_fin: string | null
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
  const { empleadoId, fecha, sucursalId, usuarioId, horaInicio, horaFin } = params
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
      .select("id, sucursal_id, hora_inicio, hora_fin")
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
        hora_inicio: null,
        hora_fin: null,
      })
      return { success: true }
    }

    const accion: "asignar" | "cambiar" = prevRow ? "cambiar" : "asignar"

    const upsertPayload: Record<string, unknown> = {
      empleado_id: empleadoId,
      fecha,
      sucursal_id: sucursalId,
      created_by: usuarioId ?? null,
      updated_at: new Date().toISOString(),
    }
    // undefined = no tocar el horario existente; null/"" = limpiarlo explícitamente.
    if (horaInicio !== undefined) upsertPayload.hora_inicio = horaInicio || null
    if (horaFin !== undefined) upsertPayload.hora_fin = horaFin || null

    const { error: upErr } = await supabase.from("empleado_sucursal_dia").upsert(upsertPayload, {
      onConflict: "empleado_id,fecha",
    })

    if (upErr) return { success: false, error: upErr.message }

    await insertHistorial({
      empleado_id: empleadoId,
      fecha,
      sucursal_efectiva_anterior: efectivaAntes,
      sucursal_efectiva_nueva: sucursalId,
      accion,
      usuario_id: usuarioId ?? null,
      hora_inicio: horaInicio !== undefined ? horaInicio || null : (prevRow?.hora_inicio as string | null | undefined) ?? null,
      hora_fin: horaFin !== undefined ? horaFin || null : (prevRow?.hora_fin as string | null | undefined) ?? null,
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
      hora_inicio: null,
      hora_fin: null,
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
        hora_inicio,
        hora_fin,
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
        horaInicio: normalizarHora(row.hora_inicio),
        horaFin: normalizarHora(row.hora_fin),
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
): Promise<AsignacionSucursalDiaInfo | null> {
  try {
    const { data } = await supabase
      .from("empleado_sucursal_dia")
      .select("sucursal_id, hora_inicio, hora_fin")
      .eq("empleado_id", empleadoId)
      .eq("fecha", fecha)
      .maybeSingle()
    if (!data?.sucursal_id) return null
    return {
      sucursalId: data.sucursal_id as string,
      horaInicio: normalizarHora(data.hora_inicio as string | null),
      horaFin: normalizarHora(data.hora_fin as string | null),
    }
  } catch {
    return null
  }
}
