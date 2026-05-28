"use client"

import { useState, useEffect, useCallback, type ReactNode, type ComponentType } from "react"
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Download, FileSpreadsheet, FileText, TrendingUp, TrendingDown,
  Users, Calendar, Loader2, RefreshCw, Building2,
  CheckCircle2, XCircle, Clock, AlertCircle, DollarSign,
  BarChart3, Star, Gift, Receipt, UserPlus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  getPagosFromDB, distribuirMontoPago, totalizarVentasSaldoGiftCards,
  esVentaSaldoGiftCard, etiquetaMetodosPago, type Pago,
} from "@/lib/data/pagos"
import {
  getServiciosPopulares,
  getTopEmpleadosFromDB,
  getCitasResumenPeriodo,
  getMetricasSucursales,
  type MetricaSucursal,
} from "@/lib/data/dashboard"
import { getClientesStats, getTopClientesPorGasto } from "@/lib/data/clientes"
import { getSucursalesActivasFromDB, getSucursalesByIdsFromDB, type Sucursal } from "@/lib/data/sucursales"
import { getCurrentUser, refreshSession, isGlobalAdministrator, effectivePrimarySucursalId, userHasMultiBranchScope, collectEffectiveSucursalIds, type User } from "@/lib/auth"
import { supabase } from "@/lib/supabase/client"
import * as XLSX from "xlsx"

// ─── Tipos internos ───────────────────────────────────────────────────────────

interface VentaDia        { etiqueta: string; fecha: string; ventas: number; ventasAnt: number }
interface ServicioRow     { name: string; cantidad: number; ingresos: number; pctTotal: number }
interface EmpleadoRow     { nombre: string; apellido: string; sucursal: string; servicios: number; ingresos: number; comision: number; ocupacion: number }
interface PropinaEmpleadaRow { empleadoId: string; nombre: string; totalPropinas: number; cobros: number; promedio: number }
interface RendimientoEmpleadaPdfRow { nombre: string; servicios: number; ingresos: number; propinas: number; ticketPromedio: number }
interface GiftCardVentaPdfRow { codigo: string; cliente: string; monto: number; metodo: string; fecha: string; sucursal: string }
interface GiftCardDetallePdfRow {
  id: string
  codigo: string
  cliente: string
  fechaEmision: string
  montoInicial: number
  saldoActual: number
  metodoPago: string
  saldoUsado: number
  saldoDisponible: number
  estado: string
  sucursal: string
}
interface CanjeGcPdfRow {
  fecha: string
  codigo: string
  cliente: string
  monto: number
  empleada: string
  sucursal: string
}
interface ClienteTopRow   { clienteId: string; nombre: string; visitas: number; totalGastado: number; ultimaVisita: string }
interface KpiStats        { ingresosTotales: number; totalServicios: number; ticketPromedio: number }
interface CitasResumen    { completadas: number; canceladas: number; pendientes: number; noShow: number; total: number; tasaCancelacion: number }

type Periodo = "semana" | "mes" | "trimestre" | "año" | "personalizado"

// ─── Helpers de fecha ─────────────────────────────────────────────────────────

function localFmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function calcularPeriodo(periodo: Periodo, customDesde?: string, customHasta?: string): { fechaDesde: string; fechaHasta: string; label: string } {
  const hoy    = new Date()
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
    case "trimestre": {
      const i = new Date(hoy); i.setMonth(hoy.getMonth() - 3)
      return { fechaDesde: localFmt(i), fechaHasta: hoyStr, label: "Últimos 3 Meses" }
    }
    case "año": {
      const i = new Date(hoy.getFullYear(), 0, 1)
      return { fechaDesde: localFmt(i), fechaHasta: hoyStr, label: "Este Año" }
    }
    case "personalizado": {
      if (!customDesde || !customHasta) {
        const hoy = new Date()
        const ini = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
        return { fechaDesde: localFmt(ini), fechaHasta: localFmt(hoy), label: "Personalizado" }
      }
      const desde = customDesde < customHasta ? customDesde : customHasta
      const hasta  = customDesde < customHasta ? customHasta : customDesde
      const d = new Date(desde + "T12:00:00")
      const h = new Date(hasta + "T12:00:00")
      const label = `${d.toLocaleDateString("es-MX", { day: "numeric", month: "short" })} – ${h.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}`
      return { fechaDesde: desde, fechaHasta: hasta, label }
    }
  }
}

function calcularPropinasPorEmpleada(pagos: Pago[]): PropinaEmpleadaRow[] {
  const map = new Map<string, { nombre: string; totalPropinas: number; cobros: number }>()

  pagos
    .filter(p => p.estado === "completado" && p.propina > 0 && p.empleadoId)
    .forEach(p => {
      const key = p.empleadoId!
      const prev = map.get(key) ?? { nombre: p.empleadoNombre || "Sin empleado", totalPropinas: 0, cobros: 0 }
      prev.totalPropinas += p.propina
      prev.cobros += 1
      map.set(key, prev)
    })

  return Array.from(map.entries())
    .map(([empleadoId, v]) => ({
      empleadoId,
      nombre: v.nombre,
      totalPropinas: v.totalPropinas,
      cobros: v.cobros,
      promedio: v.cobros > 0 ? Math.round(v.totalPropinas / v.cobros) : 0,
    }))
    .sort((a, b) => b.totalPropinas - a.totalPropinas)
}

function calcularPeriodoAnterior(periodo: Periodo, customDesde?: string, customHasta?: string): { fechaDesde: string; fechaHasta: string } {
  const hoy = new Date()
  switch (periodo) {
    case "semana": {
      const diaSemana = hoy.getDay()
      const diasDesdeElLunes = diaSemana === 0 ? 6 : diaSemana - 1
      const lunesEstaSemana = new Date(hoy)
      lunesEstaSemana.setDate(hoy.getDate() - diasDesdeElLunes)
      const domingo = new Date(lunesEstaSemana)
      domingo.setDate(lunesEstaSemana.getDate() - 1)
      const lunesAnterior = new Date(domingo)
      lunesAnterior.setDate(domingo.getDate() - 6)
      return { fechaDesde: localFmt(lunesAnterior), fechaHasta: localFmt(domingo) }
    }
    case "mes": {
      const fin   = new Date(hoy.getFullYear(), hoy.getMonth(), 0)
      const ini   = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
      return { fechaDesde: localFmt(ini), fechaHasta: localFmt(fin) }
    }
    case "trimestre": {
      const fin   = new Date(hoy); fin.setMonth(hoy.getMonth() - 3)
      const ini   = new Date(fin); ini.setMonth(fin.getMonth() - 3)
      return { fechaDesde: localFmt(ini), fechaHasta: localFmt(fin) }
    }
    case "año": {
      const fin   = new Date(hoy.getFullYear() - 1, 11, 31)
      const ini   = new Date(hoy.getFullYear() - 1, 0, 1)
      return { fechaDesde: localFmt(ini), fechaHasta: localFmt(fin) }
    }
    case "personalizado": {
      if (!customDesde || !customHasta) return { fechaDesde: "", fechaHasta: "" }
      const dias = Math.round((new Date(customHasta).getTime() - new Date(customDesde).getTime()) / 86400000)
      const fin = new Date(customDesde + "T12:00:00")
      fin.setDate(fin.getDate() - 1)
      const ini = new Date(fin)
      ini.setDate(ini.getDate() - dias)
      return { fechaDesde: localFmt(ini), fechaHasta: localFmt(fin) }
    }
  }
}

