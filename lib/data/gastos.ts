import { supabase } from "@/lib/supabase/client"

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
  empleadaNombre?: string | null   // join desde empleados
  articulo?: string | null
  diasCapacitacion?: number | null
}

export async function getGastosFromDB(
  fecha: string,
  sucursalId?: string,
  opciones?: { fechaInicio?: string; fechaFin?: string }
): Promise<Gasto[]> {
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

  query = query.order("fecha", { ascending: true }).order("created_at", { ascending: true })

  if (sucursalId) query = query.eq("sucursal_id", sucursalId)

  const { data, error } = await query

  if (error) {
    console.error("[getGastosFromDB]", error.message)
    return []
  }
  if (!data) return []

  return data.map((row: any) => ({
    id: row.id,
    sucursalId: row.sucursal_id,
    fecha: row.fecha,
    descripcion: row.descripcion,
    monto: Number(row.monto),
    categoria: row.categoria,
    hora: row.hora,
    empleadaId: row.empleada_id ?? null,
    empleadaNombre: row.empleado?.nombre ?? null,
    articulo: row.articulo ?? null,
    diasCapacitacion: row.dias_capacitacion ?? null,
  }))
}

export async function createGastoInDB(gasto: {
  sucursalId: string
  fecha: string
  descripcion: string
  monto: number
  categoria: string
  hora: string
  empleadaId?: string | null
  articulo?: string | null
  diasCapacitacion?: number | null
}): Promise<{ data: Gasto | null; error: string | null }> {
  const { data, error } = await (supabase as any)
    .from("gastos")
    .insert({
      sucursal_id: gasto.sucursalId,
      fecha: gasto.fecha,
      descripcion: gasto.descripcion,
      monto: gasto.monto,
      categoria: gasto.categoria,
      hora: gasto.hora,
      empleada_id: gasto.empleadaId ?? null,
      articulo: gasto.articulo ?? null,
      dias_capacitacion: gasto.diasCapacitacion ?? null,
    })
    .select("*")
    .single()

  if (error || !data) {
    console.error("[createGastoInDB]", error?.message)
    return { data: null, error: error?.message ?? "Error creando gasto" }
  }

  return {
    data: {
      id: data.id,
      sucursalId: data.sucursal_id,
      fecha: data.fecha,
      descripcion: data.descripcion,
      monto: Number(data.monto),
      categoria: data.categoria,
      hora: data.hora,
      empleadaId: data.empleada_id ?? null,
      articulo: data.articulo ?? null,
      diasCapacitacion: data.dias_capacitacion ?? null,
    },
    error: null,
  }
}

export async function updateGastoInDB(id: string, cambios: {
  descripcion?: string
  monto?: number
  categoria?: string
  empleadaId?: string | null
  articulo?: string | null
  diasCapacitacion?: number | null
}): Promise<{ data: Gasto | null; error: string | null }> {
  const { data, error } = await (supabase as any)
    .from("gastos")
    .update({
      ...(cambios.descripcion !== undefined && { descripcion: cambios.descripcion }),
      ...(cambios.monto !== undefined && { monto: cambios.monto }),
      ...(cambios.categoria !== undefined && { categoria: cambios.categoria }),
      ...(cambios.empleadaId !== undefined && { empleada_id: cambios.empleadaId }),
      ...(cambios.articulo !== undefined && { articulo: cambios.articulo }),
      ...(cambios.diasCapacitacion !== undefined && { dias_capacitacion: cambios.diasCapacitacion }),
    })
    .eq("id", id)
    .select("*")
    .single()

  if (error || !data) {
    console.error("[updateGastoInDB]", error?.message)
    return { data: null, error: error?.message ?? "Error actualizando gasto" }
  }

  return {
    data: {
      id: data.id,
      sucursalId: data.sucursal_id,
      fecha: data.fecha,
      descripcion: data.descripcion,
      monto: Number(data.monto),
      categoria: data.categoria,
      hora: data.hora,
      empleadaId: data.empleada_id ?? null,
      articulo: data.articulo ?? null,
      diasCapacitacion: data.dias_capacitacion ?? null,
    },
    error: null,
  }
}

export async function deleteGastoFromDB(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("gastos").delete().eq("id", id)
  if (error) console.error("[deleteGastoFromDB]", error.message)
  return { error: error?.message ?? null }
}
