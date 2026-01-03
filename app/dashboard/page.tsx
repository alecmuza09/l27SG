"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatsCard } from "@/components/dashboard/stats-card"
import { ProductividadSucursalesChart } from "@/components/dashboard/productividad-sucursales-chart"
import { TopEmpleados } from "@/components/dashboard/top-empleados"
import { SucursalSelector } from "@/components/sucursales/sucursal-selector"
import { Calendar, Users, DollarSign, TrendingUp, Clock, CheckCircle2, XCircle, Building2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export default function DashboardPage() {
  const [selectedSucursal, setSelectedSucursal] = useState("all")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Resumen general de operaciones y productividad</p>
        </div>
        <div className="w-64">
          <SucursalSelector value={selectedSucursal} onChange={setSelectedSucursal} />
        </div>
      </div>

      {/* Stats Cards con colores mejorados */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Citas Hoy"
          value={24}
          icon={Calendar}
          trend={{ value: "12% vs ayer", positive: true }}
          color="primary"
        />
        <StatsCard
          title="Clientes Activos"
          value="1,234"
          icon={Users}
          trend={{ value: "8% este mes", positive: true }}
          color="success"
        />
        <StatsCard
          title="Ingresos Hoy"
          value="$12,450"
          icon={DollarSign}
          trend={{ value: "15% vs ayer", positive: true }}
          color="success"
        />
        <StatsCard
          title="Ocupación"
          value="78%"
          icon={TrendingUp}
          trend={{ value: "5% vs semana", positive: true }}
          color="primary"
        />
      </div>

      {/* Gráfico de Productividad por Sucursales */}
      <ProductividadSucursalesChart />

      {/* Top 10 Empleados */}
      <TopEmpleados />

      {/* Cards de información adicional */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Estado de Citas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-2 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Completadas</span>
              </div>
              <span className="font-bold text-green-700 dark:text-green-400">18</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">En Progreso</span>
              </div>
              <span className="font-bold text-blue-700 dark:text-blue-400">3</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium">Pendientes</span>
              </div>
              <span className="font-bold text-amber-700 dark:text-amber-400">3</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium">Canceladas</span>
              </div>
              <span className="font-bold text-red-700 dark:text-red-400">2</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-indigo-600" />
              Resumen Sucursales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { nombre: "Carrizalejo", ingresos: "$45,200", citas: 52, tendencia: "+12%" },
                { nombre: "La Aurora", ingresos: "$38,500", citas: 48, tendencia: "+8%" },
                { nombre: "Serena", ingresos: "$42,100", citas: 50, tendencia: "+15%" },
                { nombre: "Paseo Tec", ingresos: "$35,800", citas: 45, tendencia: "+5%" },
              ].map((sucursal, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border border-indigo-200 dark:border-indigo-800"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">{sucursal.nombre}</p>
                    <p className="text-xs text-muted-foreground">{sucursal.citas} citas</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300">
                      {sucursal.ingresos}
                    </p>
                    <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400 border-green-300 dark:border-green-700 text-xs">
                      {sucursal.tendencia}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-600" />
              Alertas de Inventario
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { product: "Aceite de Masaje", stock: 5, min: 10 },
                { product: "Toallas Faciales", stock: 15, min: 20 },
                { product: "Crema Hidratante", stock: 8, min: 15 },
              ].map((item, i) => {
                const porcentaje = (item.stock / item.min) * 100
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-orange-900 dark:text-orange-100">
                        {item.product}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-2 bg-orange-200 dark:bg-orange-900 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-orange-600 dark:bg-orange-500 rounded-full transition-all"
                            style={{ width: `${Math.min(100, porcentaje)}%` }}
                          />
                        </div>
                        <span className="text-xs text-orange-700 dark:text-orange-300 font-semibold">
                          {item.stock}/{item.min}
                        </span>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className="bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300 border-orange-300 dark:border-orange-700 ml-2"
                    >
                      Bajo
                    </Badge>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Próximas Citas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                {
                  time: "10:00",
                  client: "Ana García",
                  service: "Masaje Relajante",
                  staff: "María",
                  status: "confirmed",
                },
                {
                  time: "11:30",
                  client: "Carlos López",
                  service: "Facial Hidratante",
                  staff: "Laura",
                  status: "confirmed",
                },
                {
                  time: "13:00",
                  client: "Sofia Martínez",
                  service: "Manicure & Pedicure",
                  staff: "Carmen",
                  status: "pending",
                },
                {
                  time: "14:30",
                  client: "Roberto Díaz",
                  service: "Tratamiento Corporal",
                  staff: "María",
                  status: "confirmed",
                },
              ].map((cita, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="text-sm font-medium text-primary w-16">{cita.time}</div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{cita.client}</p>
                    <p className="text-xs text-muted-foreground">
                      {cita.service} • {cita.staff}
                    </p>
                  </div>
                  <Badge variant={cita.status === "confirmed" ? "default" : "secondary"}>
                    {cita.status === "confirmed" ? "Confirmada" : "Pendiente"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Servicios Populares</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { name: "Masaje Relajante", count: 45, percentage: 85, revenue: "$6,750" },
                { name: "Facial Hidratante", count: 38, percentage: 72, revenue: "$5,320" },
                { name: "Manicure & Pedicure", count: 32, percentage: 60, revenue: "$2,880" },
                { name: "Tratamiento Corporal", count: 28, percentage: 53, revenue: "$4,200" },
              ].map((service, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{service.name}</span>
                    <div className="flex gap-3 text-muted-foreground">
                      <span>{service.count} citas</span>
                      <span className="font-semibold text-foreground">{service.revenue}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${service.percentage}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
