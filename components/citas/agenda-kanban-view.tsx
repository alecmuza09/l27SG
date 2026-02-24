"use client"

import type React from "react"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Clock, User, DollarSign, ChevronLeft, ChevronRight, CalendarIcon, MapPin, Plus, Palmtree, Loader2, Edit, MoreVertical, UtensilsCrossed, BedDouble, X, ShoppingBag } from "lucide-react"
import { getCitasByDateAndSucursalFromDB, getCitasByEmpleadoAndDateFromDB, type Cita } from "@/lib/data/citas"
import { getEmpleadosBySucursalFromDB, type Empleado } from "@/lib/data/empleados"
import { getSucursalesActivasFromDB, type Sucursal } from "@/lib/data/sucursales"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { updateCitaEstado } from "@/lib/data/citas"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { NuevaCitaDialog } from "./nueva-cita-dialog"
import { EditarCitaDialog } from "./editar-cita-dialog"
import { CajaDialog } from "./caja-dialog"
import { getVacaciones } from "@/lib/data/vacaciones"
import type { Vacacion } from "@/lib/types/vacaciones"
import { getCurrentUser, type User } from "@/lib/auth"
import { getSucursalByIdFromDB } from "@/lib/data/sucursales"

interface AgendaKanbanViewProps {
  selectedDate: string
  onDateChange: (date: string) => void
  /** Sucursal seleccionada (desde la página). Si se pasa, la agenda usa esta y notifica cambios para que el diálogo "Nueva Cita" use la misma. */
  selectedSucursal?: string
  onSucursalChange?: (sucursalId: string) => void
  /** Incrementar para forzar recarga de citas (ej. después de crear una) */
  refreshCitasKey?: number
}

// Estados permitidos en la base de datos
const ESTADOS_DB = {
  "pendiente": "pendiente",
  "confirmado": "confirmada",
  "en-espera": "en-progreso", // Mapeado a en-progreso
  "en-atencion": "en-progreso",
  "pendiente-por-pagar": "completada", // Mapeado a completada
  "pagado": "completada",
  "cancelado": "cancelada",
} as const

// Estados para mostrar en la UI
const ESTADOS = [
  { value: "pendiente", label: "Pendiente", color: "bg-yellow-500", dbValue: "pendiente" },
  { value: "confirmado", label: "Confirmado", color: "bg-blue-500", dbValue: "confirmada" },
  { value: "en-espera", label: "En Espera", color: "bg-orange-500", dbValue: "en-progreso" },
  { value: "en-atencion", label: "En Atención", color: "bg-purple-500", dbValue: "en-progreso" },
  { value: "pendiente-por-pagar", label: "Pendiente por Pagar", color: "bg-amber-500", dbValue: "completada" },
  { value: "pagado", label: "Pagado", color: "bg-green-500", dbValue: "completada" },
  { value: "cancelado", label: "Cancelado", color: "bg-red-500", dbValue: "cancelada" },
]

// Función para mapear estado de UI a estado de BD
function mapearEstadoAUI(estadoDB: string): string {
  const estado = ESTADOS.find(e => e.dbValue === estadoDB)
  return estado?.value || estadoDB
}

// Función para mapear estado de UI a estado de BD
function mapearEstadoABD(estadoUI: string): string {
  return ESTADOS_DB[estadoUI as keyof typeof ESTADOS_DB] || estadoUI
}

// Bloque manual de comida o descanso en la agenda (se guarda en localStorage por fecha)
interface BloqueAgenda {
  id: string
  empleadoId: string
  tipo: 'comida' | 'descanso'
  horaInicio?: string  // solo para tipo 'comida'
  horaFin?: string     // solo para tipo 'comida'
}

const TIME_SLOTS = Array.from({ length: 23 }, (_, i) => {
  const hour = Math.floor(i / 2) + 9
  const minutes = i % 2 === 0 ? "00" : "30"
  return `${hour.toString().padStart(2, "0")}:${minutes}`
})

