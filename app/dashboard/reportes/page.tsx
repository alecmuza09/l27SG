"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, TrendingUp, Users, Calendar } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function ReportesPage() {
  const ventasPorDia = [
    { dia: "Lun", ventas: 12450 },
    { dia: "Mar", ventas: 15200 },
    { dia: "Mié", ventas: 13800 },
    { dia: "Jue", ventas: 16500 },
    { dia: "Vie", ventas: 18900 },
    { dia: "Sáb", ventas: 22300 },
    { dia: "Dom", ventas: 19800 },
  ]

  const maxVentas = Math.max(...ventasPorDia.map((d) => d.ventas))

  const serviciosMasVendidos = [
    { nombre: "Masaje Relajante", cantidad: 45, ingresos: 38250 },
    { nombre: "Facial Hidratante", cantidad: 38, ingresos: 24700 },
    { nombre: "Manicure & Pedicure", cantidad: 32, ingresos: 24000 },
    { nombre: "Tratamiento Corporal", cantidad: 28, ingresos: 33600 },
    { nombre: "Aromaterapia", cantidad: 25, ingresos: 27500 },
  ]

  const empleadosTop = [
    { nombre: "María González", servicios: 52, ingresos: 44200, comision: 17680 },
    { nombre: "Laura Martínez", servicios: 48, ingresos: 38400, comision: 13440 },
    { nombre: "Carmen López", servicios: 42, ingresos: 31500, comision: 9450 },
    { nombre: "Ana Rodríguez", servicios: 38, ingresos: 32300, comision: 12920 },
  ]

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
            <div className="text-2xl font-bold">$148,150</div>
            <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3" />
              +12.5% vs mes anterior
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Servicios</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">168</div>
            <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3" />
              +8.3% vs mes anterior
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Nuevos Clientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24</div>
            <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3" />
              +15.2% vs mes anterior
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ticket Promedio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$882</div>
            <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3" />
              +3.8% vs mes anterior
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
                <div className="space-y-4">
                  {[
                    { metodo: "Tarjeta", porcentaje: 65, monto: 96297 },
                    { metodo: "Efectivo", porcentaje: 25, monto: 37037 },
                    { metodo: "Transferencia", porcentaje: 10, monto: 14815 },
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

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ventas por Sucursal</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { sucursal: "Luna27 Centro", ventas: 68450, porcentaje: 46 },
                    { sucursal: "Luna27 Polanco", ventas: 52530, porcentaje: 35 },
                    { sucursal: "Luna27 Santa Fe", ventas: 27170, porcentaje: 19 },
                  ].map((item) => (
                    <div key={item.sucursal} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{item.sucursal}</span>
                        <span className="font-semibold">${item.ventas.toLocaleString()}</span>
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
                        <p className="text-xs text-muted-foreground">Comisión</p>
                        <p className="font-semibold text-lg text-green-600">${empleado.comision.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
                    { categoria: "VIP", cantidad: 45, porcentaje: 15 },
                    { categoria: "Frecuentes", cantidad: 128, porcentaje: 42 },
                    { categoria: "Ocasionales", cantidad: 95, porcentaje: 31 },
                    { categoria: "Nuevos", cantidad: 36, porcentaje: 12 },
                  ].map((item) => (
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
                  Retención de Clientes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center p-6 rounded-lg bg-primary/5">
                    <div className="text-4xl font-bold text-primary mb-2">78%</div>
                    <p className="text-sm text-muted-foreground">Tasa de retención mensual</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 rounded-lg bg-muted/50">
                      <div className="text-2xl font-bold">156</div>
                      <p className="text-xs text-muted-foreground">Clientes recurrentes</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-muted/50">
                      <div className="text-2xl font-bold">3.2</div>
                      <p className="text-xs text-muted-foreground">Visitas promedio/mes</p>
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
