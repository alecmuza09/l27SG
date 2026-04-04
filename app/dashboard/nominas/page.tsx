"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Loader2, DollarSign, Users, Scissors, ChevronDown, ChevronRight,
  FileDown, Building2, TrendingUp, RefreshCw, Filter,
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getNominasAction, type NominasResult, type SucursalNomina } from "@/app/actions/nominas"
import { getCurrentUser } from "@/lib/auth"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import * as XLSX from "xlsx"

// ─── helpers ────────────────────────────────────────────────────────────────
const fmtMXN = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n)

const dateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

const hoy = () => dateStr(new Date())
const primerDiaMes = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-01` }

const fmtFecha = (d: string) =>
  new Date(d + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })

const cleanNombre = (n: string) =>
  n.replace("Luna 27 ", "").replace("Luna27 ", "").replace("Luna 27", "").trim()

type Periodo = "hoy" | "semana" | "mes" | "trimestre" | "anio" | "personalizado"

function calcularRango(periodo: Periodo): { inicio: string; fin: string } {
  const now = new Date()
  const fin = hoy()
  if (periodo === "hoy") return { inicio: fin, fin }
  if (periodo === "semana") {
    const d = new Date(now); d.setDate(d.getDate() - 6)
    return { inicio: dateStr(d), fin }
  }
  if (periodo === "mes") return { inicio: primerDiaMes(), fin }
  if (periodo === "trimestre") {
    const d = new Date(now); d.setMonth(d.getMonth() - 2); d.setDate(1)
    return { inicio: dateStr(d), fin }
  }
  if (periodo === "anio") return { inicio: `${now.getFullYear()}-01-01`, fin }
  return { inicio: primerDiaMes(), fin }
}

// ─── Excel Export ─────────────────────────────────────────────────────────────
function exportarExcel(result: NominasResult, sucursalFiltro: string) {
  const wb = XLSX.utils.book_new()

  const sucursales = sucursalFiltro === "todas"
    ? result.sucursales
    : result.sucursales.filter(s => s.sucursalId === sucursalFiltro)

  // Una hoja por sucursal
  for (const suc of sucursales) {
    const nombre = cleanNombre(suc.sucursalNombre).slice(0, 31) // max 31 chars en Excel

    const rows: any[][] = [
      [`Nómina — ${suc.sucursalNombre}`],
      [`Período: ${fmtFecha(result.fechaInicio)} al ${fmtFecha(result.fechaFin)}`],
      [],
      ["Empleada", "Servicios", "Ingresos", "Comisión %", "A Pagar"],
      ...suc.empleadas.map(e => [
        `${e.nombre} ${e.apellido}`,
        e.servicios,
        e.ingresos,
        `${e.porcentajeComision}%`,
        e.comision,
      ]),
      [],
      ["TOTAL", suc.totalServicios, suc.totalIngresos, "", suc.totalComision],
    ]

    const ws = XLSX.utils.aoa_to_sheet(rows)

    // Anchos de columna
    ws["!cols"] = [{ wch: 30 }, { wch: 12 }, { wch: 15 }, { wch: 14 }, { wch: 15 }]

    XLSX.utils.book_append_sheet(wb, ws, nombre)
  }

  // Hoja de resumen global
  const resumenRows: any[][] = [
    ["Resumen Global de Nóminas"],
    [`Período: ${fmtFecha(result.fechaInicio)} al ${fmtFecha(result.fechaFin)}`],
    [],
    ["Sucursal", "Empleadas", "Servicios", "Ingresos", "A Pagar"],
    ...sucursales.map(s => [
      cleanNombre(s.sucursalNombre),
      s.empleadas.length,
      s.totalServicios,
      s.totalIngresos,
      s.totalComision,
    ]),
    [],
    ["TOTAL GLOBAL", sucursales.reduce((a, s) => a + s.empleadas.length, 0),
      sucursales.reduce((a, s) => a + s.totalServicios, 0),
      sucursales.reduce((a, s) => a + s.totalIngresos, 0),
      sucursales.reduce((a, s) => a + s.totalComision, 0)],
  ]
  const wsResumen = XLSX.utils.aoa_to_sheet(resumenRows)
  wsResumen["!cols"] = [{ wch: 26 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 15 }]
  XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen")

  const fecha = hoy().replace(/-/g, "")
  XLSX.writeFile(wb, `nominas-luna27-${fecha}.xlsx`)
  toast.success("Excel descargado correctamente")
}

// ─── KPI Card ───────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string; sub?: string; icon: React.ElementType; color: string
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center", color)}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Sucursal Card ────────────────────────────────────────────────────────────
function SucursalCard({ suc, defaultOpen }: { suc: SucursalNomina; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  useEffect(() => { setOpen(defaultOpen) }, [defaultOpen])
  const nombre = cleanNombre(suc.sucursalNombre)

  return (
    <Card className="overflow-hidden">
      <div
        className="flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-muted/40 transition-colors select-none"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm">{nombre}</p>
            <p className="text-xs text-muted-foreground">
              {suc.empleadas.length} empleada{suc.empleadas.length !== 1 ? "s" : ""} · {suc.totalServicios} servicios
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-muted-foreground">Ingresos</p>
            <p className="font-semibold text-sm">{fmtMXN(suc.totalIngresos)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">A pagar</p>
            <p className="font-bold text-sm text-emerald-600">{fmtMXN(suc.totalComision)}</p>
          </div>
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
        </div>
      </div>

      {open && (
        <div className="border-t overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="bg-muted/30 text-xs text-muted-foreground uppercase tracking-wide">
                <th className="text-left px-5 py-2.5 font-medium">Empleada</th>
                <th className="text-center px-3 py-2.5 font-medium">Servicios</th>
                <th className="text-right px-3 py-2.5 font-medium">Ingresos</th>
                <th className="text-center px-3 py-2.5 font-medium">Comisión %</th>
                <th className="text-right px-5 py-2.5 font-medium text-emerald-700">A Pagar</th>
              </tr>
            </thead>
            <tbody>
              {suc.empleadas.map((e, i) => (
                <tr key={e.empleadaId} className={cn("border-t hover:bg-muted/20 transition-colors", i % 2 !== 0 && "bg-muted/10")}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                        {e.nombre[0]}{e.apellido?.[0] ?? ""}
                      </div>
                      <span className="font-medium">{e.nombre} {e.apellido}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <Badge variant="secondary" className="text-xs">{e.servicios}</Badge>
                  </td>
                  <td className="px-3 py-3 text-right font-medium">{fmtMXN(e.ingresos)}</td>
                  <td className="px-3 py-3 text-center">
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold",
                      e.porcentajeComision >= 40 ? "bg-blue-100 text-blue-700" :
                      e.porcentajeComision >= 30 ? "bg-purple-100 text-purple-700" :
                      "bg-gray-100 text-gray-600"
                    )}>
                      {e.porcentajeComision}%
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-emerald-600">{fmtMXN(e.comision)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 bg-muted/20 font-semibold text-sm">
                <td className="px-5 py-3 text-muted-foreground">Total {nombre}</td>
                <td className="px-3 py-3 text-center">{suc.totalServicios}</td>
                <td className="px-3 py-3 text-right">{fmtMXN(suc.totalIngresos)}</td>
                <td className="px-3 py-3 text-center">—</td>
                <td className="px-5 py-3 text-right text-emerald-600">{fmtMXN(suc.totalComision)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Card>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════

export default function NominasPage() {
  const router = useRouter()
  const currentUser = getCurrentUser()

  useEffect(() => {
    if (currentUser && currentUser.role !== "superadmin" && currentUser.role !== "admin") {
      router.replace("/dashboard")
    }
  }, [currentUser, router])

  const [periodo, setPeriodo] = useState<Periodo>("mes")
  const [fechaInicio, setFechaInicio] = useState(primerDiaMes())
  const [fechaFin, setFechaFin] = useState(hoy())
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<NominasResult | null>(null)
  const [expandAll, setExpandAll] = useState(true)
  const [sucursalFiltro, setSucursalFiltro] = useState<string>("todas")

  const handlePeriodo = (p: Periodo) => {
    setPeriodo(p)
    if (p !== "personalizado") {
      const r = calcularRango(p)
      setFechaInicio(r.inicio)
      setFechaFin(r.fin)
    }
  }

  const cargar = useCallback(async () => {
    setIsLoading(true)
    const { data, error } = await getNominasAction(fechaInicio, fechaFin)
    setIsLoading(false)
    if (error) { toast.error(`Error: ${error}`); return }
    setResult(data ?? null)
  }, [fechaInicio, fechaFin])

  useEffect(() => { cargar() }, [cargar])

  // Sucursales filtradas para la vista
  const sucursalesVista = useMemo(() => {
    if (!result) return []
    return sucursalFiltro === "todas"
      ? result.sucursales
      : result.sucursales.filter(s => s.sucursalId === sucursalFiltro)
  }, [result, sucursalFiltro])

  // Totales derivados del filtro actual
  const totalesFiltro = useMemo(() => ({
    servicios: sucursalesVista.reduce((a, s) => a + s.totalServicios, 0),
    ingresos:  sucursalesVista.reduce((a, s) => a + s.totalIngresos, 0),
    comision:  sucursalesVista.reduce((a, s) => a + s.totalComision, 0),
    empleadas: sucursalesVista.reduce((a, s) => a + s.empleadas.length, 0),
  }), [sucursalesVista])

  const PERIODOS: { key: Periodo; label: string }[] = [
    { key: "hoy",          label: "Hoy"         },
    { key: "semana",       label: "Esta semana"  },
    { key: "mes",          label: "Este mes"     },
    { key: "trimestre",    label: "Trimestre"    },
    { key: "anio",         label: "Este año"     },
    { key: "personalizado",label: "Personalizado"},
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Nóminas</h1>
          <p className="text-muted-foreground text-sm">Comisiones por empleada y sucursal</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={cargar} disabled={isLoading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            Actualizar
          </Button>
          <Button
            size="sm"
            onClick={() => result && exportarExcel(result, sucursalFiltro)}
            disabled={!result || isLoading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <FileDown className="h-4 w-4 mr-2" />
            Descargar Excel
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4 space-y-3">
          {/* Periodos */}
          <div className="flex flex-wrap gap-1.5">
            {PERIODOS.map(p => (
              <button
                key={p.key}
                onClick={() => handlePeriodo(p.key)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  periodo === p.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Fila de fechas + filtro sucursal */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={fechaInicio}
                onChange={e => { setFechaInicio(e.target.value); setPeriodo("personalizado") }}
                className="h-8 text-xs rounded-md border bg-background px-2 text-foreground"
              />
              <span className="text-muted-foreground text-xs">–</span>
              <input
                type="date"
                value={fechaFin}
                onChange={e => { setFechaFin(e.target.value); setPeriodo("personalizado") }}
                className="h-8 text-xs rounded-md border bg-background px-2 text-foreground"
              />
            </div>

            {/* Filtro por sucursal */}
            {result && result.sucursales.length > 1 && (
              <div className="flex items-center gap-2 ml-auto">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                <Select value={sucursalFiltro} onValueChange={setSucursalFiltro}>
                  <SelectTrigger className="h-8 text-xs w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas las sucursales</SelectItem>
                    {result.sucursales.map(s => (
                      <SelectItem key={s.sucursalId} value={s.sucursalId}>
                        {cleanNombre(s.sucursalNombre)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Calculando nóminas…</p>
          </div>
        </div>
      ) : !result ? null : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <KpiCard
              label="Total a pagar"
              value={fmtMXN(totalesFiltro.comision)}
              sub={`${fmtFecha(result.fechaInicio)} – ${fmtFecha(result.fechaFin)}`}
              icon={DollarSign}
              color="bg-emerald-500"
            />
            <KpiCard
              label="Ingresos del período"
              value={fmtMXN(totalesFiltro.ingresos)}
              icon={TrendingUp}
              color="bg-blue-500"
            />
            <KpiCard
              label="Total servicios"
              value={totalesFiltro.servicios.toLocaleString("es-MX")}
              icon={Scissors}
              color="bg-purple-500"
            />
            <KpiCard
              label={sucursalFiltro === "todas" ? "Sucursales" : "Empleadas"}
              value={sucursalFiltro === "todas" ? sucursalesVista.length.toString() : totalesFiltro.empleadas.toString()}
              sub={sucursalFiltro === "todas" ? `${totalesFiltro.empleadas} empleadas` : cleanNombre(result.sucursales.find(s => s.sucursalId === sucursalFiltro)?.sucursalNombre ?? "")}
              icon={sucursalFiltro === "todas" ? Building2 : Users}
              color="bg-orange-500"
            />
          </div>

          {/* Controles tabla */}
          {sucursalesVista.length > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {sucursalesVista.length} sucursal{sucursalesVista.length !== 1 ? "es" : ""} con actividad
              </p>
              <Button variant="ghost" size="sm" onClick={() => setExpandAll(v => !v)} className="text-xs">
                {expandAll ? "Colapsar todo" : "Expandir todo"}
              </Button>
            </div>
          )}

          {/* Listado por sucursal */}
          {sucursalesVista.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                <Scissors className="h-10 w-10 opacity-20" />
                <p className="font-medium">Sin servicios completados en este período</p>
                <p className="text-xs">Prueba con otro rango de fechas o sucursal</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {sucursalesVista.map(suc => (
                <SucursalCard key={suc.sucursalId} suc={suc} defaultOpen={expandAll} />
              ))}
            </div>
          )}

          {/* Resumen global */}
          {sucursalesVista.length > 0 && (
            <Card className="border-2 border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20">
              <CardContent className="p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-sm text-emerald-800 dark:text-emerald-300">
                      {sucursalFiltro === "todas" ? "Resumen Global" : `Resumen — ${cleanNombre(result.sucursales.find(s => s.sucursalId === sucursalFiltro)?.sucursalNombre ?? "")}`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {fmtFecha(result.fechaInicio)} al {fmtFecha(result.fechaFin)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-6">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Servicios</p>
                      <p className="font-bold">{totalesFiltro.servicios.toLocaleString("es-MX")}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Ingresos brutos</p>
                      <p className="font-bold">{fmtMXN(totalesFiltro.ingresos)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Total nómina</p>
                      <p className="text-2xl font-bold text-emerald-600">{fmtMXN(totalesFiltro.comision)}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
