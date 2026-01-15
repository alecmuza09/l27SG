"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getTopEmpleadosFromDB, type ProductividadEmpleado } from "@/lib/data/dashboard"
import { Trophy, Star, TrendingUp, DollarSign, Calendar, Users, Loader2 } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

const RANK_COLORS = {
  1: "bg-gradient-to-br from-yellow-400 to-yellow-600 text-yellow-900",
  2: "bg-gradient-to-br from-gray-300 to-gray-400 text-gray-900",
  3: "bg-gradient-to-br from-amber-600 to-amber-800 text-amber-100",
  default: "bg-muted text-muted-foreground",
}

const RANK_ICONS = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
}

export function TopEmpleados() {
  const [topEmpleados, setTopEmpleados] = useState<ProductividadEmpleado[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true)
        const empleados = await getTopEmpleadosFromDB(10)
        setTopEmpleados(empleados)
      } catch (err) {
        console.error('Error cargando top empleados:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-[400px]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Cargando top empleados...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (topEmpleados.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Top 10 Empleados
          </CardTitle>
          <CardDescription>Ranking por productividad e ingresos generados</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <p>No hay datos de empleados disponibles aún</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Top 10 Empleados
            </CardTitle>
            <CardDescription className="mt-1">
              Ranking por productividad e ingresos generados
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {topEmpleados.map((empleado, index) => {
            const rank = index + 1
            const rankColor = RANK_COLORS[rank as keyof typeof RANK_COLORS] || RANK_COLORS.default
            const rankIcon = RANK_ICONS[rank as keyof typeof RANK_ICONS]

            return (
              <div
                key={empleado.empleadoId}
                className="group relative rounded-lg border p-4 transition-all hover:shadow-md hover:border-primary/50 bg-gradient-to-r from-background to-muted/20"
              >
                <div className="flex items-center gap-4">
                  {/* Rank Badge */}
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold text-sm ${rankColor} shadow-sm`}
                  >
                    {rankIcon || rank}
                  </div>

                  {/* Avatar y Nombre */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {empleado.nombre[0]}
                        {empleado.apellido[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm text-foreground truncate">
                          {empleado.nombre} {empleado.apellido}
                        </p>
                        {rank <= 3 && (
                          <Badge variant="outline" className="text-xs">
                            Top {rank}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {empleado.sucursalNombre.replace("Luna27 ", "")}
                      </p>
                    </div>
                  </div>

                  {/* Métricas */}
                  <div className="hidden md:flex items-center gap-6">
                    {/* Rating */}
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm font-semibold">{empleado.rating}</span>
                    </div>

                    {/* Ingresos */}
                    <div className="flex items-center gap-1.5 min-w-[100px]">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-bold text-green-600">
                        ${empleado.ingresos.toLocaleString()}
                      </span>
                    </div>

                    {/* Citas */}
                    <div className="flex items-center gap-1.5 min-w-[60px]">
                      <Calendar className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-semibold">{empleado.citas}</span>
                    </div>

                    {/* Ocupación */}
                    <div className="flex items-center gap-2 min-w-[80px]">
                      <TrendingUp className="h-4 w-4 text-indigo-600" />
                      <div className="flex-1">
                        <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all"
                            style={{ width: `${empleado.ocupacion}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-xs font-semibold w-8">{empleado.ocupacion}%</span>
                    </div>
                  </div>

                  {/* Métricas móvil */}
                  <div className="md:hidden flex flex-col gap-2">
                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span className="font-semibold">{empleado.rating}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3 text-green-600" />
                        <span className="font-bold text-green-600">
                          ${empleado.ingresos.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-blue-600" />
                        <span className="font-semibold">{empleado.citas} citas</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3 text-indigo-600" />
                        <span className="font-semibold">{empleado.ocupacion}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                  {/* Barra de progreso visual adicional */}
                  {topEmpleados.length > 0 && topEmpleados[0].ingresos > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>Productividad</span>
                        <span>Ticket Promedio: ${empleado.promedioTicket}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary via-indigo-500 to-purple-500 rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, (empleado.ingresos / topEmpleados[0].ingresos) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
              </div>
            )
          })}
        </div>

        {/* Resumen al final */}
        <div className="mt-6 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">
              ${topEmpleados.reduce((sum, e) => sum + e.ingresos, 0).toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Ingresos Totales</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {topEmpleados.reduce((sum, e) => sum + e.citas, 0)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Citas Totales</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-indigo-600">
              {Math.round(
                topEmpleados.reduce((sum, e) => sum + e.ocupacion, 0) / topEmpleados.length
              )}
              %
            </div>
            <div className="text-xs text-muted-foreground mt-1">Ocupación Promedio</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {(
                topEmpleados.reduce((sum, e) => sum + e.rating, 0) / topEmpleados.length
              ).toFixed(1)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Rating Promedio</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}





