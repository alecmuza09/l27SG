"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { getServiciosActivosFromDB, type Servicio } from "@/lib/data/servicios"
import { getEmpleadosBySucursalFromDB, type Empleado } from "@/lib/data/empleados"
import { updateCita, type Cita } from "@/lib/data/citas"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

interface EditarCitaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cita: Cita | null
  sucursalId: string
  onCitaUpdated: () => void
}

export function EditarCitaDialog({
  open,
  onOpenChange,
  cita,
  sucursalId,
  onCitaUpdated,
}: EditarCitaDialogProps) {
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingServicios, setIsLoadingServicios] = useState(false)
  const [isLoadingEmpleados, setIsLoadingEmpleados] = useState(false)

  const [citaForm, setCitaForm] = useState({
    servicioId: "",
    empleadoId: "",
    fecha: "",
    horaInicio: "",
    notas: "",
  })

  useEffect(() => {
    if (cita && open) {
      setCitaForm({
        servicioId: cita.servicioId,
        empleadoId: cita.empleadoId,
        fecha: cita.fecha,
        horaInicio: cita.horaInicio,
        notas: cita.notas || "",
      })
    }
  }, [cita, open])

  useEffect(() => {
    async function loadData() {
      if (!open) return
      
      try {
        setIsLoadingServicios(true)
        setIsLoadingEmpleados(true)
        
        const [serviciosData, empleadosData] = await Promise.all([
          getServiciosActivosFromDB(),
          getEmpleadosBySucursalFromDB(sucursalId),
        ])
        
        setServicios(serviciosData)
        setEmpleados(empleadosData)
      } catch (error) {
        console.error("Error cargando datos:", error)
        toast.error("Error al cargar los datos")
      } finally {
        setIsLoadingServicios(false)
        setIsLoadingEmpleados(false)
      }
    }
    
    loadData()
  }, [open, sucursalId])

  const servicioSeleccionado = servicios.find((s) => s.id === citaForm.servicioId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cita) return

    setIsSubmitting(true)

    try {
      if (!citaForm.servicioId || !citaForm.empleadoId || !citaForm.fecha || !citaForm.horaInicio) {
        toast.error("Por favor completa todos los campos obligatorios")
        setIsSubmitting(false)
        return
      }

      if (!servicioSeleccionado) {
        toast.error("Servicio no encontrado")
        setIsSubmitting(false)
        return
      }

      const result = await updateCita(cita.id, {
        servicio_id: citaForm.servicioId,
        empleado_id: citaForm.empleadoId,
        fecha: citaForm.fecha,
        hora_inicio: citaForm.horaInicio,
        duracion: servicioSeleccionado.duracion,
        precio: servicioSeleccionado.precio,
        notas: citaForm.notas || undefined,
      })

      if (!result.success) {
        toast.error(`Error al actualizar cita: ${result.error || "Error desconocido"}`)
        setIsSubmitting(false)
        return
      }

      toast.success("Cita actualizada exitosamente")
      onCitaUpdated()
      onOpenChange(false)
    } catch (error: any) {
      console.error("Error inesperado:", error)
      toast.error("Error inesperado al actualizar la cita")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!cita) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
          <DialogTitle>Editar Cita</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6">
            <div className="space-y-6 pb-6">
              <div className="space-y-4">
                <Label className="text-base font-semibold">Información de la Cita</Label>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="fecha">Fecha *</Label>
                    <Input
                      id="fecha"
                      type="date"
                      required
                      value={citaForm.fecha}
                      onChange={(e) => setCitaForm({ ...citaForm, fecha: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hora">Hora *</Label>
                    <Input
                      id="hora"
                      type="time"
                      required
                      value={citaForm.horaInicio}
                      onChange={(e) => setCitaForm({ ...citaForm, horaInicio: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="servicio">Servicio *</Label>
                  {isLoadingServicios ? (
                    <div className="flex items-center gap-2 p-3 border rounded-md">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Cargando servicios...</span>
                    </div>
                  ) : (
                    <Select
                      value={citaForm.servicioId}
                      onValueChange={(value) => setCitaForm({ ...citaForm, servicioId: value })}
                      required
                    >
                      <SelectTrigger id="servicio">
                        <SelectValue placeholder="Seleccionar servicio" />
                      </SelectTrigger>
                      <SelectContent>
                        {servicios.map((servicio) => (
                          <SelectItem key={servicio.id} value={servicio.id}>
                            {servicio.nombre} - ${servicio.precio} ({servicio.duracion} min)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="empleado">Empleada *</Label>
                  {isLoadingEmpleados ? (
                    <div className="flex items-center gap-2 p-3 border rounded-md">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Cargando empleadas...</span>
                    </div>
                  ) : (
                    <Select
                      value={citaForm.empleadoId}
                      onValueChange={(value) => setCitaForm({ ...citaForm, empleadoId: value })}
                      required
                    >
                      <SelectTrigger id="empleado">
                        <SelectValue placeholder="Seleccionar empleada" />
                      </SelectTrigger>
                      <SelectContent>
                        {empleados.map((empleado) => (
                          <SelectItem key={empleado.id} value={empleado.id}>
                            {empleado.nombre} {empleado.apellido}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notasCita">Notas de la Cita</Label>
                  <Textarea
                    id="notasCita"
                    placeholder="Instrucciones especiales, recordatorios, etc."
                    value={citaForm.notas}
                    onChange={(e) => setCitaForm({ ...citaForm, notas: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t bg-background flex-shrink-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar Cambios"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}


