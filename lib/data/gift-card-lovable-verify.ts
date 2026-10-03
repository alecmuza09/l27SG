/**
 * Consulta pública luna27.mx (Lovable) al registrar o buscar un folio.
 * Sin heurística de prefijo: siempre se intenta verify-code antes de tratar como tarjeta física.
 */

export const LOVABLE_VERIFY_CODE_URL = "https://luna27.mx/api/public/verify-code" as const
export const LOVABLE_PUBLIC_API_KEY = "luna-cursor-2026" as const

export type LovableGiftcardPayload = {
  folio: string
  type: string
  package_name: string
  package_option: number
  amount: number
  customer_name: string
  purchased_at: string
  redeemed: boolean
  redeemed_at: string | null
  redeemed_by: string | null
}

export type VerificarFolioLovableResult =
  | { outcome: "found"; giftcard: LovableGiftcardPayload; codigoConsultado: string }
  | { outcome: "not_found" }
  | { outcome: "fetch_failed"; kind: "server" | "network" }

/** Variantes del folio para consultar Lovable o la BD (p. ej. con y sin guión). */
export function variantesCodigoConsultaLovable(codigo: string): string[] {
  const t = codigo.trim()
  if (!t) return []
  const variants: string[] = []
  const add = (s: string) => {
    const x = s.trim()
    if (x && !variants.includes(x)) variants.push(x)
  }
  add(t)
  const sinGuion = t.replace(/-/g, "")
  if (sinGuion !== t) add(sinGuion)
  return variants
}

export async function verificarFolioEnLovable(folio: string): Promise<VerificarFolioLovableResult> {
  const variants = variantesCodigoConsultaLovable(folio)
  if (variants.length === 0) return { outcome: "not_found" }

  let sawServerError = false
  let sawNetworkError = false

  for (const code of variants) {
    try {
      const res = await fetch(
        `${LOVABLE_VERIFY_CODE_URL}?code=${encodeURIComponent(code)}`,
        { headers: { "x-api-key": LOVABLE_PUBLIC_API_KEY } },
      )
      if (res.status === 404 || res.status === 400) continue
      if (!res.ok) {
        sawServerError = true
        continue
      }
      const data = (await res.json()) as { valid?: boolean; giftcard?: LovableGiftcardPayload }
      if (data.valid && data.giftcard) {
        return { outcome: "found", giftcard: data.giftcard, codigoConsultado: code }
      }
    } catch {
      sawNetworkError = true
    }
  }

  if (sawNetworkError && !sawServerError) return { outcome: "fetch_failed", kind: "network" }
  if (sawServerError) return { outcome: "fetch_failed", kind: "server" }
  return { outcome: "not_found" }
}

export function notificarCanjeEnLovable(folio: string, redeemedBy: string): void {
  fetch(LOVABLE_VERIFY_CODE_URL, {
    method: "POST",
    headers: { "x-api-key": LOVABLE_PUBLIC_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ code: folio, redeemed_by: redeemedBy }),
  }).catch((err) => console.error("[Lovable] Error al notificar canje:", err))
}
