"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  CreditCard, Banknote, ArrowLeftRight, Plus, ShoppingBag,
  RefreshCw, Receipt, Search, Gift, Loader2, Wallet,
} from "lucide-react"
import {
  getPagosFromDB, getResumenCajaDiarioFromDB,
  type Pago, type ResumenCajaDiario,
} from "@/lib/data/pagos"
import { getCitasByDateAndSucursalFromDB, type Cita } from "@/lib/data/citas"
import { getSucursalesActivasFromDB, type Sucursal } from "@/lib/data/sucursales"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { CajaDialog } from "@/components/punto-venta/caja-dialog"
import { cn } from "@/lib/utils"

// ─── helpers ────────────────────────────────────────────────────────────────
const fmtMXN = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n)

const hoy = () => new Date().toISOString().slice(0, 10)

// ─── tipos locales ───────────────────────────────────────────────────────────
interface Gasto {
  id: string
  descripcion: string
  monto: number
  categoria: string
  hora: string
}

// ─── StatRow helper ──────────────────────────────────────────────────────────
function StatRow({
  label, value, highlight = false,
}: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cn(
      "flex justify-between items-center py-1.5 px-2 rounded text-xs",
      highlight ? "bg-amber-50 font-semibold text-amber-900" : "text-muted-foreground",
    )}>
      <span>{label}</span>
      <span className={highlight ? "text-amber-800 font-bold" : "font-medium text-foreground"}>{value}</span>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════

