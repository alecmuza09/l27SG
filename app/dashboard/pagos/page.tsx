"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  CreditCard, DollarSign, TrendingUp, Clock, Search, Filter,
  Download, ShoppingCart, Loader2, Banknote, ArrowLeftRight,
  TrendingDown, Percent, Star, BarChart3, RefreshCw,
} from "lucide-react"
import {
  getPagosFromDB, getPagosPendientesFromDB, getResumenCajaDiarioFromDB,
  getResumenCajaAyerFromDB, type Pago, type ResumenCajaDiario,
} from "@/lib/data/pagos"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CajaDialog } from "@/components/punto-venta/caja-dialog"
import { cn } from "@/lib/utils"

const fmtMXN = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n)

const pct = (a: number, b: number) =>
  b === 0 ? 0 : Math.round(((a - b) / b) * 100)

function Delta({ actual, anterior }: { actual: number; anterior: number }) {
  const diff = pct(actual, anterior)
  if (diff === 0) return null
  return (
    <span className={cn("text-[10px] font-medium ml-1", diff > 0 ? "text-emerald-600" : "text-red-500")}>
      {diff > 0 ? "▲" : "▼"} {Math.abs(diff)}% vs ayer
    </span>
  )
}

// ─── Barra de método ──────────────────────────────────────────────────────
function BarraMetodo({ label, monto, total, color }: { label: string; monto: number; total: number; color: string }) {
  const pctVal = total > 0 ? (monto / total) * 100 : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{fmtMXN(monto)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pctVal}%` }} />
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════

export default function PagosPage() {
  const [pagos, setPagos]                 = useState<Pago[]>([])
  const [pagosPendientes, setPagosPendientes] = useState<Pago[]>([])
  const [resumenHoy, setResumenHoy]       = useState<ResumenCajaDiario | null>(null)
  const [resumenAyer, setResumenAyer]     = useState<{ totalVentas: number; cantidadTransacciones: number; ticketPromedio: number } | null>(null)
  const [searchQuery, setSearchQuery]     = useState("")
  const [cajaDialogOpen, setCajaDialogOpen] = useState(false)
  const [isLoading, setIsLoading]         = useState(true)
  const [isRefreshingResumen, setIsRefreshingResumen] = useState(false)

  const loadAll = async () => {
    const [pagosData, pendientesData, resHoy, resAyer] = await Promise.all([
      getPagosFromDB(),
      getPagosPendientesFromDB(),
      getResumenCajaDiarioFromDB(),
      getResumenCajaAyerFromDB(),
    ])
    setPagos(pagosData)
    setPagosPendientes(pendientesData)
    setResumenHoy(resHoy)
    setResumenAyer(resAyer)
  }

  useEffect(() => {
    setIsLoading(true)
    loadAll().catch(err => console.error(err)).finally(() => setIsLoading(false))
  }, [])

  const handleRefreshResumen = async () => {
    setIsRefreshingResumen(true)
    await loadAll().catch(() => {})
    setIsRefreshingResumen(false)
  }

  const handlePagoCompletado = (total: number) => {
    console.log("Pago completado. Total:", total)
    loadAll().catch(() => {})
  }

  const filteredPagos = searchQuery
    ? pagos.filter(p =>
        p.clienteNombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.referencia?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : pagos

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Cargando pagos…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Encabezado ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Pagos</h1>
          <p className="text-muted-foreground">Gestión de cobros y transacciones</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <Button onClick={() => setCajaDialogOpen(true)}>
            <ShoppingCart className="mr-2 h-4 w-4" />
            Nueva Venta
          </Button>
        </div>
      </div>

      {/* ── Dashboard de Cierre de Caja Diario ─────────────────────────── */}
      <Card className="border-2 border-violet-100 bg-gradient-to-br from-violet-50/60 to-indigo-50/40">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-violet-100">
                <BarChart3 className="h-4 w-4 text-violet-700" />
              </div>
              <div>
                <CardTitle className="text-base text-violet-900">Resumen del Día</CardTitle>
                <CardDescription className="text-xs">
                  {new Date().toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                </CardDescription>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleRefreshResumen} disabled={isRefreshingResumen}>
              <RefreshCw className={cn("h-3.5 w-3.5", isRefreshingResumen && "animate-spin")} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {/* Ingresos del día */}
            <div className="md:col-span-1 bg-background rounded-xl p-3 border shadow-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <DollarSign className="h-3.5 w-3.5" />
                <span className="text-xs">Ingresos hoy</span>
              </div>
              <p className="text-xl font-bold text-emerald-700">{fmtMXN(resumenHoy?.totalVentas ?? 0)}</p>
              {resumenAyer && <Delta actual={resumenHoy?.totalVentas ?? 0} anterior={resumenAyer.totalVentas} />}
            </div>

            {/* Transacciones */}
            <div className="bg-background rounded-xl p-3 border shadow-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <CreditCard className="h-3.5 w-3.5" />
                <span className="text-xs">Transacciones</span>
              </div>
              <p className="text-xl font-bold">{resumenHoy?.cantidadTransacciones ?? 0}</p>
              {resumenAyer && <Delta actual={resumenHoy?.cantidadTransacciones ?? 0} anterior={resumenAyer.cantidadTransacciones} />}
            </div>

            {/* Ticket promedio */}
            <div className="bg-background rounded-xl p-3 border shadow-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <TrendingUp className="h-3.5 w-3.5" />
                <span className="text-xs">Ticket promedio</span>
              </div>
              <p className="text-xl font-bold text-blue-700">{fmtMXN(resumenHoy?.ticketPromedio ?? 0)}</p>
              {resumenAyer && <Delta actual={resumenHoy?.ticketPromedio ?? 0} anterior={resumenAyer.ticketPromedio} />}
            </div>

            {/* Propinas */}
            <div className="bg-background rounded-xl p-3 border shadow-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Star className="h-3.5 w-3.5" />
                <span className="text-xs">Propinas</span>
              </div>
              <p className="text-xl font-bold text-amber-600">{fmtMXN(resumenHoy?.totalPropinas ?? 0)}</p>
            </div>

            {/* Descuentos */}
            <div className="bg-background rounded-xl p-3 border shadow-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Percent className="h-3.5 w-3.5" />
                <span className="text-xs">Descuentos</span>
              </div>
              <p className="text-xl font-bold text-violet-600">{fmtMXN(resumenHoy?.totalDescuentos ?? 0)}</p>
            </div>
          </div>

          {/* Barras por método */}
          {(resumenHoy?.totalVentas ?? 0) > 0 && (
            <div className="mt-4 bg-background rounded-xl p-3 border">
              <p className="text-xs font-semibold mb-3 text-muted-foreground uppercase">Desglose por método de pago</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <BarraMetodo label="Efectivo" monto={resumenHoy?.porMetodo.efectivo ?? 0} total={resumenHoy?.totalVentas ?? 0} color="bg-emerald-400" />
                <BarraMetodo label="Tarjeta" monto={resumenHoy?.porMetodo.tarjeta ?? 0} total={resumenHoy?.totalVentas ?? 0} color="bg-blue-400" />
                <BarraMetodo label="Transferencia" monto={resumenHoy?.porMetodo.transferencia ?? 0} total={resumenHoy?.totalVentas ?? 0} color="bg-indigo-400" />
                <BarraMetodo label="Otro/Mixto" monto={resumenHoy?.porMetodo.otro ?? 0} total={resumenHoy?.totalVentas ?? 0} color="bg-violet-400" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Tarjetas KPI secundarias ──────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Banknote className="h-4 w-4 text-emerald-500" />
              Efectivo hoy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">{fmtMXN(resumenHoy?.porMetodo.efectivo ?? 0)}</div>
            <p className="text-xs text-muted-foreground">{resumenHoy?.porMetodoCantidad.efectivo ?? 0} transacciones</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-blue-500" />
              Tarjeta hoy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">{fmtMXN(resumenHoy?.porMetodo.tarjeta ?? 0)}</div>
            <p className="text-xs text-muted-foreground">{resumenHoy?.porMetodoCantidad.tarjeta ?? 0} transacciones</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4 text-indigo-500" />
              Transferencia hoy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-700">{fmtMXN(resumenHoy?.porMetodo.transferencia ?? 0)}</div>
            <p className="text-xs text-muted-foreground">{resumenHoy?.porMetodoCantidad.transferencia ?? 0} transacciones</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" />
              Pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{pagosPendientes.length}</div>
            <p className="text-xs text-muted-foreground">
              {fmtMXN(pagosPendientes.reduce((s, p) => s + p.monto, 0))} por cobrar
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Últimas transacciones + tabla completa ────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Últimas Transacciones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pagos.slice(0, 5).map(pago => (
                <div key={pago.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{pago.clienteNombre}</p>
                    <p className="text-xs text-muted-foreground truncate">{pago.servicios.join(", ")} · {pago.hora}</p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className="font-semibold">{fmtMXN(pago.monto)}</p>
                    <Badge variant={pago.estado === "completado" ? "default" : "secondary"} className="text-[10px]">
                      {pago.estado}
                    </Badge>
                  </div>
                </div>
              ))}
              {pagos.length === 0 && <p className="text-center text-xs text-muted-foreground py-4">Sin transacciones</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Métodos de Pago — Histórico</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(() => {
              const completados = pagos.filter(p => p.estado === "completado")
              const total = completados.reduce((s, p) => s + p.monto, 0)
              const porMetodo = [
                { label: "Efectivo",      icono: <Banknote className="h-4 w-4 text-emerald-500" />, monto: completados.filter(p => p.metodoPago === "efectivo").reduce((s, p) => s + p.monto, 0),      color: "bg-emerald-400" },
                { label: "Tarjeta",       icono: <CreditCard className="h-4 w-4 text-blue-500" />,  monto: completados.filter(p => p.metodoPago === "tarjeta").reduce((s, p) => s + p.monto, 0),       color: "bg-blue-400" },
                { label: "Transferencia", icono: <ArrowLeftRight className="h-4 w-4 text-indigo-500" />, monto: completados.filter(p => p.metodoPago === "transferencia").reduce((s, p) => s + p.monto, 0), color: "bg-indigo-400" },
              ]
              return porMetodo.map(m => (
                <div key={m.label} className="flex items-center gap-3">
                  {m.icono}
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span>{m.label}</span>
                      <span className="font-semibold">{fmtMXN(m.monto)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className={cn("h-full rounded-full", m.color)} style={{ width: `${total > 0 ? (m.monto / total) * 100 : 0}%` }} />
                    </div>
                  </div>
                </div>
              ))
            })()}
          </CardContent>
        </Card>
      </div>

      {/* ── Tabla con tabs ────────────────────────────────────────────────── */}
      <Tabs defaultValue="todos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="completados">Completados</TabsTrigger>
          <TabsTrigger value="pendientes">Pendientes</TabsTrigger>
        </TabsList>

        <TabsContent value="todos">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Historial de Pagos</CardTitle>
                  <CardDescription>Todas las transacciones</CardDescription>
                </div>
                <Button variant="outline" size="icon">
                  <Filter className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar por cliente o referencia…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
                </div>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha/Hora</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Servicios</TableHead>
                      <TableHead>Empleado</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Propina</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPagos.map(pago => (
                      <TableRow key={pago.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{new Date(pago.fecha).toLocaleDateString("es-MX")}</p>
                            <p className="text-xs text-muted-foreground">{pago.hora}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{pago.clienteNombre}</p>
                            {pago.referencia && <p className="text-xs text-muted-foreground">Ref: {pago.referencia}</p>}
                          </div>
                        </TableCell>
                        <TableCell><p className="text-sm truncate max-w-xs">{pago.servicios.join(", ")}</p></TableCell>
                        <TableCell><span className="text-sm">{pago.empleadoNombre}</span></TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{pago.metodoPago}</Badge>
                        </TableCell>
                        <TableCell>
                          {pago.propina ? (
                            <span className="text-xs font-medium text-amber-600">+{fmtMXN(pago.propina)}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell><span className="font-semibold">{fmtMXN(pago.monto)}</span></TableCell>
                        <TableCell>
                          <Badge variant={pago.estado === "completado" ? "default" : pago.estado === "pendiente" ? "secondary" : "outline"}>
                            {pago.estado}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredPagos.length === 0 && (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Sin resultados</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completados">
          <Card>
            <CardHeader>
              <CardTitle>Pagos Completados</CardTitle>
              <CardDescription>Transacciones finalizadas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Propina</TableHead>
                      <TableHead>Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagos.filter(p => p.estado === "completado").map(pago => (
                      <TableRow key={pago.id}>
                        <TableCell>{new Date(pago.fecha).toLocaleDateString("es-MX")}</TableCell>
                        <TableCell>{pago.clienteNombre}</TableCell>
                        <TableCell className="capitalize">{pago.metodoPago}</TableCell>
                        <TableCell>
                          {pago.propina ? <span className="text-amber-600 font-medium">+{fmtMXN(pago.propina)}</span> : "—"}
                        </TableCell>
                        <TableCell className="font-semibold">{fmtMXN(pago.monto)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pendientes">
          <Card>
            <CardHeader>
              <CardTitle>Pagos Pendientes</CardTitle>
              <CardDescription>Transacciones por cobrar</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pagosPendientes.map(pago => (
                  <div key={pago.id} className="flex items-center justify-between p-4 rounded-lg border bg-orange-50">
                    <div className="flex-1">
                      <p className="font-medium">{pago.clienteNombre}</p>
                      <p className="text-sm text-muted-foreground">{pago.servicios.join(", ")}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(pago.fecha).toLocaleDateString("es-MX")} · {pago.hora}
                      </p>
                    </div>
                    <div className="text-right space-y-2">
                      <p className="text-lg font-bold">{fmtMXN(pago.monto)}</p>
                      <Button size="sm" onClick={() => setCajaDialogOpen(true)}>Cobrar</Button>
                    </div>
                  </div>
                ))}
                {pagosPendientes.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No hay pagos pendientes</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CajaDialog
        open={cajaDialogOpen}
        onOpenChange={setCajaDialogOpen}
        clienteNombre=""
        clienteId=""
        onPagoCompletado={handlePagoCompletado}
      />
    </div>
  )
}
