import type { Json, RealtimeChannel } from "@supabase/supabase-js"
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
    const { data, error } = await supabase
      .from("agenda_bloques")
      .select("bloques")
      .eq("sucursal_id", sucursalId)
      .eq("fecha", fecha)
      .maybeSingle()

    if (error) {
      console.warn("getAgendaBloquesFromDB:", error.message, error.code)
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

export type SaveAgendaBloquesResult =
  | { ok: true }
  | { ok: false; error: string }

export async function saveAgendaBloquesToDB(
  sucursalId: string,
  fecha: string,
  bloques: AgendaBloque[],
): Promise<SaveAgendaBloquesResult> {
  if (!sucursalId || !fecha) return { ok: false, error: "Falta sucursal o fecha" }
  try {
    const payload = {
      sucursal_id: sucursalId,
      fecha,
      bloques: bloques as unknown as Json,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase.from("agenda_bloques").upsert(payload, {
      onConflict: "sucursal_id,fecha",
    })

    if (error) {
      console.error("saveAgendaBloquesToDB:", error.message, error.code, error.details)
      return { ok: false, error: error.message || "Error al guardar en la base de datos" }
    }
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("saveAgendaBloquesToDB", e)
    return { ok: false, error: msg }
  }
}

/** Suscripción para refrescar la agenda cuando otro usuario guarda bloques en la misma sucursal */
export function subscribeAgendaBloquesRealtime(
  sucursalId: string,
  onRemoteChange: () => void,
): RealtimeChannel {
  const channel = supabase
    .channel(`realtime:agenda_bloques:${sucursalId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "agenda_bloques",
        filter: `sucursal_id=eq.${sucursalId}`,
      },
      () => {
        onRemoteChange()
      },
    )
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR") {
        console.warn("subscribeAgendaBloquesRealtime: canal en error (¿Realtime activado para agenda_bloques?)")
      }
    })

  return channel
}

export async function unsubscribeAgendaBloquesRealtime(channel: RealtimeChannel): Promise<void> {
  await supabase.removeChannel(channel)
}
