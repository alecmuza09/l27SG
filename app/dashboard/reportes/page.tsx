"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, TrendingUp, Users, Calendar, Loader2 } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getPagosFromDB } from "@/lib/data/pagos"
import { getDashboardStats, getServiciosPopulares, getTopEmpleadosFromDB } from "@/lib/data/dashboard"
import { getClientesStats } from "@/lib/data/clientes"

export default function ReportesPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [ventasPorDia, setVentasPorDia] = useState<Array<{ dia: string; ventas: number }>>([])
  const [serviciosMasVendidos, setServiciosMasVendidos] = useState<Array<{ name: string; count: number; revenue: number }>>([])
  const [empleadosTop, setEmpleadosTop] = useState<Array<{ nombre: string; apellido: string; citas: number; ingresos: number }>>([])
  const [stats, setStats] = useState({ ingresosTotales: 0, totalServicios: 0, nuevosClientes: 0, ticketPromedio: 0 })
  const [clientesStats, setClientesStats] = useState({ total: 0, activos: 0, vip: 0, nuevos: 0 })

  useEffect(() => {
    async function loadReportes() {
      try {
        setIsLoading(true)
        
        // Calcular ventas por día de la última semana
        const pagos = await getPagosFromDB()
        const hoy = new Date()
        const ventasPorDiaArray = []
        
        for (let i = 6; i >= 0; i--) {
          const fecha = new Date(hoy)
          fecha.setDate(fecha.getDate() - i)
          const fechaStr = fecha.toISOString().split('T')[0]
          const diaNombre = fecha.toLocaleDateString('es-MX', { weekday: 'short' })
          
          const ventasDia = pagos
            .filter(p => p.fecha === fechaStr && p.estado === 'completado')
            .reduce((sum, p) => sum + p.monto, 0)
          
          ventasPorDiaArray.push({ dia: diaNombre, ventas: ventasDia })
        }
        
        setVentasPorDia(ventasPorDiaArray)
        
        // Obtener servicios populares y empleados top
        const [servicios, empleados] = await Promise.all([
          getServiciosPopulares(5),
          getTopEmpleadosFromDB(4)
        ])
        
        setServiciosMasVendidos(servicios.map(s => ({
          name: s.name,
          cantidad: s.count,
          ingresos: s.revenue
        })))
        
        setEmpleadosTop(empleados.map(e => ({
          nombre: e.nombre,
          apellido: e.apellido,
          servicios: e.citas,
          ingresos: e.ingresos,
          comision: Math.round(e.ingresos * 0.4) // Estimación de comisión 40%
        })))
        
        // Obtener estadísticas generales
        const dashboardStats = await getDashboardStats()
        const clientesData = await getClientesStats()
        
        const ingresosTotales = pagos
          .filter(p => p.estado === 'completado')
          .reduce((sum, p) => sum + p.monto, 0)
        
        const totalServicios = pagos.filter(p => p.estado === 'completado').length
        const ticketPromedio = totalServicios > 0 ? ingresosTotales / totalServicios : 0
        
        setStats({
          ingresosTotales,
          totalServicios,
          nuevosClientes: clientesData.nuevos,
          ticketPromedio: Math.round(ticketPromedio)
        })
        
        setClientesStats(clientesData)
      } catch (err) {
        console.error('Error cargando reportes:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadReportes()
  }, [])

  const maxVentas = ventasPorDia.length > 0 ? Math.max(...ventasPorDia.map((d) => d.ventas)) : 1

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Cargando reportes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Reportes</h1>
          <p className="text-muted-foreground">Análisis y estadísticas del negocio</p>
        </div>
        <div className="flex gap-2">
          <Select defaultValue="mes">
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semana">Esta Semana</SelectItem>
              <SelectItem value="mes">Este Mes</SelectItem>
              <SelectItem value="trimestre">Trimestre</SelectItem>
              <SelectItem value="año">Este Año</SelectItem>
            </SelectContent>
          </Select>
          <Button>
            <Download className="mr-2 h-4 w-4" />
            Exportar PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ingresos Totales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.ingresosTotales.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Ingresos totales
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Servicios</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalServicios}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Servicios completados
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Nuevos Clientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.nuevosClientes}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Últimos 30 días
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ticket Promedio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.ticketPromedio.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Promedio por servicio
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="ventas" className="space-y-4">
        <TabsList>
          <TabsTrigger value="ventas">Ventas</TabsTrigger>
          <TabsTrigger value="servicios">Servicios</TabsTrigger>
          <TabsTrigger value="empleados">Empleados</TabsTrigger>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
        </TabsList>

        <TabsContent value="ventas" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ventas por Día</CardTitle>
              <CardDescription>Ingresos diarios de la última semana</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {ventasPorDia.map((dia) => (
                  <div key={dia.dia} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{dia.dia}</span>
                      <span className="font-semibold">${dia.ventas.toLocaleString()}</span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${(dia.ventas / maxVentas) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Métodos de Pago</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <p>Los métodos de pago se calcularán desde los datos de pagos</p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ventas por Sucursal</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <p>Las ventas por sucursal se calcularán desde los datos de pagos</p>
                </div>
              </CardContent>
            </Card>
            
            {/* Métodos de pago - placeholder */}
            <Card className="md:col-span-2" style={{ display: 'none' }}>
              <CardHeader>
                <CardTitle className="text-base">Métodos de Pago</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { metodo: "Tarjeta", porcentaje: 0, monto: 0 },
                    { metodo: "Efectivo", porcentaje: 0, monto: 0 },
                    { metodo: "Transferencia", porcentaje: 0, monto: 0 },
                  ].map((item) => (
                    <div key={item.metodo} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{item.metodo}</span>
                        <div className="flex gap-3">
                          <span className="text-muted-foreground">{item.porcentaje}%</span>
                          <span className="font-semibold">${item.monto.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${item.porcentaje}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

          </div>
        </TabsContent>

        <TabsContent value="servicios">
          <Card>
            <CardHeader>
              <CardTitle>Servicios Más Vendidos</CardTitle>
              <CardDescription>Top 5 servicios del mes</CardDescription>
            </CardHeader>
            <CardContent>
              {serviciosMasVendidos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No hay datos de servicios disponibles aún</p>
                </div>
              ) : (
              <div className="space-y-4">
                {serviciosMasVendidos.map((servicio, index) => (
                  <div key={servicio.nombre} className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{servicio.nombre}</p>
                      <p className="text-sm text-muted-foreground">{servicio.cantidad} servicios realizados</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-lg">${servicio.ingresos.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">
                        ${Math.round(servicio.ingresos / servicio.cantidad)} promedio
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="empleados">
          <Card>
            <CardHeader>
              <CardTitle>Rendimiento de Empleados</CardTitle>
              <CardDescription>Top empleados del mes</CardDescription>
            </CardHeader>
            <CardContent>
              {empleadosTop.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No hay datos de empleados disponibles aún</p>
                </div>
              ) : (
              <div className="space-y-4">
                {empleadosTop.map((empleado, index) => (
                  <div key={empleado.nombre} className="p-4 rounded-lg border bg-card">
                    <div className="flex items-center gap-4 mb-3">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                        <span className="text-lg font-bold text-primary">#{index + 1}</span>
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-lg">{empleado.nombre}</p>
                        <p className="text-sm text-muted-foreground">{empleado.servicios} servicios realizados</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-3 border-t">
                      <div>
                        <p className="text-xs text-muted-foreground">Ingresos Generados</p>
                        <p className="font-semibold text-lg">${empleado.ingresos.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Comisión Estimada</p>
                        <p className="font-semibold text-lg text-green-600">${(empleado as any).comision?.toLocaleString() || '0'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

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
                <div className="space-y-4">
                  {[
                    { categoria: "VIP", cantidad: clientesStats.vip, porcentaje: clientesStats.total > 0 ? Math.round((clientesStats.vip / clientesStats.total) * 100) : 0 },
                    { categoria: "Activos", cantidad: clientesStats.activos, porcentaje: clientesStats.total > 0 ? Math.round((clientesStats.activos / clientesStats.total) * 100) : 0 },
                    { categoria: "Nuevos (30 días)", cantidad: clientesStats.nuevos, porcentaje: clientesStats.total > 0 ? Math.round((clientesStats.nuevos / clientesStats.total) * 100) : 0 },
                  ].filter(item => item.cantidad > 0).map((item) => (
                    <div key={item.categoria} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{item.categoria}</span>
                        <div className="flex gap-3">
                          <span className="text-muted-foreground">{item.porcentaje}%</span>
                          <span className="font-semibold">{item.cantidad}</span>
                        </div>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${item.porcentaje}%` }} />
                      </div>
                    </div>
                  ))}
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
                    <div className="text-4xl font-bold text-primary mb-2">{clientesStats.total}</div>
                    <p className="text-sm text-muted-foreground">Total de clientes</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 rounded-lg bg-muted/50">
                      <div className="text-2xl font-bold">{clientesStats.activos}</div>
                      <p className="text-xs text-muted-foreground">Clientes activos</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-muted/50">
                      <div className="text-2xl font-bold">{clientesStats.nuevos}</div>
                      <p className="text-xs text-muted-foreground">Nuevos (30 días)</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
