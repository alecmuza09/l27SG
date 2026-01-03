"use client"

import type React from "react"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Clock, User, DollarSign, ChevronLeft, ChevronRight, CalendarIcon, MapPin, Plus, Palmtree } from "lucide-react"
import { MOCK_CITAS, type Cita } from "@/lib/data/citas"
import { getEmpleadosBySucursalFromDB, type Empleado } from "@/lib/data/empleados"
import { getSucursalesActivasFromDB, type Sucursal } from "@/lib/data/sucursales"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { NuevaCitaDialog } from "./nueva-cita-dialog"
import { getVacaciones } from "@/lib/data/vacaciones"
import type { Vacacion } from "@/lib/types/vacaciones"

interface AgendaKanbanViewProps {
  selectedDate: string
  onDateChange: (date: string) => void
}

const ESTADOS = [
  { value: "pendiente", label: "Pendiente", color: "bg-yellow-500" },
  { value: "confirmada", label: "Confirmada", color: "bg-blue-500" },
  { value: "en-progreso", label: "En Progreso", color: "bg-purple-500" },
  { value: "completada", label: "Completada", color: "bg-green-500" },
  { value: "cancelada", label: "Cancelada", color: "bg-red-500" },
  { value: "no-asistio", label: "No Asistió", color: "bg-gray-500" },
]

const TIME_SLOTS = Array.from({ length: 23 }, (_, i) => {
  const hour = Math.floor(i / 2) + 9
  const minutes = i % 2 === 0 ? "00" : "30"
  return `${hour.toString().padStart(2, "0")}:${minutes}`
})

