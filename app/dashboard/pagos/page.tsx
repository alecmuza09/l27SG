"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { CreditCard, DollarSign, TrendingUp, Clock, Search, Filter, Download, ShoppingCart, Loader2 } from "lucide-react"
import { getPagosFromDB, getPagosPendientesFromDB, type Pago } from "@/lib/data/pagos"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CajaDialog } from "@/components/punto-venta/caja-dialog"

export default function PagosPage() {
  const [pagos, setPagos] = useState<Pago[]>([])
  const [pagosPendientes, setPagosPendientes] = useState<Pago[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [cajaDialogOpen, setCajaDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadPagos() {
      try {
        setIsLoading(true)
        const hoy = new Date().toISOString().split('T')[0]
        const [pagosData, pendientesData] = await Promise.all([
          getPagosFromDB(),
          getPagosPendientesFromDB()
        ])
        setPagos(pagosData)
        setPagosPendientes(pendientesData)
      } catch (err) {
        console.error('Error cargando pagos:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadPagos()
  }, [])

  const filteredPagos = searchQuery
    ? pagos.filter(
        (p) =>
          p.clienteNombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.referencia?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : pagos

  const hoy = new Date().toISOString().split('T')[0]
  const pagosHoyCompletados = pagos.filter((p) => p.fecha === hoy && p.estado === "completado")

  const stats = {
    totalHoy: pagosHoyCompletados.length,
    montoHoy: pagosHoyCompletados.reduce((acc, p) => acc + p.monto, 0),
    pendientes: pagosPendientes.length,
    montoPendiente: pagosPendientes.reduce((acc, p) => acc + p.monto, 0),
  }

  const pagosCompletados = pagos.filter((p) => p.estado === "completado")
  const pagosPorMetodo = {
    efectivo: pagosCompletados.filter((p) => p.metodoPago === "efectivo").length,
    tarjeta: pagosCompletados.filter((p) => p.metodoPago === "tarjeta").length,
    transferencia: pagosCompletados.filter((p) => p.metodoPago === "transferencia").length,
  }

  const handlePagoCompletado = (total: number, ajustes: any[]) => {
    console.log("Pago completado:", { total, ajustes })
    // Recargar pagos después de completar uno
    async function reloadPagos() {
      const [pagosData, pendientesData] = await Promise.all([
        getPagosFromDB(),
        getPagosPendientesFromDB()
      ])
      setPagos(pagosData)
      setPagosPendientes(pendientesData)
    }
    reloadPagos()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Cargando pagos...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
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

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Pagos Hoy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalHoy}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Ingresos Hoy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.montoHoy.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.pendientes}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Monto Pendiente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">${stats.montoPendiente.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Métodos de Pago</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Efectivo</span>
              <span className="font-semibold">{pagosPorMetodo.efectivo}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Tarjeta</span>
              <span className="font-semibold">{pagosPorMetodo.tarjeta}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Transferencia</span>
              <span className="font-semibold">{pagosPorMetodo.transferencia}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Últimas Transacciones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pagos.slice(0, 4).map((pago) => (
                <div key={pago.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex-1">
                    <p className="font-medium">{pago.clienteNombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {pago.servicios.join(", ")} • {pago.hora}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">${pago.monto}</p>
                    <Badge variant={pago.estado === "completado" ? "default" : "secondary"} className="text-xs">
                      {pago.estado}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

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
                  <Input
                    placeholder="Buscar por cliente o referencia..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
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
                      <TableHead>Monto</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPagos.map((pago) => (
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
                        <TableCell>
                          <div className="max-w-xs">
                            <p className="text-sm truncate">{pago.servicios.join(", ")}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{pago.empleadoNombre}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {pago.metodoPago}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold">${pago.monto.toLocaleString()}</span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              pago.estado === "completado"
                                ? "default"
                                : pago.estado === "pendiente"
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {pago.estado}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
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
                      <TableHead>Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagos
                      .filter((p) => p.estado === "completado")
                      .map((pago) => (
                        <TableRow key={pago.id}>
                          <TableCell>{new Date(pago.fecha).toLocaleDateString("es-MX")}</TableCell>
                          <TableCell>{pago.clienteNombre}</TableCell>
                          <TableCell className="capitalize">{pago.metodoPago}</TableCell>
                          <TableCell className="font-semibold">${pago.monto.toLocaleString()}</TableCell>
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
                {pagosPendientes.map((pago) => (
                  <div key={pago.id} className="flex items-center justify-between p-4 rounded-lg border bg-orange-50">
                    <div className="flex-1">
                      <p className="font-medium">{pago.clienteNombre}</p>
                      <p className="text-sm text-muted-foreground">{pago.servicios.join(", ")}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(pago.fecha).toLocaleDateString("es-MX")} • {pago.hora}
                      </p>
                    </div>
                    <div className="text-right space-y-2">
                      <p className="text-lg font-bold">${pago.monto.toLocaleString()}</p>
                      <Button size="sm" onClick={() => setCajaDialogOpen(true)}>
                        Cobrar
                      </Button>
                    </div>
                  </div>
                ))}
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