function buildVentasPorPeriodo(
  pagos: Pago[], pagosAnt: Pago[], periodo: Periodo, fechaDesde: string, fechaHasta: string,
): VentaDia[] {
  const comp    = pagos.filter(p => p.estado === "completado")
  const compAnt = pagosAnt.filter(p => p.estado === "completado")

  const ventasPorFecha = (lista: Pago[], f: string) =>
    lista.filter(p => p.fecha === f).reduce((s, p) => s + p.monto, 0)

  if (periodo === "semana" || periodo === "mes") {
    const cur = new Date(fechaDesde + "T12:00:00")
    const fin = new Date(fechaHasta + "T12:00:00")
    const dias: VentaDia[] = []
    let idx = 0
    while (cur <= fin) {
      const f  = localFmt(cur)
      const etiqueta = periodo === "semana"
        ? cur.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" })
        : cur.toLocaleDateString("es-MX", { day: "numeric", month: "short" })
      // período anterior: mismo índice hacia atrás
      const antD = new Date(cur)
      antD.setDate(antD.getDate() - (periodo === "semana" ? 7 : new Date(cur.getFullYear(), cur.getMonth(), 0).getDate()))
      dias.push({ etiqueta, fecha: f, ventas: ventasPorFecha(comp, f), ventasAnt: compAnt.filter(p => p.fecha === localFmt(antD)).reduce((s, p) => s + p.monto, 0) })
      cur.setDate(cur.getDate() + 1); idx++
    }
    return dias
  }

  if (periodo === "trimestre") {
    const cur = new Date(fechaDesde + "T12:00:00")
    const fin = new Date(fechaHasta + "T12:00:00")
    const semanas: VentaDia[] = []
    while (cur <= fin) {
      const desde = localFmt(cur)
      const hastaD = new Date(cur); hastaD.setDate(hastaD.getDate() + 6); if (hastaD > fin) hastaD.setTime(fin.getTime())
      const hasta  = localFmt(hastaD)
      const ventas = comp.filter(p => p.fecha >= desde && p.fecha <= hasta).reduce((s, p) => s + p.monto, 0)
      const ventasAnt = compAnt.filter(p => p.fecha >= desde && p.fecha <= hasta).reduce((s, p) => s + p.monto, 0)
      const etiqueta = `${cur.toLocaleDateString("es-MX", { day: "numeric", month: "short" })} – ${hastaD.toLocaleDateString("es-MX", { day: "numeric", month: "short" })}`
      semanas.push({ etiqueta, fecha: desde, ventas, ventasAnt })
      cur.setDate(cur.getDate() + 7)
    }
    return semanas
  }

  if (periodo === "personalizado") {
    const ini = new Date(fechaDesde + "T12:00:00")
    const fin = new Date(fechaHasta + "T12:00:00")
    const dias = Math.round((fin.getTime() - ini.getTime()) / 86400000) + 1

    if (dias <= 31) {
      // día por día
      const cur = new Date(ini)
      const result: VentaDia[] = []
      while (cur <= fin) {
        const f = localFmt(cur)
        const antD = new Date(cur)
        antD.setDate(antD.getDate() - dias)
        const fAnt = localFmt(antD)
        result.push({
          etiqueta: cur.toLocaleDateString("es-MX", { day: "numeric", month: "short" }),
          fecha: f,
          ventas: ventasPorFecha(comp, f),
          ventasAnt: ventasPorFecha(compAnt, fAnt),
        })
        cur.setDate(cur.getDate() + 1)
      }
      return result
    }

    if (dias <= 90) {
      // semana por semana
      const cur = new Date(ini)
      const result: VentaDia[] = []
      while (cur <= fin) {
        const desde = localFmt(cur)
        const hastaD = new Date(cur)
        hastaD.setDate(hastaD.getDate() + 6)
        if (hastaD > fin) hastaD.setTime(fin.getTime())
        const hasta = localFmt(hastaD)
        const ventas = comp.filter(p => p.fecha >= desde && p.fecha <= hasta).reduce((s, p) => s + p.monto, 0)
        const ventasAnt = compAnt.filter(p => p.fecha >= desde && p.fecha <= hasta).reduce((s, p) => s + p.monto, 0)
        result.push({
          etiqueta: `${cur.toLocaleDateString("es-MX", { day: "numeric", month: "short" })} – ${hastaD.toLocaleDateString("es-MX", { day: "numeric", month: "short" })}`,
          fecha: desde,
          ventas,
          ventasAnt,
        })
        cur.setDate(cur.getDate() + 7)
      }
      return result
    }

    // más de 90 días → por mes
    const result: VentaDia[] = []
    const curM = new Date(ini.getFullYear(), ini.getMonth(), 1)
    const lastM = new Date(fin.getFullYear(), fin.getMonth(), 1)
    while (curM <= lastM) {
      const y = curM.getFullYear()
      const m = curM.getMonth()
      const monthStart = `${y}-${String(m + 1).padStart(2, "0")}-01`
      const ult = new Date(y, m + 1, 0).getDate()
      const monthEnd = `${y}-${String(m + 1).padStart(2, "0")}-${String(ult).padStart(2, "0")}`
      const desde = monthStart < fechaDesde ? fechaDesde : monthStart
      const hasta = monthEnd > fechaHasta ? fechaHasta : monthEnd
      result.push({
        etiqueta: new Date(y, m, 1).toLocaleDateString("es-MX", { month: "short", year: "2-digit" }),
        fecha: desde,
        ventas: comp.filter(p => p.fecha >= desde && p.fecha <= hasta).reduce((s, p) => s + p.monto, 0),
        ventasAnt: compAnt.filter(p => p.fecha >= desde && p.fecha <= hasta).reduce((s, p) => s + p.monto, 0),
      })
      curM.setMonth(curM.getMonth() + 1)
    }
    return result
  }

  // año → por mes
  const hoy = new Date()
  return Array.from({ length: hoy.getMonth() + 1 }, (_, m) => {
    const ini = `${hoy.getFullYear()}-${String(m + 1).padStart(2, "0")}-01`
    const ult = new Date(hoy.getFullYear(), m + 1, 0).getDate()
    const end = `${hoy.getFullYear()}-${String(m + 1).padStart(2, "0")}-${String(ult).padStart(2, "0")}`
    const antY = hoy.getFullYear() - 1
    const iniA = `${antY}-${String(m + 1).padStart(2, "0")}-01`
    const endA = `${antY}-${String(m + 1).padStart(2, "0")}-${String(ult).padStart(2, "0")}`
    return {
      etiqueta: new Date(hoy.getFullYear(), m, 1).toLocaleDateString("es-MX", { month: "short", year: "2-digit" }),
      fecha: ini,
      ventas: comp.filter(p => p.fecha >= ini && p.fecha <= end).reduce((s, p) => s + p.monto, 0),
      ventasAnt: compAnt.filter(p => p.fecha >= iniA && p.fecha <= endA).reduce((s, p) => s + p.monto, 0),
    }
  })
}

// ─── Helpers UI ───────────────────────────────────────────────────────────────

const fmtMXN = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n)

const fmtPdfMXN = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 }).format(n)

function slugPdf(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "general"
}

function periodoSlugFrom(periodo: Periodo): string {
  if (periodo === "personalizado") return "personalizado"
  return periodo === "semana" ? "esta-semana"
    : periodo === "mes" ? "este-mes"
    : periodo === "trimestre" ? "trimestre"
    : "este-anio"
}

function normalizarFechaGc(raw?: string | null): string {
  if (!raw) return "—"
  return raw.slice(0, 10)
}

function labelEstadoGc(estado: string): string {
  const map: Record<string, string> = {
    activa: "Activa",
    agotada: "Agotada",
    cancelada: "Cancelada",
    pendiente: "Pendiente",
    expirada: "Expirada",
  }
  return map[estado] ?? estado
}

function labelMetodoPagoGc(raw?: string | null): string {
  if (!raw?.trim()) return "—"
  const n = raw.trim().toLowerCase()
  const map: Record<string, string> = {
    efectivo: "Efectivo",
    tarjeta: "Tarjeta",
    transferencia: "Transferencia",
    cortesia: "Cortesía",
    otro: "Otro",
  }
  return map[n] ?? raw.trim()
}

const GC_SELECT_PDF = `
  id, codigo, monto_inicial, saldo_actual, estado, fecha_emision, created_at, metodo_pago, sucursal_id,
  cliente:clientes(nombre, apellido),
  sucursal:sucursales(nombre)
`

async function fetchGiftCardsParaPdf(
  fechaDesde: string,
  fechaHasta: string,
  sucursalId?: string,
): Promise<GiftCardDetallePdfRow[]> {
  const PAGE = 1000
  const rows: Record<string, unknown>[] = []
  let offset = 0

  for (;;) {
    let query = (supabase as any)
      .from("gift_cards")
      .select(GC_SELECT_PDF)
      .gte("fecha_emision", fechaDesde)
      .lte("fecha_emision", fechaHasta)
      .order("fecha_emision", { ascending: true })
      .range(offset, offset + PAGE - 1)

    if (sucursalId) query = query.eq("sucursal_id", sucursalId)

    const { data, error } = await query
    if (error) throw new Error(error.message)
    if (!data?.length) break
    rows.push(...data)
    if (data.length < PAGE) break
    offset += PAGE
  }

  return rows.map((gc: any) => {
    const montoInicial = Number(gc.monto_inicial) || 0
    const saldoActual = Number(gc.saldo_actual) || 0
    return {
      id: gc.id as string,
      codigo: gc.codigo,
      cliente: gc.cliente ? `${gc.cliente.nombre} ${gc.cliente.apellido}` : "Sin cliente",
      fechaEmision: normalizarFechaGc(gc.fecha_emision || gc.created_at),
      montoInicial,
      saldoActual,
      metodoPago: labelMetodoPagoGc(gc.metodo_pago),
      saldoUsado: Math.max(0, montoInicial - saldoActual),
      saldoDisponible: saldoActual,
      estado: labelEstadoGc(gc.estado),
      sucursal: gc.sucursal?.nombre || gc.sucursal_id || "—",
    }
  })
}

async function fetchCanjesParaPdf(
  fechaDesde: string,
  fechaHasta: string,
  sucursalId?: string,
): Promise<CanjeGcPdfRow[]> {
  const PAGE = 1000
  const rows: Record<string, unknown>[] = []
  let offset = 0

  for (;;) {
    let query = (supabase as any)
      .from("gift_card_transacciones")
      .select(`
        *,
        empleado:empleados(nombre, apellido),
        gift_card:gift_cards(codigo, sucursal_id, cliente:clientes(nombre, apellido), sucursal:sucursales(nombre))
      `)
      .in("tipo", ["canje", "uso", "descuento", "cobro", "vip_pass"])
      .gte("created_at", fechaDesde + "T00:00:00")
      .lte("created_at", fechaHasta + "T23:59:59")
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE - 1)

    if (sucursalId) query = query.eq("gift_card.sucursal_id", sucursalId)

    const { data, error } = await query
    if (error) throw new Error(error.message)
    if (!data?.length) break
    rows.push(...data)
    if (data.length < PAGE) break
    offset += PAGE
  }

  return rows
    .map((t: any): CanjeGcPdfRow | null => {
      const gc = t.gift_card
      if (!gc) return null
      const empleadaJoin = t.empleado
        ? `${t.empleado.nombre ?? ""} ${t.empleado.apellido ?? ""}`.trim()
        : ""
      const empleadaDirecta = String(t.empleado_nombre ?? t.empleada ?? "").trim()
      const clienteNombre = gc.cliente
        ? `${gc.cliente.nombre} ${gc.cliente.apellido}`
        : "Sin cliente"
      return {
        fecha: normalizarFechaGc(t.fecha || t.created_at),
        codigo: gc.codigo,
        cliente: clienteNombre,
        monto: Number(t.monto) || 0,
        empleada: empleadaJoin || empleadaDirecta || "—",
        sucursal: gc.sucursal?.nombre || gc.sucursal_id || "—",
      }
    })
    .filter((r): r is CanjeGcPdfRow => r !== null)
}

function extraerCodigoGiftCardPago(p: Pago): string {
  const serv = p.servicios?.[0] ?? ""
  const segmentos = serv.split("·").map(s => s.trim()).filter(Boolean)
  if (segmentos.length >= 2) {
    const ultimo = segmentos[segmentos.length - 1]
    if (ultimo && !/venta saldo gift card/i.test(ultimo)) return ultimo
  }
  const match = p.notas?.match(/·\s*([^\s·]+)\s*·/)
  if (match?.[1]) return match[1]
  return "—"
}

function calcularRendimientoEmpleadasPdf(pagos: Pago[]): RendimientoEmpleadaPdfRow[] {
  const map = new Map<string, RendimientoEmpleadaPdfRow>()
  pagos
    .filter(p => p.estado === "completado")
    .forEach(p => {
      const key = p.empleadoId ?? `nombre:${p.empleadoNombre}`
      const prev = map.get(key) ?? {
        nombre: p.empleadoNombre || "Sin empleado",
        servicios: 0,
        ingresos: 0,
        propinas: 0,
        ticketPromedio: 0,
      }
      prev.servicios += 1
      prev.ingresos += p.monto
      prev.propinas += p.propina ?? 0
      map.set(key, prev)
    })
  return Array.from(map.values())
    .map(r => ({ ...r, ticketPromedio: r.servicios > 0 ? Math.round(r.ingresos / r.servicios) : 0 }))
    .sort((a, b) => b.ingresos - a.ingresos)
}

