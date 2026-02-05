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
import { searchClientes, createCliente, type Cliente } from "@/lib/data/clientes"
import { getServiciosActivosFromDB, type Servicio } from "@/lib/data/servicios"
import { getEmpleadosBySucursalFromDB, type Empleado } from "@/lib/data/empleados"
import { createCita } from "@/lib/data/citas"
import { Plus, Search, User, Loader2, ChevronsUpDown } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"

interface NuevaCitaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedDate: string
  selectedTime?: string
  selectedEmpleadoId?: string
  sucursalId: string
  /** Se llama después de crear una cita para que la agenda recargue */
  onCitaCreada?: () => void
}

export function NuevaCitaDialog({
  open,
  onOpenChange,
  selectedDate,
  selectedTime,
  selectedEmpleadoId,
  sucursalId,
  onCitaCreada,
}: NuevaCitaDialogProps) {
  const [clienteMode, setClienteMode] = useState<"existing" | "new">("existing")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedClienteId, setSelectedClienteId] = useState("")
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null)
  const [clientesBusqueda, setClientesBusqueda] = useState<Cliente[]>([])
  const [isLoadingClientes, setIsLoadingClientes] = useState(false)
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingServicios, setIsLoadingServicios] = useState(false)
  const [isLoadingEmpleados, setIsLoadingEmpleados] = useState(false)
  const [errorServicios, setErrorServicios] = useState<string | null>(null)
  const [servicioPopoverOpen, setServicioPopoverOpen] = useState(false)

  // Nuevo cliente form
  const [nuevoCliente, setNuevoCliente] = useState({
    nombre: "",
    apellido: "",
    email: "",
    telefono: "",
    notas: "",
  })

  // Cita form
  const [citaForm, setCitaForm] = useState({
    servicioId: "",
    empleadoId: selectedEmpleadoId || "",
    fecha: selectedDate,
    horaInicio: selectedTime || "",
    notas: "",
  })

  // Actualizar formulario cuando cambien los props (especialmente cuando se abre desde un slot)
  useEffect(() => {
    if (open) {
      setCitaForm({
        servicioId: "",
        empleadoId: selectedEmpleadoId || "",
        fecha: selectedDate,
        horaInicio: selectedTime || "",
        notas: "",
      })
      setSelectedClienteId("")
      setSelectedCliente(null)
      setClienteMode("existing")
      setSearchQuery("")
      setClientesBusqueda([])
    }
  }, [open, selectedDate, selectedTime, selectedEmpleadoId])

  // Búsqueda de clientes en el servidor (todos los clientes activos, con debounce)
  useEffect(() => {
    if (!open || clienteMode !== "existing") return

    const trimmed = searchQuery.trim()
    if (!trimmed) {
      setClientesBusqueda([])
      return
    }

    const timer = setTimeout(async () => {
      setIsLoadingClientes(true)
      try {
        const resultados = await searchClientes(trimmed, 100)
        setClientesBusqueda(resultados)
      } catch (error) {
        console.error("Error buscando clientes:", error)
        setClientesBusqueda([])
        toast.error("Error al buscar clientes")
      } finally {
        setIsLoadingClientes(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [open, clienteMode, searchQuery])

  useEffect(() => {
    async function loadData() {
      if (!open) return
      
      try {
        setIsLoadingServicios(true)
        setIsLoadingEmpleados(true)
        setErrorServicios(null)
        
        const [serviciosData, empleadosData] = await Promise.all([
          getServiciosActivosFromDB(),
          getEmpleadosBySucursalFromDB(sucursalId),
        ])
        
        setServicios(serviciosData)
        setEmpleados(empleadosData)
        
        if (serviciosData.length === 0) {
          setErrorServicios("No hay servicios disponibles en la base de datos")
        }
      } catch (error) {
        console.error("Error cargando datos:", error)
        setErrorServicios("Error al cargar los servicios")
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
    setIsSubmitting(true)

    try {
      let clienteIdFinal = selectedClienteId

      // Si es nuevo cliente, crearlo primero
      if (clienteMode === "new") {
        if (!nuevoCliente.nombre || !nuevoCliente.apellido || !nuevoCliente.telefono) {
          toast.error("Por favor completa todos los campos obligatorios del cliente")
          setIsSubmitting(false)
          return
        }

        const clienteResult = await createCliente({
          nombre: nuevoCliente.nombre,
          apellido: nuevoCliente.apellido,
          telefono: nuevoCliente.telefono,
          email: nuevoCliente.email || undefined,
          notas: nuevoCliente.notas || undefined,
        })

        if (!clienteResult.success || !clienteResult.cliente) {
          toast.error(`Error al crear cliente: ${clienteResult.error || "Error desconocido"}`)
          setIsSubmitting(false)
          return
        }

        clienteIdFinal = clienteResult.cliente.id
        toast.success("Cliente creado exitosamente")
      }

      // Validar que se haya seleccionado un cliente
      if (!clienteIdFinal) {
        toast.error("Por favor selecciona o crea un cliente")
        setIsSubmitting(false)
        return
      }

      // Validar campos de la cita
      if (!citaForm.servicioId || !citaForm.empleadoId || !citaForm.fecha || !citaForm.horaInicio) {
        toast.error("Por favor completa todos los campos obligatorios de la cita")
        setIsSubmitting(false)
        return
      }

      if (!servicioSeleccionado) {
        toast.error("Servicio no encontrado")
        setIsSubmitting(false)
        return
      }

      // Obtener información del cliente y empleado para mostrar en el resumen
      const clienteSeleccionado = clienteMode === "new" 
        ? { nombre: nuevoCliente.nombre, apellido: nuevoCliente.apellido }
        : selectedCliente?.id === clienteIdFinal ? selectedCliente : null
      const empleadoSeleccionado = empleados.find(e => e.id === citaForm.empleadoId)

      // Mostrar resumen antes de guardar
      const resumenCita = {
        cliente: clienteSeleccionado ? `${clienteSeleccionado.nombre} ${clienteSeleccionado.apellido}` : "N/A",
        servicio: servicioSeleccionado.nombre,
        empleado: empleadoSeleccionado ? `${empleadoSeleccionado.nombre} ${empleadoSeleccionado.apellido}` : "N/A",
        fecha: new Date(citaForm.fecha).toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
        hora: citaForm.horaInicio,
        duracion: servicioSeleccionado.duracion,
        precio: servicioSeleccionado.precio,
      }

      // Mostrar toast con información de lo que se está guardando
      toast.info(
        `Guardando cita: ${resumenCita.cliente} - ${resumenCita.servicio} - ${resumenCita.fecha} ${resumenCita.hora}`,
        { duration: 2000 }
      )

      // Crear la cita
      const citaResult = await createCita({
        cliente_id: clienteIdFinal,
        empleado_id: citaForm.empleadoId,
        servicio_id: citaForm.servicioId,
        sucursal_id: sucursalId,
        fecha: citaForm.fecha,
        hora_inicio: citaForm.horaInicio,
        duracion: servicioSeleccionado.duracion,
        precio: servicioSeleccionado.precio,
        estado: "pendiente",
        notas: citaForm.notas || undefined,
      })

      if (!citaResult.success) {
        toast.error(`Error al crear cita: ${citaResult.error || "Error desconocido"}`)
        setIsSubmitting(false)
        return
      }

      // Mostrar resumen de la cita creada
      toast.success(
        `Cita creada exitosamente: ${resumenCita.cliente} - ${resumenCita.servicio} - ${resumenCita.fecha} ${resumenCita.hora}`,
        { duration: 4000 }
      )

      onCitaCreada?.()
      onOpenChange(false)

      // Resetear formulario
      setNuevoCliente({
        nombre: "",
        apellido: "",
        email: "",
        telefono: "",
        notas: "",
      })
      setCitaForm({
        servicioId: "",
        empleadoId: selectedEmpleadoId || "",
        fecha: selectedDate,
        horaInicio: selectedTime || "",
        notas: "",
      })
      setSelectedClienteId("")
      setClienteMode("existing")
      setSearchQuery("")
    } catch (error: any) {
      console.error("Error inesperado:", error)
      toast.error("Error inesperado al crear la cita")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>Nueva Cita</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6">
            <div className="space-y-6 pb-6">
              {/* Sección de Cliente */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">Cliente</Label>
                <Tabs value={clienteMode} onValueChange={(v) => setClienteMode(v as "existing" | "new")}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="existing">Cliente Existente</TabsTrigger>
                    <TabsTrigger value="new">Nuevo Cliente</TabsTrigger>
                  </TabsList>

                  <TabsContent value="existing" className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar cliente por nombre, email o teléfono..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <ScrollArea className="h-[200px] border rounded-md">
                      <div className="p-2 space-y-1">
                        {isLoadingClientes ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                          </div>
                        ) : searchQuery.trim() === "" ? (
                          <p className="p-4 text-sm text-muted-foreground text-center">
                            Escribe nombre, email o teléfono para buscar entre todos los clientes
                          </p>
                        ) : clientesBusqueda.length === 0 ? (
                          <p className="p-4 text-sm text-muted-foreground text-center">
                            No se encontraron clientes. Prueba con otro término.
                          </p>
                        ) : (
                          clientesBusqueda.map((cliente) => (
                          <button
                            key={cliente.id}
                            type="button"
                            onClick={() => {
                          setSelectedClienteId(cliente.id)
                          setSelectedCliente(cliente)
                        }}
                            className={`w-full text-left p-3 rounded-md hover:bg-accent transition-colors ${
                              selectedClienteId === cliente.id ? "bg-accent" : ""
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <User className="h-5 w-5 text-primary" />
                              </div>
                              <div className="flex-1">
                                <p className="font-medium">
                                  {cliente.nombre} {cliente.apellido}
                                </p>
                                {cliente.email && (
                                  <p className="text-sm text-muted-foreground">{cliente.email}</p>
                                )}
                                <p className="text-xs text-muted-foreground">{cliente.telefono}</p>
                              </div>
                            </div>
                          </button>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="new" className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="nombre">Nombre *</Label>
                        <Input
                          id="nombre"
                          required
                          value={nuevoCliente.nombre}
                          onChange={(e) => setNuevoCliente({ ...nuevoCliente, nombre: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="apellido">Apellido *</Label>
                        <Input
                          id="apellido"
                          required
                          value={nuevoCliente.apellido}
                          onChange={(e) => setNuevoCliente({ ...nuevoCliente, apellido: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={nuevoCliente.email}
                        onChange={(e) => setNuevoCliente({ ...nuevoCliente, email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="telefono">Teléfono *</Label>
                      <Input
                        id="telefono"
                        type="tel"
                        required
                        value={nuevoCliente.telefono}
                        onChange={(e) => setNuevoCliente({ ...nuevoCliente, telefono: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notasCliente">Notas del Cliente</Label>
                      <Textarea
                        id="notasCliente"
                        placeholder="Alergias, preferencias, etc."
                        value={nuevoCliente.notas}
                        onChange={(e) => setNuevoCliente({ ...nuevoCliente, notas: e.target.value })}
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Sección de Cita */}
              <div className="space-y-4 pt-4 border-t">
                <Label className="text-base font-semibold">Detalles de la Cita</Label>

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
                  ) : errorServicios ? (
                    <div className="p-3 border border-destructive/50 rounded-md bg-destructive/10">
                      <p className="text-sm text-destructive">{errorServicios}</p>
                    </div>
                  ) : servicios.length === 0 ? (
                    <div className="p-3 border border-yellow-500/50 rounded-md bg-yellow-500/10">
                      <p className="text-sm text-yellow-700 dark:text-yellow-400">
                        No hay servicios disponibles. Por favor, agrega servicios en la sección de Servicios.
                      </p>
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
                  {servicioSeleccionado && (
                    <div className="p-3 bg-muted/50 rounded-md border">
                      <p className="text-sm font-medium">Servicio seleccionado:</p>
                      <p className="text-sm text-muted-foreground">
                        {servicioSeleccionado.nombre} - ${servicioSeleccionado.precio} ({servicioSeleccionado.duracion} minutos)
                      </p>
                      {servicioSeleccionado.descripcion && (
                        <p className="text-xs text-muted-foreground mt-1">{servicioSeleccionado.descripcion}</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="empleado">Empleada *</Label>
                  {isLoadingEmpleados ? (
                    <div className="flex items-center gap-2 p-3 border rounded-md">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Cargando empleadas...</span>
                    </div>
                  ) : empleados.length === 0 ? (
                    <div className="p-3 border border-yellow-500/50 rounded-md bg-yellow-500/10">
                      <p className="text-sm text-yellow-700 dark:text-yellow-400">
                        No hay empleadas disponibles para esta sucursal.
                      </p>
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
                            {empleado.nombre} {empleado.apellido} - {empleado.especialidades && empleado.especialidades.length > 0 ? empleado.especialidades.join(", ") : empleado.rol}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {citaForm.empleadoId && (
                    <div className="p-3 bg-muted/50 rounded-md border">
                      <p className="text-sm font-medium">Empleada seleccionada:</p>
                      <p className="text-sm text-muted-foreground">
                        {empleados.find(e => e.id === citaForm.empleadoId)?.nombre} {empleados.find(e => e.id === citaForm.empleadoId)?.apellido}
                      </p>
                    </div>
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

              {/* Resumen de la cita antes de guardar */}
              {citaForm.servicioId && citaForm.empleadoId && (selectedClienteId || clienteMode === "new") && (
                <div className="pt-4 border-t space-y-2">
                  <Label className="text-base font-semibold">Resumen de la Cita</Label>
                  <div className="p-4 bg-primary/5 rounded-md border border-primary/20">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cliente:</span>
                        <span className="font-medium">
                          {clienteMode === "new" 
                            ? `${nuevoCliente.nombre} ${nuevoCliente.apellido} (nuevo)`
                            : selectedCliente?.id === selectedClienteId 
                              ? `${selectedCliente.nombre} ${selectedCliente.apellido}`
                              : "No seleccionado"}
                        </span>
                      </div>
                      {servicioSeleccionado && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Servicio:</span>
                            <span className="font-medium">{servicioSeleccionado.nombre}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Duración:</span>
                            <span className="font-medium">{servicioSeleccionado.duracion} minutos</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Precio:</span>
                            <span className="font-medium">${servicioSeleccionado.precio}</span>
                          </div>
                        </>
                      )}
                      {empleados.find(e => e.id === citaForm.empleadoId) && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Empleada:</span>
                          <span className="font-medium">
                            {empleados.find(e => e.id === citaForm.empleadoId)!.nombre} {empleados.find(e => e.id === citaForm.empleadoId)!.apellido}
                          </span>
                        </div>
                      )}
                      {citaForm.fecha && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Fecha:</span>
                          <span className="font-medium">
                            {new Date(citaForm.fecha).toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                          </span>
                        </div>
                      )}
                      {citaForm.horaInicio && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Hora:</span>
                          <span className="font-medium">{citaForm.horaInicio}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
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
                  Creando...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Cita
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
