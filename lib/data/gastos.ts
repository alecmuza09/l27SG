import { supabase } from "@/lib/supabase/client"

export const CATEGORIAS_GASTO = [
  { value: "operativo",     label: "Operativo" },
  { value: "mantenimiento", label: "Mantenimiento" },
  { value: "compras",       label: "Compras" },
  { value: "gasolina",      label: "Gasolina" },
  { value: "capacitacion",  label: "Capacitación" },
  { value: "otro",          label: "Otro" },
] as const

export type CategoriaGasto = typeof CATEGORIAS_GASTO[number]["value"]

export interface Gasto {
  id: string
  sucursalId: string
  fecha: string
  descripcion: string
  monto: number
  categoria: string
  hora: string
  // Nuevos campos opcionales
  empleadaId?: string | null
  /** Nombre para mostrar: join de empleados o nombre libre externo */
  empleadaNombre?: string | null
  /** Nombre escrito a mano cuando la persona no está en empleados */
  empleadaNombreLibre?: string | null
  articulo?: string | null
  /** Legacy: rango de fechas (solo lectura / gastos viejos) */
  capacitacionFechaInicio?: string | null
  capacitacionFechaFin?: string | null
  /** Días de capacitación (1–10); reemplaza el rango de fechas */
  diasCapacitacion?: number | null
}

function mapGastoRow(row: any): Gasto {
  const nombreLibre = row.empleada_nombre_libre ?? null
  const diasRaw = row.dias_capacitacion
  return {
    id: row.id,
    sucursalId: row.sucursal_id,
    fecha: row.fecha,
    descripcion: row.descripcion,
    monto: Number(row.monto),
    categoria: row.categoria,
    hora: row.hora,
    empleadaId: row.empleada_id ?? null,
    empleadaNombre: row.empleado?.nombre ?? nombreLibre ?? null,
    empleadaNombreLibre: nombreLibre,
    articulo: row.articulo ?? null,
    capacitacionFechaInicio: row.capacitacion_fecha_inicio ?? null,
    capacitacionFechaFin: row.capacitacion_fecha_fin ?? null,
    diasCapacitacion: diasRaw == null || diasRaw === "" ? null : Number(diasRaw),
  }
}

export async function getGastosFromDB(
  fecha: string,
  sucursalId?: string,
  opciones?: { fechaInicio?: string; fechaFin?: string }
): Promise<Gasto[]> {
  // PostgREST devuelve máximo ~1000 filas por request: se pagina para no truncar rangos largos.
  const PAGE = 1000
  const rows: any[] = []

  for (let offset = 0; ; offset += PAGE) {
    let query = (supabase as any)
      .from("gastos")
      .select(`
        *,
        empleado:empleados(id, nombre)
      `)

    if (opciones?.fechaInicio && opciones?.fechaFin) {
      query = query.gte("fecha", opciones.fechaInicio).lte("fecha", opciones.fechaFin)
    } else {
      query = query.eq("fecha", fecha)
    }

    query = query
      .order("fecha", { ascending: true })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + PAGE - 1)

    if (sucursalId) query = query.eq("sucursal_id", sucursalId)

    const { data, error } = await query

    if (error) {
      console.error("[getGastosFromDB]", error.message)
      return []
    }
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) break
  }

  return rows.map(mapGastoRow)
}

export async function createGastoInDB(gasto: {
  sucursalId: string
  fecha: string
  descripcion: string
  monto: number
  categoria: string
  hora: string
  empleadaId?: string | null
  empleadaNombreLibre?: string | null
  articulo?: string | null
  diasCapacitacion?: number | null
}): Promise<{ data: Gasto | null; error: string | null }> {
  const empleadaId = gasto.empleadaId || null
  const nombreLibre = empleadaId ? null : (gasto.empleadaNombreLibre?.trim() || null)

  const { data, error } = await (supabase as any)
    .from("gastos")
    .insert({
      sucursal_id: gasto.sucursalId,
      fecha: gasto.fecha,
      descripcion: gasto.descripcion,
      monto: gasto.monto,
      categoria: gasto.categoria,
      hora: gasto.hora,
      empleada_id: empleadaId,
      empleada_nombre_libre: nombreLibre,
      articulo: gasto.articulo ?? null,
      // Nuevos gastos ya no usan rango de fechas
      capacitacion_fecha_inicio: null,
      capacitacion_fecha_fin: null,
      dias_capacitacion: gasto.diasCapacitacion ?? null,
    })
    .select("*")
    .single()

  if (error || !data) {
    console.error("[createGastoInDB]", error?.message)
    return { data: null, error: error?.message ?? "Error creando gasto" }
  }

  return { data: mapGastoRow(data), error: null }
}