function calcularVentasGiftCardsPdf(
  pagos: Pago[],
  sucursales: Sucursal[],
  sucursalPorDefecto?: string,
): GiftCardVentaPdfRow[] {
  const sucMap = new Map(sucursales.map(s => [s.id, s.nombre]))
  return pagos
    .filter(esVentaSaldoGiftCard)
    .map(p => ({
      codigo: extraerCodigoGiftCardPago(p),
      cliente: p.clienteNombre || "Sin cliente",
      monto: p.monto,
      metodo: etiquetaMetodosPago(p),
      fecha: p.fecha,
      sucursal: sucMap.get(p.sucursalId) ?? sucursalPorDefecto ?? p.sucursalId,
    }))
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.monto - a.monto)
}

function calcularDesgloseMetodosPdf(pagos: Pago[]) {
  const totales = { efectivo: 0, tarjeta: 0, transferencia: 0, otro: 0 }
  pagos
    .filter(p => p.estado === "completado")
    .forEach(p => {
      const d = distribuirMontoPago(p)
      totales.efectivo += d.efectivo
      totales.tarjeta += d.tarjeta
      totales.transferencia += d.transferencia
      totales.otro += d.otro
    })
  return totales
}

type JsPDFDoc = import("jspdf").jsPDF

const PDF_HEADER_BLACK: [number, number, number] = [10, 10, 10]
const PDF_CREAM: [number, number, number] = [245, 240, 232]
const PDF_TEXT_SOFT: [number, number, number] = [26, 26, 26]
const PDF_TABLE_START_Y = 70

function pdfTableOpts() {
  return {
    theme: "grid" as const,
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      font: "helvetica",
      fillColor: [255, 255, 255] as [number, number, number],
      textColor: PDF_TEXT_SOFT,
    },
    headStyles: {
      fillColor: PDF_HEADER_BLACK,
      textColor: 255,
      fontStyle: "bold" as const,
      font: "helvetica",
    },
    alternateRowStyles: { fillColor: PDF_CREAM },
    margin: { left: 14, right: 14 },
  }
}

function pdfEncabezadoBase(
  doc: JsPDFDoc,
  opts: { sucursal: string; periodo: string; seccion: string },
  tituloHeader: string,
) {
  const w = doc.internal.pageSize.getWidth()
  const h = doc.internal.pageSize.getHeight()

  doc.setFillColor(...PDF_CREAM)
  doc.rect(0, 0, w, h, "F")

  doc.setFillColor(...PDF_HEADER_BLACK)
  doc.rect(0, 0, w, 24, "F")

  doc.setFont("helvetica", "bold")
  doc.setFontSize(15)
  doc.setTextColor(255, 255, 255)
  doc.text("Luna\u00B727", 14, 16)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(200, 200, 200)
  doc.text(tituloHeader, w - 14, 16, { align: "right" })

  doc.setDrawColor(200, 195, 185)
  doc.setLineWidth(0.3)
  doc.line(14, 32, w - 14, 32)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(8.5)
  doc.setTextColor(80, 75, 70)
  doc.text(`Sucursal: ${opts.sucursal}`, 14, 39)
  doc.text(`Período: ${opts.periodo}`, 14, 45)
  doc.text(
    `Generado: ${new Date().toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" })}`,
    14,
    51,
  )

  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  doc.setTextColor(10, 10, 10)
  doc.text(opts.seccion, 14, 62)

  doc.setDrawColor(10, 10, 10)
  doc.setLineWidth(0.5)
  doc.line(14, 65, w - 14, 65)
}

function pdfEncabezado(
  doc: JsPDFDoc,
  opts: { sucursal: string; periodo: string; seccion: string },
) {
  pdfEncabezadoBase(doc, opts, "Reporte de Resultados")
}

function pdfPiePagina(doc: JsPDFDoc) {
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(100, 95, 88)
    doc.text(
      `Página ${i} de ${total}`,
      doc.internal.pageSize.getWidth() - 14,
      doc.internal.pageSize.getHeight() - 8,
      { align: "right" },
    )
  }
}

function pdfEncabezadoGiftCards(
  doc: JsPDFDoc,
  opts: { sucursal: string; periodo: string; seccion: string },
) {
  pdfEncabezadoBase(doc, opts, "Reporte de Gift Cards")
}

async function generarGiftCardsPdf(opts: {
  sucursal: string
  periodoLabel: string
  periodoSlug: string
  sucSlug: string
  cards: GiftCardDetallePdfRow[]
  canjes: CanjeGcPdfRow[]
}) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ])

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" })
  const tableOpts = pdfTableOpts()

  const totalEmitidas = opts.cards.length
  const totalVendido = opts.cards.reduce((s, c) => s + c.montoInicial, 0)
  const totalSaldoUsado = opts.cards.reduce((sum, c) => sum + c.saldoUsado, 0)
  const diferencia = totalVendido - totalSaldoUsado
  const favorLabel = diferencia >= 0 ? "Favor a Gisman" : "Favor a Sucursal"
  const favorMonto = Math.abs(diferencia)

  pdfEncabezadoGiftCards(doc, { sucursal: opts.sucursal, periodo: opts.periodoLabel, seccion: "Resumen" })
  autoTable(doc, {
    ...tableOpts,
    startY: PDF_TABLE_START_Y,
    head: [["Indicador", "Valor"]],
    body: [
      ["Gift cards emitidas en el período", String(totalEmitidas)],
      ["Total vendido en el período", fmtPdfMXN(totalVendido)],
      ["Total de saldo usado (canjes)", fmtPdfMXN(totalSaldoUsado)],
      [favorLabel, fmtPdfMXN(favorMonto)],
    ],
    didParseCell: (data: any) => {
      if (data.section === "body" && data.row.index === 3) {
        data.cell.styles.fontStyle = "bold"
        data.cell.styles.fillColor = diferencia >= 0
          ? [220, 240, 220]
          : [240, 220, 220]
        data.cell.styles.textColor = diferencia >= 0
          ? [30, 100, 30]
          : [140, 30, 30]
      }
    },
  })

  doc.addPage()
  pdfEncabezadoGiftCards(doc, {
    sucursal: opts.sucursal,
    periodo: opts.periodoLabel,
    seccion: "Detalle de Gift Cards emitidas en el período",
  })
  autoTable(doc, {
    ...tableOpts,
    startY: PDF_TABLE_START_Y,
    head: [[
      "Código", "Cliente", "Emisión", "Monto inicial", "Método",
      "Saldo usado", "Saldo disp.", "Estado", "Sucursal",
    ]],
    body: opts.cards.length > 0
      ? opts.cards.map(c => [
          c.codigo,
          c.cliente,
          c.fechaEmision,
          fmtPdfMXN(c.montoInicial),
          c.metodoPago,
          fmtPdfMXN(c.saldoUsado),
          fmtPdfMXN(c.saldoDisponible),
          c.estado,
          c.sucursal,
        ])
      : [["Sin gift cards emitidas en este período", "—", "—", "—", "—", "—", "—", "—", "—"]],
  })

  doc.addPage()
  pdfEncabezadoGiftCards(doc, {
    sucursal: opts.sucursal,
    periodo: opts.periodoLabel,
    seccion: "Movimientos / Canjes del período",
  })
  autoTable(doc, {
    ...tableOpts,
    startY: PDF_TABLE_START_Y,
    head: [["Fecha", "Código GC", "Cliente", "Monto usado", "Empleada", "Sucursal"]],
    body: opts.canjes.length > 0
      ? opts.canjes.map(c => [
          c.fecha,
          c.codigo,
          c.cliente,
          fmtPdfMXN(c.monto),
          c.empleada,
          c.sucursal,
        ])
      : [["Sin canjes en este período", "—", "—", "—", "—", "—"]],
  })

  pdfPiePagina(doc)
  doc.save(`gift-cards-${opts.sucSlug}-${opts.periodoSlug}-${localFmt(new Date())}.pdf`)
}

