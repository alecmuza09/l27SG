import { supabase } from "@/lib/supabase/client"

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type TipoAusencia =
  | "falta"
  | "falta_justificada"
  | "permiso"
  | "incapacidad"
  | "salida"
  | "tarde"

export type EstatusAusencia =
  | "pendiente"
  | "aprobada"
  | "rechazada"
  | "cancelada"

export interface Ausencia {
  id: string
  empleadoId: string
  empleadoNombre?: string   // join con empleados
  tipo: TipoAusencia
  motivo: string | null
  fechaInicio: string       // "YYYY-MM-DD"
  fechaFin: string
  duracionHoras: number | null
  estatus: EstatusAusencia
  aprobadoPor: string | null
  fechaAprobacion: string | null
  motivoRechazo: string | null
  notas: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateAusenciaInput {
  empleadoId: string
  tipo: TipoAusencia
  motivo?: string
  fechaInicio: string
  fechaFin: string
  duracionHoras?: number
  notas?: string
}

// ─── Labels legibles ──────────────────────────────────────────────────────────

export const TIPO_AUSENCIA_LABELS: Record<TipoAusencia, string> = {
  falta:            "Falta injustificada",
  falta_justificada:"Falta justificada",
  permiso:          "Permiso personal",
  incapacidad:      "Incapacidad médica",
  salida:           "Salida anticipada",
  tarde:            "Llegada tarde",
}

export const ESTATUS_AUSENCIA_LABELS: Record<EstatusAusencia, string> = {
  pendiente:  "Pendiente",
  aprobada:   "Aprobada",
  rechazada:  "Rechazada",
  cancelada:  "Cancelada",
}

export const ESTATUS_AUSENCIA_COLORS: Record<EstatusAusencia, string> = {
  pendiente:  "bg-yellow-100 text-yellow-800 border-yellow-200",
  aprobada:   "bg-green-100 text-green-800 border-green-200",
  rechazada:  "bg-red-100 text-red-800 border-red-200",
  cancelada:  "bg-gray-100 text-gray-700 border-gray-200",
}

export const TIPO_AUSENCIA_COLORS: Record<TipoAusencia, string> = {
  falta:            "bg-red-50 text-red-700",
  falta_justificada:"bg-orange-50 text-orange-700",
  permiso:          "bg-blue-50 text-blue-700",
  incapacidad:      "bg-purple-50 text-purple-700",
  salida:           "bg-amber-50 text-amber-700",
  tarde:            "bg-slate-50 text-slate-700",
}

// ─── Row mapper ───────────────────────────────────────────────────────────────

function mapRow(row: any, empleadoNombre?: string): Ausencia {
  return {
    id:              row.id,
    empleadoId:      row.empleado_id,
    empleadoNombre:  empleadoNombre ?? row.empleado_nombre ?? undefined,
    tipo:            row.tipo as TipoAusencia,
    motivo:          row.motivo ?? null,
    fechaInicio:     row.fecha_inicio,
    fechaFin:        row.fecha_fin,
    duracionHoras:   row.duracion_horas ?? null,
    estatus:         row.estatus as EstatusAusencia,
    aprobadoPor:     row.aprobado_por ?? null,
    fechaAprobacion: row.fecha_aprobacion ?? null,
    motivoRechazo:   row.motivo_rechazo ?? null,
    notas:           row.notas ?? null,
    createdAt:       row.created_at,
    updatedAt:       row.updated_at,
  }
}

// ─── CRUD ──────────────────────────────────────────────────────────────────────

export async function getAusenciasFromDB(filters?: {
  empleadoId?: string
  estatus?: EstatusAusencia
  tipo?: TipoAusencia
  fechaDesde?: string
  fechaHasta?: string
}): Promise<Ausencia[]> {
  let query = supabase
    .from("ausencias")
    .select(`
      *,
      empleados (
        nombre,
        apellido
      )
    `)
    .order("fecha_inicio", { ascending: false })

  if (filters?.empleadoId) query = query.eq("empleado_id", filters.empleadoId)
  if (filters?.estatus)    query = query.eq("estatus", filters.estatus)
  if (filters?.tipo)       query = query.eq("tipo", filters.tipo)
  if (filters?.fechaDesde) query = query.gte("fecha_inicio", filters.fechaDesde)
  if (filters?.fechaHasta) query = query.lte("fecha_fin", filters.fechaHasta)

  const { data, error } = await query

  if (error) {
    console.error("Error cargando ausencias:", error)
    return []
  }

  return (data ?? []).map((row) => {
    const nombre = row.empleados
      ? `${row.empleados.nombre} ${row.empleados.apellido}`
      : undefined
    return mapRow(row, nombre)
  })
}

export async function createAusencia(
  input: CreateAusenciaInput
): Promise<{ success: boolean; ausencia?: Ausencia; error?: string }> {
  const { data, error } = await supabase
    .from("ausencias")
    .insert({
      empleado_id:    input.empleadoId,
      tipo:           input.tipo,
      motivo:         input.motivo ?? null,
      fecha_inicio:   input.fechaInicio,
      fecha_fin:      input.fechaFin,
      duracion_horas: input.duracionHoras ?? null,
      notas:          input.notas ?? null,
    })
    .select()
    .single()

  if (error) {
    console.error("Error creando ausencia:", error)
    return { success: false, error: error.message }
  }

  return { success: true, ausencia: mapRow(data) }
}

export async function aprobarAusencia(
  id: string,
  aprobadoPor: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("ausencias")
    .update({
      estatus:          "aprobada",
      aprobado_por:     aprobadoPor,
      fecha_aprobacion: new Date().toISOString(),
      motivo_rechazo:   null,
    })
    .eq("id", id)

  if (error) {
    console.error("Error aprobando ausencia:", error)
    return { success: false, error: error.message }
  }
  return { success: true }
}

export async function rechazarAusencia(
  id: string,
  aprobadoPor: string,
  motivoRechazo: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("ausencias")
    .update({
      estatus:          "rechazada",
      aprobado_por:     aprobadoPor,
      fecha_aprobacion: new Date().toISOString(),
      motivo_rechazo:   motivoRechazo,
    })
    .eq("id", id)

  if (error) {
    console.error("Error rechazando ausencia:", error)
    return { success: false, error: error.message }
  }
  return { success: true }
}

export async function cancelarAusencia(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("ausencias")
    .update({ estatus: "cancelada" })
    .eq("id", id)

  if (error) {
    console.error("Error cancelando ausencia:", error)
    return { success: false, error: error.message }
  }
  return { success: true }
}

export async function deleteAusencia(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from("ausencias").delete().eq("id", id)

  if (error) {
    console.error("Error eliminando ausencia:", error)
    return { success: false, error: error.message }
  }
  return { success: true }
}

// Resumen de ausencias por empleado (para dashboard)
export async function getResumenAusencias(
  empleadoId: string,
  anio: number
): Promise<Record<TipoAusencia, number>> {
  const fechaDesde = `${anio}-01-01`
  const fechaHasta = `${anio}-12-31`

  const ausencias = await getAusenciasFromDB({
    empleadoId,
    fechaDesde,
    fechaHasta,
  })

  const aprobadas = ausencias.filter((a) => a.estatus === "aprobada")

  return {
    falta:            aprobadas.filter((a) => a.tipo === "falta").length,
    falta_justificada:aprobadas.filter((a) => a.tipo === "falta_justificada").length,
    permiso:          aprobadas.filter((a) => a.tipo === "permiso").length,
    incapacidad:      aprobadas.filter((a) => a.tipo === "incapacidad").length,
    salida:           aprobadas.filter((a) => a.tipo === "salida").length,
    tarde:            aprobadas.filter((a) => a.tipo === "tarde").length,
  }
}