export function AgendaKanbanView({ selectedDate, onDateChange, selectedSucursal: selectedSucursalProp, onSucursalChange, refreshCitasKey }: AgendaKanbanViewProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [selectedSucursalState, setSelectedSucursalState] = useState<string>("")
  const isControlledSucursal = selectedSucursalProp !== undefined && onSucursalChange !== undefined
  const selectedSucursal = isControlledSucursal ? selectedSucursalProp : selectedSucursalState
  const setSelectedSucursal = isControlledSucursal ? onSucursalChange : setSelectedSucursalState
  const [draggedCita, setDraggedCita] = useState<Cita | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<{ time: string; empleadoId: string } | null>(null)
  const [vacaciones, setVacaciones] = useState<Vacacion[]>([])
  const [empleadosSucursal, setEmpleadosSucursal] = useState<Empleado[]>([])
  const [citas, setCitas] = useState<Cita[]>([])
  const [isLoadingCitas, setIsLoadingCitas] = useState(false)
  const [editingCita, setEditingCita] = useState<Cita | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [cajaCita, setCajaCita] = useState<Cita | null>(null)
  const [isCajaOpen, setIsCajaOpen] = useState(false)
  // Bloques manuales (comida / descanso) — guardados en localStorage por fecha
  const [bloquesAgenda, setBloquesAgenda] = useState<BloqueAgenda[]>([])
  const [isBloquesOpen, setIsBloquesOpen] = useState(false)
  const [nuevoBloque, setNuevoBloque] = useState<{ empleadoId: string; tipo: 'comida' | 'descanso'; horaInicio: string; horaFin: string }>({
    empleadoId: '',
    tipo: 'comida',
    horaInicio: '13:00',
    horaFin: '14:00',
  })

  // Calcular isAdmin de forma segura (siempre definido)
  const isAdmin: boolean = Boolean(currentUser?.role === 'admin')
  const userSucursalId = currentUser?.sucursalId

  useEffect(() => {
    const user = getCurrentUser()
    setCurrentUser(user)
  }, [])

  useEffect(() => {
    setVacaciones(getVacaciones())
  }, [])

  useEffect(() => {
    async function loadSucursales() {
      if (isAdmin) {
        const sucursalesData = await getSucursalesActivasFromDB()
        setSucursales(sucursalesData)
        if (sucursalesData.length > 0 && !isControlledSucursal && !selectedSucursalState) {
          setSelectedSucursalState(sucursalesData[0].id)
        }
      } else if (userSucursalId) {
        const sucursal = await getSucursalByIdFromDB(userSucursalId)
        if (sucursal) {
          setSucursales([sucursal])
          if (onSucursalChange) onSucursalChange(userSucursalId)
          else setSelectedSucursalState(userSucursalId)
        }
      }
    }
    if (currentUser) {
      loadSucursales()
    }
  }, [currentUser, isAdmin, userSucursalId])

  useEffect(() => {
    async function loadEmpleados() {
      if (selectedSucursal) {
        const empleados = await getEmpleadosBySucursalFromDB(selectedSucursal)
        setEmpleadosSucursal(empleados)
      }
    }
    loadEmpleados()
  }, [selectedSucursal])

  useEffect(() => {
    async function loadCitas() {
      if (selectedSucursal && selectedDate) {
        setIsLoadingCitas(true)
        try {
          const citasData = await getCitasByDateAndSucursalFromDB(selectedDate, selectedSucursal)
          setCitas(citasData)
        } catch (error) {
          console.error('Error cargando citas:', error)
          toast.error('Error al cargar las citas')
        } finally {
          setIsLoadingCitas(false)
        }
      }
    }
    loadCitas()
  }, [selectedSucursal, selectedDate, refreshCitasKey])

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

  const empleadosEnDescansoHoy = useMemo(() => {
    return empleadosSucursal.filter(
      (emp) =>
        !isEmpleadoDeVacaciones(emp.id, selectedDate) &&
        bloquesAgenda.some((b) => b.empleadoId === emp.id && b.tipo === 'descanso')
    )
  }, [empleadosSucursal, selectedDate, vacaciones, bloquesAgenda])

  const empleadosDisponibles = useMemo(() => {
    return empleadosSucursal.filter(
      (emp) =>
        !isEmpleadoDeVacaciones(emp.id, selectedDate) &&
        !bloquesAgenda.some((b) => b.empleadoId === emp.id && b.tipo === 'descanso')
    )
  }, [empleadosSucursal, selectedDate, vacaciones, bloquesAgenda])

  // Cargar bloques del día desde localStorage cuando cambia la fecha
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`bloques_agenda_${selectedDate}`)
      setBloquesAgenda(stored ? JSON.parse(stored) : [])
    } catch {
      setBloquesAgenda([])
    }
  }, [selectedDate])

  const citasFiltradas = useMemo(
    () => citas.filter((c) => c.fecha === selectedDate && c.sucursalId === selectedSucursal),
    [citas, selectedDate, selectedSucursal],
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

  const navigateDate = (direction: "prev" | "next" | "today") => {
    if (direction === "today") {
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      onDateChange(`${year}-${month}-${day}`)
    } else {
      // Parsear la fecha correctamente para evitar problemas de zona horaria
      const [year, month, day] = selectedDate.split('-').map(Number)
      const date = new Date(year, month - 1, day)
      date.setDate(date.getDate() + (direction === "next" ? 1 : -1))
      const newYear = date.getFullYear()
      const newMonth = String(date.getMonth() + 1).padStart(2, '0')
      const newDay = String(date.getDate()).padStart(2, '0')
      onDateChange(`${newYear}-${newMonth}-${newDay}`)
    }
  }

  // Estado para la hora actual
  const [currentTime, setCurrentTime] = useState<string>("")
  const [isToday, setIsToday] = useState(false)

  useEffect(() => {
    const updateCurrentTime = () => {
      const now = new Date()
      const hours = String(now.getHours()).padStart(2, '0')
      const minutes = String(now.getMinutes()).padStart(2, '0')
      setCurrentTime(`${hours}:${minutes}`)
      
      // Verificar si la fecha seleccionada es hoy
      const today = new Date()
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      setIsToday(selectedDate === todayStr)
    }

    updateCurrentTime()
    const interval = setInterval(updateCurrentTime, 60000) // Actualizar cada minuto

    return () => clearInterval(interval)
  }, [selectedDate])

  const formatDate = (dateStr: string) => {
    // Parsear la fecha correctamente para evitar problemas de zona horaria
    // La fecha viene en formato YYYY-MM-DD, agregamos hora local para evitar conversión UTC
    const [year, month, day] = dateStr.split('-').map(Number)
    const date = new Date(year, month - 1, day)
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

  const handleCitaCreated = async () => {
    // Recargar citas después de crear una nueva
    if (selectedSucursal && selectedDate) {
      setIsLoadingCitas(true)
      try {
        const citasData = await getCitasByDateAndSucursalFromDB(selectedDate, selectedSucursal)
        setCitas(citasData)
        // Pequeño delay para asegurar que el estado se actualice
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error) {
        console.error('Error recargando citas:', error)
      } finally {
        setIsLoadingCitas(false)
      }
    }
  }

  const handleCambiarEstado = async (citaId: string, nuevoEstadoUI: string) => {
    try {
      const estadoDB = mapearEstadoABD(nuevoEstadoUI) as 'pendiente' | 'confirmada' | 'en-progreso' | 'completada' | 'cancelada' | 'no-asistio'
      // Usar campo "pagado" para diferenciar "pagado" de "pendiente-por-pagar"
      const pagado = nuevoEstadoUI === 'pagado' ? true : nuevoEstadoUI === 'pendiente-por-pagar' ? false : undefined
      const result = await updateCitaEstado(citaId, estadoDB, pagado)
      if (result.success) {
        toast.success(`Estado cambiado a: ${ESTADOS.find(e => e.value === nuevoEstadoUI)?.label}`)
        await handleCitaCreated()
      } else {
        toast.error(`Error al cambiar estado: ${result.error}`)
      }
    } catch (error) {
      console.error('Error cambiando estado:', error)
      toast.error('Error al cambiar el estado de la cita')
    }
  }

  // Determinar el estado UI real de una cita usando tanto "estado" como el campo "pagado"
  const getEstadoUI = (cita: Cita): string => {
    if (cita.estado === 'completada') return cita.pagado ? 'pagado' : 'pendiente-por-pagar'
    return ESTADOS.find(e => e.dbValue === cita.estado)?.value || cita.estado
  }

  const saveBloques = (bloques: BloqueAgenda[]) => {
    setBloquesAgenda(bloques)
    try {
      localStorage.setItem(`bloques_agenda_${selectedDate}`, JSON.stringify(bloques))
    } catch { /* localStorage lleno o no disponible */ }
  }

  const handleAgregarBloque = () => {
    if (!nuevoBloque.empleadoId) { toast.error('Selecciona una empleada'); return }
    if (nuevoBloque.tipo === 'comida' && (!nuevoBloque.horaInicio || !nuevoBloque.horaFin)) {
      toast.error('Indica la hora de inicio y fin de la comida'); return
    }
    if (nuevoBloque.tipo === 'comida' && nuevoBloque.horaFin <= nuevoBloque.horaInicio) {
      toast.error('La hora de fin debe ser después de la de inicio'); return
    }
    const bloque: BloqueAgenda = {
      id: Math.random().toString(36).slice(2),
      empleadoId: nuevoBloque.empleadoId,
      tipo: nuevoBloque.tipo,
      horaInicio: nuevoBloque.tipo === 'comida' ? nuevoBloque.horaInicio : undefined,
      horaFin: nuevoBloque.tipo === 'comida' ? nuevoBloque.horaFin : undefined,
    }
    saveBloques([...bloquesAgenda, bloque])
    toast.success(nuevoBloque.tipo === 'comida' ? 'Hora de comida marcada' : 'Día de descanso marcado')
    // Resetear selección de empleada para facilitar agregar otro bloque
    setNuevoBloque((prev) => ({ ...prev, empleadoId: '' }))
  }

  const handleEliminarBloque = (id: string) => {
    saveBloques(bloquesAgenda.filter((b) => b.id !== id))
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
            {isToday && currentTime && (
              <Badge variant="outline" className="ml-2 text-xs">
                {currentTime}
              </Badge>
            )}
          </div>
          <Button variant="outline" size="icon" onClick={() => navigateDate("next")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button 
            variant={isToday ? "default" : "outline"} 
            size="sm" 
            onClick={() => navigateDate("today")}
            className="ml-2"
          >
            Hoy
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsBloquesOpen(true)}
            className="ml-2"
            title="Marcar comidas y descansos del día"
          >
            <UtensilsCrossed className="h-4 w-4 mr-2" />
            Comidas y descansos
            {bloquesAgenda.length > 0 && (
              <Badge className="ml-2 h-5 min-w-5 px-1 text-xs" variant="secondary">
                {bloquesAgenda.length}
              </Badge>
            )}
          </Button>
        </div>

        {isAdmin && (
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
        )}
        {!isAdmin && sucursales.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-muted/50">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{sucursales[0]?.nombre}</span>
          </div>
        )}
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

      {/* Vista Timeline por empleada */}
      <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Agenda por Empleada
                {empleadosDeVacacionesHoy.length > 0 && (
                  <Badge variant="outline" className="ml-2 text-amber-600 border-amber-300">
                    {empleadosDeVacacionesHoy.length} de vacaciones
                  </Badge>
                )}
                {empleadosEnDescansoHoy.length > 0 && (
                  <Badge variant="outline" className="ml-2 text-slate-600 border-slate-300">
                    {empleadosEnDescansoHoy.length} descanso
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingCitas ? (
                <div className="flex items-center justify-center h-[600px]">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Cargando citas...</p>
                  </div>
                </div>
              ) : (
                <div className="h-[620px] overflow-y-auto overflow-x-auto relative">
                  <div
                    className="grid gap-1.5"
                    style={{
                      gridTemplateColumns: `repeat(${[...empleadosDisponibles, ...empleadosEnDescansoHoy, ...empleadosDeVacacionesHoy].length || 1}, minmax(155px, 1fr))`,
                      minWidth: `${[...empleadosDisponibles, ...empleadosEnDescansoHoy, ...empleadosDeVacacionesHoy].length * 155}px`,
                    }}
                  >
                    {[...empleadosDisponibles, ...empleadosEnDescansoHoy, ...empleadosDeVacacionesHoy].map((empleado) => {
                      const citasEmpleado = citasFiltradas.filter((c) => c.empleadoId === empleado.id)
                      const vacacionEmpleado = isEmpleadoDeVacaciones(empleado.id, selectedDate)
                      const descansoHoy = bloquesAgenda.some((b) => b.empleadoId === empleado.id && b.tipo === 'descanso')
                      const noDisponible = vacacionEmpleado || descansoHoy

                    return (
                      <div key={empleado.id} className={cn("space-y-1", noDisponible && "opacity-60")}>
                        {/* Encabezado compacto de empleada */}
                        <div
                          className={cn(
                            "flex items-center gap-1.5 pb-1.5 border-b sticky top-0 bg-background z-10",
                            vacacionEmpleado && "bg-amber-50 rounded-t-md px-1.5 pt-1.5",
                            descansoHoy && "bg-slate-100 dark:bg-slate-800 rounded-t-md px-1.5 pt-1.5",
                          )}
                        >
                          <div
                            className={cn(
                              "h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0",
                              vacacionEmpleado && "bg-amber-200",
                              descansoHoy && "bg-slate-300 dark:bg-slate-600",
                              !noDisponible && "bg-primary/10",
                            )}
                          >
                            {vacacionEmpleado ? (
                              <Palmtree className="h-3.5 w-3.5 text-amber-600" />
                            ) : descansoHoy ? (
                              <UtensilsCrossed className="h-3.5 w-3.5 text-slate-500" />
                            ) : (
                              <User className="h-3.5 w-3.5 text-primary" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-xs truncate leading-tight">
                              {empleado.nombre} {empleado.apellido}
                            </p>
                            {vacacionEmpleado ? (
                              <p className="text-[10px] text-amber-600 font-medium leading-tight">Vacaciones</p>
                            ) : descansoHoy ? (
                              <p className="text-[10px] text-slate-500 leading-tight">Descanso</p>
                            ) : (
                              <p className="text-[10px] text-muted-foreground leading-tight">
                                {empleado.horarioInicio} - {empleado.horarioFin}
                              </p>
                            )}
                          </div>
                          {!noDisponible && (
                            <Badge variant="outline" className="flex-shrink-0 text-[10px] px-1 py-0 h-4">
                              {citasEmpleado.length}
                            </Badge>
                          )}
                        </div>

                        {vacacionEmpleado ? (
                          <div className="flex items-center justify-center h-24 bg-amber-50 rounded-lg border border-amber-200">
                            <div className="text-center">
                              <Palmtree className="h-6 w-6 text-amber-400 mx-auto mb-1" />
                              <p className="text-xs text-amber-600 font-medium">De vacaciones</p>
                              <p className="text-[10px] text-amber-500">
                                {new Date(vacacionEmpleado.fechaInicio).toLocaleDateString("es-MX")} –{" "}
                                {new Date(vacacionEmpleado.fechaFin).toLocaleDateString("es-MX")}
                              </p>
                            </div>
                          </div>
                        ) : descansoHoy ? (
                          <div className="flex items-center justify-center h-24 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                            <div className="text-center">
                              <UtensilsCrossed className="h-6 w-6 text-slate-400 mx-auto mb-1" />
                              <p className="text-xs text-slate-600 dark:text-slate-400">Día de descanso</p>
                            </div>
                          </div>
                        ) : (
                          /* Timeline de 30 minutos */
                          <div className="space-y-0.5 relative">
                            {TIME_SLOTS.map((slot, slotIndex) => {
                              const [hour, minutes] = slot.split(":")
                              const slotTime = `${hour}:${minutes}`
                              
                              const normalizarHora = (hora: string): string => {
                                if (!hora) return ''
                                return hora.substring(0, 5)
                              }
                              // Buscar si algún bloque de comida de esta empleada cubre este slot
                              const bloqueComida = bloquesAgenda.find(
                                (b) =>
                                  b.empleadoId === empleado.id &&
                                  b.tipo === 'comida' &&
                                  b.horaInicio &&
                                  b.horaFin &&
                                  slotTime >= b.horaInicio.substring(0, 5) &&
                                  slotTime < b.horaFin.substring(0, 5)
                              )
                              const isComida = !!bloqueComida
                              
                              // Buscar citas que empiecen exactamente en este slot
                              const cita = citasEmpleado.find((c) => {
                                const horaInicioNormalizada = normalizarHora(c.horaInicio)
                                return horaInicioNormalizada === slotTime
                              })
                              
                              // Verificar si este slot está ocupado por una cita que empezó antes
                              const citaQueOcupaEsteSlot = citasEmpleado.find((c) => {
                                const horaInicio = normalizarHora(c.horaInicio)
                                const horaFin = normalizarHora(c.horaFin)
                                return slotTime >= horaInicio && slotTime < horaFin
                              })
                              
                              const isInRange =
                                slotTime >= empleado.horarioInicio &&
                                slotTime < empleado.horarioFin &&
                                !isComida
                              
                              // Calcular cuántos slots ocupa la cita (cada slot es 30 minutos)
                              const calcularSlotsOcupados = (cita: Cita): number => {
                                return Math.ceil(cita.duracion / 30)
                              }
                              
                              // Solo mostrar la cita en el slot donde empieza
                              const mostrarCita = cita && normalizarHora(cita.horaInicio) === slotTime

                              const slotTieneCita = mostrarCita && !!cita
                              const alturaCita = slotTieneCita ? Math.max(calcularSlotsOcupados(cita!) * 32 + (calcularSlotsOcupados(cita!) - 1) * 2, 76) : 32
                              return (
                                <div key={slot} className="flex gap-1 relative">
                                  <div className="text-[10px] text-muted-foreground py-1 w-9 flex-shrink-0 leading-tight">{slot}</div>
                                  <div
                                    className={cn(
                                      "flex-1 border-l border-border pl-1 cursor-pointer hover:bg-accent/50 transition-colors relative",
                                      !slotTieneCita && "min-h-[32px]",
                                      (!isInRange || isComida) && "bg-muted/30 cursor-not-allowed",
                                      isComida && "bg-orange-50 dark:bg-orange-950/20",
                                      (cita || citaQueOcupaEsteSlot) && "cursor-default bg-primary/5",
                                    )}
                                    style={slotTieneCita ? { minHeight: `${alturaCita}px` } : undefined}
                                    onClick={() => !cita && !citaQueOcupaEsteSlot && isInRange && handleSlotClick(slotTime, empleado.id, true)}
                                  >
                                    {mostrarCita && cita ? (
                                      <Card
                                        className="cursor-move hover:shadow-md transition-shadow absolute inset-0 z-10 border border-border bg-card shadow-sm rounded-md overflow-visible"
                                        draggable
                                        onDragStart={() => handleDragStart(cita)}
                                        onClick={(e) => e.stopPropagation()}
                                        style={{ minHeight: `${alturaCita}px` }}
                                      >
                                        <CardContent className="p-1.5 h-full flex flex-col gap-0.5 min-h-0 overflow-visible">
                                          <div className="flex items-center justify-between gap-0.5 shrink-0">
                                            <Badge
                                              className={cn(
                                                "text-[9px] px-1 py-0 shrink-0 leading-tight",
                                                ESTADOS.find((e) => e.value === getEstadoUI(cita))?.color || "bg-gray-500",
                                              )}
                                            >
                                              {ESTADOS.find((e) => e.value === getEstadoUI(cita))?.label || cita.estado}
                                            </Badge>
                                            <DropdownMenu>
                                              <DropdownMenuTrigger asChild>
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  className="h-5 w-5 shrink-0"
                                                  onClick={(e) => e.stopPropagation()}
                                                >
                                                  <MoreVertical className="h-2.5 w-2.5" />
                                                </Button>
                                              </DropdownMenuTrigger>
                                              <DropdownMenuContent align="end" className="z-50" onClick={(e) => e.stopPropagation()}>
                                                <DropdownMenuItem
                                                  onSelect={() => {
                                                    setEditingCita(cita)
                                                    setIsEditDialogOpen(true)
                                                  }}
                                                >
                                                  <Edit className="h-4 w-4 mr-2" />
                                                  Editar Cita
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                  onSelect={() => {
                                                    setCajaCita(cita)
                                                    setIsCajaOpen(true)
                                                  }}
                                                  className="text-emerald-700 focus:text-emerald-700 focus:bg-emerald-50"
                                                >
                                                  <ShoppingBag className="h-4 w-4 mr-2" />
                                                  Ir a Caja
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                                  Cambiar Estado:
                                                </div>
                                                {ESTADOS.map((estado) => {
                                                  const isCurrentState = getEstadoUI(cita) === estado.value
                                                  return (
                                                    <DropdownMenuItem
                                                      key={estado.value}
                                                      onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleCambiarEstado(cita.id, estado.value)
                                                      }}
                                                      disabled={isCurrentState}
                                                      className={isCurrentState ? "bg-accent" : ""}
                                                    >
                                                      <div className={cn("h-2 w-2 rounded-full mr-2", estado.color)} />
                                                      {estado.label}
                                                    </DropdownMenuItem>
                                                  )
                                                })}
                                                </DropdownMenuContent>
                                              </DropdownMenu>
                                          </div>
                                          <div className="flex-1 min-h-[2rem] flex flex-col justify-center gap-0 min-w-0">
                                            <p className="font-semibold text-[11px] text-foreground leading-snug truncate" title={cita.clienteNombre}>
                                              {cita.clienteNombre}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground leading-snug truncate" title={cita.servicioNombre}>
                                              {cita.servicioNombre}
                                            </p>
                                          </div>
                                          <div className="flex items-center justify-between text-[10px] text-muted-foreground shrink-0 pt-0.5 border-t border-border/60">
                                            <span className="flex items-center gap-0.5">
                                              <Clock className="h-2.5 w-2.5 shrink-0" />
                                              {cita.horaInicio}–{cita.horaFin}
                                            </span>
                                            <span className="font-medium text-foreground">${cita.precio}</span>
                                          </div>
                                        </CardContent>
                                      </Card>
                                    ) : citaQueOcupaEsteSlot ? (
                                      <div className="absolute inset-0 bg-primary/5 z-0" />
                                    ) : isComida ? (
                                      <div className="flex items-center justify-center h-full min-h-[32px] text-[10px] text-orange-600 dark:text-orange-400">
                                        <UtensilsCrossed className="h-2.5 w-2.5 mr-0.5" />
                                        Comida
                                      </div>
                                    ) : (
                                      isInRange && (
                                        <div className="flex items-center justify-center h-full min-h-[32px] opacity-0 hover:opacity-100 transition-opacity">
                                          <Plus className="h-3 w-3 text-muted-foreground" />
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
                </div>
              )}
            </CardContent>
          </Card>
      </div>

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

      <Dialog open={isBloquesOpen} onOpenChange={setIsBloquesOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Comidas y descansos — {selectedDate.split('-').reverse().join('/')}</DialogTitle>
            <DialogDescription>
              Agrega manualmente los bloques de comida o descanso para el día. Se guardan automáticamente y puedes quitarlos cuando quieras.
            </DialogDescription>
          </DialogHeader>

          {/* Formulario para agregar nuevo bloque */}
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Empleada</Label>
              <Select
                value={nuevoBloque.empleadoId}
                onValueChange={(v) => setNuevoBloque((prev) => ({ ...prev, empleadoId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar empleada" />
                </SelectTrigger>
                <SelectContent>
                  {empleadosSucursal.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.nombre} {emp.apellido}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo de bloque</Label>
              <Select
                value={nuevoBloque.tipo}
                onValueChange={(v: 'comida' | 'descanso') => setNuevoBloque((prev) => ({ ...prev, tipo: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="comida">
                    <span className="flex items-center gap-2"><UtensilsCrossed className="h-4 w-4 text-orange-500" /> Comida (rango de horas)</span>
                  </SelectItem>
                  <SelectItem value="descanso">
                    <span className="flex items-center gap-2"><BedDouble className="h-4 w-4 text-slate-500" /> Día de descanso (todo el día)</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {nuevoBloque.tipo === 'comida' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="comida-inicio">Inicio</Label>
                  <Input
                    id="comida-inicio"
                    type="time"
                    value={nuevoBloque.horaInicio}
                    onChange={(e) => setNuevoBloque((prev) => ({ ...prev, horaInicio: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="comida-fin">Fin</Label>
                  <Input
                    id="comida-fin"
                    type="time"
                    value={nuevoBloque.horaFin}
                    onChange={(e) => setNuevoBloque((prev) => ({ ...prev, horaFin: e.target.value }))}
                  />
                </div>
              </div>
            )}

            <Button className="w-full" onClick={handleAgregarBloque}>
              <Plus className="mr-2 h-4 w-4" />
              Agregar bloque
            </Button>
          </div>

          {/* Lista de bloques activos para este día */}
          {bloquesAgenda.length > 0 && (
            <div className="space-y-2 border-t pt-4">
              <p className="text-sm font-medium text-muted-foreground">Bloques activos hoy</p>
              <div className="space-y-2">
                {bloquesAgenda.map((bloque) => {
                  const emp = empleadosSucursal.find((e) => e.id === bloque.empleadoId)
                  if (!emp) return null
                  return (
                    <div
                      key={bloque.id}
                      className={cn(
                        "flex items-center justify-between rounded-md border px-3 py-2",
                        bloque.tipo === 'comida'
                          ? "bg-orange-50 border-orange-200 dark:bg-orange-950/20"
                          : "bg-slate-50 border-slate-200 dark:bg-slate-800/50",
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {bloque.tipo === 'comida' ? (
                          <UtensilsCrossed className="h-4 w-4 text-orange-500 shrink-0" />
                        ) : (
                          <BedDouble className="h-4 w-4 text-slate-500 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{emp.nombre} {emp.apellido}</p>
                          <p className="text-xs text-muted-foreground">
                            {bloque.tipo === 'comida'
                              ? `Comida: ${bloque.horaInicio} – ${bloque.horaFin}`
                              : 'Día de descanso'}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleEliminarBloque(bloque.id)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2 border-t">
            <Button variant="outline" onClick={() => setIsBloquesOpen(false)}>
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <NuevaCitaDialog
        open={dialogOpen}
        onOpenChange={async (open) => {
          setDialogOpen(open)
          if (!open) {
            setSelectedSlot(null)
            await new Promise(resolve => setTimeout(resolve, 300))
            await handleCitaCreated()
          }
        }}
        selectedDate={selectedDate}
        selectedTime={selectedSlot?.time}
        selectedEmpleadoId={selectedSlot?.empleadoId}
        sucursalId={selectedSucursal}
      />

      <EditarCitaDialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open)
          if (!open) setEditingCita(null)
        }}
        cita={editingCita}
        sucursalId={selectedSucursal}
        onCitaUpdated={handleCitaCreated}
      />

      <CajaDialog
        open={isCajaOpen}
        onOpenChange={(open) => {
          setIsCajaOpen(open)
          if (!open) setCajaCita(null)
        }}
        cita={cajaCita}
        onPagoCobrado={handleCitaCreated}
      />
    </div>
  )
}
