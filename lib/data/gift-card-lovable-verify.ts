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
  /** Teléfono de quien compró (opcional; Lovable puede no enviarlo) */
  customer_phone?: string | null
  /** Correo de quien compró (opcional) */
  customer_email?: string | null
  /** Nombre del destinatario / titular si es regalo (opcional) */
  recipient_name?: string | null
  purchased_at: string
  redeemed: boolean
  redeemed_at: string | null
  redeemed_by: string | null
  /** ISO o null si la promo no tiene vencimiento */
  expires_at?: string | null
  is_expired?: boolean
}

export type VerificarFolioLovableResult =
  | { outcome: "found"; giftcard: LovableGiftcardPayload; codigoConsultado: string }
  | { outcome: "expired"; giftcard: LovableGiftcardPayload; codigoConsultado: string }
  | { outcome: "voided"; giftcard?: LovableGiftcardPayload; codigoConsultado: string }
  | { outcome: "not_found" }
  | { outcome: "fetch_failed"; kind: "server" | "network" }

export const MSG_FOLIO_ANULADO_LOVABLE = "Folio anulado, no es válido" as const

type LovableVerifyResponse = {
  valid?: boolean
  reason?: string
  ok?: boolean
  giftcard?: LovableGiftcardPayload
}

/** Fecha de vencimiento (YYYY-MM-DD) en zona America/Monterrey a partir de expires_at de Lovable. */
export function fechaVencimientoDesdeExpiresAt(
  expiresAt: string | null | undefined,
): string | null {
  if (!expiresAt) return null
  const trimmed = expiresAt.trim()
  if (!trimmed) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed

  const d = new Date(trimmed)
  if (Number.isNaN(d.getTime())) {
    const m = trimmed.match(/^(\d{4}-\d{2}-\d{2})/)
    return m ? m[1] : null
  }

  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Monterrey",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d)
  } catch {
    return trimmed.slice(0, 10)
  }
}

export function formatearFechaVigenciaLovable(
  expiresAt: string | null | undefined,
): string | null {
  const ymd = fechaVencimientoDesdeExpiresAt(expiresAt)
  if (!ymd) return null
  const [y, m, d] = ymd.split("-").map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export function mensajeGiftCardExpiradaLovable(
  expiresAt?: string | null,
): string {
  const f = formatearFechaVigenciaLovable(expiresAt)
  return f
    ? `Este certificado expiró el ${f} y ya no es válido`
    : "Este certificado expiró y ya no es válido"
}

function esRespuestaExpirada(data: LovableVerifyResponse): boolean {
  if (data.reason === "expired") return true
  if (data.giftcard?.is_expired === true) return true
  return false
}

function esRespuestaAnulada(data: LovableVerifyResponse): boolean {
  return data.reason === "voided"
}

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

      let data: LovableVerifyResponse | null = null
      try {
        data = (await res.json()) as LovableVerifyResponse
      } catch {
        if (!res.ok) {
          sawServerError = true
          continue
        }
      }

      if (data && esRespuestaExpirada(data)) {
        const giftcard: LovableGiftcardPayload = data.giftcard
          ? { ...data.giftcard, is_expired: true }
          : {
              folio: code,
              type: "",
              package_name: "",
              package_option: 0,
              amount: 0,
              customer_name: "",
              purchased_at: "",
              redeemed: false,
              redeemed_at: null,
              redeemed_by: null,
              expires_at: null,
              is_expired: true,
            }
        return { outcome: "expired", giftcard, codigoConsultado: code }
      }

      if (data && esRespuestaAnulada(data)) {
        return {
          outcome: "voided",
          giftcard: data.giftcard,
          codigoConsultado: code,
        }
      }

      if (!res.ok) {
        sawServerError = true
        continue
      }

      if (data?.valid && data.giftcard) {
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
  })
    .then(async (res) => {
      if (res.ok) return
      try {
        const data = (await res.json()) as LovableVerifyResponse
        if (data.reason === "expired" || res.status === 409) {
          console.warn("[Lovable] Canje rechazado: gift card expirada", folio)
        } else {
          console.error("[Lovable] Error al notificar canje:", res.status, data)
        }
      } catch {
        console.error("[Lovable] Error al notificar canje:", res.status)
      }
    })
    .catch((err) => console.error("[Lovable] Error al notificar canje:", err))
}
