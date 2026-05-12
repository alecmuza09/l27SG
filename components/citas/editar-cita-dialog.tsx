"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Textarea } from "@/components/ui/textarea"
import { getServiciosActivosFromDB, type Servicio } from "@/lib/data/servicios"
import { getEmpleadosParaAgendaPorSucursalYDia, type Empleado } from "@/lib/data/empleado-sucursal-dia"
import { getSucursalesActivasFromDB, type Sucursal } from "@/lib/data/sucursales"
import { updateCita, type Cita } from "@/lib/data/citas"
import { Loader2, ChevronsUpDown, UserRound } from "lucide-react"
import { toast } from "sonner"
import { getCurrentUser } from "@/lib/auth"

/** Misma convención que la agenda Kanban (UI → BD). */
const ESTADOS_DB = {
  pendiente: "pendiente",
  confirmado: "confirmada",
  "en-espera": "en-progreso",
  "en-atencion": "en-progreso",
  "pendiente-por-pagar": "completada",
  pagado: "completada",
  cancelado: "cancelada",
} as const

const ESTADOS_EDITAR: { value: keyof typeof ESTADOS_DB; label: string; dbValue: string }[] = [
  { value: "pendiente", label: "Pendiente", dbValue: "pendiente" },
  { value: "confirmado", label: "Confirmado", dbValue: "confirmada" },
  { value: "en-espera", label: "En Espera", dbValue: "en-progreso" },
  { value: "en-atencion", label: "En Atención", dbValue: "en-progreso" },
  { value: "pendiente-por-pagar", label: "Pendiente por Pagar", dbValue: "completada" },
  { value: "pagado", label: "Pagado", dbValue: "completada" },
  { value: "cancelado", label: "Cancelado", dbValue: "cancelada" },
]

function mapearEstadoABD(estadoUI: string): string {
  return (ESTADOS_DB as Record<string, string>)[estadoUI] || estadoUI
}

