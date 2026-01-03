"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getCitasByDate } from "@/lib/data/citas"
import { Clock, User, Briefcase, DollarSign, MoreVertical } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface DayScheduleProps {
  date: string
}

const estadoColors = {
  pendiente: "bg-yellow-100 text-yellow-800 border-yellow-300",
  confirmada: "bg-blue-100 text-blue-800 border-blue-300",
  "en-progreso": "bg-purple-100 text-purple-800 border-purple-300",
  completada: "bg-green-100 text-green-800 border-green-300",
  cancelada: "bg-red-100 text-red-800 border-red-300",
  "no-asistio": "bg-gray-100 text-gray-800 border-gray-300",
}

export function DaySchedule({ date }: DayScheduleProps) {
  const citas = getCitasByDate(date).sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))

  const hours = Array.from({ length: 12 }, (_, i) => i + 9)

  const getCitaAtHour = (hour: number) => {
    const hourStr = `${String(hour).padStart(2, "0")}:00`
    return citas.filter((cita) => {
      const citaHour = Number.parseInt(cita.horaInicio.split(":")[0])
      return citaHour === hour
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Agenda del día -{" "}
          {new Date(date + "T00:00:00").toLocaleDateString("es-MX", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {hours.map((hour) => {
            const citasEnHora = getCitaAtHour(hour)
            return (
              <div key={hour} className="flex gap-4">
                <div className="w-20 text-sm font-medium text-muted-foreground pt-2">
                  {String(hour).padStart(2, "0")}:00
                </div>
                <div className="flex-1 min-h-[60px] border-l-2 border-border pl-4">
                  {citasEnHora.length > 0 ? (
                    <div className="space-y-2">
                      {citasEnHora.map((cita) => (
                        <div
                          key={cita.id}
                          className={`p-3 rounded-lg border ${estadoColors[cita.estado]} transition-all hover:shadow-md`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Clock className="h-3 w-3" />
                                <span className="text-sm font-semibold">
                                  {cita.horaInicio} - {cita.horaFin}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {cita.duracion} min
                                </Badge>
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-sm">
                                  <User className="h-3 w-3" />
                                  <span className="font-medium">{cita.clienteNombre}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <Briefcase className="h-3 w-3" />
                                  <span>{cita.servicioNombre}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="text-xs">Con: {cita.empleadoNombre}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm font-semibold">
                                  <DollarSign className="h-3 w-3" />
                                  <span>${cita.precio}</span>
                                  {cita.pagado && (
                                    <Badge variant="outline" className="text-xs bg-green-50">
                                      Pagado
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>Ver detalles</DropdownMenuItem>
                                <DropdownMenuItem>Editar</DropdownMenuItem>
                                <DropdownMenuItem>Confirmar</DropdownMenuItem>
                                <DropdownMenuItem>Marcar como completada</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive">Cancelar</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground pt-2">Sin citas</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
