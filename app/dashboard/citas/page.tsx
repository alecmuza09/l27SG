"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Plus, CalendarIcon, List, LayoutGrid } from "lucide-react"
import { CalendarView } from "@/components/citas/calendar-view"
import { DaySchedule } from "@/components/citas/day-schedule"
import { AgendaKanbanView } from "@/components/citas/agenda-kanban-view"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { getClientes, type Cliente } from "@/lib/data/clientes"
import { MOCK_EMPLEADOS } from "@/lib/data/empleados"
import { MOCK_SERVICIOS } from "@/lib/data/servicios"

export default function CitasPage() {
  const today = new Date().toISOString().split("T")[0]
  const [selectedDate, setSelectedDate] = useState(today)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedServicio, setSelectedServicio] = useState("")
  const [clientes, setClientes] = useState<Cliente[]>([])

  const servicioSeleccionado = MOCK_SERVICIOS.find((s) => s.id === selectedServicio)

  useEffect(() => {
    async function loadClientes() {
      const clientesData = await getClientes()
      setClientes(clientesData)
    }
    loadClientes()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Citas</h1>
          <p className="text-muted-foreground">Gestiona las citas y el calendario</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Cita
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nueva Cita</DialogTitle>
              <DialogDescription>Agenda una nueva cita para un cliente</DialogDescription>
            </DialogHeader>
            <form className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cliente">Cliente *</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map((cliente) => (
                      <SelectItem key={cliente.id} value={cliente.id}>
                        {cliente.nombre} {cliente.apellido} - {cliente.telefono}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="servicio">Servicio *</Label>
                <Select value={selectedServicio} onValueChange={setSelectedServicio}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar servicio" />
                  </SelectTrigger>
                  <SelectContent>
                    {MOCK_SERVICIOS.filter((s) => s.activo).map((servicio) => (
                      <SelectItem key={servicio.id} value={servicio.id}>
                        {servicio.nombre} - {servicio.duracion} min - ${servicio.precio}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {servicioSeleccionado && (
                  <p className="text-xs text-muted-foreground">{servicioSeleccionado.descripcion}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="empleado">Empleado *</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar empleado" />
                  </SelectTrigger>
                  <SelectContent>
                    {MOCK_EMPLEADOS.filter((e) => e.activo).map((empleado) => (
                      <SelectItem key={empleado.id} value={empleado.id}>
                        {empleado.nombre} {empleado.apellido} - {empleado.rol}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fecha">Fecha *</Label>
                  <Input id="fecha" type="date" defaultValue={selectedDate} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hora">Hora *</Label>
                  <Input id="hora" type="time" required />
                </div>
              </div>

              {servicioSeleccionado && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm">
                    <span className="font-medium">Duración:</span> {servicioSeleccionado.duracion} minutos
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Precio:</span> ${servicioSeleccionado.precio}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notas">Notas</Label>
                <Textarea id="notas" placeholder="Observaciones, preferencias del cliente..." rows={3} />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Agendar Cita</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="agenda" className="space-y-4">
        <TabsList>
          <TabsTrigger value="agenda" className="gap-2">
            <LayoutGrid className="h-4 w-4" />
            Vista Agenda Avanzada
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-2">
            <CalendarIcon className="h-4 w-4" />
            Vista Calendario
          </TabsTrigger>
          <TabsTrigger value="schedule" className="gap-2">
            <List className="h-4 w-4" />
            Vista Agenda Simple
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agenda" className="space-y-4">
          <AgendaKanbanView selectedDate={selectedDate} onDateSelect={setSelectedDate} />
        </TabsContent>

        <TabsContent value="calendar" className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <CalendarView selectedDate={selectedDate} onDateSelect={setSelectedDate} />
            </div>
            <div className="lg:col-span-2">
              <DaySchedule date={selectedDate} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="schedule">
          <DaySchedule date={selectedDate} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