async function generarReportePdf(opts: {
  sucursal: string
  periodoLabel: string
  periodoSlug: string
  sucSlug: string
  statsActual: KpiStats
  ventasSaldoGc: { monto: number; transacciones: number }
  citasResumen: CitasResumen
  clientesNuevos: number
  pagos: Pago[]
  propinasEmpleadas: PropinaEmpleadaRow[]
  serviciosMasVendidos: Array<{ name: string; cantidad: number; ingresos: number; pctTotal: number }>
  sucursales: Sucursal[]
  sucursalPorDefecto?: string
}) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ])

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" })
  const pagosComp = opts.pagos.filter(p => p.estado === "completado")
  const totalPropinas = pagosComp.reduce((s, p) => s + (p.propina ?? 0), 0)
  const subtotalServicios = pagosComp.reduce((s, p) => s + p.monto - (p.propina ?? 0), 0)
  const totalGeneral = subtotalServicios + totalPropinas
  const metodos = calcularDesgloseMetodosPdf(opts.pagos)
  const rendimiento = calcularRendimientoEmpleadasPdf(opts.pagos)
  const ventasGc = calcularVentasGiftCardsPdf(opts.pagos, opts.sucursales, opts.sucursalPorDefecto)

  const tableOpts = pdfTableOpts()

  // ── Página 1: Resumen General ──
  pdfEncabezado(doc, { sucursal: opts.sucursal, periodo: opts.periodoLabel, seccion: "Resumen General" })
  autoTable(doc, {
    ...tableOpts,
    startY: PDF_TABLE_START_Y,
    head: [["Indicador", "Valor"]],
    body: [
      ["Ingresos Totales", fmtPdfMXN(opts.statsActual.ingresosTotales)],
      ["Total Servicios", String(opts.statsActual.totalServicios)],
      ["Ticket Promedio", fmtPdfMXN(opts.statsActual.ticketPromedio)],
      ["Ventas Gift Cards", `${fmtPdfMXN(opts.ventasSaldoGc.monto)} (${opts.ventasSaldoGc.transacciones} ventas)`],
      ["Citas Completadas", String(opts.citasResumen.completadas)],
      ["Tasa Cancelación", `${opts.citasResumen.tasaCancelacion}%`],
      ["Nuevos Clientes", String(opts.clientesNuevos)],
    ],
  })

  // ── Página 2: Desglose por Método de Pago ──
  doc.addPage()
  pdfEncabezado(doc, { sucursal: opts.sucursal, periodo: opts.periodoLabel, seccion: "Desglose de Ventas por Método de Pago" })
  autoTable(doc, {
    ...tableOpts,
    startY: PDF_TABLE_START_Y,
    head: [["Método de Pago", "Monto"]],
    body: [
      ["Efectivo", fmtPdfMXN(metodos.efectivo)],
      ["Tarjeta", fmtPdfMXN(metodos.tarjeta)],
      ["Transferencia", fmtPdfMXN(metodos.transferencia)],
      ["Otros", fmtPdfMXN(metodos.otro)],
      ["Subtotal servicios (sin propinas)", fmtPdfMXN(subtotalServicios)],
      ["Total propinas", fmtPdfMXN(totalPropinas)],
      ["Total general", fmtPdfMXN(totalGeneral)],
    ],
    didParseCell: (data) => {
      if (data.section === "body" && data.row.index >= 4) {
        data.cell.styles.fontStyle = "bold"
        if (data.row.index === 6) {
          data.cell.styles.fillColor = PDF_CREAM
        }
      }
    },
  })

  // ── Página 3: Rendimiento por Empleada ──
  doc.addPage()
  pdfEncabezado(doc, { sucursal: opts.sucursal, periodo: opts.periodoLabel, seccion: "Rendimiento por Empleada" })
  autoTable(doc, {
    ...tableOpts,
    startY: PDF_TABLE_START_Y,
    head: [["Nombre", "Servicios", "Ingresos", "Propinas", "Ticket prom."]],
    body: rendimiento.length > 0
      ? rendimiento.map(r => [
          r.nombre,
          String(r.servicios),
          fmtPdfMXN(r.ingresos),
          fmtPdfMXN(r.propinas),
          fmtPdfMXN(r.ticketPromedio),
        ])
      : [["Sin datos en este período", "—", "—", "—", "—"]],
  })

  // ── Página 4: Propinas por Empleada ──
  doc.addPage()
  pdfEncabezado(doc, { sucursal: opts.sucursal, periodo: opts.periodoLabel, seccion: "Propinas por Empleada" })
  autoTable(doc, {
    ...tableOpts,
    startY: PDF_TABLE_START_Y,
    head: [["Nombre", "Total propinas", "Cobros con propina", "Propina promedio"]],
    body: opts.propinasEmpleadas.length > 0
      ? opts.propinasEmpleadas.map(p => [
          p.nombre,
          fmtPdfMXN(p.totalPropinas),
          String(p.cobros),
          fmtPdfMXN(p.promedio),
        ])
      : [["Sin propinas en este período", "—", "—", "—"]],
  })

  // ── Página 5: Top 5 Servicios Más Vendidos ──
  doc.addPage()
  pdfEncabezado(doc, { sucursal: opts.sucursal, periodo: opts.periodoLabel, seccion: "Top 5 Servicios Más Vendidos" })
  autoTable(doc, {
    ...tableOpts,
    startY: PDF_TABLE_START_Y,
    head: [["#", "Servicio", "# Citas", "% del Total", "Ingresos", "Ticket Promedio"]],
    body: opts.serviciosMasVendidos.length > 0
      ? opts.serviciosMasVendidos.slice(0, 5).map((s, i) => [
          String(i + 1),
          s.name,
          String(s.cantidad),
          `${s.pctTotal}%`,
          fmtPdfMXN(s.ingresos),
          fmtPdfMXN(s.cantidad > 0 ? Math.round(s.ingresos / s.cantidad) : 0),
        ])
      : [["—", "Sin servicios en este período", "—", "—", "—", "—"]],
  })

  // ── Página 6: Detalle de Cobros ──
  doc.addPage()
  pdfEncabezado(doc, { sucursal: opts.sucursal, periodo: opts.periodoLabel, seccion: "Detalle de Cobros" })
  const cobrosOrdenados = [...pagosComp].sort((a, b) =>
    a.fecha.localeCompare(b.fecha) || (a.hora || "").localeCompare(b.hora || ""),
  )
  autoTable(doc, {
    ...tableOpts,
    startY: PDF_TABLE_START_Y,
    head: [["Fecha", "Hora", "Cliente", "Empleada", "Servicios", "Método", "Propina", "Total"]],
    body: cobrosOrdenados.length > 0
      ? cobrosOrdenados.map(p => [
          p.fecha,
          p.hora || "—",
          p.clienteNombre || "—",
          p.empleadoNombre || "—",
          (p.servicios?.length ? p.servicios.join(" · ") : "—").slice(0, 80),
          etiquetaMetodosPago(p),
          (p.propina ?? 0) > 0 ? fmtPdfMXN(p.propina!) : "—",
          fmtPdfMXN(p.monto),
        ])
      : [["Sin cobros en este período", "—", "—", "—", "—", "—", "—", "—"]],
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: 14 },
      4: { cellWidth: 38 },
    },
  })

  // ── Página 7: Ventas de Gift Cards ──
  doc.addPage()
  pdfEncabezado(doc, { sucursal: opts.sucursal, periodo: opts.periodoLabel, seccion: "Ventas de Gift Cards" })
  autoTable(doc, {
    ...tableOpts,
    startY: PDF_TABLE_START_Y,
    head: [["Código", "Cliente", "Monto", "Método de pago", "Fecha emisión", "Sucursal"]],
    body: ventasGc.length > 0
      ? ventasGc.map(v => [
          v.codigo,
          v.cliente,
          fmtPdfMXN(v.monto),
          v.metodo,
          v.fecha,
          v.sucursal,
        ])
      : [["Sin ventas de gift cards en este período", "—", "—", "—", "—", "—"]],
  })

  pdfPiePagina(doc)
  doc.save(`reporte-${opts.sucSlug}-${opts.periodoSlug}-${localFmt(new Date())}.pdf`)
}

function Tendencia({ actual, anterior }: { actual: number; anterior: number }) {
  if (anterior === 0) return null
  const pct = Math.round(((actual - anterior) / anterior) * 100)
  const up  = pct >= 0
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold",
      up ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700",
    )}>
      {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      {up ? "+" : ""}{pct}%
    </span>
  )
}

const BARRA_AZUL_GRADIENT = "bg-gradient-to-r from-[#1a73e8] to-[#0ea5e9]"
const BARRA_AZUL_SOLIDA = "bg-[#1a73e8]"

