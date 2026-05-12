"use client"

import type React from "react"
import { useState, useEffect, useCallback, useRef } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { searchClientes, createCliente, type Cliente } from "@/lib/data/clientes"
import { getServiciosActivosFromDB, type Servicio } from "@/lib/data/servicios"
import { getEmpleadosParaAgendaPorSucursalYDia, type Empleado } from "@/lib/data/empleado-sucursal-dia"
import {
  createCita,
  getCitasByDateAndSucursalFromDB,
  type Cita,
} from "@/lib/data/citas"
import { getCurrentUser } from "@/lib/auth"
import {
  Plus, Search, User, Loader2, ChevronsUpDown, Trash2,
  Clock, DollarSign, ChevronDown, CheckCircle2, AlertCircle, X,
  UtensilsCrossed, BedDouble,
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { cn, formatHora12 } from "@/lib/utils"

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ServicioItem {
  uid: string          // id local para la lista
  servicioId: string
  empleadoId: string
  horaInicio: string
}

interface NuevaCitaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedDate: string
  selectedTime?: string
  selectedEmpleadoId?: string
  sucursalId: string
  onCitaCreada?: () => void
  /** En desktop, renderiza como panel lateral inline (sin overlay) */
  asPanel?: boolean
  /** Si existe, muestra bloque para registrar comida/descanso en la agenda del día seleccionado */
  onRegistrarBloqueAgenda?: (params: {
    fecha: string
    empleadoId: string
    tipo: "comida" | "descanso"
    horaInicio: string
    duracionMinutos: number
  }) => Promise<boolean>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2)
}

function addMinutes(hora: string, mins: number): string {
  if (!hora) return ""
  const [h, m] = hora.split(":").map(Number)
  const total = h * 60 + m + mins
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
}

function minsHora(hora: string): number {
  const h = hora.slice(0, 5).split(":").map(Number)
  return (h[0] ?? 0) * 60 + (h[1] ?? 0)
}

function horariosSeCruzan(
  inicioA: string,
  finA: string,
  inicioB: string,
  finB: string,
): boolean {
  const a1 = minsHora(inicioA)
  const a2 = minsHora(finA)
  const b1 = minsHora(inicioB)
  const b2 = minsHora(finB)
  return a1 < b2 && b1 < a2
}

/** Mismos slots que la agenda Kanban (9:00–20:00 cada 30 min). */
const AGENDA_SLOT_TIMES = Array.from({ length: 23 }, (_, i) => {
  const hour = Math.floor(i / 2) + 9
  const minutes = i % 2 === 0 ? "00" : "30"
  return `${hour.toString().padStart(2, "0")}:${minutes}`
})

const BLOQUE_DURACIONES_MIN = [15, 30, 45, 60, 90, 120] as const

// ─── Componente ───────────────────────────────────────────────────────────────

