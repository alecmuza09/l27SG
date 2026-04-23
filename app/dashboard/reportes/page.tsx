"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, FileSpreadsheet, TrendingUp, Users, Calendar, Loader2, RefreshCw } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { getPagosFromDB, type Pago } from "@/lib/data/pagos"
import { getServiciosPopulares, getTopEmpleadosFromDB } from "@/lib/data/dashboard"
import { getClientesStats } from "@/lib/data/clientes"
import { getCurrentUser } from "@/lib/auth"
import * as XLSX from "xlsx"

// ── Helpers de fecha ─────────────────────────────────────────────────────────

function localFmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

type Periodo = "semana" | "mes" | "trimestre" | "año"

interface RangoPeriodo {
  fechaDesde: string
  fechaHasta: string
  label: string
}

function calcularPeriodo(periodo: Periodo): RangoPeriodo {
  const hoy = new Date()
  const hoyStr = localFmt(hoy)

  switch (periodo) {
    case "semana": {
      const inicio = new Date(hoy)
      inicio.setDate(hoy.getDate() - 6)
      return { fechaDesde: localFmt(inicio), fechaHasta: hoyStr, label: "Esta Semana" }
    }
    case "mes": {
      const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
      return { fechaDesde: localFmt(inicio), fechaHasta: hoyStr, label: "Este Mes" }
    }
    case "trimestre": {
      const inicio = new Date(hoy)
      inicio.setMonth(hoy.getMonth() - 3)
      return { fechaDesde: localFmt(inicio), fechaHasta: hoyStr, label: "Últimos 3 Meses" }
    }
    case "año": {
      const inicio = new Date(hoy.getFullYear(), 0, 1)
      return { fechaDesde: localFmt(inicio), fechaHasta: hoyStr, label: "Este Año" }
    }
  }
}

interface VentaDia {
  etiqueta: string
  fecha: string
  ventas: number
}

function buildVentasPorPeriodo(pagos: Pago[], periodo: Periodo, fechaDesde: string, fechaHasta: string): VentaDia[] {
  const completados = pagos.filter(p => p.estado === "completado")

  if (periodo === "semana" || periodo === "mes") {
    const inicio = new Date(fechaDesde + "T12:00:00")
    const fin    = new Date(fechaHasta + "T12:00:00")
    const dias: VentaDia[] = []
    const cur = new Date(inicio)
    while (cur <= fin) {
      const fechaStr = localFmt(cur)
      const ventas   = completados
        .filter(p => p.fecha === fechaStr)
        .reduce((s, p) => s + p.monto, 0)
      const etiqueta = periodo === "semana"
        ? cur.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" })
        : cur.toLocaleDateString("es-MX", { day: "numeric", month: "short" })
      dias.push({ etiqueta, fecha: fechaStr, ventas })
      cur.setDate(cur.getDate() + 1)
    }
    return dias
  }

  if (periodo === "trimestre") {
    const inicio = new Date(fechaDesde + "T12:00:00")
    const fin    = new Date(fechaHasta + "T12:00:00")
    const semanas: VentaDia[] = []
    const cur = new Date(inicio)
    while (cur <= fin) {
      const semanaInicio = localFmt(cur)
      const semanaFinD   = new Date(cur)
      semanaFinD.setDate(semanaFinD.getDate() + 6)
      if (semanaFinD > fin) semanaFinD.setTime(fin.getTime())
      const semanaFin = localFmt(semanaFinD)
      const ventas    = completados
        .filter(p => p.fecha >= semanaInicio && p.fecha <= semanaFin)
        .reduce((s, p) => s + p.monto, 0)
      const etiqueta = `${cur.toLocaleDateString("es-MX", { day: "numeric", month: "short" })} – ${semanaFinD.toLocaleDateString("es-MX", { day: "numeric", month: "short" })}`
      semanas.push({ etiqueta, fecha: semanaInicio, ventas })
      cur.setDate(cur.getDate() + 7)
    }
    return semanas
  }

  // año → agrupado por mes
  const hoy = new Date()
  const meses: VentaDia[] = []
  for (let m = 0; m <= hoy.getMonth(); m++) {
    const inicioMes = `${hoy.getFullYear()}-${String(m + 1).padStart(2, "0")}-01`
    const ultimoDia = new Date(hoy.getFullYear(), m + 1, 0).getDate()
    const finMes    = `${hoy.getFullYear()}-${String(m + 1).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`
    const ventas    = completados
      .filter(p => p.fecha >= inicioMes && p.fecha <= finMes)
      .reduce((s, p) => s + p.monto, 0)
    const etiqueta  = new Date(hoy.getFullYear(), m, 1)
      .toLocaleDateString("es-MX", { month: "short", year: "2-digit" })
    meses.push({ etiqueta, fecha: inicioMes, ventas })
  }
  return meses
}