function BarraHorizontal({
  valor, max,
  colorClass = BARRA_AZUL_SOLIDA,
  gradientClass,
  heightClass = "h-2",
}: {
  valor: number
  max: number
  colorClass?: string
  gradientClass?: string
  heightClass?: string
}) {
  const pct = max > 0 ? Math.min(100, (valor / max) * 100) : 0
  return (
    <div className={cn("bg-muted rounded-full overflow-hidden", heightClass)}>
      <div
        className={cn("h-full rounded-full transition-all duration-500", gradientClass ?? colorClass)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

const SUCURSAL_ACCENT_BORDERS = [
  "border-l-[#1a73e8]",
  "border-l-[#0ea5e9]",
  "border-l-slate-400",
  "border-l-blue-400",
  "border-l-sky-400",
  "border-l-cyan-500",
]

const SUCURSAL_GRADIENTS = [
  BARRA_AZUL_GRADIENT,
  "bg-gradient-to-r from-[#1e40af] to-[#38bdf8]",
  "bg-gradient-to-r from-[#2563eb] to-[#7dd3fc]",
  "bg-gradient-to-r from-[#1a73e8] to-[#93c5fd]",
  "bg-gradient-to-r from-slate-500 to-slate-300",
  "bg-gradient-to-r from-cyan-600 to-sky-400",
]

function KpiCard({
  icon: Icon,
  iconBg,
  iconColor,
  title,
  value,
  subtitle,
  tendencia,
  className,
}: {
  icon: ComponentType<{ className?: string }>
  iconBg: string
  iconColor: string
  title: string
  value: ReactNode
  subtitle?: ReactNode
  tendencia?: { actual: number; anterior: number }
  className?: string
}) {
  return (
    <Card className={cn(
      "min-h-[140px] h-[140px] items-start gap-2 border border-solid border-slate-200 py-3 shadow-sm",
      className,
    )}>
      <CardHeader className="px-3 pb-0 pt-0 w-full">
        <div className="flex items-start gap-2">
          <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", iconBg)}>
            <Icon className={cn("h-4 w-4", iconColor)} />
          </div>
          <CardTitle className="text-xs font-medium text-muted-foreground leading-snug line-clamp-2">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-3 pt-1 pb-0 flex flex-col items-start justify-start gap-1 flex-1 min-h-0 overflow-hidden">
        <div className="text-xl font-bold tracking-tight leading-none">{value}</div>
        {subtitle}
        {tendencia && (
          <div className="flex items-center gap-1.5 flex-wrap mt-auto">
            <Tendencia actual={tendencia.actual} anterior={tendencia.anterior} />
            <span className="text-[10px] text-muted-foreground leading-tight">vs ant.</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function BadgeOcupacion({ pct }: { pct: number }) {
  const style =
    pct > 70
      ? "bg-green-100 text-green-700 border-green-200"
      : pct >= 40
        ? "bg-amber-100 text-amber-700 border-amber-200"
        : "bg-red-100 text-red-700 border-red-200"
  return (
    <Badge variant="outline" className={cn("text-xs font-semibold border", style)}>
      {pct}%
    </Badge>
  )
}

function DonutDistribucionClientes({
  vip, activos, nuevos, total,
}: {
  vip: number
  activos: number
  nuevos: number
  total: number
}) {
  const segments = [
    { label: "VIP", value: vip, color: "#1a73e8" },
    { label: "Activos", value: activos, color: "#0ea5e9" },
    { label: "Nuevos (30 días)", value: nuevos, color: "#94a3b8" },
  ]
  const sum = segments.reduce((s, x) => s + x.value, 0)

  if (sum === 0 && total === 0) {
    return <p className="text-center text-sm text-muted-foreground py-6">Sin datos de clientes</p>
  }

  let acc = 0
  const stops = segments
    .filter(s => s.value > 0)
    .map(s => {
      const start = (acc / Math.max(sum, 1)) * 100
      acc += s.value
      const end = (acc / Math.max(sum, 1)) * 100
      return `${s.color} ${start}% ${end}%`
    })
    .join(", ")

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative shrink-0">
        <div
          className="h-36 w-36 rounded-full shadow-inner"
          style={{ background: stops ? `conic-gradient(${stops})` : "var(--muted)" }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-[4.5rem] w-[4.5rem] rounded-full bg-card flex flex-col items-center justify-center shadow-sm border">
            <span className="text-2xl font-bold leading-none">{total}</span>
            <span className="text-[10px] text-muted-foreground mt-0.5">Total</span>
          </div>
        </div>
      </div>
      <div className="flex-1 space-y-3 w-full min-w-0">
        {segments.map(s => {
          const pct = sum > 0 ? Math.round((s.value / sum) * 100) : 0
          return (
            <div key={s.label} className="space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                <span className="font-medium flex-1 truncate">{s.label}</span>
                <span className="text-muted-foreground tabular-nums shrink-0">{s.value} · {pct}%</span>
              </div>
              <BarraHorizontal
                valor={s.value}
                max={Math.max(...segments.map(x => x.value), 1)}
                gradientClass={BARRA_AZUL_GRADIENT}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function ReportesPage() {
  const [viewer, setViewer] = useState<User | null>(null)
  useEffect(() => {
    void refreshSession().then(setViewer)
  }, [])

  const currentUser    = viewer ?? getCurrentUser()
  const isSuperAdmin   = currentUser?.role === "superadmin"
  const isAdmin        = isGlobalAdministrator(currentUser)
  const isManager      = currentUser?.role === "manager"
  const multiBranch    = userHasMultiBranchScope(currentUser)
  const branchIds      = collectEffectiveSucursalIds(currentUser)
  const sucursalFija   = isAdmin || multiBranch ? undefined : effectivePrimarySucursalId(currentUser)

  // ── Filtros ──
  const [periodo,          setPeriodo]          = useState<Periodo>("mes")
  const [fechaCustomDesde, setFechaCustomDesde] = useState<string>("")
  const [fechaCustomHasta, setFechaCustomHasta] = useState<string>("")
  const [sucursalFilter,   setSucursalFilter]   = useState<string>("all")
  const [sucursales,       setSucursales]       = useState<Sucursal[]>([])
  const [activeTab,        setActiveTab]        = useState(isManager ? "servicios" : "ventas")
  const [isLoading,        setIsLoading]        = useState(true)

  // ── Datos ──
  const [pagosBrutos,          setPagosBrutos]          = useState<Pago[]>([])
  const [pagosAnteriores,      setPagosAnteriores]      = useState<Pago[]>([])
  const [ventasPeriodo,        setVentasPeriodo]        = useState<VentaDia[]>([])
  const [statsActual,          setStatsActual]          = useState<KpiStats>({ ingresosTotales: 0, totalServicios: 0, ticketPromedio: 0 })
  const [statsAnterior,        setStatsAnterior]        = useState<KpiStats>({ ingresosTotales: 0, totalServicios: 0, ticketPromedio: 0 })
  const [ventasSaldoGcActual,  setVentasSaldoGcActual]  = useState({ monto: 0, transacciones: 0 })
  const [ventasSaldoGcAnt,     setVentasSaldoGcAnt]     = useState({ monto: 0, transacciones: 0 })
  const [citasResumen,         setCitasResumen]         = useState<CitasResumen>({ completadas: 0, canceladas: 0, pendientes: 0, noShow: 0, total: 0, tasaCancelacion: 0 })
  const [serviciosMasVendidos, setServiciosMasVendidos] = useState<ServicioRow[]>([])
  const [empleadosTop,         setEmpleadosTop]         = useState<EmpleadoRow[]>([])
  const [propinasEmpleadas,    setPropinasEmpleadas]    = useState<PropinaEmpleadaRow[]>([])
  const [clientesStats,        setClientesStats]        = useState({ total: 0, activos: 0, vip: 0, nuevos: 0 })
  const [topClientes,          setTopClientes]          = useState<ClienteTopRow[]>([])
  const [metodosPago,          setMetodosPago]          = useState<Array<{ metodo: string; monto: number; count: number }>>([])
  const [metricasSucursales,   setMetricasSucursales]   = useState<MetricaSucursal[]>([])
  const [isExportingPdf,       setIsExportingPdf]       = useState(false)
  const [isExportingGcPdf,     setIsExportingGcPdf]     = useState(false)

  // ── Carga inicial de sucursales ──────────────────────────────────────────
  useEffect(() => {
    if (isAdmin) {
      getSucursalesActivasFromDB().then(setSucursales).catch(() => {})
    } else if (multiBranch && branchIds.length > 0) {
      getSucursalesByIdsFromDB(branchIds).then(setSucursales).catch(() => {})
    }
  }, [isAdmin, multiBranch, branchIds.join(",")])

  // ── Carga de datos reactiva ──────────────────────────────────────────────
  const cargarDatos = useCallback(async () => {
    setIsLoading(true)
    try {
      const { fechaDesde, fechaHasta } = calcularPeriodo(periodo, fechaCustomDesde, fechaCustomHasta)
      const { fechaDesde: antDesde, fechaHasta: antHasta } = calcularPeriodoAnterior(periodo, fechaCustomDesde, fechaCustomHasta)

      // sucursal efectiva: admin o multi-sucursal con «all» → undefined (RLS acota); una sede concreta → id
      const sucId =
        isAdmin || multiBranch
          ? (sucursalFilter === "all" ? undefined : sucursalFilter)
          : sucursalFija

      const [pagos, pagosAnt, citasRes, servicios, empleados, cliStats, topCli, metSuc] = await Promise.all([
        getPagosFromDB(sucId, undefined, fechaDesde, fechaHasta),
        getPagosFromDB(sucId, undefined, antDesde,   antHasta),
        getCitasResumenPeriodo(fechaDesde, fechaHasta, sucId),
        getServiciosPopulares(10, sucId, undefined, fechaDesde, fechaHasta),
        getTopEmpleadosFromDB(10, sucId, fechaDesde, fechaHasta),
        getClientesStats(sucId),
        getTopClientesPorGasto(10, fechaDesde, fechaHasta, sucId),
        isAdmin && sucursalFilter === "all"
          ? getMetricasSucursales(fechaDesde, fechaHasta)
          : Promise.resolve([] as MetricaSucursal[]),
      ])

      setPagosBrutos(pagos)
      setPagosAnteriores(pagosAnt)
      setCitasResumen(citasRes)
      setClientesStats(cliStats)
      setTopClientes(topCli)
      setMetricasSucursales(metSuc)
      setVentasPeriodo(buildVentasPorPeriodo(pagos, pagosAnt, periodo, fechaDesde, fechaHasta))

      const calcStats = (lista: Pago[]): KpiStats => {
        const comp      = lista.filter(p => p.estado === "completado")
        const ingresos  = comp.reduce((s, p) => s + p.monto, 0)
        const total     = comp.length
        return { ingresosTotales: ingresos, totalServicios: total, ticketPromedio: total > 0 ? Math.round(ingresos / total) : 0 }
      }
      setStatsActual(calcStats(pagos))
      setStatsAnterior(calcStats(pagosAnt))
      setVentasSaldoGcActual(totalizarVentasSaldoGiftCards(pagos))
      setVentasSaldoGcAnt(totalizarVentasSaldoGiftCards(pagosAnt))

      // Métodos de pago (incluye desglose efectivo/tarjeta en pagos mixtos, sin duplicar montos)
      const metodosMap = new Map<string, { monto: number; count: number }>()
      const bump = (clave: string, monto: number) => {
        if (monto <= 0.009) return
        const prev = metodosMap.get(clave) ?? { monto: 0, count: 0 }
        metodosMap.set(clave, { monto: prev.monto + monto, count: prev.count + 1 })
      }
      pagos.filter(p => p.estado === "completado").forEach(p => {
        const d = distribuirMontoPago(p)
        bump("efectivo", d.efectivo)
        bump("tarjeta", d.tarjeta)
        bump("transferencia", d.transferencia)
        bump("otro", d.otro)
      })
      setMetodosPago(Array.from(metodosMap.entries()).map(([metodo, v]) => ({ metodo, ...v })).sort((a, b) => b.monto - a.monto))

      // Servicios enriquecidos
      const totalSvc = servicios.reduce((s, x) => s + x.count, 0)
      setServiciosMasVendidos(servicios.map(s => ({
        name: s.name, cantidad: s.count, ingresos: s.revenue,
        pctTotal: totalSvc > 0 ? Math.round((s.count / totalSvc) * 100) : 0,
      })))

      setEmpleadosTop(empleados.map(e => ({
        nombre: e.nombre, apellido: e.apellido,
        sucursal: e.sucursalNombre,
        servicios: e.citas, ingresos: e.ingresos,
        comision: Math.round(e.ingresos * 0.3),
        ocupacion: e.ocupacion,
      })))
      setPropinasEmpleadas(calcularPropinasPorEmpleada(pagos))
    } catch (err) {
      console.error("Error cargando reportes:", err)
    } finally {
      setIsLoading(false)
    }
  }, [periodo, fechaCustomDesde, fechaCustomHasta, sucursalFilter, sucursalFija, isAdmin, multiBranch])

  useEffect(() => {
    if (periodo === "personalizado" && (!fechaCustomDesde || !fechaCustomHasta)) return
    cargarDatos()
  }, [cargarDatos, periodo, fechaCustomDesde, fechaCustomHasta])

  // ── Exportar Excel ────────────────────────────────────────────────────────
  const handleExportExcel = () => {
    const { label } = calcularPeriodo(periodo, fechaCustomDesde, fechaCustomHasta)
    const sucNombre  = sucursalFilter === "all"
      ? (multiBranch ? "Todas mis sucursales" : "Todas las sucursales")
      : (sucursales.find(s => s.id === sucursalFilter)?.nombre ?? sucursalFilter)
    const wb = XLSX.utils.book_new()

    // Resumen KPIs
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Reporte de Resultados"],
      ["Período", label],
      ["Sucursal", sucNombre],
      ["Generado el", new Date().toLocaleDateString("es-MX", { dateStyle: "full" })],
      [],
      ["KPI", "Período Actual", "Período Anterior", "Variación %"],
      ["Ingresos Totales",  statsActual.ingresosTotales,  statsAnterior.ingresosTotales,  statsAnterior.ingresosTotales > 0 ? `${Math.round(((statsActual.ingresosTotales - statsAnterior.ingresosTotales) / statsAnterior.ingresosTotales) * 100)}%` : "—"],
      ["Total Servicios",   statsActual.totalServicios,   statsAnterior.totalServicios,   statsAnterior.totalServicios  > 0 ? `${Math.round(((statsActual.totalServicios  - statsAnterior.totalServicios)  / statsAnterior.totalServicios)  * 100)}%` : "—"],
      ["Ticket Promedio",   statsActual.ticketPromedio,   statsAnterior.ticketPromedio,   statsAnterior.ticketPromedio  > 0 ? `${Math.round(((statsActual.ticketPromedio  - statsAnterior.ticketPromedio)  / statsAnterior.ticketPromedio)  * 100)}%` : "—"],
      ["Ventas saldo gift cards ($)", ventasSaldoGcActual.monto, ventasSaldoGcAnt.monto, ventasSaldoGcAnt.monto > 0 ? `${Math.round(((ventasSaldoGcActual.monto - ventasSaldoGcAnt.monto) / ventasSaldoGcAnt.monto) * 100)}%` : "—"],
      ["Cantidad ventas saldo GC", ventasSaldoGcActual.transacciones, ventasSaldoGcAnt.transacciones, ventasSaldoGcAnt.transacciones > 0 ? `${Math.round(((ventasSaldoGcActual.transacciones - ventasSaldoGcAnt.transacciones) / ventasSaldoGcAnt.transacciones) * 100)}%` : "—"],
      ["Citas Completadas", citasResumen.completadas, "", ""],
      ["Tasa de Cancelación", `${citasResumen.tasaCancelacion}%`, "", ""],
    ]), "Resumen")

    // Ventas por período
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Etiqueta", "Fecha", "Ingresos ($)", "Período Anterior ($)"],
      ...ventasPeriodo.map(v => [v.etiqueta, v.fecha, v.ventas, v.ventasAnt]),
    ]), "Ventas por Período")

    // Citas por estado
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Estado", "Cantidad"],
      ["Completadas", citasResumen.completadas],
      ["Canceladas",  citasResumen.canceladas],
      ["Pendientes",  citasResumen.pendientes],
      ["No Show",     citasResumen.noShow],
      ["Total",       citasResumen.total],
      ["Tasa cancelación", `${citasResumen.tasaCancelacion}%`],
    ]), "Citas por Estado")

    // Servicios
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Servicio", "# Citas", "Ingresos ($)", "Ticket Promedio ($)", "% del Total"],
      ...serviciosMasVendidos.map(s => [s.name, s.cantidad, s.ingresos, s.cantidad > 0 ? Math.round(s.ingresos / s.cantidad) : 0, `${s.pctTotal}%`]),
    ]), "Servicios")

    // Empleados
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Nombre", "Apellido", "Sucursal", "Servicios", "Ingresos ($)", "Comisión 30% ($)", "Ocupación %"],
      ...empleadosTop.map(e => [e.nombre, e.apellido, e.sucursal, e.servicios, e.ingresos, e.comision, `${e.ocupacion}%`]),
    ]), "Empleados")

    // Top Clientes
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Nombre", "Visitas", "Total Gastado ($)", "Última Visita"],
      ...topClientes.map(c => [c.nombre, c.visitas, c.totalGastado, c.ultimaVisita]),
    ]), "Top Clientes")

    // Métodos de pago
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Método", "Cobros", "Monto ($)"],
      ...metodosPago.map(m => [m.metodo, m.count, m.monto]),
    ]), "Métodos de Pago")

    // Sucursales (admin, todas)
    if (isAdmin && metricasSucursales.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ["Sucursal", "Ingresos ($)", "Citas", "Ticket Promedio ($)", "Top Servicio"],
        ...metricasSucursales.map(s => [s.nombre, s.ingresos, s.totalCitas, s.ticketPromedio, s.topServicio]),
      ]), "Sucursales")
    }

    const slug = periodo === "semana" ? "esta-semana" : periodo === "mes" ? "este-mes" : periodo === "trimestre" ? "trimestre" : "este-año"
    XLSX.writeFile(wb, `reporte-${slug}.xlsx`)
  }

  // ── Exportar PDF ──────────────────────────────────────────────────────────
  const handleExportPDF = async () => {
    setIsExportingPdf(true)
    try {
      const { label } = calcularPeriodo(periodo, fechaCustomDesde, fechaCustomHasta)
      const sucNombre = sucursalFilter === "all"
        ? (multiBranch ? "Todas mis sucursales" : "Todas las sucursales")
        : (sucursales.find(s => s.id === sucursalFilter)?.nombre ?? sucursalFilter)
      const periodoSlug = periodoSlugFrom(periodo)

      await generarReportePdf({
        sucursal: sucNombre,
        periodoLabel: label,
        periodoSlug,
        sucSlug: slugPdf(sucNombre),
        statsActual,
        ventasSaldoGc: ventasSaldoGcActual,
        citasResumen,
        clientesNuevos: clientesStats.nuevos,
        pagos: pagosBrutos,
        propinasEmpleadas,
        serviciosMasVendidos,
        sucursales,
        sucursalPorDefecto: sucursalFilter !== "all" ? sucNombre : undefined,
      })
    } catch (err) {
      console.error("Error generando PDF:", err)
    } finally {
      setIsExportingPdf(false)
    }
  }

  const handleExportGiftCardsPDF = async () => {
    setIsExportingGcPdf(true)
    try {
      const { fechaDesde, fechaHasta, label } = calcularPeriodo(periodo, fechaCustomDesde, fechaCustomHasta)
      const sucNombre = sucursalFilter === "all"
        ? (multiBranch ? "Todas mis sucursales" : "Todas las sucursales")
        : (sucursales.find(s => s.id === sucursalFilter)?.nombre ?? sucursalFilter)
      const sucId =
        isAdmin || multiBranch
          ? (sucursalFilter === "all" ? undefined : sucursalFilter)
          : sucursalFija

      const cards = await fetchGiftCardsParaPdf(fechaDesde, fechaHasta, sucId)
      const canjes = await fetchCanjesParaPdf(fechaDesde, fechaHasta, sucId)

      await generarGiftCardsPdf({
        sucursal: sucNombre,
        periodoLabel: label,
        periodoSlug: periodoSlugFrom(periodo),
        sucSlug: slugPdf(sucNombre),
        cards,
        canjes,
      })
    } catch (err) {
      console.error("Error generando PDF de gift cards:", err)
    } finally {
      setIsExportingGcPdf(false)
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const maxVentas   = Math.max(...ventasPeriodo.map(d => Math.max(d.ventas, d.ventasAnt)), 1)
  const maxEmpleado = Math.max(...empleadosTop.map(e => e.ingresos), 1)
  const { label: periodoLabel } = calcularPeriodo(periodo, fechaCustomDesde, fechaCustomHasta)
  const sucNombreActiva = sucursalFilter === "all"
    ? (multiBranch ? "Todas mis sucursales" : "Todas las sucursales")
    : (sucursales.find(s => s.id === sucursalFilter)?.nombre ?? "")

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Cargando reportes…</p>
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <div id="reporte-contenido" className="space-y-6">

        {/* ── Cabecera ── */}
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Reportes</h1>
              <p className="text-muted-foreground text-sm mt-1">
                {isManager ? "Análisis de tu sucursal" : "Análisis y estadísticas del negocio"}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 items-center no-print">
              {/* Filtro sucursal (solo admin) */}
              {(isAdmin || multiBranch) && sucursales.length > 0 && (
                <Select value={sucursalFilter} onValueChange={setSucursalFilter}>
                  <SelectTrigger className="w-52">
                    <Building2 className="h-4 w-4 mr-2 shrink-0 text-muted-foreground" />
                    <SelectValue placeholder="Sucursal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{multiBranch ? "Todas mis sucursales" : "Todas las sucursales"}</SelectItem>
                    {sucursales.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Filtro período */}
              <div className="flex items-center gap-2">
                <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
                  <SelectTrigger className="h-9 w-44 text-sm">
                    <Calendar className="h-4 w-4 mr-1.5 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="semana">Esta Semana</SelectItem>
                    <SelectItem value="mes">Este Mes</SelectItem>
                    <SelectItem value="trimestre">Trimestre</SelectItem>
                    <SelectItem value="año">Este Año</SelectItem>
                    <SelectItem value="personalizado">Personalizado…</SelectItem>
                  </SelectContent>
                </Select>

                {periodo === "personalizado" && (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value={fechaCustomDesde}
                      onChange={e => setFechaCustomDesde(e.target.value)}
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <span className="text-muted-foreground text-sm">—</span>
                    <input
                      type="date"
                      value={fechaCustomHasta}
                      onChange={e => setFechaCustomHasta(e.target.value)}
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                )}
              </div>

              <Button variant="outline" size="icon" onClick={cargarDatos} title="Actualizar datos">
                <RefreshCw className="h-4 w-4" />
              </Button>

              {!isManager && (
                <>
                  <Button
                    variant="outline"
                    onClick={handleExportPDF}
                    disabled={isExportingPdf}
                    className="border-slate-300 bg-slate-50 hover:bg-slate-100 text-[#1e40af] font-medium shadow-sm"
                  >
                    {isExportingPdf
                      ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      : <FileText className="mr-2 h-4 w-4" />}
                    Exportar PDF
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleExportExcel}
                    className="border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium shadow-sm"
                  >
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Exportar Excel
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Contexto visible: sucursal y período */}
          <div className="border-b-2 border-slate-200 pb-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                <Building2 className="h-4 w-4 text-slate-500" />
                {(isAdmin || multiBranch) ? sucNombreActiva : (sucNombreActiva || "Mi sucursal")}
              </span>
              <span className="hidden sm:inline text-muted-foreground">·</span>
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                <Calendar className="h-4 w-4 text-slate-500" />
                {periodoLabel}
              </span>
              <span className="hidden sm:inline text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">
                Generado: {new Date().toLocaleDateString("es-MX", { dateStyle: "medium" })}
              </span>
            </div>
          </div>
        </div>

        {/* ── KPIs ── */}
        <div className="space-y-2">
          <div className={cn(
            "grid gap-3 items-start",
            isManager ? "grid-cols-2 md:grid-cols-4 lg:grid-cols-5" : "grid-cols-2 md:grid-cols-4 lg:grid-cols-7",
          )}>
            {!isManager && (
              <KpiCard
                icon={DollarSign}
                iconBg="bg-green-50"
                iconColor="text-green-500"
                title="Ingresos Totales"
                value={fmtMXN(statsActual.ingresosTotales)}
                tendencia={{ actual: statsActual.ingresosTotales, anterior: statsAnterior.ingresosTotales }}
              />
            )}

            <KpiCard
              icon={BarChart3}
              iconBg="bg-blue-50"
              iconColor="text-blue-500"
              title="Total Servicios"
              value={statsActual.totalServicios}
              tendencia={{ actual: statsActual.totalServicios, anterior: statsAnterior.totalServicios }}
            />

            {!isManager && (
              <KpiCard
                icon={Receipt}
                iconBg="bg-orange-50"
                iconColor="text-orange-500"
                title="Ticket Promedio"
                value={fmtMXN(statsActual.ticketPromedio)}
                tendencia={{ actual: statsActual.ticketPromedio, anterior: statsAnterior.ticketPromedio }}
              />
            )}

            <KpiCard
              icon={Gift}
              iconBg="bg-sky-50"
              iconColor="text-[#0ea5e9]"
              title="Ventas saldo gift cards"
              value={fmtMXN(ventasSaldoGcActual.monto)}
              subtitle={
                <p className="text-[10px] text-muted-foreground leading-tight">{ventasSaldoGcActual.transacciones} ventas</p>
              }
              tendencia={!isManager ? { actual: ventasSaldoGcActual.monto, anterior: ventasSaldoGcAnt.monto } : undefined}
            />

            <KpiCard
              icon={CheckCircle2}
              iconBg="bg-emerald-50"
              iconColor="text-emerald-500"
              title="Citas Completadas"
              value={citasResumen.completadas}
              subtitle={<p className="text-[10px] text-muted-foreground leading-tight">De {citasResumen.total} totales</p>}
            />

            <KpiCard
              icon={XCircle}
              iconBg="bg-red-50"
              iconColor="text-red-400"
              title="Tasa Cancelación"
              value={
                <span className={cn(
                  citasResumen.tasaCancelacion > 20 ? "text-red-500" : citasResumen.tasaCancelacion > 10 ? "text-amber-500" : "text-green-600",
                )}>
                  {citasResumen.tasaCancelacion}%
                </span>
              }
              subtitle={
                <p className="text-[10px] text-muted-foreground leading-tight">{citasResumen.canceladas + citasResumen.noShow} cancel. / no-show</p>
              }
            />

            <KpiCard
              icon={UserPlus}
              iconBg="bg-slate-50"
              iconColor="text-slate-500"
              title="Nuevos Clientes"
              value={clientesStats.nuevos}
              subtitle={<p className="text-[10px] text-muted-foreground leading-tight">Últimos 30 días</p>}
            />
          </div>

          {!isManager && (
            <div className="flex justify-end no-print">
              <button
                type="button"
                onClick={handleExportGiftCardsPDF}
                disabled={isExportingGcPdf}
                title="Descargar reporte PDF de gift cards"
                className="inline-flex items-center gap-1 text-xs font-medium text-[#0ea5e9] hover:text-slate-700 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExportingGcPdf
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Download className="h-3.5 w-3.5" />}
                ↓ PDF Gift Cards
              </button>
            </div>
          )}
        </div>

        {/* ── Tabs ── */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="no-print flex-wrap h-auto gap-1">
            {!isManager && <TabsTrigger value="ventas">Ventas</TabsTrigger>}
            <TabsTrigger value="servicios">Servicios</TabsTrigger>
            <TabsTrigger value="empleados">Empleados</TabsTrigger>
            {!isManager && <TabsTrigger value="nomina">Nómina</TabsTrigger>}
            <TabsTrigger value="clientes">Clientes</TabsTrigger>
            {isAdmin && <TabsTrigger value="sucursales">Sucursales</TabsTrigger>}
          </TabsList>

          {/* ══════════════ VENTAS ══════════════ */}
          {!isManager && (
            <TabsContent value="ventas" className="space-y-4">

              {/* Ventas por período con comparativa */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    {periodo === "año" ? "Ventas por Mes" : periodo === "trimestre" ? "Ventas por Semana" : "Ventas por Día"}
                  </CardTitle>
                  <CardDescription>
                    {periodoLabel} · barras azules = actual, gris = período anterior
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {ventasPeriodo.length === 0 ? (
                    <p className="text-center py-8 text-sm text-muted-foreground">Sin datos en este período</p>
                  ) : (
                    <div className="space-y-4">
                      {ventasPeriodo.map(d => (
                        <div key={d.fecha} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium capitalize min-w-[130px]">{d.etiqueta}</span>
                            <div className="flex items-center gap-3">
                              {d.ventasAnt > 0 && (
                                <span className="text-xs text-muted-foreground">{fmtMXN(d.ventasAnt)}</span>
                              )}
                              <span className={`font-semibold tabular-nums ${d.ventas === 0 ? "text-muted-foreground" : ""}`}>
                                {d.ventas === 0 ? "—" : fmtMXN(d.ventas)}
                              </span>
                            </div>
                          </div>
                          {/* Barra actual */}
                          <BarraHorizontal
                            valor={d.ventas}
                            max={maxVentas}
                            gradientClass={BARRA_AZUL_GRADIENT}
                            heightClass="h-2.5"
                          />
                          {/* Barra anterior */}
                          {d.ventasAnt > 0 && (
                            <BarraHorizontal
                              valor={d.ventasAnt}
                              max={maxVentas}
                              colorClass="bg-slate-200"
                              heightClass="h-2"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid gap-4 lg:grid-cols-2">
                {/* Métodos de pago */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Métodos de Pago</CardTitle>
                    <CardDescription>{periodoLabel}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {metodosPago.length === 0 ? (
                      <p className="text-center py-6 text-sm text-muted-foreground">Sin pagos en este período</p>
                    ) : (
                      <div className="space-y-3">
                        {metodosPago.map(m => {
                          const pct   = statsActual.ingresosTotales > 0 ? Math.round((m.monto / statsActual.ingresosTotales) * 100) : 0
                          const label = m.metodo === "efectivo" ? "Efectivo" : m.metodo === "tarjeta" ? "Tarjeta" : m.metodo === "transferencia" ? "Transferencia" : m.metodo
                          return (
                            <div key={m.metodo} className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span className="capitalize font-medium">{label}</span>
                                <span className="text-muted-foreground tabular-nums">{fmtMXN(m.monto)} · {m.count} cobros · {pct}%</span>
                              </div>
                              <BarraHorizontal
                                valor={m.monto}
                                max={statsActual.ingresosTotales}
                                gradientClass={BARRA_AZUL_GRADIENT}
                              />
                            </div>
                          )
                        })}
                        <div className="pt-2 border-t flex justify-between text-sm font-semibold">
                          <span>Total</span>
                          <span>{fmtMXN(statsActual.ingresosTotales)}</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Citas por estado */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Calendar className="h-4 w-4" />Estado de Citas
                    </CardTitle>
                    <CardDescription>{periodoLabel}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {[
                        { label: "Completadas",  icon: CheckCircle2, color: "text-green-600",  bg: "bg-green-500",       count: citasResumen.completadas },
                        { label: "Canceladas",   icon: XCircle,      color: "text-red-500",    bg: "bg-red-400",         count: citasResumen.canceladas  },
                        { label: "Pendientes",   icon: Clock,        color: "text-amber-500",  bg: "bg-amber-400",       count: citasResumen.pendientes  },
                        { label: "No Show",      icon: AlertCircle,  color: "text-slate-400",  bg: "bg-slate-300",       count: citasResumen.noShow      },
                      ].map(row => {
                        const pct = citasResumen.total > 0 ? Math.round((row.count / citasResumen.total) * 100) : 0
                        const Icon = row.icon
                        return (
                          <div key={row.label} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className={`flex items-center gap-1.5 font-medium ${row.color}`}>
                                <Icon className="h-3.5 w-3.5" />{row.label}
                              </span>
                              <span className="tabular-nums text-muted-foreground">{row.count} · {pct}%</span>
                            </div>
                            <BarraHorizontal valor={row.count} max={citasResumen.total} colorClass={row.bg} />
                          </div>
                        )
                      })}
                      <div className="pt-2 border-t flex justify-between text-sm font-semibold">
                        <span>Total citas</span>
                        <span>{citasResumen.total}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Comparativa período anterior — resumen */}
              {!isManager && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Comparativa vs Período Anterior</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {[
                        { label: "Ingresos",        actual: statsActual.ingresosTotales, ant: statsAnterior.ingresosTotales, fmt: fmtMXN },
                        { label: "Servicios",        actual: statsActual.totalServicios,  ant: statsAnterior.totalServicios,  fmt: (n: number) => String(n) },
                        { label: "Ticket Promedio",  actual: statsActual.ticketPromedio,  ant: statsAnterior.ticketPromedio,  fmt: fmtMXN },
                      ].map(item => (
                        <div key={item.label} className="p-4 rounded-lg bg-muted/40 space-y-1">
                          <p className="text-xs text-muted-foreground">{item.label}</p>
                          <p className="text-lg font-bold">{item.fmt(item.actual)}</p>
                          <p className="text-xs text-muted-foreground">Ant: {item.fmt(item.ant)}</p>
                          <Tendencia actual={item.actual} anterior={item.ant} />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          )}

          {/* ══════════════ SERVICIOS ══════════════ */}
          <TabsContent value="servicios" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Servicios Más Vendidos</CardTitle>
                <CardDescription>Top 10 · {periodoLabel}</CardDescription>
              </CardHeader>
              <CardContent>
                {serviciosMasVendidos.length === 0 ? (
                  <p className="text-center py-8 text-sm text-muted-foreground">Sin datos en este período</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8">#</TableHead>
                          <TableHead>Servicio</TableHead>
                          <TableHead className="text-right"># Citas</TableHead>
                          <TableHead className="text-right">% Total</TableHead>
                          <TableHead className="text-right">Ingresos</TableHead>
                          <TableHead className="text-right">Ticket Prom.</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {serviciosMasVendidos.map((s, i) => (
                          <TableRow key={s.name}>
                            <TableCell className="text-muted-foreground font-mono text-xs">{i + 1}</TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <span className="font-medium">{s.name}</span>
                                <BarraHorizontal valor={s.pctTotal} max={100} gradientClass={BARRA_AZUL_GRADIENT} />
                              </div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{s.cantidad}</TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">{s.pctTotal}%</TableCell>
                            <TableCell className="text-right tabular-nums font-semibold">{fmtMXN(s.ingresos)}</TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {fmtMXN(s.cantidad > 0 ? Math.round(s.ingresos / s.cantidad) : 0)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══════════════ EMPLEADOS ══════════════ */}
          <TabsContent value="empleados" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Rendimiento de Empleados</CardTitle>
                <CardDescription>Top 10 · {periodoLabel}</CardDescription>
              </CardHeader>
              <CardContent>
                {empleadosTop.length === 0 ? (
                  <p className="text-center py-8 text-sm text-muted-foreground">Sin datos en este período</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8">#</TableHead>
                          <TableHead>Empleada</TableHead>
                          {isAdmin && <TableHead>Sucursal</TableHead>}
                          {!isManager && (
                            <>
                              <TableHead className="text-right">Ingresos</TableHead>
                              <TableHead className="text-right">Comisión 30%</TableHead>
                            </>
                          )}
                          <TableHead className="text-right">Ocupación</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {empleadosTop.map((e, i) => (
                          <TableRow key={`${e.nombre}-${e.apellido}-${i}`}>
                            <TableCell className="text-muted-foreground font-mono text-xs">{i + 1}</TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <span className="font-medium">{e.nombre} {e.apellido}</span>
                                {!isManager && (
                                  <BarraHorizontal
                                    valor={e.ingresos}
                                    max={maxEmpleado}
                                    gradientClass={BARRA_AZUL_GRADIENT}
                                  />
                                )}
                              </div>
                            </TableCell>
                            {isAdmin && (
                              <TableCell className="text-muted-foreground text-sm">{e.sucursal}</TableCell>
                            )}
                            {!isManager && (
                              <>
                                <TableCell className="text-right tabular-nums font-semibold">{fmtMXN(e.ingresos)}</TableCell>
                                <TableCell className="text-right tabular-nums text-green-600 font-semibold">{fmtMXN(e.comision)}</TableCell>
                              </>
                            )}
                            <TableCell className="text-right">
                              <BadgeOcupacion pct={e.ocupacion} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gift className="h-5 w-5" />
                  Propinas por Empleada
                </CardTitle>
                <CardDescription>{periodoLabel}</CardDescription>
              </CardHeader>
              <CardContent>
                {propinasEmpleadas.length === 0 ? (
                  <p className="text-center py-8 text-sm text-muted-foreground">Sin propinas registradas en este período</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Empleada</TableHead>
                          <TableHead className="text-right">Total propinas</TableHead>
                          <TableHead className="text-right">Cobros con propina</TableHead>
                          <TableHead className="text-right">Propina promedio</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {propinasEmpleadas.map(e => (
                          <TableRow key={e.empleadoId}>
                            <TableCell className="font-medium">{e.nombre}</TableCell>
                            <TableCell className="text-right tabular-nums font-semibold text-green-600">
                              {fmtMXN(e.totalPropinas)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{e.cobros}</TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {fmtMXN(e.promedio)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══════════════ CLIENTES ══════════════ */}
          <TabsContent value="clientes" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Stats generales */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4" />Distribución de Clientes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <DonutDistribucionClientes
                    vip={clientesStats.vip}
                    activos={clientesStats.activos}
                    nuevos={clientesStats.nuevos}
                    total={clientesStats.total}
                  />
                  <div className="text-center p-4 rounded-lg bg-slate-50 border border-slate-200 mt-4">
                    <div className="text-3xl font-bold text-slate-700">{clientesStats.total}</div>
                    <p className="text-xs text-muted-foreground mt-1">Total de clientes registrados</p>
                  </div>
                </CardContent>
              </Card>

              {/* Top clientes por gasto */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Star className="h-4 w-4" />Top Clientes por Gasto
                  </CardTitle>
                  <CardDescription>{periodoLabel}</CardDescription>
                </CardHeader>
                <CardContent>
                  {topClientes.length === 0 ? (
                    <p className="text-center py-6 text-sm text-muted-foreground">Sin visitas en este período</p>
                  ) : (
                    <div className="space-y-2">
                      {topClientes.slice(0, 8).map((c, i) => (
                        <div key={c.clienteId} className="flex items-center gap-3 py-1.5">
                          <span className="text-xs text-muted-foreground w-5 text-right shrink-0">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{c.nombre}</p>
                            <p className="text-xs text-muted-foreground">{c.visitas} {c.visitas === 1 ? "visita" : "visitas"} · última: {c.ultimaVisita}</p>
                          </div>
                          <span className="font-semibold text-sm tabular-nums shrink-0">{fmtMXN(c.totalGastado)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ══════════════ SUCURSALES (solo admin) ══════════════ */}
          {isAdmin && (
            <TabsContent value="sucursales" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Comparativa por Sucursal</CardTitle>
                  <CardDescription>{periodoLabel}</CardDescription>
                </CardHeader>
                <CardContent>
                  {metricasSucursales.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      <Building2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p>Selecciona "Todas las sucursales" para ver la comparativa</p>
                    </div>
                  ) : (
                    <>
                      {/* Resumen en tarjetas */}
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-6">
                        {(() => {
                          const maxIngresos = Math.max(...metricasSucursales.map(x => x.ingresos), 1)
                          const promedioIngresos = metricasSucursales.reduce((s, x) => s + x.ingresos, 0) / metricasSucursales.length
                          return metricasSucursales.map((s, idx) => {
                            const aboveAvg = s.ingresos >= promedioIngresos
                            return (
                              <div
                                key={s.sucursalId}
                                className={cn(
                                  "p-4 rounded-lg border border-l-4 bg-card space-y-2 shadow-sm",
                                  SUCURSAL_ACCENT_BORDERS[idx % SUCURSAL_ACCENT_BORDERS.length],
                                )}
                              >
                                <div className="flex items-center justify-between">
                                  <p className="font-semibold text-sm">{s.nombre}</p>
                                  <Badge variant="outline" className="text-xs">{s.totalCitas} citas</Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                  <p className="text-xl font-bold">{fmtMXN(s.ingresos)}</p>
                                  <span className={cn(
                                    "inline-flex items-center text-xs font-semibold",
                                    aboveAvg ? "text-green-600" : "text-red-500",
                                  )}>
                                    {aboveAvg
                                      ? <TrendingUp className="h-4 w-4" />
                                      : <TrendingDown className="h-4 w-4" />}
                                  </span>
                                </div>
                                <div className="flex justify-between text-xs text-muted-foreground">
                                  <span>Ticket: {fmtMXN(s.ticketPromedio)}</span>
                                  <span className="truncate max-w-[120px]">Top: {s.topServicio}</span>
                                </div>
                                <BarraHorizontal
                                  valor={s.ingresos}
                                  max={maxIngresos}
                                  gradientClass={SUCURSAL_GRADIENTS[idx % SUCURSAL_GRADIENTS.length]}
                                  heightClass="h-3"
                                />
                              </div>
                            )
                          })
                        })()}
                      </div>

                      {/* Tabla detallada */}
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>#</TableHead>
                              <TableHead>Sucursal</TableHead>
                              <TableHead className="text-right">Ingresos</TableHead>
                              <TableHead className="text-right">Citas</TableHead>
                              <TableHead className="text-right">Ticket Prom.</TableHead>
                              <TableHead>Top Servicio</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {metricasSucursales.map((s, i) => (
                              <TableRow key={s.sucursalId}>
                                <TableCell className="text-muted-foreground font-mono text-xs">{i + 1}</TableCell>
                                <TableCell className="font-medium">{s.nombre}</TableCell>
                                <TableCell className="text-right tabular-nums font-semibold">{fmtMXN(s.ingresos)}</TableCell>
                                <TableCell className="text-right tabular-nums">{s.totalCitas}</TableCell>
                                <TableCell className="text-right tabular-nums text-muted-foreground">{fmtMXN(s.ticketPromedio)}</TableCell>
                                <TableCell className="text-muted-foreground text-sm">{s.topServicio}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {!isManager && (
            <TabsContent value="nomina" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="h-5 w-5" />
                    Nómina por Empleada
                  </CardTitle>
                  <CardDescription>{periodoLabel}</CardDescription>
                </CardHeader>
                <CardContent>
                  {empleadosTop.length === 0 ? (
                    <p className="text-center py-8 text-sm text-muted-foreground">
                      Sin datos en este período
                    </p>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>#</TableHead>
                              <TableHead>Empleada</TableHead>
                              {isAdmin && <TableHead>Sucursal</TableHead>}
                              <TableHead className="text-right"># Servicios</TableHead>
                              <TableHead className="text-right">Ventas Totales</TableHead>
                              <TableHead className="text-right">Comisión (30%)</TableHead>
                              <TableHead className="text-right">Propinas</TableHead>
                              <TableHead className="text-right">Total a Pagar</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(() => {
                              const propMap = new Map(
                                propinasEmpleadas.map(p => [p.empleadoId, p.totalPropinas])
                              )
                              const rows = empleadosTop.map(e => ({
                                ...e,
                                propinas: propMap.get(
                                  pagosBrutos
                                    .find(p => p.empleadoNombre === `${e.nombre} ${e.apellido}`)
                                    ?.empleadoId ?? ""
                                ) ?? 0,
                              }))
                              const totalVentas    = rows.reduce((s, r) => s + r.ingresos, 0)
                              const totalComision  = rows.reduce((s, r) => s + r.comision, 0)
                              const totalPropinas  = rows.reduce((s, r) => s + r.propinas, 0)
                              const totalAPagar    = totalComision + totalPropinas

                              return (
                                <>
                                  {rows.map((e, i) => {
                                    const totalPagar = e.comision + e.propinas
                                    return (
                                      <TableRow key={`${e.nombre}-${e.apellido}-${i}`}>
                                        <TableCell className="text-muted-foreground font-mono text-xs">
                                          {i + 1}
                                        </TableCell>
                                        <TableCell className="font-medium">
                                          {e.nombre} {e.apellido}
                                        </TableCell>
                                        {isAdmin && (
                                          <TableCell className="text-muted-foreground text-sm">
                                            {e.sucursal}
                                          </TableCell>
                                        )}
                                        <TableCell className="text-right tabular-nums">
                                          {e.servicios}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums font-semibold">
                                          {fmtMXN(e.ingresos)}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums text-blue-600 font-semibold">
                                          {fmtMXN(e.comision)}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums text-green-600 font-semibold">
                                          {e.propinas > 0 ? fmtMXN(e.propinas) : "—"}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums font-bold">
                                          {fmtMXN(totalPagar)}
                                        </TableCell>
                                      </TableRow>
                                    )
                                  })}
                                  {/* Totales */}
                                  <TableRow className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                                    <TableCell colSpan={isAdmin ? 4 : 3} className="text-right text-sm">
                                      Totales
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                      {fmtMXN(totalVentas)}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums text-blue-600">
                                      {fmtMXN(totalComision)}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums text-green-600">
                                      {fmtMXN(totalPropinas)}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums text-lg">
                                      {fmtMXN(totalAPagar)}
                                    </TableCell>
                                  </TableRow>
                                </>
                              )
                            })()}
                          </TableBody>
                        </Table>
                      </div>
                      <p className="text-xs text-muted-foreground mt-3">
                        * Comisión calculada al 30% sobre ventas totales. Propinas tomadas de cobros registrados en el período.
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

        </Tabs>
      </div>
    </>
  )
}
