"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ChevronsUpDown, Loader2, ListPlus } from "lucide-react"
import { toast } from "sonner"
import { createCita, type Cita } from "@/lib/data/citas"
import { getServiciosActivosFromDB, type Servicio } from "@/lib/data/servicios"
import { getEmpleadosParaAgendaPorSucursalYDia, type Empleado } from "@/lib/data/empleado-sucursal-dia"
import { getCurrentUser } from "@/lib/auth"

const SLOT_TIMES = Array.from({ length: 23 }, (_, i) => {
  const hour = Math.floor(i / 2) + 9
  const minutes = i % 2 === 0 ? "00" : "30"
  return `${hour.toString().padStart(2, "0")}:${minutes}`
})

function mins(hora: string): number {
  const h = hora.slice(0, 5).split(":").map(Number)
  return (h[0] ?? 0) * 60 + (h[1] ?? 0)
}

function overlaps(
  startA: number,
  endA: number,
  startB: number,
  endB: number,
): boolean {
  return startA < endB && startB < endA
}

function primeraHoraDisponibleTras(refHora: string): string {
  const ref = mins(refHora)
  return SLOT_TIMES.find((s) => mins(s) >= ref) ?? SLOT_TIMES[0] ?? "09:00"
}

export interface AgregarServicioCitaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  citaBase: Cita | null
  sucursalId: string
  fecha: string
  /** Citas del día para detectar cruces por empleada y fecha */
  citasExistentes: Cita[]
  onSuccess: () => void | Promise<void>
}