function getEstadoUI(cita: Cita): keyof typeof ESTADOS_DB {
  if (cita.estado === "completada") return cita.pagado ? "pagado" : "pendiente-por-pagar"
  const found = ESTADOS_EDITAR.find((e) => e.dbValue === cita.estado)
  return (found?.value ?? "pendiente") as keyof typeof ESTADOS_DB
}

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
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingServicios, setIsLoadingServicios] = useState(false)
  const [isLoadingEmpleados, setIsLoadingEmpleados] = useState(false)
  const [servicioPopoverOpen, setServicioPopoverOpen] = useState(false)

  const [citaForm, setCitaForm] = useState({
    servicioId: "",
    empleadoId: "",
    sucursalId: "",
    fecha: "",
    horaInicio: "",
    notas: "",
    estadoUI: "pendiente" as string,
  })

  useEffect(() => {
    if (cita && open) {
      setCitaForm({
        servicioId: cita.servicioId,
        empleadoId: cita.empleadoId,
        sucursalId: cita.sucursalId || sucursalId,
        fecha: cita.fecha,
        horaInicio: cita.horaInicio.substring(0, 5),
        notas: cita.notas || "",
        estadoUI: getEstadoUI(cita),
      })
    }
  }, [cita, open, sucursalId])

  useEffect(() => {
    async function loadData() {
      if (!open) return
      try {
        setIsLoadingServicios(true)
        const [serviciosData, sucursalesData] = await Promise.all([
          getServiciosActivosFromDB(),
          getSucursalesActivasFromDB(),
        ])
        setServicios(serviciosData)
        setSucursales(sucursalesData)
      } catch (error) {
        console.error("Error cargando datos:", error)
        toast.error("Error al cargar los datos")
      } finally {
        setIsLoadingServicios(false)
      }
    }
    loadData()
  }, [open])

  // Recargar empleadas cuando cambia la sucursal
  useEffect(() => {
    async function loadEmpleados() {
      if (!citaForm.sucursalId || !citaForm.fecha) return
      try {
        setIsLoadingEmpleados(true)
        const empleadosData = await getEmpleadosParaAgendaPorSucursalYDia(
          citaForm.sucursalId,
          citaForm.fecha,
        )
        setEmpleados(empleadosData)
      } catch (error) {
        console.error("Error cargando empleadas:", error)
      } finally {
        setIsLoadingEmpleados(false)
      }
    }
    loadEmpleados()
  }, [citaForm.sucursalId, citaForm.fecha])

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

      const horaNorm = citaForm.horaInicio.substring(0, 5)
      const estadoBD = mapearEstadoABD(citaForm.estadoUI) as
        | "pendiente"
        | "confirmada"
      | "en-progreso"
      | "completada"
      | "cancelada"
      | "no-asistio"

      const pagado =
        estadoBD === "completada" ? citaForm.estadoUI === "pagado" : false

      const editor = getCurrentUser()
      const modificadoPor = editor ? (editor.name || editor.email || "Sistema") : "Sistema"

      const result = await updateCita(cita.id, {
        servicio_id: citaForm.servicioId,
        empleado_id: citaForm.empleadoId,
        sucursal_id: citaForm.sucursalId || undefined,
        fecha: citaForm.fecha,
        hora_inicio: horaNorm,
        duracion: servicioSeleccionado.duracion,
        precio: servicioSeleccionado.precio,
        notas: citaForm.notas || undefined,
        estado: estadoBD,
        pagado,
        creadoPor: cita.creadoPor,
        modificadoPor,
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

                <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2">
                  <UserRound className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Clienta</p>
                    <p className="text-sm font-medium truncate" title={cita.clienteNombre}>
                      {cita.clienteNombre}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="estadoCita">Estado de la cita</Label>
                  <Select
                    value={citaForm.estadoUI}
                    onValueChange={(value) => setCitaForm({ ...citaForm, estadoUI: value })}
                  >
                    <SelectTrigger id="estadoCita">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ESTADOS_EDITAR.map((e) => (
                        <SelectItem key={e.value} value={e.value}>
                          {e.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

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
                    <Popover open={servicioPopoverOpen} onOpenChange={setServicioPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={servicioPopoverOpen}
                          className="w-full justify-between font-normal"
                          id="servicio"
                        >
                          {servicioSeleccionado
                            ? `${servicioSeleccionado.nombre} - $${servicioSeleccionado.precio} (${servicioSeleccionado.duracion} min)`
                            : "Buscar o seleccionar servicio..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                        <Command
                          filter={(value, search) => {
                            const s = servicios.find((sv) => sv.id === value)
                            if (!s) return 0
                            const term = search.toLowerCase()
                            return s.nombre.toLowerCase().includes(term) ||
                              String(s.precio).includes(term) ||
                              String(s.duracion).includes(term)
                              ? 1
                              : 0
                          }}
                        >
                          <CommandInput placeholder="Escribir nombre del servicio..." />
                          <CommandList>
                            <CommandEmpty>No hay servicios que coincidan.</CommandEmpty>
                            <CommandGroup>
                              {servicios.map((servicio) => (
                                <CommandItem
                                  key={servicio.id}
                                  value={servicio.id}
                                  onSelect={() => {
                                    setCitaForm({ ...citaForm, servicioId: servicio.id })
                                    setServicioPopoverOpen(false)
                                  }}
                                >
                                  {servicio.nombre} - ${servicio.precio} ({servicio.duracion} min)
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="sucursal">Sucursal *</Label>
                    <Select
                      value={citaForm.sucursalId}
                      onValueChange={(value) =>
                        setCitaForm({ ...citaForm, sucursalId: value, empleadoId: "" })
                      }
                      required
                    >
                      <SelectTrigger id="sucursal">
                        <SelectValue placeholder="Seleccionar sucursal" />
                      </SelectTrigger>
                      <SelectContent>
                        {sucursales.map((suc) => (
                          <SelectItem key={suc.id} value={suc.id}>
                            {suc.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="empleado">Empleada *</Label>
                    {isLoadingEmpleados ? (
                      <div className="flex items-center gap-2 p-3 border rounded-md">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Cargando...</span>
                      </div>
                    ) : (
                      <Select
                        value={citaForm.empleadoId}
                        onValueChange={(value) => setCitaForm({ ...citaForm, empleadoId: value })}
                        required
                        disabled={!citaForm.sucursalId}
                      >
                        <SelectTrigger id="empleado">
                          <SelectValue placeholder={citaForm.sucursalId ? "Seleccionar empleada" : "Elige sucursal primero"} />
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