const fmtMXN = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n)

// ── Componente principal ──────────────────────────────────────────────────────

export default function ReportesPage() {
  const currentUser = getCurrentUser()
  const isAdmin   = currentUser?.role === "admin"
  const isManager = currentUser?.role === "manager"
  const sucursalFiltro = isAdmin ? undefined : (currentUser?.sucursalId ?? undefined)

  // ── Estado ──────────────────────────────────────────────────────────────
  const [periodo,   setPeriodo]   = useState<Periodo>("mes")
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(isManager ? "servicios" : "ventas")

  const [pagosBrutos,           setPagosBrutos]           = useState<Pago[]>([])
  const [ventasPeriodo,         setVentasPeriodo]         = useState<VentaDia[]>([])
  const [serviciosMasVendidos,  setServiciosMasVendidos]  = useState<Array<{ name: string; cantidad: number; ingresos: number }>>([])
  const [empleadosTop,          setEmpleadosTop]          = useState<Array<{ nombre: string; apellido: string; servicios: number; ingresos: number; comision: number }>>([])
  const [stats,                 setStats]                 = useState({ ingresosTotales: 0, totalServicios: 0, nuevosClientes: 0, ticketPromedio: 0 })
  const [clientesStats,         setClientesStats]         = useState({ total: 0, activos: 0, vip: 0, nuevos: 0 })
  const [metodosPago,           setMetodosPago]           = useState<Array<{ metodo: string; monto: number; count: number }>>([])

  // ── Carga de datos ───────────────────────────────────────────────────────
  const cargarDatos = useCallback(async () => {
    setIsLoading(true)
    try {
      const { fechaDesde, fechaHasta } = calcularPeriodo(periodo)

      const [pagos, servicios, empleados, clientesData] = await Promise.all([
        getPagosFromDB(sucursalFiltro, undefined, fechaDesde, fechaHasta),
        getServiciosPopulares(5, sucursalFiltro, undefined, fechaDesde, fechaHasta),
        getTopEmpleadosFromDB(6, sucursalFiltro, fechaDesde, fechaHasta),
        getClientesStats(),
      ])

      setPagosBrutos(pagos)
      setVentasPeriodo(buildVentasPorPeriodo(pagos, periodo, fechaDesde, fechaHasta))

      const completados = pagos.filter(p => p.estado === "completado")
      const ingresosTotales = completados.reduce((s, p) => s + p.monto, 0)
      const totalServicios  = completados.length
      setStats({
        ingresosTotales,
        totalServicios,
        nuevosClientes: clientesData.nuevos,
        ticketPromedio: totalServicios > 0 ? Math.round(ingresosTotales / totalServicios) : 0,
      })
      setClientesStats(clientesData)

      // Métodos de pago
      const metodosMap = new Map<string, { monto: number; count: number }>()
      completados.forEach(p => {
        const m = p.metodoPago ?? "otro"
        const prev = metodosMap.get(m) ?? { monto: 0, count: 0 }
        metodosMap.set(m, { monto: prev.monto + p.monto, count: prev.count + 1 })
      })
      setMetodosPago(Array.from(metodosMap.entries())
        .map(([metodo, v]) => ({ metodo, ...v }))
        .sort((a, b) => b.monto - a.monto))

      setServiciosMasVendidos(servicios.map(s => ({
        name: s.name, cantidad: s.count, ingresos: s.revenue,
      })))
      setEmpleadosTop(empleados.map(e => ({
        nombre: e.nombre, apellido: e.apellido,
        servicios: e.citas, ingresos: e.ingresos,
        comision: Math.round(e.ingresos * 0.3),
      })))
    } catch (err) {
      console.error("Error cargando reportes:", err)
    } finally {
      setIsLoading(false)
    }
  }, [periodo, sucursalFiltro])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  // ── Exportar PDF (window.print) ──────────────────────────────────────────
  const handleExportPDF = () => {
    window.print()
  }

  // ── Exportar Excel ────────────────────────────────────────────────────────
  const handleExportExcel = () => {
    const { label } = calcularPeriodo(periodo)
    const wb = XLSX.utils.book_new()

    // Hoja: Resumen KPIs
    const resumenData = [
      ["Reporte Luna27", label],
      [],
      ["KPI", "Valor"],
      ["Ingresos Totales", stats.ingresosTotales],
      ["Total Servicios", stats.totalServicios],
      ["Nuevos Clientes", stats.nuevosClientes],
      ["Ticket Promedio", stats.ticketPromedio],
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumenData), "Resumen")

    // Hoja: Ventas por Día/Semana/Mes
    const ventasHeaders = [["Etiqueta", "Fecha", "Monto ($)"]]
    const ventasRows    = ventasPeriodo.map(v => [v.etiqueta, v.fecha, v.ventas])
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([...ventasHeaders, ...ventasRows]), "Ventas por Período")

    // Hoja: Servicios
    const svcHeaders = [["Servicio", "Cantidad", "Ingresos ($)", "Promedio ($)"]]
    const svcRows    = serviciosMasVendidos.map(s => [s.name, s.cantidad, s.ingresos, s.cantidad > 0 ? Math.round(s.ingresos / s.cantidad) : 0])
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([...svcHeaders, ...svcRows]), "Servicios")

    // Hoja: Empleados
    const empHeaders = [["Nombre", "Apellido", "Servicios", "Ingresos ($)", "Comisión ($)"]]
    const empRows    = empleadosTop.map(e => [e.nombre, e.apellido, e.servicios, e.ingresos, e.comision])
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([...empHeaders, ...empRows]), "Empleados")

    // Hoja: Clientes
    const cliData = [
      ["Categoría", "Cantidad"],
      ["Total", clientesStats.total],
      ["Activos", clientesStats.activos],
      ["VIP", clientesStats.vip],
      ["Nuevos (30 días)", clientesStats.nuevos],
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cliData), "Clientes")

    // Hoja: Métodos de pago
    const metHeaders = [["Método", "Cobros", "Monto ($)"]]
    const metRows    = metodosPago.map(m => [m.metodo, m.count, m.monto])
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([...metHeaders, ...metRows]), "Métodos de Pago")

    const slug = periodo === "semana" ? "esta-semana" : periodo === "mes" ? "este-mes" : periodo === "trimestre" ? "trimestre" : "este-año"
    XLSX.writeFile(wb, `reporte-${slug}.xlsx`)
  }

  // ── Derived ──────────────────────────────────────────────────────────────
  const maxVentas = ventasPeriodo.length > 0 ? Math.max(...ventasPeriodo.map(d => d.ventas), 1) : 1
  const maxCitas  = empleadosTop.length  > 0 ? Math.max(...empleadosTop.map(e => e.servicios), 1) : 1
  const { label: periodoLabel } = calcularPeriodo(periodo)

  // ── Loading ──────────────────────────────────────────────────────────────
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* CSS para impresión PDF */}
      <style>{`
        @media print {
          body > * { visibility: hidden !important; }
          #reporte-contenido, #reporte-contenido * { visibility: visible !important; }
          #reporte-contenido { position: fixed; top: 0; left: 0; width: 100%; padding: 24px; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div id="reporte-contenido" className="space-y-6">
        {/* Cabecera */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Reportes</h1>
            <p className="text-muted-foreground">
              {isManager ? "Análisis y estadísticas de tu sucursal" : "Análisis y estadísticas del negocio"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 no-print">
            <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semana">Esta Semana</SelectItem>
                <SelectItem value="mes">Este Mes</SelectItem>
                <SelectItem value="trimestre">Trimestre</SelectItem>
                <SelectItem value="año">Este Año</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={cargarDatos} title="Actualizar">
              <RefreshCw className="h-4 w-4" />
            </Button>
            {!isManager && (
              <>
                <Button variant="outline" onClick={handleExportPDF}>
                  <Download className="mr-2 h-4 w-4" />
                  PDF
                </Button>
                <Button variant="outline" onClick={handleExportExcel}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Excel
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Badge de período activo */}
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-normal">
            <Calendar className="mr-1 h-3 w-3" />
            Período: {periodoLabel}
          </Badge>
        </div>

        {/* KPI cards */}
        <div className={`grid gap-4 ${isManager ? "md:grid-cols-2" : "md:grid-cols-4"}`}>
          {!isManager && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Ingresos Totales</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{fmtMXN(stats.ingresosTotales)}</div>
                <p className="text-xs text-muted-foreground mt-1">{periodoLabel}</p>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Servicios</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalServicios}</div>
              <p className="text-xs text-muted-foreground mt-1">Servicios completados</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Nuevos Clientes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.nuevosClientes}</div>
              <p className="text-xs text-muted-foreground mt-1">Últimos 30 días</p>
            </CardContent>
          </Card>
          {!isManager && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Ticket Promedio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{fmtMXN(stats.ticketPromedio)}</div>
                <p className="text-xs text-muted-foreground mt-1">Promedio por cobro</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="no-print">
            {!isManager && <TabsTrigger value="ventas">Ventas</TabsTrigger>}
            <TabsTrigger value="servicios">Servicios</TabsTrigger>
            <TabsTrigger value="empleados">Empleados</TabsTrigger>
            <TabsTrigger value="clientes">Clientes</TabsTrigger>
          </TabsList>

          {/* ── Ventas ── */}
          {!isManager && (
            <TabsContent value="ventas" className="space-y-4">
              {/* Ventas por período */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    {periodo === "año" ? "Ventas por Mes" : periodo === "trimestre" ? "Ventas por Semana" : "Ventas por Día"}
                  </CardTitle>
                  <CardDescription>
                    {periodoLabel} · {ventasPeriodo.filter(d => d.ventas > 0).length} días con actividad
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {ventasPeriodo.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground text-sm">Sin datos en este período</p>
                  ) : (
                    <div className="space-y-3">
                      {ventasPeriodo.map((d) => (
                        <div key={d.fecha} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium capitalize min-w-[120px]">{d.etiqueta}</span>
                            <span className={`font-semibold tabular-nums ${d.ventas === 0 ? "text-muted-foreground" : ""}`}>
                              {d.ventas === 0 ? "—" : fmtMXN(d.ventas)}
                            </span>
                          </div>
                          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all duration-500"
                              style={{ width: `${maxVentas > 0 ? (d.ventas / maxVentas) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Métodos de pago */}
              <div className="grid gap-4 md:grid-cols-2">
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
                        {metodosPago.map((m) => {
                          const pct = stats.ingresosTotales > 0 ? Math.round((m.monto / stats.ingresosTotales) * 100) : 0
                          const label = m.metodo === "efectivo" ? "Efectivo" : m.metodo === "tarjeta" ? "Tarjeta" : m.metodo === "transferencia" ? "Transferencia" : m.metodo
                          return (
                            <div key={m.metodo} className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span className="capitalize font-medium">{label}</span>
                                <span className="text-muted-foreground">{fmtMXN(m.monto)} · {m.count} cobros</span>
                              </div>
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Resumen Financiero
                    </CardTitle>
                    <CardDescription>{periodoLabel}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {[
                        { label: "Ingresos brutos", value: fmtMXN(stats.ingresosTotales) },
                        { label: "Total cobros", value: `${stats.totalServicios}` },
                        { label: "Ticket promedio", value: fmtMXN(stats.ticketPromedio) },
                      ].map(item => (
                        <div key={item.label} className="flex justify-between items-center py-2 border-b last:border-0">
                          <span className="text-sm text-muted-foreground">{item.label}</span>
                          <span className="font-semibold">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}

          {/* ── Servicios ── */}
          <TabsContent value="servicios">
            <Card>
              <CardHeader>
                <CardTitle>Servicios Más Vendidos</CardTitle>
                <CardDescription>Top 5 · {periodoLabel}</CardDescription>
              </CardHeader>
              <CardContent>
                {serviciosMasVendidos.length === 0 ? (
                  <p className="text-center py-8 text-sm text-muted-foreground">Sin servicios en este período</p>
                ) : (
                  <div className="space-y-3">
                    {serviciosMasVendidos.map((s, i) => (
                      <div key={s.name} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{s.name}</p>
                          <p className="text-xs text-muted-foreground">{s.cantidad} realizados</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-semibold">{fmtMXN(s.ingresos)}</p>
                          {!isManager && (
                            <p className="text-xs text-muted-foreground">
                              {fmtMXN(s.cantidad > 0 ? Math.round(s.ingresos / s.cantidad) : 0)} / servicio
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Empleados ── */}
          <TabsContent value="empleados">
            <Card>
              <CardHeader>
                <CardTitle>Rendimiento de Empleados</CardTitle>
                <CardDescription>Top empleados · {periodoLabel}</CardDescription>
              </CardHeader>
              <CardContent>
                {empleadosTop.length === 0 ? (
                  <p className="text-center py-8 text-sm text-muted-foreground">Sin datos en este período</p>
                ) : (
                  <div className="space-y-4">
                    {empleadosTop.map((e, i) => (
                      <div key={`${e.nombre}-${e.apellido}`} className="p-4 rounded-lg border bg-card">
                        <div className="flex items-center gap-4 mb-2">
                          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 shrink-0">
                            <span className="text-sm font-bold text-primary">#{i + 1}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold">{e.nombre} {e.apellido}</p>
                            <p className="text-xs text-muted-foreground">{e.servicios} servicios</p>
                          </div>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2">
                          <div
                            className="h-full bg-gradient-to-r from-primary to-indigo-500 rounded-full transition-all duration-500"
                            style={{ width: `${isManager ? (maxCitas > 0 ? (e.servicios / maxCitas) * 100 : 0) : (empleadosTop[0]?.ingresos > 0 ? (e.ingresos / empleadosTop[0].ingresos) * 100 : 0)}%` }}
                          />
                        </div>
                        {!isManager && (
                          <div className="grid grid-cols-2 gap-3 pt-2 border-t mt-2">
                            <div>
                              <p className="text-xs text-muted-foreground">Ingresos</p>
                              <p className="font-semibold">{fmtMXN(e.ingresos)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Comisión (30%)</p>
                              <p className="font-semibold text-green-600">{fmtMXN(e.comision)}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Clientes ── */}
          <TabsContent value="clientes">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Clientes por Categoría
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { categoria: "VIP",              cantidad: clientesStats.vip },
                      { categoria: "Activos",          cantidad: clientesStats.activos },
                      { categoria: "Nuevos (30 días)", cantidad: clientesStats.nuevos },
                    ].filter(item => item.cantidad > 0).map(item => {
                      const pct = clientesStats.total > 0 ? Math.round((item.cantidad / clientesStats.total) * 100) : 0
                      return (
                        <div key={item.categoria} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium">{item.categoria}</span>
                            <span className="text-muted-foreground">{pct}% · {item.cantidad}</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Estadísticas de Clientes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-center p-6 rounded-lg bg-primary/5">
                      <div className="text-4xl font-bold text-primary mb-1">{clientesStats.total}</div>
                      <p className="text-sm text-muted-foreground">Total de clientes</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-center p-3 rounded-lg bg-muted/50">
                        <div className="text-2xl font-bold">{clientesStats.activos}</div>
                        <p className="text-xs text-muted-foreground">Activos</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-muted/50">
                        <div className="text-2xl font-bold">{clientesStats.nuevos}</div>
                        <p className="text-xs text-muted-foreground">Nuevos (30d)</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