export function AgregarServicioCitaDialog({
  open,
  onOpenChange,
  citaBase,
  sucursalId,
  fecha,
  citasExistentes,
  onSuccess,
}: AgregarServicioCitaDialogProps) {
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [loadingCat, setLoadingCat] = useState(false)
  const [servicioId, setServicioId] = useState("")
  const [empleadoId, setEmpleadoId] = useState("")
  const [horaInicio, setHoraInicio] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [servicioPopoverOpen, setServicioPopoverOpen] = useState(false)

  useEffect(() => {
    if (!open || !citaBase) return
    setServicioId("")
    setServicioPopoverOpen(false)
    setEmpleadoId(citaBase.empleadoId)
    const refFin = (citaBase.horaFin || citaBase.horaInicio).slice(0, 5)
    setHoraInicio(primeraHoraDisponibleTras(refFin))

    async function load() {
      setLoadingCat(true)
      try {
        const [svc, emp] = await Promise.all([
          getServiciosActivosFromDB(),
          getEmpleadosParaAgendaPorSucursalYDia(sucursalId, fecha),
        ])
        setServicios(svc)
        setEmpleados(emp)
      } catch {
        toast.error("Error al cargar servicios u empleadas")
      } finally {
        setLoadingCat(false)
      }
    }
    load()
  }, [open, citaBase, sucursalId, fecha])

  const servicioSel = servicios.find((s) => s.id === servicioId)

  const tieneConflicto = (): boolean => {
    if (!servicioSel || !empleadoId || !horaInicio) return false
    const start = mins(horaInicio)
    const end = start + servicioSel.duracion
    return citasExistentes.some((c) => {
      if (c.empleadoId !== empleadoId || c.fecha !== fecha) return false
      return overlaps(
        start,
        end,
        mins(c.horaInicio),
        mins(c.horaFin || c.horaInicio),
      )
    })
  }

  const handleGuardar = async () => {
    if (!citaBase) return
    if (!servicioId || !empleadoId || !horaInicio) {
      toast.error("Selecciona servicio, empleada y hora")
      return
    }
    if (!servicioSel) return
    if (tieneConflicto()) {
      toast.error(
        "Esa empleada ya tiene otra cita que se cruza con el horario elegido",
      )
      return
    }

    setIsSaving(true)
    try {
      const user = getCurrentUser()
      const creadoPor = user
        ? user.name || user.email || "Sistema"
        : "Sistema"
      const notaExtra = `Servicio adicional (misma visita: ${citaBase.servicioNombre} ${citaBase.horaInicio.slice(0, 5)})`
      const notas = [citaBase.notas, notaExtra].filter(Boolean).join("\n")

      const res = await createCita({
        cliente_id: citaBase.clienteId,
        empleado_id: empleadoId,
        servicio_id: servicioId,
        sucursal_id: sucursalId,
        fecha,
        hora_inicio: horaInicio,
        duracion: servicioSel.duracion,
        precio: servicioSel.precio,
        estado: "pendiente",
        notas: notas.trim() ? notas.trim() : undefined,
        creadoPor,
      })

      if (!res.success) {
        toast.error(res.error ?? "No se pudo crear la cita")
        return
      }
      toast.success("Servicio agregado — ya aparece en la agenda")
      onOpenChange(false)
      await onSuccess()
    } finally {
      setIsSaving(false)
    }
  }

  const conflictoPreview = tieneConflicto()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListPlus className="h-5 w-5" />
            Agregar servicio
          </DialogTitle>
          <DialogDescription>
            Se crea otra fila en la agenda el mismo día para{" "}
            <span className="font-medium text-foreground">
              {citaBase?.clienteNombre}
            </span>
            . El total del día en el resumen incluirá ambos servicios.
          </DialogDescription>
        </DialogHeader>

        {loadingCat || !citaBase ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4 py-2">
            <div className="rounded-md bg-muted/50 px-3 py-2 text-xs space-y-0.5">
              <p>
                <span className="text-muted-foreground">Cita actual: </span>
                <span className="font-medium">{citaBase.servicioNombre}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Horario actual: </span>
                <span className="font-mono">{citaBase.horaInicio.slice(0, 5)}</span>
                {" – "}
                <span className="font-mono">{citaBase.horaFin.slice(0, 5)}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Importe esta cita: </span>
                ${Number(citaBase.precio).toLocaleString("es-MX")}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Servicio a agregar *</Label>
              <Popover open={servicioPopoverOpen} onOpenChange={setServicioPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={servicioPopoverOpen}
                    className="w-full justify-between font-normal"
                  >
                    {servicioSel
                      ? `${servicioSel.nombre} — $${servicioSel.precio} (${servicioSel.duracion} min)`
                      : "Buscar o elegir servicio…"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command
                    filter={(value, search) => {
                      const s = servicios.find((sv) => sv.id === value)
                      if (!s) return 0
                      const term = search.toLowerCase().trim()
                      if (!term) return 1
                      const nombre = s.nombre.toLowerCase()
                      const matchNombre = nombre.includes(term)
                      const matchPrecio = String(s.precio).includes(term)
                      const matchDur = String(s.duracion).includes(term)
                      return matchNombre || matchPrecio || matchDur ? 1 : 0
                    }}
                  >
                    <CommandInput placeholder="Filtrar por nombre, precio o duración…" />
                    <CommandList>
                      <CommandEmpty>Ningún servicio coincide.</CommandEmpty>
                      <CommandGroup>
                        {servicios.map((s) => (
                          <CommandItem
                            key={s.id}
                            value={s.id}
                            onSelect={() => {
                              setServicioId(s.id)
                              setServicioPopoverOpen(false)
                            }}
                          >
                            {s.nombre} — ${s.precio} ({s.duracion} min)
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Empleada *</Label>
              <Select value={empleadoId} onValueChange={setEmpleadoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona empleada" />
                </SelectTrigger>
                <SelectContent>
                  {empleados.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nombre} {e.apellido}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Hora de inicio *</Label>
              <Select value={horaInicio} onValueChange={setHoraInicio}>
                <SelectTrigger className="font-mono">
                  <SelectValue placeholder="Hora" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {SLOT_TIMES.map((t) => (
                    <SelectItem key={t} value={t} className="font-mono">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {servicioSel && horaInicio && (
                <p className="text-xs text-muted-foreground">
                  Termina sobre las{" "}
                  {(() => {
                    const end =
                      mins(horaInicio) + servicioSel.duracion
                    const h = Math.floor(end / 60)
                    const m = end % 60
                    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
                  })()}
                </p>
              )}
            </div>

            {conflictoPreview && (
              <p className="text-xs text-destructive font-medium">
                Hay conflicto de horario con otra cita de esta empleada.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void handleGuardar()}
            disabled={
              loadingCat ||
              isSaving ||
              !servicioId ||
              !empleadoId ||
              !horaInicio ||
              conflictoPreview
            }
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Guardando…
              </>
            ) : (
              "Guardar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
