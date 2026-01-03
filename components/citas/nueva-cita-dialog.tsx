"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getClientes, type Cliente } from "@/lib/data/clientes"
import { MOCK_SERVICIOS } from "@/lib/data/servicios"
import { MOCK_EMPLEADOS } from "@/lib/data/empleados"
import { Plus, Search, User } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"

interface NuevaCitaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedDate: string
  selectedTime?: string
  selectedEmpleadoId?: string
  sucursalId: string
}

export function NuevaCitaDialog({
  open,
  onOpenChange,
  selectedDate,
  selectedTime,
  selectedEmpleadoId,
  sucursalId,
}: NuevaCitaDialogProps) {
  const [clienteMode, setClienteMode] = useState<"existing" | "new">("existing")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedClienteId, setSelectedClienteId] = useState("")
  const [clientes, setClientes] = useState<Cliente[]>([])

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

  useEffect(() => {
    async function loadClientes() {
      const clientesData = await getClientes()
      setClientes(clientesData)
    }
    if (open) {
      loadClientes()
    }
  }, [open])

  const clientesFiltrados = clientes.filter(
    (c) =>
      c.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.apellido.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      c.telefono.includes(searchQuery),
  )

  const empleadosSucursal = MOCK_EMPLEADOS.filter((e) => e.sucursalId === sucursalId && e.activo)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (clienteMode === "new") {
      console.log("[v0] Creando nuevo cliente:", nuevoCliente)
      // Aquí iría la lógica para crear el cliente en la base de datos
    }

    console.log("[v0] Creando nueva cita:", {
      clienteId: clienteMode === "existing" ? selectedClienteId : "nuevo",
      ...citaForm,
    })

    // Aquí iría la lógica para crear la cita en la base de datos
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Nueva Cita</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6 pb-4">
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
                        {clientesFiltrados.map((cliente) => (
                          <button
                            key={cliente.id}
                            type="button"
                            onClick={() => setSelectedClienteId(cliente.id)}
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
                        ))}
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
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        required
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
                  <Select
                    value={citaForm.servicioId}
                    onValueChange={(value) => setCitaForm({ ...citaForm, servicioId: value })}
                    required
                  >
                    <SelectTrigger id="servicio">
                      <SelectValue placeholder="Seleccionar servicio" />
                    </SelectTrigger>
                    <SelectContent>
                      {MOCK_SERVICIOS.map((servicio) => (
                        <SelectItem key={servicio.id} value={servicio.id}>
                          {servicio.nombre} - ${servicio.precio} ({servicio.duracion} min)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="empleado">Empleada *</Label>
                  <Select
                    value={citaForm.empleadoId}
                    onValueChange={(value) => setCitaForm({ ...citaForm, empleadoId: value })}
                    required
                  >
                    <SelectTrigger id="empleado">
                      <SelectValue placeholder="Seleccionar empleada" />
                    </SelectTrigger>
                    <SelectContent>
                      {empleadosSucursal.map((empleado) => (
                        <SelectItem key={empleado.id} value={empleado.id}>
                          {empleado.nombre} {empleado.apellido} - {empleado.especialidades.join(", ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
          </ScrollArea>

          <DialogFooter className="pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">
              <Plus className="h-4 w-4 mr-2" />
              Crear Cita
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
