export type Periodo = "semana" | "mes" | "mes_anterior" | "trimestre" | "año" | "personalizado"

export const OPCIONES_PERIODO = [
  { value: "semana", label: "Esta Semana" },
  { value: "mes", label: "Este Mes" },
  { value: "mes_anterior", label: "Mes Anterior" },
  { value: "trimestre", label: "Trimestre" },
  { value: "año", label: "Este Año" },
  { value: "personalizado", label: "Personalizado…" },
] as const

export function localFmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function calcularPeriodo(
  periodo: Periodo,
  customDesde?: string,
  customHasta?: string,
): { fechaDesde: string; fechaHasta: string; label: string } {
  const hoy = new Date()
  const hoyStr = localFmt(hoy)
  switch (periodo) {
    case "semana": {
      const i = new Date(hoy)
      const diaSemana = hoy.getDay() // 0=domingo, 1=lunes, ..., 6=sábado
      const diasDesdeElLunes = diaSemana === 0 ? 6 : diaSemana - 1
      i.setDate(hoy.getDate() - diasDesdeElLunes)
      return { fechaDesde: localFmt(i), fechaHasta: hoyStr, label: "Esta Semana" }
    }
    case "mes": {
      const i = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
      return { fechaDesde: localFmt(i), fechaHasta: hoyStr, label: "Este Mes" }
    }
    case "mes_anterior": {
      // Día 1 al último día del mes calendario anterior (enero → diciembre del año previo).
      const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
      const fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0)
      return { fechaDesde: localFmt(inicio), fechaHasta: localFmt(fin), label: "Mes Anterior" }
    }
    case "trimestre": {
      const i = new Date(hoy)
      i.setMonth(hoy.getMonth() - 3)
      return { fechaDesde: localFmt(i), fechaHasta: hoyStr, label: "Últimos 3 Meses" }
    }
    case "año": {
      const i = new Date(hoy.getFullYear(), 0, 1)
      return { fechaDesde: localFmt(i), fechaHasta: hoyStr, label: "Este Año" }
    }
    case "personalizado": {
      if (!customDesde || !customHasta) {
        const hoyFallback = new Date()
        const ini = new Date(hoyFallback.getFullYear(), hoyFallback.getMonth(), 1)
        return { fechaDesde: localFmt(ini), fechaHasta: localFmt(hoyFallback), label: "Personalizado" }
      }
      const desde = customDesde < customHasta ? customDesde : customHasta
      const hasta = customDesde < customHasta ? customHasta : customDesde
      const d = new Date(desde + "T12:00:00")
      const h = new Date(hasta + "T12:00:00")
      const label = `${d.toLocaleDateString("es-MX", { day: "numeric", month: "short" })} – ${h.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}`
      return { fechaDesde: desde, fechaHasta: hasta, label }
    }
  }
}

/** Formato de rango para UI, p. ej. "1 nov – 30 nov 2026". */
export function formatearRangoPeriodo(fechaDesde: string, fechaHasta: string): string {
  const d = new Date(fechaDesde + "T12:00:00")
  const h = new Date(fechaHasta + "T12:00:00")
  return `${d.toLocaleDateString("es-MX", { day: "numeric", month: "short" })} – ${h.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}`
}