export default function PagosPage() {
  const [fecha, setFecha]                       = useState(hoy())
  const [sucursales, setSucursales]             = useState<Sucursal[]>([])
  const [sucursalId, setSucursalId]             = useState<string>("todas")
  const [citas, setCitas]                       = useState<Cita[]>([])
  const [pagos, setPagos]                       = useState<Pago[]>([])
  const [resumen, setResumen]                   = useState<ResumenCajaDiario | null>(null)
  const [gastos, setGastos]                     = useState<Gasto[]>([])
  const [isLoading, setIsLoading]               = useState(true)
  const [cajaOpen, setCajaOpen]                 = useState(false)
  const [citasSeleccionadas, setCitasSeleccionadas] = useState<Set<string>>(new Set())
  const [gastoDialogOpen, setGastoDialogOpen]   = useState(false)
  const [nuevoGasto, setNuevoGasto]             = useState({ descripcion: "", monto: "", categoria: "operativo" })
  const [busqueda, setBusqueda]                 = useState("")
  const [busquedaCitas, setBusquedaCitas]       = useState("")

  // ── carga de datos ──────────────────────────────────────────────────────────
  const cargarDatos = useCallback(async () => {
    setIsLoading(true)
    try {
      const [sucData, pagosData, resData] = await Promise.all([
        getSucursalesActivasFromDB(),
        getPagosFromDB(sucursalId !== "todas" ? sucursalId : undefined),
        getResumenCajaDiarioFromDB(sucursalId !== "todas" ? sucursalId : undefined),
      ])
      setSucursales(sucData)
      setPagos(pagosData)
      setResumen(resData)

      // Citas del día seleccionado
      if (sucursalId !== "todas") {
        const citasData = await getCitasByDateAndSucursalFromDB(fecha, sucursalId)
        setCitas(citasData)
      } else if (sucData.length > 0) {
        // Para "todas", cargamos de la primera sucursal como default
        const citasData = await getCitasByDateAndSucursalFromDB(fecha, sucData[0].id)
        setCitas(citasData)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }, [fecha, sucursalId])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  // ── estado derivado ─────────────────────────────────────────────────────────
  const citasPendientes = citas.filter(c =>
    !c.pagado &&
    c.estado !== "cancelada" &&
    c.estado !== "no-asistio",
  )

  const citasPendientesFiltradas = busquedaCitas
    ? citasPendientes.filter(c =>
        c.clienteNombre.toLowerCase().includes(busquedaCitas.toLowerCase()) ||
        c.empleadoNombre.toLowerCase().includes(busquedaCitas.toLowerCase()) ||
        c.servicioNombre.toLowerCase().includes(busquedaCitas.toLowerCase()),
      )
    : citasPendientes

  const pagosFiltrados = busqueda
    ? pagos.filter(p =>
        p.clienteNombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        p.empleadoNombre?.toLowerCase().includes(busqueda.toLowerCase()),
      )
    : pagos

  const totalEfectivo   = pagos.filter(p => p.metodoPago === "efectivo").reduce((s, p) => s + p.monto, 0)
  const totalTarjeta    = pagos.filter(p => p.metodoPago === "tarjeta").reduce((s, p) => s + p.monto, 0)
  const totalTransf     = pagos.filter(p => p.metodoPago === "transferencia").reduce((s, p) => s + p.monto, 0)
  const totalGastos     = gastos.reduce((s, g) => s + g.monto, 0)
  const totalGeneral    = totalEfectivo + totalTarjeta + totalTransf

  // ── helpers de selección ────────────────────────────────────────────────────
  const toggleCita = (id: string) => {
    setCitasSeleccionadas(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleTodas = () => {
    const ids = citasPendientesFiltradas.map(c => c.id)
    const todasSeleccionadas = ids.every(id => citasSeleccionadas.has(id))
    if (todasSeleccionadas) {
      setCitasSeleccionadas(new Set())
    } else {
      setCitasSeleccionadas(new Set(ids))
    }
  }

  const citasACobrar = citasPendientes.filter(c => citasSeleccionadas.has(c.id))
  const totalSeleccionado = citasACobrar.reduce((s, c) => s + c.precio, 0)

  const abrirCajaConSeleccion = () => {
    if (citasSeleccionadas.size === 0) return
    setCajaOpen(true)
  }

  // ── acciones ────────────────────────────────────────────────────────────────

  const agregarGasto = () => {
    if (!nuevoGasto.descripcion || !nuevoGasto.monto) return
    setGastos(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        descripcion: nuevoGasto.descripcion,
        monto: parseFloat(nuevoGasto.monto),
        categoria: nuevoGasto.categoria,
        hora: new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
      },
    ])
    setNuevoGasto({ descripcion: "", monto: "", categoria: "operativo" })
    setGastoDialogOpen(false)
  }

  // ── estado de cita badge ────────────────────────────────────────────────────
  const estadoColor = (estado: string) => {
    const m: Record<string, string> = {
      "pendiente":   "bg-yellow-100 text-yellow-800 border-yellow-200",
      "confirmada":  "bg-blue-100 text-blue-800 border-blue-200",
      "en-progreso": "bg-purple-100 text-purple-800 border-purple-200",
      "completada":  "bg-green-100 text-green-800 border-green-200",
    }
    return m[estado] ?? "bg-gray-100 text-gray-700 border-gray-200"
  }

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex gap-0 -m-6 h-[calc(100vh-4rem)]">

      {/* ════════════════════════ PANEL IZQUIERDO ══════════════════════════════ */}
      <aside className="w-56 flex-shrink-0 bg-gray-50 border-r flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b bg-white">
          <h2 className="font-bold text-base text-foreground mb-3">Cobros Luna27</h2>

          {/* Sucursal */}
          <Select value={sucursalId} onValueChange={setSucursalId}>
            <SelectTrigger className="h-8 text-xs mb-2">
              <SelectValue placeholder="Sucursal…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las sucursales</SelectItem>
              {sucursales.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  {s.nombre.replace("Luna27 ", "")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Fecha */}
          <input
            type="date"
            value={fecha}
            onChange={e => setFecha(e.target.value)}
            className="w-full h-8 text-xs rounded-md border bg-background px-2 text-foreground"
          />
        </div>

        {/* Botones de acción */}
        <div className="p-3 space-y-2 border-b">
          <button
            onClick={() => setGastoDialogOpen(true)}
            className="w-full flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg px-3 py-2.5 transition-colors"
          >
            <Plus className="h-3.5 w-3.5 flex-shrink-0" />
            Nuevo gasto
          </button>
          <button
            onClick={() => { setCitaSeleccionada(null); setCajaOpen(true) }}
            className="w-full flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg px-3 py-2.5 transition-colors"
          >
            <ShoppingBag className="h-3.5 w-3.5 flex-shrink-0" />
            Cobro espontáneo
          </button>
          <button className="w-full flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg px-3 py-2.5 transition-colors">
            <Gift className="h-3.5 w-3.5 flex-shrink-0" />
            Transferir saldo GC
          </button>
          <button
            onClick={cargarDatos}
            className="w-full flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground border rounded-lg px-3 py-2 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5 flex-shrink-0" />
            Actualizar
          </button>
        </div>

        {/* Resumen financiero del día */}
        <div className="p-3 flex-1 space-y-1">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wide mb-2">
            Resumen del día
          </p>

          <StatRow label="Servicios — Tarjeta" value={fmtMXN(totalTarjeta)} />
          <StatRow label="Servicios — Efectivo" value={fmtMXN(totalEfectivo)} />
          <StatRow label="Transferencias" value={fmtMXN(totalTransf)} />
          <StatRow label="Propinas" value={fmtMXN(resumen?.totalPropinas ?? 0)} />
          <StatRow label="Descuentos" value={fmtMXN(resumen?.totalDescuentos ?? 0)} />

          <Separator className="my-2" />

          <StatRow label="Gastos del día" value={fmtMXN(totalGastos)} />

          <Separator className="my-2" />

          <StatRow label="Total Efectivo"    value={fmtMXN(totalEfectivo)} highlight />
          <StatRow label="Total Tarjeta"     value={fmtMXN(totalTarjeta)} highlight />
          <StatRow label="Total"             value={fmtMXN(totalGeneral)} highlight />
        </div>

        {/* Contador de pendientes */}
        <div className="p-3 border-t bg-white">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Por cobrar hoy</span>
            <Badge variant="secondary" className="text-orange-700 bg-orange-50 border-orange-200">
              {citasPendientes.length} citas
            </Badge>
          </div>
          <p className="text-sm font-bold text-orange-600 mt-0.5">
            {fmtMXN(citasPendientes.reduce((s, c) => s + c.precio, 0))}
          </p>
        </div>
      </aside>

      {/* ════════════════════════ ÁREA PRINCIPAL ═══════════════════════════════ */}
      <main className="flex-1 flex flex-col overflow-hidden bg-background">
        <Tabs defaultValue="pendientes" className="flex flex-col h-full">
          {/* Barra de tabs */}
          <div className="px-4 pt-4 border-b bg-background flex-shrink-0">
            <TabsList className="h-9">
              <TabsTrigger value="pendientes" className="text-xs">
                Servicios por cobrar
                {citasPendientes.length > 0 && (
                  <span className="ml-1.5 bg-orange-500 text-white text-[10px] rounded-full px-1.5 py-0.5 leading-none">
                    {citasPendientes.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="cobros" className="text-xs">Cobros</TabsTrigger>
              <TabsTrigger value="giftcards" className="text-xs">Giftcards cobradas</TabsTrigger>
              <TabsTrigger value="gastos" className="text-xs">
                Gastos del día
                {gastos.length > 0 && (
                  <span className="ml-1.5 bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5 leading-none">
                    {gastos.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ─── TAB: Servicios por cobrar ─────────────────────────────────── */}
          <TabsContent value="pendientes" className="flex-1 overflow-hidden m-0 flex flex-col">

            {/* Barra de búsqueda + selección masiva */}
            <div className="px-4 pt-4 pb-3 border-b bg-background flex-shrink-0 space-y-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar cliente, empleada o servicio…"
                    value={busquedaCitas}
                    onChange={e => { setBusquedaCitas(e.target.value); setCitasSeleccionadas(new Set()) }}
                    className="pl-9 h-8 text-xs"
                  />
                </div>
                {citasPendientesFiltradas.length > 0 && (
                  <button
                    onClick={toggleTodas}
                    className="text-xs text-primary underline underline-offset-2 whitespace-nowrap"
                  >
                    {citasPendientesFiltradas.every(c => citasSeleccionadas.has(c.id))
                      ? "Deseleccionar todas"
                      : "Seleccionar todas"}
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {new Date(fecha + "T12:00:00").toLocaleDateString("es-MX", {
                    weekday: "long", day: "numeric", month: "long",
                  })}
                  {" · "}
                  <span className="font-medium text-foreground">
                    {citasPendientesFiltradas.length} por cobrar
                  </span>
                </span>
                {sucursalId === "todas" && (
                  <span className="text-amber-600 font-medium">Selecciona una sucursal para ver citas</span>
                )}
              </div>
            </div>

            {/* Lista de citas */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : sucursalId === "todas" ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <Receipt className="h-10 w-10 mb-3 opacity-20" />
                  <p className="text-sm font-medium">Selecciona una sucursal</p>
                  <p className="text-xs mt-1">Elige la sucursal en el panel izquierdo para ver las citas del día</p>
                </div>
              ) : citasPendientesFiltradas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <Receipt className="h-10 w-10 mb-3 opacity-20" />
                  <p className="text-sm">Sin servicios pendientes por cobrar</p>
                  <p className="text-xs mt-1">Cambia la fecha o el filtro de búsqueda</p>
                </div>
              ) : (
                <div className="divide-y">
                  {citasPendientesFiltradas.map((cita) => {
                    const seleccionada = citasSeleccionadas.has(cita.id)
                    return (
                      <div
                        key={cita.id}
                        onClick={() => toggleCita(cita.id)}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors select-none",
                          seleccionada
                            ? "bg-emerald-50 hover:bg-emerald-100 border-l-4 border-l-emerald-500"
                            : "hover:bg-muted/40 border-l-4 border-l-transparent",
                        )}
                      >
                        {/* Checkbox */}
                        <div className={cn(
                          "h-5 w-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors",
                          seleccionada
                            ? "bg-emerald-600 border-emerald-600"
                            : "border-gray-300 bg-white",
                        )}>
                          {seleccionada && (
                            <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>

                        {/* Info principal */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-semibold truncate">{cita.clienteNombre}</p>
                            <span className={cn(
                              "text-[10px] border rounded-full px-2 py-0.5 font-medium flex-shrink-0",
                              estadoColor(cita.estado),
                            )}>
                              {cita.estado.replace("-", " ")}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{cita.servicioNombre}</p>
                        </div>

                        {/* Empleada */}
                        <div className="hidden sm:block text-center flex-shrink-0 w-28">
                          <p className="text-xs text-muted-foreground truncate">{cita.empleadoNombre}</p>
                          <p className="text-xs tabular-nums text-muted-foreground/70">
                            {cita.horaInicio} – {cita.horaFin}
                          </p>
                        </div>

                        {/* Precio */}
                        <div className="flex-shrink-0 text-right">
                          <p className="text-sm font-bold tabular-nums">{fmtMXN(cita.precio)}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Barra flotante de cobro cuando hay selección */}
            {citasSeleccionadas.size > 0 && (
              <div className="flex-shrink-0 border-t bg-emerald-700 text-white px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">
                    {citasSeleccionadas.size} servicio{citasSeleccionadas.size > 1 ? "s" : ""} seleccionado{citasSeleccionadas.size > 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-emerald-200">Total: {fmtMXN(totalSeleccionado)}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCitasSeleccionadas(new Set())}
                    className="text-xs text-emerald-200 hover:text-white underline"
                  >
                    Limpiar
                  </button>
                  <Button
                    size="sm"
                    className="h-8 bg-white text-emerald-700 hover:bg-emerald-50 font-semibold text-xs"
                    onClick={abrirCajaConSeleccion}
                  >
                    <Wallet className="h-3.5 w-3.5 mr-1.5" />
                    Cobrar {citasSeleccionadas.size > 1 ? `(${citasSeleccionadas.size})` : ""}
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ─── TAB: Cobros ───────────────────────────────────────────────── */}
          <TabsContent value="cobros" className="flex-1 overflow-auto m-0 p-4">
            {/* Buscador */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente o empleada…"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <div className="rounded-lg border overflow-hidden">
              <div className="px-4 py-3 bg-muted/40 border-b flex items-center justify-between">
                <p className="text-sm font-semibold">Cobros del día</p>
                <span className="text-xs text-muted-foreground">{pagosFiltrados.length} registros</span>
              </div>
              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : pagosFiltrados.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <CreditCard className="h-10 w-10 mb-3 opacity-30" />
                  <p className="text-sm">Sin cobros registrados para este filtro</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/20">
                      <TableHead className="text-xs">Hora</TableHead>
                      <TableHead className="text-xs">Cliente</TableHead>
                      <TableHead className="text-xs">Empleada</TableHead>
                      <TableHead className="text-xs">Servicios</TableHead>
                      <TableHead className="text-xs">Método</TableHead>
                      <TableHead className="text-xs">Propina</TableHead>
                      <TableHead className="text-xs text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagosFiltrados.map(pago => (
                      <TableRow key={pago.id} className="hover:bg-muted/30">
                        <TableCell className="text-xs text-muted-foreground tabular-nums">{pago.hora}</TableCell>
                        <TableCell className="text-sm font-medium">{pago.clienteNombre}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{pago.empleadoNombre}</TableCell>
                        <TableCell className="text-xs max-w-[180px] truncate">{pago.servicios.join(", ")}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1 text-xs border rounded px-1.5 py-0.5 capitalize">
                            {pago.metodoPago === "efectivo"      && <Banknote className="h-3 w-3 text-emerald-500" />}
                            {pago.metodoPago === "tarjeta"       && <CreditCard className="h-3 w-3 text-blue-500" />}
                            {pago.metodoPago === "transferencia" && <ArrowLeftRight className="h-3 w-3 text-indigo-500" />}
                            {pago.metodoPago}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-amber-600 font-medium">
                          {pago.propina ? `+${fmtMXN(pago.propina)}` : "—"}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-sm">{fmtMXN(pago.monto)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>

          {/* ─── TAB: Giftcards ────────────────────────────────────────────── */}
          <TabsContent value="giftcards" className="flex-1 overflow-auto m-0 p-4">
            <div className="rounded-lg border overflow-hidden">
              <div className="px-4 py-3 bg-muted/40 border-b">
                <p className="text-sm font-semibold">Giftcards cobradas hoy</p>
              </div>
              {(() => {
                const gcPagos = pagos.filter(p =>
                  p.metodoPago === "otro" || (p.referencia ?? "").toLowerCase().includes("giftcard"),
                )
                return gcPagos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                    <Gift className="h-10 w-10 mb-3 opacity-30" />
                    <p className="text-sm">Sin pagos con gift card hoy</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/20">
                        <TableHead className="text-xs">Hora</TableHead>
                        <TableHead className="text-xs">Cliente</TableHead>
                        <TableHead className="text-xs">Servicios</TableHead>
                        <TableHead className="text-xs">Referencia</TableHead>
                        <TableHead className="text-xs text-right">Monto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gcPagos.map(p => (
                        <TableRow key={p.id} className="hover:bg-muted/30">
                          <TableCell className="text-xs tabular-nums">{p.hora}</TableCell>
                          <TableCell className="text-sm font-medium">{p.clienteNombre}</TableCell>
                          <TableCell className="text-xs max-w-[180px] truncate">{p.servicios.join(", ")}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{p.referencia ?? "—"}</TableCell>
                          <TableCell className="text-right font-semibold text-sm">{fmtMXN(p.monto)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )
              })()}
            </div>
          </TabsContent>

          {/* ─── TAB: Gastos ───────────────────────────────────────────────── */}
          <TabsContent value="gastos" className="flex-1 overflow-auto m-0 p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold">Gastos del día</p>
                <p className="text-xs text-muted-foreground">Total: {fmtMXN(totalGastos)}</p>
              </div>
              <Button size="sm" onClick={() => setGastoDialogOpen(true)} className="h-8 text-xs">
                <Plus className="h-3.5 w-3.5 mr-1" />
                Nuevo gasto
              </Button>
            </div>
            <div className="rounded-lg border overflow-hidden">
              {gastos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <Banknote className="h-10 w-10 mb-3 opacity-30" />
                  <p className="text-sm">Sin gastos registrados hoy</p>
                  <p className="text-xs mt-1">Usa "Nuevo gasto" para registrar un egreso</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/20">
                      <TableHead className="text-xs">Hora</TableHead>
                      <TableHead className="text-xs">Descripción</TableHead>
                      <TableHead className="text-xs">Categoría</TableHead>
                      <TableHead className="text-xs text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gastos.map(g => (
                      <TableRow key={g.id} className="hover:bg-muted/30">
                        <TableCell className="text-xs tabular-nums text-muted-foreground">{g.hora}</TableCell>
                        <TableCell className="text-sm">{g.descripcion}</TableCell>
                        <TableCell>
                          <span className="text-xs border rounded px-1.5 py-0.5 capitalize text-muted-foreground">
                            {g.categoria}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-red-600">{fmtMXN(g.monto)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* ════ DIALOG: Nuevo gasto ═════════════════════════════════════════════ */}
      <Dialog open={gastoDialogOpen} onOpenChange={setGastoDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar gasto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs">Descripción</Label>
              <Input
                placeholder="Ej: Materiales, limpieza…"
                value={nuevoGasto.descripcion}
                onChange={e => setNuevoGasto(p => ({ ...p, descripcion: e.target.value }))}
                className="h-9 text-sm mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Monto (MXN)</Label>
              <Input
                type="number"
                min="0"
                step="any"
                placeholder="0.00"
                value={nuevoGasto.monto}
                onChange={e => setNuevoGasto(p => ({ ...p, monto: e.target.value }))}
                className="h-9 text-sm mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Categoría</Label>
              <Select value={nuevoGasto.categoria} onValueChange={v => setNuevoGasto(p => ({ ...p, categoria: v }))}>
                <SelectTrigger className="h-9 text-sm mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operativo">Operativo</SelectItem>
                  <SelectItem value="insumos">Insumos</SelectItem>
                  <SelectItem value="nomina">Nómina</SelectItem>
                  <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1 h-9 text-sm" onClick={() => setGastoDialogOpen(false)}>
                Cancelar
              </Button>
              <Button className="flex-1 h-9 text-sm bg-blue-600 hover:bg-blue-700" onClick={agregarGasto}>
                Guardar gasto
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ════ CAJA DIALOG ════════════════════════════════════════════════════ */}
      <CajaDialog
        open={cajaOpen}
        onOpenChange={(v) => {
          setCajaOpen(v)
          if (!v) setCitasSeleccionadas(new Set())
        }}
        sucursalIdInicial={sucursalId !== "todas" ? sucursalId : ""}
        clienteNombre={citasACobrar[0]?.clienteNombre ?? ""}
        clienteId={citasACobrar[0]?.clienteId ?? ""}
        citasIniciales={citasACobrar.map(c => ({
          id: c.id,
          clienteId: c.clienteId,
          clienteNombre: c.clienteNombre,
          servicioNombre: c.servicioNombre,
          precio: c.precio,
          empleadoId: c.empleadoId,
        }))}
        onPagoCompletado={() => {
          cargarDatos()
          setCajaOpen(false)
          setCitasSeleccionadas(new Set())
        }}
      />
    </div>
  )
}
