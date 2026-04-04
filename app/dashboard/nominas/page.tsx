"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, DollarSign, Users, Scissors, ChevronDown, ChevronRight, Download, Building2, TrendingUp } from "lucide-react"
import { getNominasAction, type NominasResult, type SucursalNomina } from "@/app/actions/nominas"
import { getCurrentUser } from "@/lib/auth"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ─── helpers ────────────────────────────────────────────────────────────────
const fmtMXN = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n)

const hoy = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

const primerDiaMes = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
}

type Periodo = "semana" | "mes" | "trimestre" | "anio" | "personalizado"

function calcularRango(periodo: Periodo): { inicio: string; fin: string } {
  const now = new Date()
  const fin = hoy()
  let inicio = fin

  if (periodo === "semana") {
    const d = new Date(now)
    d.setDate(d.getDate() - 6)
    inicio = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  } else if (periodo === "mes") {
    inicio = primerDiaMes()
  } else if (periodo === "trimestre") {
    const d = new Date(now)
    d.setMonth(d.getMonth() - 2)
    d.setDate(1)
    inicio = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
  } else if (periodo === "anio") {
    inicio = `${now.getFullYear()}-01-01`
  }

  return { inicio, fin }
}

// ─── KPI Card ───────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, color }: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  color: string
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

// ─── Sucursal Row ────────────────────────────────────────────────────────────
function SucursalCard({ suc }: { suc: SucursalNomina }) {
  const [open, setOpen] = useState(true)
  const nombre = suc.sucursalNombre.replace("Luna 27 ", "").replace("Luna27 ", "")

  return (
    <Card className="overflow-hidden">
      <div
        className="flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-muted/40 transition-colors select-none"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
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
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Ingresos</p>
            <p className="font-semibold text-sm">{fmtMXN(suc.totalIngresos)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">A pagar</p>
            <p className="font-bold text-sm text-emerald-600">{fmtMXN(suc.totalComision)}</p>
          </div>
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>

      {open && (
        <div className="border-t">
          <table className="w-full text-sm">
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
                <tr key={e.empleadaId} className={cn("border-t hover:bg-muted/20 transition-colors", i % 2 === 0 ? "" : "bg-muted/10")}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                        {e.nombre[0]}{e.apellido[0]}
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

  // Redirigir si no es superadmin o admin
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

  const handlePeriodo = (p: Periodo) => {
    setPeriodo(p)
    if (p !== "personalizado") {
      const rango = calcularRango(p)
      setFechaInicio(rango.inicio)
      setFechaFin(rango.fin)
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

  const PERIODOS: { key: Periodo; label: string }[] = [
    { key: "semana",       label: "Esta semana" },
    { key: "mes",          label: "Este mes"    },
    { key: "trimestre",    label: "Trimestre"   },
    { key: "anio",         label: "Este año"    },
    { key: "personalizado",label: "Personalizado"},
  ]

  const fmtFecha = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Nóminas</h1>
          <p className="text-muted-foreground text-sm">
            Reporte de comisiones por empleada y sucursal
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={cargar} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
          Actualizar
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Selector de periodo */}
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

            {/* Fechas personalizadas */}
            <div className="flex items-center gap-2 ml-auto">
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
              value={fmtMXN(result.totalComision)}
              sub={`${fmtFecha(result.fechaInicio)} – ${fmtFecha(result.fechaFin)}`}
              icon={DollarSign}
              color="bg-emerald-500"
            />
            <KpiCard
              label="Ingresos totales"
              value={fmtMXN(result.totalIngresos)}
              icon={TrendingUp}
              color="bg-blue-500"
            />
            <KpiCard
              label="Total servicios"
              value={result.totalServicios.toLocaleString("es-MX")}
              icon={Scissors}
              color="bg-purple-500"
            />
            <KpiCard
              label="Sucursales"
              value={result.sucursales.length.toString()}
              sub={`${result.sucursales.reduce((s, x) => s + x.empleadas.length, 0)} empleadas`}
              icon={Users}
              color="bg-orange-500"
            />
          </div>

          {/* Controles de tabla */}
          {result.sucursales.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {result.sucursales.length} sucursal{result.sucursales.length !== 1 ? "es" : ""} con actividad
              </p>
              <Button variant="ghost" size="sm" onClick={() => setExpandAll(v => !v)} className="text-xs">
                {expandAll ? "Colapsar todo" : "Expandir todo"}
              </Button>
            </div>
          )}

          {/* Por sucursal */}
          {result.sucursales.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                <Scissors className="h-10 w-10 opacity-20" />
                <p className="font-medium">Sin servicios completados en este período</p>
                <p className="text-xs">Prueba con un rango de fechas diferente</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {result.sucursales.map(suc => (
                <SucursalCard key={suc.sucursalId} suc={suc} />
              ))}
            </div>
          )}

          {/* Resumen final */}
          {result.sucursales.length > 0 && (
            <Card className="border-2 border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20">
              <CardContent className="p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-sm text-emerald-800 dark:text-emerald-300">Resumen Global</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {fmtFecha(result.fechaInicio)} al {fmtFecha(result.fechaFin)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-6">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Servicios</p>
                      <p className="font-bold">{result.totalServicios.toLocaleString("es-MX")}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Ingresos brutos</p>
                      <p className="font-bold">{fmtMXN(result.totalIngresos)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Total nómina</p>
                      <p className="text-2xl font-bold text-emerald-600">{fmtMXN(result.totalComision)}</p>
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
