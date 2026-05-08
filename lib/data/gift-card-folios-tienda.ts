/**
 * Folios de gift card vendidos en la tienda en línea (prefijo LUNA[1-4]m + 4 caracteres).
 */

export const FOLIO_TIENDA_ONLINE_LONGITUD = 10 as const

export const MSG_FOLIO_TIENDA_LONGITUD =
  "El folio debe tener exactamente 10 caracteres (6 del prefijo + 4 aleatorios)."

export const MSG_FOLIO_TIENDA_INVALIDO =
  "El folio no es válido. Verifica el código de la tienda en línea."

export const MSG_FOLIO_YA_REGISTRADO = "Este folio ya fue registrado previamente"

const BASES_FOLIO_TIENDA = ["LUNA1M", "LUNA2M", "LUNA3M", "LUNA4M"] as const

const DEFINICION_POR_PREFIJO: Record<string, { servicio: string; valor: number }> = {
  LUNA1M: { servicio: "Mani Spa c/gel", valor: 559 },
  LUNA2M: { servicio: "Mani y Pedi Jelly Detox", valor: 770 },
  LUNA3M: { servicio: "Mani y Pedi SPA", valor: 799 },
  LUNA4M: { servicio: "Manicure Luna + Cápsula", valor: 599 },
}

export type AnalisisFolioTienda =
  | { tipo: "no_aplica" }
  | { tipo: "valido"; codigoNormalizado: string; servicio: string; valor: number }
  | { tipo: "error"; mensaje: string }

/**
 * True solo si el texto es/puede ser un folio LUNA[1-4]m… (tienda en línea).
 * No basta con "LUNA" (p. ej. otros códigos tipo LUNA27-… no entran aquí).
 */
export function intentandoFormatoTiendaEnLinea(codigo: string): boolean {
  const raw = codigo.trim()
  if (raw.length <= 4) return false
  const u = raw.toUpperCase()
  return BASES_FOLIO_TIENDA.some((b) => b.startsWith(u) || u.startsWith(b))
}

/**
 * Interpreta folio tienda en línea para autocompletar o validar.
 * La regla de 10 caracteres solo aplica cuando el código coincide con LUNA[1-4]m + 4 caracteres;
 * cualquier otro código devuelve no_aplica (sin restricción de longitud en el caller).
 */
export function analizarFolioTiendaEnLinea(codigo: string): AnalisisFolioTienda {
  const raw = codigo.trim()
  if (!raw) return { tipo: "no_aplica" }

  if (!intentandoFormatoTiendaEnLinea(raw)) return { tipo: "no_aplica" }

  if (raw.length !== FOLIO_TIENDA_ONLINE_LONGITUD) {
    return { tipo: "error", mensaje: MSG_FOLIO_TIENDA_LONGITUD }
  }

  const digito = raw[4]
  const m = raw[5]
  if (!/^[1-4]$/.test(digito) || (m !== "m" && m !== "M")) {
    return { tipo: "error", mensaje: MSG_FOLIO_TIENDA_INVALIDO }
  }

  const sufijo = raw.slice(6)
  if (!/^[A-Za-z0-9]{4}$/.test(sufijo)) {
    return { tipo: "error", mensaje: MSG_FOLIO_TIENDA_INVALIDO }
  }

  const key = `LUNA${digito}M`
  const def = DEFINICION_POR_PREFIJO[key]
  if (!def) {
    return { tipo: "error", mensaje: MSG_FOLIO_TIENDA_INVALIDO }
  }

  const codigoNormalizado = `LUNA${digito}m${sufijo.toUpperCase()}`
  return {
    tipo: "valido",
    codigoNormalizado,
    servicio: def.servicio,
    valor: def.valor,
  }
}

/** Solo resultado positivo cuando el folio está completo y es válido (útil para autocompletar en vivo). */
export function detectarFolioTiendaCompleto(
  codigo: string,
): Extract<AnalisisFolioTienda, { tipo: "valido" }> | null {
  const a = analizarFolioTiendaEnLinea(codigo)
  return a.tipo === "valido" ? a : null
}
