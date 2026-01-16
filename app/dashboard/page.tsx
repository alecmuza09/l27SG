"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatsCard } from "@/components/dashboard/stats-card"
import { ProductividadSucursalesChart } from "@/components/dashboard/productividad-sucursales-chart"
import { TopEmpleados } from "@/components/dashboard/top-empleados"
import { SucursalSelector } from "@/components/sucursales/sucursal-selector"
import { Calendar, Users, DollarSign, TrendingUp, Clock, CheckCircle2, XCircle, Building2, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { 
  getDashboardStats, 
  getEstadoCitas, 
  getProximasCitas, 
  getServiciosPopulares, 
  getResumenSucursales 
} from "@/lib/data/dashboard"
import { getCurrentUser, type User } from "@/lib/auth"

export default function DashboardPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [selectedSucursal, setSelectedSucursal] = useState("all")

  // Calcular isAdmin de forma segura (siempre definido)
  const isAdmin: boolean = Boolean(currentUser?.role === 'admin')
  const userSucursalId = currentUser?.sucursalId

  useEffect(() => {
    const user = getCurrentUser()
    setCurrentUser(user)
    // Si no es admin, establecer su sucursal automáticamente
    if (user && user.role !== 'admin' && user.sucursalId) {
      setSelectedSucursal(user.sucursalId)
    }
  }, [])
  const [stats, setStats] = useState({ citasHoy: 0, clientesActivos: 0, ingresosHoy: 0, ocupacion: 0 })
  const [estadoCitas, setEstadoCitas] = useState({ completadas: 0, enProgreso: 0, pendientes: 0, canceladas: 0 })
  const [proximasCitas, setProximasCitas] = useState<Array<{ id: string; time: string; client: string; service: string; staff: string; status: string }>>([])
  const [serviciosPopulares, setServiciosPopulares] = useState<Array<{ name: string; count: number; percentage: number; revenue: number }>>([])
  const [resumenSucursales, setResumenSucursales] = useState<Array<{ nombre: string; ingresos: number; citas: number; tendencia: string }>>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setIsLoading(true)
        // Determinar sucursal a usar (filtrar por rol)
        const sucursalId = !isAdmin && userSucursalId 
          ? userSucursalId 
          : (selectedSucursal === 'all' ? undefined : selectedSucursal)
        
        const [statsData, estadoCitasData, proximasCitasData, serviciosPopularesData, resumenSucursalesData] = await Promise.all([
          getDashboardStats(sucursalId),
          getEstadoCitas(sucursalId),
          getProximasCitas(4, sucursalId),
          getServiciosPopulares(4, sucursalId),
          isAdmin ? getResumenSucursales(sucursalId) : Promise.resolve([]) // Solo admin ve resumen de todas
        ])
        
        setStats(statsData)
        setEstadoCitas(estadoCitasData)
        setProximasCitas(proximasCitasData)
        setServiciosPopulares(serviciosPopularesData)
        setResumenSucursales(resumenSucursalesData)
      } catch (err) {
        console.error('Error cargando datos del dashboard:', err)
      } finally {
        setIsLoading(false)
      }
    }

    if (currentUser) {
      loadDashboardData()
    }
  }, [selectedSucursal, currentUser, isAdmin, userSucursalId])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Cargando dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Resumen general de operaciones y productividad</p>
        </div>
        {isAdmin && (
          <div className="w-64">
            <SucursalSelector value={selectedSucursal} onChange={setSelectedSucursal} />
          </div>
        )}
      </div>

      {/* Stats Cards con colores mejorados */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Citas Hoy"
          value={stats.citasHoy}
          icon={Calendar}
          color="primary"
        />
        <StatsCard
          title="Clientes Activos"
          value={stats.clientesActivos.toLocaleString()}
          icon={Users}
          color="success"
        />
        <StatsCard
          title="Ingresos Hoy"
          value={`$${stats.ingresosHoy.toLocaleString()}`}
          icon={DollarSign}
          color="success"
        />
        <StatsCard
          title="Ocupación"
          value={`${stats.ocupacion}%`}
          icon={TrendingUp}
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
              <span className="font-bold text-green-700 dark:text-green-400">{estadoCitas.completadas}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">En Progreso</span>
              </div>
              <span className="font-bold text-blue-700 dark:text-blue-400">{estadoCitas.enProgreso}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium">Pendientes</span>
              </div>
              <span className="font-bold text-amber-700 dark:text-amber-400">{estadoCitas.pendientes}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium">Canceladas</span>
              </div>
              <span className="font-bold text-red-700 dark:text-red-400">{estadoCitas.canceladas}</span>
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
            {resumenSucursales.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No hay datos de sucursales disponibles</p>
              </div>
            ) : (
              <div className="space-y-3">
                {resumenSucursales.map((sucursal, i) => {
                  const tendenciaPositiva = !sucursal.tendencia.startsWith('-')
                  return (
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
                          ${sucursal.ingresos.toLocaleString()}
                        </p>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            tendenciaPositiva 
                              ? 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400 border-green-300 dark:border-green-700'
                              : 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400 border-red-300 dark:border-red-700'
                          }`}
                        >
                          {sucursal.tendencia}
                        </Badge>
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
              <Clock className="h-4 w-4 text-orange-600" />
              Alertas de Inventario
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <p>Las alertas de inventario se mostrarán cuando haya productos con stock bajo</p>
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
            {proximasCitas.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No hay próximas citas programadas</p>
              </div>
            ) : (
              <div className="space-y-4">
                {proximasCitas.map((cita) => (
                  <div
                    key={cita.id}
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
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Servicios Populares</CardTitle>
          </CardHeader>
          <CardContent>
            {serviciosPopulares.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No hay servicios populares registrados aún</p>
              </div>
            ) : (
              <div className="space-y-4">
                {serviciosPopulares.map((service) => (
                  <div key={service.name} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{service.name}</span>
                      <div className="flex gap-3 text-muted-foreground">
                        <span>{service.count} citas</span>
                        <span className="font-semibold text-foreground">${service.revenue.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${service.percentage}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
