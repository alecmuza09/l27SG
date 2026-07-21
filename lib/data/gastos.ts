import { supabase } from "@/lib/supabase/client"

export interface Gasto {
  id: string
  sucursalId: string
  fecha: string
  descripcion: string
  monto: number
  categoria: string
  hora: string
}

export async function getGastosFromDB(fecha: string, sucursalId?: string): Promise<Gasto[]> {
  let query = (supabase as any)
    .from("gastos")
    .select("*")
    .eq("fecha", fecha)
    .order("created_at", { ascending: true })

  if (sucursalId) query = query.eq("sucursal_id", sucursalId)

  const { data, error } = await query

  if (error) {
    console.error("[getGastosFromDB]", error.message)
    return []
  }
  if (!data) return []

  return data.map(g => ({
    id: g.id,
    sucursalId: g.sucursal_id,
    fecha: g.fecha,
    descripcion: g.descripcion,
    monto: Number(g.monto),
    categoria: g.categoria,
    hora: g.hora,
  }))
}

export async function createGastoInDB(gasto: {
  sucursalId: string
  fecha: string
  descripcion: string
  monto: number
  categoria: string
  hora: string
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
    },
    error: null,
  }
}

export async function deleteGastoFromDB(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("gastos").delete().eq("id", id)
  if (error) console.error("[deleteGastoFromDB]", error.message)
  return { error: error?.message ?? null }
}
