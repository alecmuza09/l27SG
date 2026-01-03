"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { getProductividadSucursales } from "@/lib/data/dashboard"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell } from "recharts"
import { TrendingUp, TrendingDown } from "lucide-react"
import { Badge } from "@/components/ui/badge"

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f59e0b", // amber
  "#10b981", // emerald
  "#3b82f6", // blue
  "#ef4444", // red
]

const chartConfig = {
  ingresos: {
    label: "Ingresos",
    color: "hsl(var(--chart-1))",
  },
  citas: {
    label: "Citas",
    color: "hsl(var(--chart-2))",
  },
  ocupacion: {
    label: "Ocupación",
    color: "hsl(var(--chart-3))",
  },
}

export function ProductividadSucursalesChart() {
  const data = getProductividadSucursales().sort((a, b) => b.ingresos - a.ingresos)

  // Formatear nombres de sucursales para el gráfico
  const chartData = data.map((sucursal) => ({
    nombre: sucursal.nombre.replace("Luna27 ", ""),
    ingresos: sucursal.ingresos,
    citas: sucursal.citas,
    ocupacion: sucursal.ocupacion,
    promedioTicket: sucursal.promedioTicket,
    tendencia: sucursal.tendencia,
    fullName: sucursal.nombre,
  }))

  return (
    <Card className="col-span-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold">Productividad por Sucursal</CardTitle>
            <CardDescription className="mt-1">
              Comparativa de ingresos, citas y ocupación por sucursal
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Gráfico de barras - Ingresos */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Ingresos por Sucursal</h3>
              <span className="text-xs text-muted-foreground">Último período</span>
            </div>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="nombre"
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                />
                <ChartTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const data = payload[0].payload
                    return (
                      <div className="rounded-lg border bg-background p-3 shadow-lg">
                        <div className="font-semibold mb-2">{data.fullName}</div>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Ingresos:</span>
                            <span className="font-semibold">${data.ingresos.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Citas:</span>
                            <span className="font-semibold">{data.citas}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Ticket Promedio:</span>
                            <span className="font-semibold">${data.promedioTicket}</span>
                          </div>
                          <div className="flex justify-between gap-4 items-center">
                            <span className="text-muted-foreground">Tendencia:</span>
                            <Badge
                              variant={data.tendencia >= 0 ? "default" : "destructive"}
                              className="gap-1"
                            >
                              {data.tendencia >= 0 ? (
                                <TrendingUp className="h-3 w-3" />
                              ) : (
                                <TrendingDown className="h-3 w-3" />
                              )}
                              {Math.abs(data.tendencia).toFixed(1)}%
                            </Badge>
                          </div>
                        </div>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="ingresos" fill="hsl(var(--chart-1))" radius={[8, 8, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </div>

          {/* Métricas adicionales en grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            {data.slice(0, 4).map((sucursal, index) => (
              <div
                key={sucursal.sucursalId}
                className="rounded-lg border p-4 bg-gradient-to-br from-background to-muted/20"
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="text-sm font-semibold text-foreground line-clamp-1">
                    {sucursal.nombre.replace("Luna27 ", "")}
                  </h4>
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Ingresos</span>
                    <span className="text-sm font-bold">${sucursal.ingresos.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Ocupación</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${sucursal.ocupacion}%`,
                            backgroundColor: COLORS[index % COLORS.length],
                          }}
                        />
                      </div>
                      <span className="text-xs font-semibold">{sucursal.ocupacion}%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Citas</span>
                    <span className="text-sm font-semibold">{sucursal.citas}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}





