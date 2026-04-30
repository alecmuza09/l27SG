import { supabase } from "@/lib/supabase/client"

/** Igual que BloqueAgenda en la vista de agenda */
export interface AgendaBloque {
  id: string
  empleadoId: string
  tipo: "comida" | "descanso"
  horaInicio?: string
  horaFin?: string
}

export async function getAgendaBloquesFromDB(
  sucursalId: string,
  fecha: string,
): Promise<AgendaBloque[]> {
  if (!sucursalId || !fecha) return []
  try {
    const { data, error } = await (supabase as any)
      .from("agenda_bloques")
      .select("bloques")
      .eq("sucursal_id", sucursalId)
      .eq("fecha", fecha)
      .maybeSingle()

    if (error) {
      console.warn("getAgendaBloquesFromDB:", error.message)
      return []
    }
    const raw = data?.bloques
    if (!raw) return []
    const arr = Array.isArray(raw) ? raw : typeof raw === "string" ? JSON.parse(raw) : []
    return arr.filter(Boolean) as AgendaBloque[]
  } catch (e) {
    console.warn("getAgendaBloquesFromDB", e)
    return []
  }
}

export async function saveAgendaBloquesToDB(
  sucursalId: string,
  fecha: string,
  bloques: AgendaBloque[],
): Promise<boolean> {
  if (!sucursalId || !fecha) return false
  try {
    const { error } = await (supabase as any).from("agenda_bloques").upsert(
      {
        sucursal_id: sucursalId,
        fecha,
        bloques,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "sucursal_id,fecha" },
    )
    if (error) {
      console.error("saveAgendaBloquesToDB:", error.message)
      return false
    }
    return true
  } catch (e) {
    console.error("saveAgendaBloquesToDB", e)
    return false
  }
}