export function NuevaCitaDialog({
  open,
  onOpenChange,
  selectedDate,
  selectedTime,
  selectedEmpleadoId,
  sucursalId,
  onCitaCreada,
  asPanel = false,
  onRegistrarBloqueAgenda,
}: NuevaCitaDialogProps) {
  // ── Estado: cliente ────────────────────────────────────────────────────────
  const [clienteMode, setClienteMode] = useState<"existing" | "new">("existing")
  /** Texto que escribe la usuaria (la búsqueda no corre hasta Enter o clic en Buscar). */
  const [clienteNombreBusqueda, setClienteNombreBusqueda] = useState("")
  const [selectedClienteId, setSelectedClienteId] = useState("")
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null)
  const [clientesBusqueda, setClientesBusqueda] = useState<Cliente[]>([])
  /** True después de ejecutar al menos una búsqueda con Enter/Buscar. */
  const [clienteBusquedaEjecutada, setClienteBusquedaEjecutada] = useState(false)
  const [isLoadingClientes, setIsLoadingClientes] = useState(false)
  const [nuevoCliente, setNuevoCliente] = useState({
    nombre: "", apellido: "", email: "", telefono: "", notas: "",
  })

  // ── Estado: catálogos ──────────────────────────────────────────────────────
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [isLoadingData, setIsLoadingData] = useState(false)

  // ── Estado: fecha / notas generales ────────────────────────────────────────
  const [fechaGeneral, setFechaGeneral] = useState(selectedDate)
  const [notasGenerales, setNotasGenerales] = useState("")

  // ── Estado: lista de servicios ─────────────────────────────────────────────
  const [serviciosItems, setServiciosItems] = useState<ServicioItem[]>([
    { uid: uid(), servicioId: "", empleadoId: selectedEmpleadoId || "", horaInicio: selectedTime || "" },
  ])
  // Popovers de búsqueda de servicio por uid
  const [openPopovers, setOpenPopovers] = useState<Record<string, boolean>>({})

  // ── Estado: envío ──────────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [overlapDialogOpen, setOverlapDialogOpen] = useState(false)
  const pendingClienteIdRef = useRef<string | null>(null)

  // ── Comida / descanso rápido en agenda (solo si hay callback) ─────────────
  const [bloqueTipo, setBloqueTipo] = useState<"comida" | "descanso">("comida")
  const [bloqueHoraInicio, setBloqueHoraInicio] = useState("13:00")
  const [bloqueDuracionMin, setBloqueDuracionMin] = useState(60)
  const [bloqueEmpleadoId, setBloqueEmpleadoId] = useState("")
  const [bloqueSaving, setBloqueSaving] = useState(false)

  // ── Reset al abrir ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setFechaGeneral(selectedDate)
      setNotasGenerales("")
      setServiciosItems([
        { uid: uid(), servicioId: "", empleadoId: selectedEmpleadoId || "", horaInicio: selectedTime || "" },
      ])
      setSelectedClienteId("")
      setSelectedCliente(null)
      setClienteMode("existing")
      setClienteNombreBusqueda("")
      setClienteBusquedaEjecutada(false)
      setClientesBusqueda([])
      setNuevoCliente({ nombre: "", apellido: "", email: "", telefono: "", notas: "" })
      setOpenPopovers({})
    } else {
      setOverlapDialogOpen(false)
      pendingClienteIdRef.current = null
    }
  }, [open, selectedDate, selectedTime, selectedEmpleadoId])

  const ejecutarBusquedaClientes = useCallback(async () => {
    const trimmed = clienteNombreBusqueda.trim()
    if (!trimmed) {
      setClientesBusqueda([])
      toast.info("Escribe un nombre o teléfono y vuelve a buscar")
      return
    }
    setClienteBusquedaEjecutada(true)
    setIsLoadingClientes(true)
    try {
      setClientesBusqueda(await searchClientes(trimmed, 100))
    } catch {
      toast.error("Error al buscar clientes")
      setClientesBusqueda([])
    } finally {
      setIsLoadingClientes(false)
    }
  }, [clienteNombreBusqueda])

  // ── Carga de catálogos ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    async function load() {
      setIsLoadingData(true)
      try {
        const [svc, emp] = await Promise.all([
          getServiciosActivosFromDB(),
          getEmpleadosParaAgendaPorSucursalYDia(sucursalId, fechaGeneral),
        ])
        setServicios(svc)
        setEmpleados(emp)
      } catch {
        toast.error("Error al cargar datos")
      } finally {
        setIsLoadingData(false)
      }
    }
    load()
  }, [open, sucursalId, fechaGeneral])

  useEffect(() => {
    if (!open || !onRegistrarBloqueAgenda) return
    setBloqueTipo("comida")
    setBloqueHoraInicio(selectedTime && AGENDA_SLOT_TIMES.includes(selectedTime) ? selectedTime : "13:00")
    setBloqueDuracionMin(60)
  }, [open, selectedTime, onRegistrarBloqueAgenda])

  useEffect(() => {
    if (!open || !onRegistrarBloqueAgenda) return
    const emp =
      serviciosItems.find((it) => it.empleadoId)?.empleadoId ||
      selectedEmpleadoId ||
      ""
    setBloqueEmpleadoId(emp)
  }, [open, serviciosItems, selectedEmpleadoId, onRegistrarBloqueAgenda])

  const guardarBloqueEnAgenda = async () => {
    if (!onRegistrarBloqueAgenda) return
    if (!bloqueEmpleadoId) {
      toast.error("Selecciona la empleada para el bloque")
      return
    }
    if (!bloqueHoraInicio) {
      toast.error("Indica la hora de inicio")
      return
    }
    setBloqueSaving(true)
    try {
      await onRegistrarBloqueAgenda({
        fecha: fechaGeneral,
        empleadoId: bloqueEmpleadoId,
        tipo: bloqueTipo,
        horaInicio: bloqueHoraInicio,
        duracionMinutos: bloqueDuracionMin,
      })
    } finally {
      setBloqueSaving(false)
    }
  }

  // ── Helpers de lista ───────────────────────────────────────────────────────
  function updateItem(idx: number, patch: Partial<ServicioItem>) {
    setServiciosItems((prev) => prev.map((it, i) => i === idx ? { ...it, ...patch } : it))
  }

  function addItem() {
    const last = serviciosItems[serviciosItems.length - 1]
    const lastSvc = servicios.find((s) => s.id === last.servicioId)
    const nextHora = lastSvc && last.horaInicio
      ? addMinutes(last.horaInicio, lastSvc.duracion)
      : last.horaInicio
    setServiciosItems((prev) => [
      ...prev,
      { uid: uid(), servicioId: "", empleadoId: "", horaInicio: nextHora },
    ])
  }

  function removeItem(idx: number) {
    if (serviciosItems.length === 1) return
    setServiciosItems((prev) => prev.filter((_, i) => i !== idx))
  }

  // Totales para el resumen
  const totalPrecio = serviciosItems.reduce((sum, it) => {
    const svc = servicios.find((s) => s.id === it.servicioId)
    return sum + (svc?.precio ?? 0)
  }, 0)
  const totalDuracion = serviciosItems.reduce((sum, it) => {
    const svc = servicios.find((s) => s.id === it.servicioId)
    return sum + (svc?.duracion ?? 0)
  }, 0)
  const allItemsValid = serviciosItems.every((it) => it.servicioId && it.empleadoId && it.horaInicio)

  const nuevoClienteDatosListos =
    nuevoCliente.nombre.trim().length > 0 &&
    nuevoCliente.apellido.trim().length > 0 &&
    nuevoCliente.telefono.trim().length > 0

  const clienteListoParaCita =
    clienteMode === "existing"
      ? Boolean(selectedClienteId)
      : nuevoClienteDatosListos

  const crearCitasEnServidor = async (clienteIdFinal: string) => {
    const user = getCurrentUser()
    const creadoPor = user ? (user.name || user.email || "Sistema") : "Sistema"
    const results = await Promise.all(
      serviciosItems.map((item) => {
        const svc = servicios.find((s) => s.id === item.servicioId)!
        return createCita({
          cliente_id: clienteIdFinal,
          empleado_id: item.empleadoId,
          servicio_id: item.servicioId,
          sucursal_id: sucursalId,
          fecha: fechaGeneral,
          hora_inicio: item.horaInicio,
          duracion: svc.duracion,
          precio: svc.precio,
          estado: "pendiente",
          notas: notasGenerales || undefined,
          creadoPor,
        })
      }),
    )

    const failed = results.filter((r) => !r.success)
    if (failed.length > 0) {
      toast.error(`${failed.length} cita(s) no se pudieron crear`)
    } else {
      toast.success(
        serviciosItems.length === 1
          ? "Cita creada exitosamente"
          : `${serviciosItems.length} citas creadas exitosamente`,
      )
      onCitaCreada?.()
      onOpenChange(false)
    }
  }

  function hayTraslapeServiciosItemsVsCitasDia(citasDia: Cita[]): boolean {
    return serviciosItems.some((item) => {
      const svc = servicios.find((s) => s.id === item.servicioId)
      if (!svc) return false
      const horaNorm = item.horaInicio.substring(0, 5)
      let totalM = minsHora(horaNorm) + svc.duracion
      totalM = Math.min(Math.max(totalM, 0), 23 * 60 + 59)
      const finNueva = `${String(Math.floor(totalM / 60)).padStart(2, "0")}:${String(totalM % 60).padStart(2, "0")}`
      return citasDia.some((otra) => {
        if (otra.estado === "cancelada") return false
        if (otra.empleadoId !== item.empleadoId) return false
        const ni = otra.horaInicio.substring(0, 5)
        const nf = (otra.horaFin || otra.horaInicio).substring(0, 5)
        return horariosSeCruzan(horaNorm, finNueva, ni, nf)
      })
    })
  }

  const handleOverlapContinue = () => {
    const id = pendingClienteIdRef.current
    if (!id) {
      setOverlapDialogOpen(false)
      return
    }
    setOverlapDialogOpen(false)
    void (async () => {
      setIsSubmitting(true)
      try {
        await crearCitasEnServidor(id)
      } catch {
        toast.error("Error inesperado al crear las citas")
      } finally {
        setIsSubmitting(false)
        pendingClienteIdRef.current = null
      }
    })()
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    let clienteIdFinal = selectedClienteId

    if (clienteMode === "new") {
      const n = nuevoCliente.nombre.trim()
      const a = nuevoCliente.apellido.trim()
      const t = nuevoCliente.telefono.trim()
      if (!n || !a) {
        toast.error(
          "Debes ingresar el nombre y el apellido. Ambos campos son obligatorios.",
        )
        return
      }
      if (!t) {
        toast.error("El teléfono es obligatorio.")
        return
      }
    } else if (!selectedClienteId) {
      toast.error("Selecciona o crea un cliente")
      return
    }

    for (const [i, item] of serviciosItems.entries()) {
      if (!item.servicioId || !item.empleadoId || !item.horaInicio) {
        toast.error(`Completa todos los campos del servicio ${i + 1}`)
        return
      }
    }

    setIsSubmitting(true)

    try {
      if (clienteMode === "new") {
        const res = await createCliente({
          nombre: nuevoCliente.nombre,
          apellido: nuevoCliente.apellido,
          telefono: nuevoCliente.telefono,
          email: nuevoCliente.email || undefined,
          notas: nuevoCliente.notas || undefined,
        })
        if (!res.success || !res.cliente) {
          toast.error(`Error al crear cliente: ${res.error}`)
          setIsSubmitting(false)
          return
        }
        clienteIdFinal = res.cliente.id
        toast.success("Cliente creado")
      }

      if (!clienteIdFinal) {
        toast.error("Selecciona o crea un cliente")
        setIsSubmitting(false)
        return
      }

      const citasDia = await getCitasByDateAndSucursalFromDB(fechaGeneral, sucursalId)
      if (hayTraslapeServiciosItemsVsCitasDia(citasDia)) {
        pendingClienteIdRef.current = clienteIdFinal
        setOverlapDialogOpen(true)
        setIsSubmitting(false)
        return
      }

      await crearCitasEnServidor(clienteIdFinal)
    } catch {
      toast.error("Error inesperado al crear las citas")
    } finally {
      setIsSubmitting(false)
    }
  }

  // ─── Shared form content ──────────────────────────────────────────────────
  const formContent = (
    <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">
            <div className="px-6 py-6 space-y-6">

              {/* ── CLIENTE ─────────────────────────────────────────────────── */}
              <section className="space-y-3">
                <Label className="text-base font-semibold">Cliente</Label>
                <Tabs value={clienteMode} onValueChange={(v) => {
                  setClienteMode(v as "existing" | "new")
                  setClienteNombreBusqueda("")
                  setClienteBusquedaEjecutada(false)
                  setClientesBusqueda([])
                  setSelectedClienteId("")
                  setSelectedCliente(null)
                }}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="existing">Cliente existente</TabsTrigger>
                    <TabsTrigger value="new">Nuevo cliente</TabsTrigger>
                  </TabsList>

                  <TabsContent value="existing" className="space-y-2 mt-3">
                    <div className="flex gap-2 flex-wrap items-stretch">
                      <div className="relative flex-1 min-w-[160px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                          aria-label="Texto para buscar clienta (solo ejecuta al pulsar Buscar o Enter)"
                          autoComplete="off"
                          spellCheck={false}
                          enterKeyHint="search"
                          placeholder="Nombre, teléfono o email…"
                          value={clienteNombreBusqueda}
                          onChange={(e) => setClienteNombreBusqueda(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              void ejecutarBusquedaClientes()
                            }
                          }}
                          className="pl-9"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="default"
                        className="shrink-0 px-6"
                        onClick={() => void ejecutarBusquedaClientes()}
                      >
                        Buscar
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Escribir aquí{" "}
                      <strong className="text-foreground font-medium">no</strong>
                      {" "}inicia ninguna búsqueda ni recarga la lista. Solo al pulsar{" "}
                      <strong className="text-foreground font-medium">Buscar</strong>
                      {" "}o{" "}
                      <strong className="text-foreground font-medium">Enter</strong>
                      {" "}se consultan las clientas en la base de datos.
                    </p>
                    {selectedCliente && (
                      <div className="flex items-center gap-3 px-3 py-2 rounded-md bg-primary/5 border border-primary/20">
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{selectedCliente.nombre} {selectedCliente.apellido}</p>
                          <p className="text-xs text-muted-foreground">{selectedCliente.telefono}</p>
                        </div>
                        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs"
                          onClick={() => { setSelectedClienteId(""); setSelectedCliente(null) }}>
                          Cambiar
                        </Button>
                      </div>
                    )}
                    {!selectedCliente && (
                      <div className="border rounded-md">
                        <ScrollArea className="h-[120px]">
                          <div className="p-2 space-y-1">
                            {isLoadingClientes ? (
                              <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                              </div>
                            ) : !clienteBusquedaEjecutada ? (
                              <p className="p-4 text-sm text-muted-foreground text-center">
                                Escribe el nombre completo (o teléfono) y usa Enter o Buscar.
                              </p>
                            ) : clientesBusqueda.length === 0 ? (
                              <p className="p-4 text-sm text-muted-foreground text-center">
                                Sin resultados. Prueba otro término.
                              </p>
                            ) : clientesBusqueda.map((c) => (
                              <button key={c.id} type="button"
                                onClick={() => { setSelectedClienteId(c.id); setSelectedCliente(c) }}
                                className={cn(
                                  "w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors flex items-center gap-3",
                                  selectedClienteId === c.id && "bg-accent"
                                )}>
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                  <User className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium">{c.nombre} {c.apellido}</p>
                                  <p className="text-xs text-muted-foreground">{c.telefono}{c.email ? ` · ${c.email}` : ""}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="new" className="space-y-3 mt-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Nombre *</Label>
                        <Input value={nuevoCliente.nombre} onChange={(e) => setNuevoCliente({ ...nuevoCliente, nombre: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Apellido *</Label>
                        <Input value={nuevoCliente.apellido} onChange={(e) => setNuevoCliente({ ...nuevoCliente, apellido: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Teléfono *</Label>
                        <Input type="tel" value={nuevoCliente.telefono} onChange={(e) => setNuevoCliente({ ...nuevoCliente, telefono: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Email</Label>
                        <Input type="email" value={nuevoCliente.email} onChange={(e) => setNuevoCliente({ ...nuevoCliente, email: e.target.value })} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Notas del cliente</Label>
                      <Textarea rows={2} placeholder="Alergias, preferencias..." value={nuevoCliente.notas}
                        onChange={(e) => setNuevoCliente({ ...nuevoCliente, notas: e.target.value })} />
                    </div>
                  </TabsContent>
                </Tabs>
              </section>

              <Separator />

              {/* ── FECHA GENERAL ────────────────────────────────────────────── */}
              <section className="space-y-3">
                <Label className="text-base font-semibold">Fecha de la sesión</Label>
                <div className="flex items-center gap-3">
                  <Input type="date" value={fechaGeneral} onChange={(e) => setFechaGeneral(e.target.value)}
                    className="w-44" required />
                  <p className="text-sm text-muted-foreground">
                    {fechaGeneral && new Date(fechaGeneral + "T12:00:00").toLocaleDateString("es-MX", {
                      weekday: "long", day: "numeric", month: "long",
                    })}
                  </p>
                </div>
              </section>

              <Separator />

              {/* ── SERVICIOS ────────────────────────────────────────────────── */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-semibold">Servicios</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Agrega uno o más servicios. Cada uno puede tener distinta empleada y hora.
                    </p>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={addItem}
                    disabled={isLoadingData}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Agregar servicio
                  </Button>
                </div>

                {isLoadingData ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Cargando catálogos...</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {serviciosItems.map((item, idx) => {
                      const svcSeleccionado = servicios.find((s) => s.id === item.servicioId)
                      const empSeleccionada = empleados.find((e) => e.id === item.empleadoId)

                      return (
                        <div
                          key={item.uid}
                          className={cn(
                            "rounded-lg border p-3 space-y-3 relative",
                            svcSeleccionado && item.empleadoId && item.horaInicio
                              ? "border-primary/30 bg-primary/5"
                              : "border-border bg-muted/20"
                          )}
                        >
                          {/* Número + borrar */}
                          <div className="flex items-center justify-between mb-1">
                            <Badge variant="outline" className="text-xs font-semibold">
                              Servicio {idx + 1}
                            </Badge>
                            {serviciosItems.length > 1 && (
                              <Button type="button" variant="ghost" size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                onClick={() => removeItem(idx)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>

                          {/* Fila: Servicio + Empleada (fila 1) / Hora (fila 2 si el panel es estrecho) */}
                          <div className="grid grid-cols-2 gap-2 items-end">
                            {/* Servicio */}
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Servicio *</Label>
                              <Popover
                                open={!!openPopovers[item.uid]}
                                onOpenChange={(v) => setOpenPopovers((p) => ({ ...p, [item.uid]: v }))}
                              >
                                <PopoverTrigger asChild>
                                  <Button variant="outline" role="combobox"
                                    className="w-full justify-between font-normal text-left h-9 text-sm">
                                    <span className="truncate">
                                      {svcSeleccionado
                                        ? svcSeleccionado.nombre
                                        : "Seleccionar servicio..."}
                                    </span>
                                    <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 p-0" align="start">
                                  <Command filter={(value, search) => {
                                    const s = servicios.find((sv) => sv.id === value)
                                    return s && s.nombre.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
                                  }}>
                                    <CommandInput placeholder="Buscar servicio..." />
                                    <CommandList>
                                      <CommandEmpty>Sin resultados.</CommandEmpty>
                                      <CommandGroup>
                                        {servicios.map((svc) => (
                                          <CommandItem key={svc.id} value={svc.id}
                                            onSelect={() => {
                                              updateItem(idx, { servicioId: svc.id })
                                              setOpenPopovers((p) => ({ ...p, [item.uid]: false }))
                                            }}>
                                            <div className="flex-1 min-w-0">
                                              <p className="text-sm font-medium truncate">{svc.nombre}</p>
                                              <p className="text-xs text-muted-foreground">
                                                ${svc.precio} · {svc.duracion} min
                                              </p>
                                            </div>
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                            </div>

                            {/* Empleada */}
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Empleada *</Label>
                              <Select value={item.empleadoId}
                                onValueChange={(v) => updateItem(idx, { empleadoId: v })}>
                                <SelectTrigger className="h-9 text-sm">
                                  <SelectValue placeholder="Seleccionar..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {empleados.map((emp) => (
                                    <SelectItem key={emp.id} value={emp.id}>
                                      {emp.nombre} {emp.apellido}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                          </div>
                          {/* Hora — fila independiente para evitar compresión */}
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Hora *</Label>
                            <Select
                              value={item.horaInicio}
                              onValueChange={(v) => updateItem(idx, { horaInicio: v })}
                            >
                              <SelectTrigger className="h-9 w-full text-sm">
                                <SelectValue placeholder="Seleccionar hora..." />
                              </SelectTrigger>
                              <SelectContent className="max-h-60">
                                {Array.from({ length: 21 }, (_, i) => {
                                  const h = Math.floor(i / 2) + 10
                                  const m = i % 2 === 0 ? "00" : "30"
                                  const val = `${String(h).padStart(2, "0")}:${m}`
                                  return (
                                    <SelectItem key={val} value={val}>
                                      <span className="tabular-nums font-medium">{formatHora12(val)}</span>
                                    </SelectItem>
                                  )
                                })}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Info del servicio seleccionado */}
                          {svcSeleccionado && (
                            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {svcSeleccionado.duracion} min
                                {item.horaInicio && (
                                  <> · hasta {addMinutes(item.horaInicio, svcSeleccionado.duracion)}</>
                                )}
                              </span>
                              <span className="flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                ${svcSeleccionado.precio}
                              </span>
                              {empSeleccionada && (
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {empSeleccionada.nombre} {empSeleccionada.apellido}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>

              {onRegistrarBloqueAgenda && (
                <>
                  <Separator />
                  <section className="space-y-3 rounded-lg border border-dashed bg-muted/15 p-4">
                    <div>
                      <Label className="text-base font-semibold">Comida o descanso en la agenda</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Registra un bloque para la empleada sin cerrar este panel. Se guarda en el día de la sesión ({fechaGeneral}).
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Tipo</Label>
                        <Select value={bloqueTipo} onValueChange={(v: "comida" | "descanso") => setBloqueTipo(v)}>
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="comida">
                              <span className="flex items-center gap-2"><UtensilsCrossed className="h-3.5 w-3.5 text-orange-500" /> Comida</span>
                            </SelectItem>
                            <SelectItem value="descanso">
                              <span className="flex items-center gap-2"><BedDouble className="h-3.5 w-3.5 text-slate-500" /> Descanso</span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Empleada</Label>
                        <Select value={bloqueEmpleadoId} onValueChange={setBloqueEmpleadoId}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Seleccionar..." />
                          </SelectTrigger>
                          <SelectContent>
                            {empleados.map((emp) => (
                              <SelectItem key={emp.id} value={emp.id}>
                                {emp.nombre} {emp.apellido}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Hora de inicio</Label>
                        <Select value={bloqueHoraInicio} onValueChange={setBloqueHoraInicio}>
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="max-h-56">
                            {AGENDA_SLOT_TIMES.map((t) => (
                              <SelectItem key={t} value={t}>
                                <span className="tabular-nums">{formatHora12(t)}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Duración</Label>
                        <Select
                          value={String(bloqueDuracionMin)}
                          onValueChange={(v) => setBloqueDuracionMin(Number(v))}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {BLOQUE_DURACIONES_MIN.map((m) => (
                              <SelectItem key={m} value={String(m)}>{m} min</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full"
                      disabled={bloqueSaving || isLoadingData || empleados.length === 0}
                      onClick={() => void guardarBloqueEnAgenda()}
                    >
                      {bloqueSaving ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Guardando...</>
                      ) : (
                        <>Agregar bloque a la agenda del día</>
                      )}
                    </Button>
                  </section>
                </>
              )}

              {/* ── NOTAS GENERALES ──────────────────────────────────────────── */}
              <section className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">Notas generales (opcionales)</Label>
                <Textarea rows={2} placeholder="Instrucciones, recordatorios, etc."
                  value={notasGenerales} onChange={(e) => setNotasGenerales(e.target.value)} />
              </section>

              {/* ── RESUMEN ───────────────────────────────────────────────────── */}
              {allItemsValid && clienteListoParaCita && (
                <section className="rounded-lg border border-primary/25 bg-primary/5 p-4 space-y-3">
                  <p className="text-sm font-semibold">Resumen de la sesión</p>

                  {/* Cliente */}
                  <div className="text-sm flex justify-between">
                    <span className="text-muted-foreground">Cliente</span>
                    <span className="font-medium">
                      {clienteMode === "new"
                        ? `${nuevoCliente.nombre} ${nuevoCliente.apellido}`
                        : selectedCliente
                          ? `${selectedCliente.nombre} ${selectedCliente.apellido}`
                          : "—"}
                    </span>
                  </div>

                  <Separator />

                  {/* Lista de servicios */}
                  <div className="space-y-2">
                    {serviciosItems.map((item, idx) => {
                      const svc = servicios.find((s) => s.id === item.servicioId)
                      const emp = empleados.find((e) => e.id === item.empleadoId)
                      if (!svc || !emp) return null
                      return (
                        <div key={item.uid} className="text-sm flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2">
                            <Badge variant="secondary" className="text-[10px] mt-0.5 shrink-0">#{idx + 1}</Badge>
                            <div>
                              <p className="font-medium">{svc.nombre}</p>
                              <p className="text-xs text-muted-foreground">
                                {emp.nombre} {emp.apellido} · {item.horaInicio}–{addMinutes(item.horaInicio, svc.duracion)} · {svc.duracion} min
                              </p>
                            </div>
                          </div>
                          <span className="font-semibold shrink-0">${svc.precio}</span>
                        </div>
                      )
                    })}
                  </div>

                  <Separator />

                  {/* Totales */}
                  <div className="flex justify-between text-sm font-semibold">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      {totalDuracion} min en total
                    </span>
                    <span className="text-primary">${totalPrecio} total</span>
                  </div>
                </section>
              )}

            </div>
          </div>{/* /overflow-y-auto */}

          {/* ── FOOTER ──────────────────────────────────────────────────────── */}
          <div className="px-6 py-4 border-t bg-background flex-shrink-0 flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              {serviciosItems.length} servicio{serviciosItems.length > 1 ? "s" : ""} · ${totalPrecio}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  isSubmitting ||
                  isLoadingData ||
                  !allItemsValid ||
                  !clienteListoParaCita
                }
              >
                {isSubmitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creando...</>
                ) : (
                  <><Plus className="h-4 w-4 mr-2" />
                    {serviciosItems.length === 1 ? "Crear Cita" : `Crear ${serviciosItems.length} Citas`}
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
  )

  const overlapHorarioAlert = (
    <AlertDialog
      open={overlapDialogOpen}
      onOpenChange={(v) => {
        setOverlapDialogOpen(v)
        if (!v) pendingClienteIdRef.current = null
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Horario ocupado</AlertDialogTitle>
          <AlertDialogDescription>
            Ya existe una cita en este horario para la empleada seleccionada. ¿Deseas continuar de todas formas?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction type="button" onClick={() => handleOverlapContinue()}>
            Continuar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  // ─── Render ────────────────────────────────────────────────────────────────
  if (asPanel) {
    if (!open) return null
    return (
      <>
        <div className="flex flex-col h-full overflow-hidden">
          <div className="px-5 pt-5 pb-3 border-b flex-shrink-0 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Nueva Cita</h2>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
              <span className="sr-only">Cerrar</span>
            </Button>
          </div>
          {formContent}
        </div>
        {overlapHorarioAlert}
      </>
    )
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:w-[520px] sm:max-w-none p-0 flex flex-col gap-0 overflow-hidden h-full">
          <SheetHeader className="px-6 pt-6 pb-3 border-b flex-shrink-0">
            <SheetTitle className="text-xl">Nueva Cita</SheetTitle>
          </SheetHeader>
          {formContent}
        </SheetContent>
      </Sheet>
      {overlapHorarioAlert}
    </>
  )
}
