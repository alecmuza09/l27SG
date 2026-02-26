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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { searchClientes, createCliente, type Cliente } from "@/lib/data/clientes"
import { getServiciosActivosFromDB, type Servicio } from "@/lib/data/servicios"
import { getEmpleadosBySucursalFromDB, type Empleado } from "@/lib/data/empleados"
import { createCita } from "@/lib/data/citas"
import {
  Plus, Search, User, Loader2, ChevronsUpDown, Trash2,
  Clock, DollarSign, ChevronDown, CheckCircle2, AlertCircle,
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

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

// ─── Componente ───────────────────────────────────────────────────────────────

export function NuevaCitaDialog({
  open,
  onOpenChange,
  selectedDate,
  selectedTime,
  selectedEmpleadoId,
  sucursalId,
  onCitaCreada,
}: NuevaCitaDialogProps) {
  // ── Estado: cliente ────────────────────────────────────────────────────────
  const [clienteMode, setClienteMode] = useState<"existing" | "new">("existing")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedClienteId, setSelectedClienteId] = useState("")
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null)
  const [clientesBusqueda, setClientesBusqueda] = useState<Cliente[]>([])
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
      setSearchQuery("")
      setClientesBusqueda([])
      setNuevoCliente({ nombre: "", apellido: "", email: "", telefono: "", notas: "" })
      setOpenPopovers({})
    }
  }, [open, selectedDate, selectedTime, selectedEmpleadoId])

  // ── Búsqueda de clientes ───────────────────────────────────────────────────
  useEffect(() => {
    if (!open || clienteMode !== "existing") return
    const trimmed = searchQuery.trim()
    if (!trimmed) { setClientesBusqueda([]); return }
    const timer = setTimeout(async () => {
      setIsLoadingClientes(true)
      try {
        setClientesBusqueda(await searchClientes(trimmed, 100))
      } catch {
        toast.error("Error al buscar clientes")
      } finally {
        setIsLoadingClientes(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [open, clienteMode, searchQuery])

  // ── Carga de catálogos ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    async function load() {
      setIsLoadingData(true)
      try {
        const [svc, emp] = await Promise.all([
          getServiciosActivosFromDB(),
          getEmpleadosBySucursalFromDB(sucursalId),
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
  }, [open, sucursalId])

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

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // 1) Resolver cliente
      let clienteIdFinal = selectedClienteId
      if (clienteMode === "new") {
        if (!nuevoCliente.nombre || !nuevoCliente.apellido || !nuevoCliente.telefono) {
          toast.error("Completa los campos obligatorios del cliente")
          setIsSubmitting(false)
          return
        }
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

      // 2) Validar servicios
      for (const [i, item] of serviciosItems.entries()) {
        if (!item.servicioId || !item.empleadoId || !item.horaInicio) {
          toast.error(`Completa todos los campos del servicio ${i + 1}`)
          setIsSubmitting(false)
          return
        }
      }

      // 3) Crear todas las citas en paralelo
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
          })
        })
      )

      const failed = results.filter((r) => !r.success)
      if (failed.length > 0) {
        toast.error(`${failed.length} cita(s) no se pudieron crear`)
      } else {
        toast.success(
          serviciosItems.length === 1
            ? "Cita creada exitosamente"
            : `${serviciosItems.length} citas creadas exitosamente`
        )
        onCitaCreada?.()
        onOpenChange(false)
      }
    } catch (err: any) {
      toast.error("Error inesperado al crear las citas")
    } finally {
      setIsSubmitting(false)
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3 flex-shrink-0">
          <DialogTitle className="text-xl">Nueva Cita</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <ScrollArea className="flex-1">
            <div className="px-6 pb-6 space-y-6">

              {/* ── CLIENTE ─────────────────────────────────────────────────── */}
              <section className="space-y-3">
                <Label className="text-base font-semibold">Cliente</Label>
                <Tabs value={clienteMode} onValueChange={(v) => setClienteMode(v as any)}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="existing">Cliente existente</TabsTrigger>
                    <TabsTrigger value="new">Nuevo cliente</TabsTrigger>
                  </TabsList>

                  <TabsContent value="existing" className="space-y-2 mt-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por nombre, teléfono o email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
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
                        <ScrollArea className="h-[160px]">
                          <div className="p-2 space-y-1">
                            {isLoadingClientes ? (
                              <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                              </div>
                            ) : searchQuery.trim() === "" ? (
                              <p className="p-4 text-sm text-muted-foreground text-center">
                                Escribe para buscar entre todos los clientes
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

                          {/* Fila: Servicio + Empleada + Hora */}
                          <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
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

                            {/* Hora */}
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Hora *</Label>
                              <Input type="time" value={item.horaInicio}
                                onChange={(e) => updateItem(idx, { horaInicio: e.target.value })}
                                className="h-9 w-28 text-sm" required />
                            </div>
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

              {/* ── NOTAS GENERALES ──────────────────────────────────────────── */}
              <section className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">Notas generales (opcionales)</Label>
                <Textarea rows={2} placeholder="Instrucciones, recordatorios, etc."
                  value={notasGenerales} onChange={(e) => setNotasGenerales(e.target.value)} />
              </section>

              {/* ── RESUMEN ───────────────────────────────────────────────────── */}
              {allItemsValid && (selectedClienteId || clienteMode === "new") && (
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
          </ScrollArea>

          {/* ── FOOTER ──────────────────────────────────────────────────────── */}
          <DialogFooter className="px-6 py-4 border-t bg-background flex-shrink-0 flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              {serviciosItems.length} servicio{serviciosItems.length > 1 ? "s" : ""} · ${totalPrecio}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting || isLoadingData}>
                {isSubmitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creando...</>
                ) : (
                  <><Plus className="h-4 w-4 mr-2" />
                    {serviciosItems.length === 1 ? "Crear Cita" : `Crear ${serviciosItems.length} Citas`}
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
