"use server"

import {
  LOVABLE_PUBLIC_API_KEY,
  LOVABLE_VERIFY_CODE_URL,
} from "@/lib/data/gift-card-lovable-verify"
import type { LovableVipSaleItem } from "@/lib/types/vip-pass"

const LOVABLE_VIP_SALES_TIMEOUT_MS = 6000

export type { LovableVipSaleItem }

export type ConsultarVipSalesResult =
  | { ok: true; items: LovableVipSaleItem[] }
  | { ok: false; error: string }

/** Origen público de luna27.mx a partir de la misma URL que verify-code. */
function lovablePublicOrigin(): string {
  return new URL(LOVABLE_VERIFY_CODE_URL).origin
}

/**
 * Consulta ventas VIP Pass en luna27.mx (solo lectura).
 * from/to = folios de línea de la campaña activa (p. ej. VIP3000 … VIP3999).
 * La llave solo viaja en este server action.
 */
export async function consultarVentasVipLovable(params: {
  fromFolio: string
  toFolio: string
}): Promise<ConsultarVipSalesResult> {
  const from = params.fromFolio.trim()
  const to = params.toFolio.trim()
  if (!from || !to) return { ok: false, error: "Rango inválido" }

  const url =
    `${lovablePublicOrigin()}/api/public/vip-sales` +
    `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), LOVABLE_VIP_SALES_TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "x-api-key": LOVABLE_PUBLIC_API_KEY },
      signal: controller.signal,
      cache: "no-store",
    })

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` }
    }

    let data: unknown
    try {
      data = await res.json()
    } catch {
      return { ok: false, error: "JSON inválido" }
    }

    const rawItems = (data as { items?: unknown })?.items
    if (!Array.isArray(rawItems)) {
      return { ok: false, error: "Respuesta sin items" }
    }

    const items: LovableVipSaleItem[] = []
    for (const raw of rawItems) {
      if (!raw || typeof raw !== "object") continue
      const row = raw as Record<string, unknown>
      const folio = String(row.folio ?? "").trim()
      const statusRaw = String(row.status ?? "").trim().toLowerCase()
      if (!folio) continue
      if (statusRaw !== "paid" && statusRaw !== "voided") continue

      items.push({
        folio,
        status: statusRaw,
        customer_name: String(row.customer_name ?? ""),
        package_name: String(row.package_name ?? ""),
        amount: Number(row.amount) || 0,
        purchased_at: String(row.purchased_at ?? ""),
      })
    }

    return { ok: true, items }
  } catch (err) {
    const msg =
      err instanceof Error && err.name === "AbortError"
        ? "timeout"
        : "network"
    return { ok: false, error: msg }
  } finally {
    clearTimeout(timer)
  }
}