export function AgendaKanbanView({ selectedDate, onDateChange }: AgendaKanbanViewProps) {
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [selectedSucursal, setSelectedSucursal] = useState<string>("")
  const [viewMode, setViewMode] = useState<"timeline" | "kanban">("timeline")
  const [draggedCita, setDraggedCita] = useState<Cita | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<{ time: string; empleadoId: string } | null>(null)
  const [vacaciones, setVacaciones] = useState<Vacacion[]>([])
  const [empleadosSucursal, setEmpleadosSucursal] = useState<Empleado[]>([])

  useEffect(() => {
    setVacaciones(getVacaciones())
  }, [])

  useEffect(() => {
    async function loadSucursales() {
      const sucursalesData = await getSucursalesActivasFromDB()
      setSucursales(sucursalesData)
      if (sucursalesData.length > 0 && !selectedSucursal) {
        setSelectedSucursal(sucursalesData[0].id)
      }
    }
    loadSucursales()
  }, [])

  useEffect(() => {
    async function loadEmpleados() {
      if (selectedSucursal) {
        const empleados = await getEmpleadosBySucursalFromDB(selectedSucursal)
        setEmpleadosSucursal(empleados)
      }
    }
    loadEmpleados()
  }, [selectedSucursal])

  const isEmpleadoDeVacaciones = (empleadoId: string, fecha: string): Vacacion | null => {
    const fechaDate = new Date(fecha)
    return (
      vacaciones.find((vac) => {
        if (vac.empleadoId !== empleadoId) return false
        if (vac.estado !== "aprobada") return false
        const inicio = new Date(vac.fechaInicio)
        const fin = new Date(vac.fechaFin)
        return fechaDate >= inicio && fechaDate <= fin
      }) || null
    )
  }

  const empleadosDeVacacionesHoy = useMemo(() => {
    return empleadosSucursal.filter((emp) => isEmpleadoDeVacaciones(emp.id, selectedDate))
  }, [empleadosSucursal, selectedDate, vacaciones])

  const empleadosDisponibles = useMemo(() => {
    return empleadosSucursal.filter((emp) => !isEmpleadoDeVacaciones(emp.id, selectedDate))
  }, [empleadosSucursal, selectedDate, vacaciones])

  const citasFiltradas = useMemo(
    () => MOCK_CITAS.filter((c) => c.fecha === selectedDate && c.sucursalId === selectedSucursal),
    [selectedDate, selectedSucursal],
  )

  const citasPorEstado = useMemo(() => {
    return ESTADOS.reduce(
      (acc, estado) => {
        acc[estado.value] = citasFiltradas.filter((c) => c.estado === estado.value)
        return acc
      },
      {} as Record<string, Cita[]>,
    )
  }, [citasFiltradas])

  const navigateDate = (direction: "prev" | "next") => {
    const date = new Date(selectedDate)
    date.setDate(date.getDate() + (direction === "next" ? 1 : -1))
    onDateChange(date.toISOString().split("T")[0])
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return new Intl.DateTimeFormat("es-MX", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date)
  }

  const handleDragStart = (cita: Cita) => {
    setDraggedCita(cita)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (nuevoEstado: string) => {
    if (draggedCita) {
      console.log(`[v0] Moviendo cita ${draggedCita.id} a estado ${nuevoEstado}`)
      setDraggedCita(null)
    }
  }

  const handleSlotClick = (time: string, empleadoId: string, isInRange: boolean) => {
    if (!isInRange) return
    if (isEmpleadoDeVacaciones(empleadoId, selectedDate)) return
    setSelectedSlot({ time, empleadoId })
    setDialogOpen(true)
  }

  return (
    <div className="space-y-4">
      {/* Header con filtros */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigateDate("prev")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 min-w-[300px]">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium capitalize">{formatDate(selectedDate)}</span>
          </div>
          <Button variant="outline" size="icon" onClick={() => navigateDate("next")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedSucursal} onValueChange={setSelectedSucursal}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sucursales.map((sucursal) => (
                <SelectItem key={sucursal.id} value={sucursal.id}>
                  {sucursal.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {empleadosDeVacacionesHoy.length > 0 && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Palmtree className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-medium text-amber-800">Personal de Vacaciones</p>
                <p className="text-sm text-amber-700">
                  {empleadosDeVacacionesHoy.map((e) => `${e.nombre} ${e.apellido}`).join(", ")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs para cambiar entre vistas */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "timeline" | "kanban")}>
        <TabsList>
          <TabsTrigger value="timeline">Vista Timeline</TabsTrigger>
          <TabsTrigger value="kanban">Vista Kanban</TabsTrigger>
        </TabsList>

        {/* Vista Timeline por empleada */}
        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Agenda por Empleada
                {empleadosDeVacacionesHoy.length > 0 && (
                  <Badge variant="outline" className="ml-2 text-amber-600 border-amber-300">
                    {empleadosDeVacacionesHoy.length} de vacaciones
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
                  {[...empleadosDisponibles, ...empleadosDeVacacionesHoy].map((empleado) => {
                    const citasEmpleado = citasFiltradas.filter((c) => c.empleadoId === empleado.id)
                    const vacacionEmpleado = isEmpleadoDeVacaciones(empleado.id, selectedDate)

                    return (
                      <div key={empleado.id} className={cn("space-y-2", vacacionEmpleado && "opacity-60")}>
                        <div
                          className={cn(
                            "flex items-center gap-3 pb-2 border-b sticky top-0 bg-background z-10",
                            vacacionEmpleado && "bg-amber-50 rounded-t-lg px-2 pt-2",
                          )}
                        >
                          <div
                            className={cn(
                              "h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0",
                              vacacionEmpleado ? "bg-amber-200" : "bg-primary/10",
                            )}
                          >
                            {vacacionEmpleado ? (
                              <Palmtree className="h-5 w-5 text-amber-600" />
                            ) : (
                              <User className="h-5 w-5 text-primary" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {empleado.nombre} {empleado.apellido}
                            </p>
                            {vacacionEmpleado ? (
                              <p className="text-xs text-amber-600 font-medium">De vacaciones</p>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                {empleado.horarioInicio} - {empleado.horarioFin}
                              </p>
                            )}
                          </div>
                          {!vacacionEmpleado && (
                            <Badge variant="outline" className="flex-shrink-0">
                              {citasEmpleado.length}
                            </Badge>
                          )}
                        </div>

                        {vacacionEmpleado ? (
                          <div className="flex items-center justify-center h-32 bg-amber-50 rounded-lg border border-amber-200">
                            <div className="text-center">
                              <Palmtree className="h-8 w-8 text-amber-400 mx-auto mb-2" />
                              <p className="text-sm text-amber-600">De vacaciones</p>
                              <p className="text-xs text-amber-500">
                                {new Date(vacacionEmpleado.fechaInicio).toLocaleDateString("es-MX")} -{" "}
                                {new Date(vacacionEmpleado.fechaFin).toLocaleDateString("es-MX")}
                              </p>
                            </div>
                          </div>
                        ) : (
                          /* Timeline de 30 minutos */
                          <div className="space-y-1">
                            {TIME_SLOTS.map((slot) => {
                              const [hour, minutes] = slot.split(":")
                              const slotTime = `${hour}:${minutes}`
                              const cita = citasEmpleado.find((c) => c.horaInicio === slotTime)
                              const isInRange = slotTime >= empleado.horarioInicio && slotTime < empleado.horarioFin

                              return (
                                <div key={slot} className="flex gap-2">
                                  <div className="text-xs text-muted-foreground py-2 w-12 flex-shrink-0">{slot}</div>
                                  <div
                                    className={cn(
                                      "flex-1 min-h-[40px] border-l-2 border-border pl-2 py-1 cursor-pointer hover:bg-accent/50 transition-colors",
                                      !isInRange && "bg-muted/30 cursor-not-allowed",
                                    )}
                                    onClick={() => handleSlotClick(slotTime, empleado.id, isInRange)}
                                  >
                                    {cita ? (
                                      <Card
                                        className="cursor-move hover:shadow-md transition-shadow"
                                        draggable
                                        onDragStart={() => handleDragStart(cita)}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <CardContent className="p-2">
                                          <div className="space-y-1">
                                            <Badge
                                              className={cn(
                                                "text-xs",
                                                ESTADOS.find((e) => e.value === cita.estado)?.color,
                                              )}
                                            >
                                              {ESTADOS.find((e) => e.value === cita.estado)?.label}
                                            </Badge>
                                            <p className="font-medium text-xs truncate">{cita.clienteNombre}</p>
                                            <p className="text-xs text-muted-foreground truncate">
                                              {cita.servicioNombre}
                                            </p>
                                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                              <span className="flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {cita.duracion}m
                                              </span>
                                              <span className="flex items-center gap-1">
                                                <DollarSign className="h-3 w-3" />${cita.precio}
                                              </span>
                                            </div>
                                          </div>
                                        </CardContent>
                                      </Card>
                                    ) : (
                                      isInRange && (
                                        <div className="flex items-center justify-center h-full opacity-0 hover:opacity-100 transition-opacity">
                                          <Plus className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                      )
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vista Kanban por estado */}
        <TabsContent value="kanban">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {ESTADOS.map((estado) => (
              <Card
                key={estado.value}
                className="flex flex-col"
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(estado.value)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">{estado.label}</CardTitle>
                    <Badge variant="secondary">{citasPorEstado[estado.value]?.length || 0}</Badge>
                  </div>
                  <div className={cn("h-1 rounded-full", estado.color)} />
                </CardHeader>
                <CardContent className="flex-1">
                  <ScrollArea className="h-[500px] pr-4">
                    <div className="space-y-3">
                      {citasPorEstado[estado.value]?.map((cita) => (
                        <Card
                          key={cita.id}
                          className="cursor-move hover:shadow-md transition-shadow"
                          draggable
                          onDragStart={() => handleDragStart(cita)}
                        >
                          <CardContent className="p-4 space-y-2">
                            <div className="flex items-start justify-between">
                              <p className="font-medium text-sm">{cita.clienteNombre}</p>
                              {cita.pagado && (
                                <Badge variant="outline" className="text-xs bg-green-500/10 text-green-700">
                                  Pagado
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{cita.servicioNombre}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>
                                {cita.horaInicio} - {cita.horaFin}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <User className="h-3 w-3" />
                              <span>{cita.empleadoNombre}</span>
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t">
                              <span className="text-xs text-muted-foreground">{cita.duracion} min</span>
                              <span className="font-medium text-sm">${cita.precio}</span>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Resumen de estadísticas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{citasFiltradas.length}</div>
            <p className="text-xs text-muted-foreground">Total Citas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{citasPorEstado["completada"]?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Completadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{citasPorEstado["confirmada"]?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Confirmadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-primary">{empleadosDisponibles.length}</div>
            <p className="text-xs text-muted-foreground">Personal Disponible</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-primary">
              ${citasFiltradas.reduce((sum, c) => sum + c.precio, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Ingresos Día</p>
          </CardContent>
        </Card>
      </div>

      <NuevaCitaDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        selectedDate={selectedDate}
        selectedTime={selectedSlot?.time}
        selectedEmpleadoId={selectedSlot?.empleadoId}
        sucursalId={selectedSucursal}
      />
    </div>
  )
}