export async function updateGastoInDB(id: string, cambios: {
  descripcion?: string
  monto?: number
  categoria?: string
  empleadaId?: string | null
  empleadaNombreLibre?: string | null
  articulo?: string | null
  diasCapacitacion?: number | null
}): Promise<{ data: Gasto | null; error: string | null }> {
  const patch: Record<string, unknown> = {
    ...(cambios.descripcion !== undefined && { descripcion: cambios.descripcion }),
    ...(cambios.monto !== undefined && { monto: cambios.monto }),
    ...(cambios.categoria !== undefined && { categoria: cambios.categoria }),
    ...(cambios.articulo !== undefined && { articulo: cambios.articulo }),
    ...(cambios.diasCapacitacion !== undefined && { dias_capacitacion: cambios.diasCapacitacion }),
  }

  if (cambios.empleadaId !== undefined || cambios.empleadaNombreLibre !== undefined) {
    const empleadaId = cambios.empleadaId || null
    patch.empleada_id = empleadaId
    patch.empleada_nombre_libre = empleadaId
      ? null
      : (cambios.empleadaNombreLibre?.trim() || null)
  }

  const { data, error } = await (supabase as any)
    .from("gastos")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single()

  if (error || !data) {
    console.error("[updateGastoInDB]", error?.message)
    return { data: null, error: error?.message ?? "Error actualizando gasto" }
  }

  return { data: mapGastoRow(data), error: null }
}

export async function deleteGastoFromDB(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("gastos").delete().eq("id", id)
  if (error) console.error("[deleteGastoFromDB]", error.message)
  return { error: error?.message ?? null }
}

/** Clave comparable: minúsculas, sin acentos, trim y espacios colapsados. */
export function normalizarNombre(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
}

/**
 * Escrituras canónicas de `empleada_nombre_libre` (todas las sucursales).
 * Agrupa por clave normalizada y elige la más frecuente (empate → la más larga).
 */
export async function getNombresLibresGastos(): Promise<string[]> {
  const PAGE = 1000
  const groups = new Map<string, Map<string, number>>()

  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await (supabase as any)
      .from("gastos")
      .select("empleada_nombre_libre")
      .not("empleada_nombre_libre", "is", null)
      .neq("empleada_nombre_libre", "")
      .range(offset, offset + PAGE - 1)

    if (error) {
      console.error("[getNombresLibresGastos]", error.message)
      return []
    }

    for (const row of data ?? []) {
      const raw = typeof row.empleada_nombre_libre === "string"
        ? row.empleada_nombre_libre.trim()
        : ""
      if (!raw) continue
      const key = normalizarNombre(raw)
      if (!key) continue
      let spellings = groups.get(key)
      if (!spellings) {
        spellings = new Map()
        groups.set(key, spellings)
      }
      spellings.set(raw, (spellings.get(raw) ?? 0) + 1)
    }

    if (!data || data.length < PAGE) break
  }

  const nombres: string[] = []
  for (const spellings of groups.values()) {
    let best = ""
    let bestCount = -1
    for (const [spelling, count] of spellings) {
      if (count > bestCount || (count === bestCount && spelling.length > best.length)) {
        best = spelling
        bestCount = count
      }
    }
    if (best) nombres.push(best)
  }

  return nombres.sort((a, b) => a.localeCompare(b, "es"))
}
