"use client"

import type React from "react"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Clock, User, DollarSign, ChevronLeft, ChevronRight, CalendarIcon, MapPin, Plus, Palmtree, Loader2, Edit, MoreVertical, UtensilsCrossed, BedDouble, X, ShoppingBag, Timer, UserX, CheckCircle, XCircle, FileText, Stethoscope, LogOut, AlertTriangle } from "lucide-react"
import { getCitasByDateAndSucursalFromDB, getCitasByEmpleadoAndDateFromDB, type Cita } from "@/lib/data/citas"
import { getEmpleadosBySucursalFromDB, type Empleado } from "@/lib/data/empleados"
import { getSucursalesActivasFromDB, type Sucursal } from "@/lib/data/sucursales"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { updateCitaEstado, updateCita } from "@/lib/data/citas"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { NuevaCitaDialog } from "./nueva-cita-dialog"
import { EditarCitaDialog } from "./editar-cita-dialog"
import { CajaDialog } from "./caja-dialog"
import { getVacaciones } from "@/lib/data/vacaciones"
import type { Vacacion } from "@/lib/types/vacaciones"
import { getCurrentUser, type User } from "@/lib/auth"
import { getSucursalByIdFromDB } from "@/lib/data/sucursales"
import {
  getAusenciasFromDB, createAusencia, aprobarAusencia, rechazarAusencia, cancelarAusencia,
  TIPO_AUSENCIA_LABELS, ESTATUS_AUSENCIA_COLORS, ESTATUS_AUSENCIA_LABELS, TIPO_AUSENCIA_COLORS,
  type Ausencia, type TipoAusencia,
} from "@/lib/data/ausencias"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"

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

// Estilos de tarjeta por estado
const ESTADO_CARD: Record<string, { bg: string; border: string; bar: string; text: string }> = {
  pendiente:            { bg: "bg-yellow-50 dark:bg-yellow-950/30",  border: "border-yellow-300 dark:border-yellow-700",  bar: "bg-yellow-400",  text: "text-yellow-800 dark:text-yellow-300" },
  confirmado:           { bg: "bg-blue-50 dark:bg-blue-950/30",      border: "border-blue-300 dark:border-blue-700",      bar: "bg-blue-400",    text: "text-blue-800 dark:text-blue-300" },
  "en-espera":          { bg: "bg-orange-50 dark:bg-orange-950/30",  border: "border-orange-300 dark:border-orange-700",  bar: "bg-orange-400",  text: "text-orange-800 dark:text-orange-300" },
  "en-atencion":        { bg: "bg-purple-50 dark:bg-purple-950/30",  border: "border-purple-300 dark:border-purple-700",  bar: "bg-purple-400",  text: "text-purple-800 dark:text-purple-300" },
  "pendiente-por-pagar":{ bg: "bg-amber-50 dark:bg-amber-950/30",    border: "border-amber-300 dark:border-amber-700",    bar: "bg-amber-400",   text: "text-amber-800 dark:text-amber-300" },
  pagado:               { bg: "bg-green-50 dark:bg-green-950/30",    border: "border-green-300 dark:border-green-700",    bar: "bg-green-500",   text: "text-green-800 dark:text-green-300" },
  cancelado:            { bg: "bg-red-50 dark:bg-red-950/30",        border: "border-red-200 dark:border-red-800",        bar: "bg-red-400",     text: "text-red-700 dark:text-red-300" },
}

// Iniciales del nombre (máx. 2 letras)
function getInitials(name: string): string {
  return name.split(" ").slice(0, 2).map((n) => n[0] ?? "").join("").toUpperCase()
}

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

// Altura por slot en px (incluye margen)
const SLOT_H = 34

// Convierte hora "HH:MM[:ss]" a minutos desde medianoche
function horaToMins(hora: string): number {
  const [h, m] = hora.substring(0, 5).split(":").map(Number)
  return h * 60 + m
}

// Posición top en px para una hora (referencia: 10:00 = 0px)
function horaToPx(hora: string): number {
  return Math.max(0, (horaToMins(hora) - 10 * 60) / 30 * SLOT_H)
}

// Altura en px para una duración en minutos
function duracionToPx(minutos: number): number {
  return Math.max((minutos / 30) * SLOT_H - 2, 48)
}

// Detecta si dos citas se solapan en tiempo
function citasOverlap(a: Cita, b: Cita): boolean {
  const a1 = horaToMins(a.horaInicio)
  const a2 = horaToMins(a.horaFin)
  const b1 = horaToMins(b.horaInicio)
  const b2 = horaToMins(b.horaFin)
  return a1 < b2 && b1 < a2
}

// Asigna columna a cada cita para mostrarlas lado a lado cuando solapan
function getOverlapInfo(citas: Cita[]): Map<string, { col: number; totalCols: number }> {
  const result = new Map<string, { col: number; totalCols: number }>()
  if (citas.length === 0) return result

  const sorted = [...citas].sort((a, b) =>
    horaToMins(a.horaInicio) - horaToMins(b.horaInicio)
  )
  const colMap = new Map<string, number>()

  for (const cita of sorted) {
    const usedCols = new Set<number>()
    for (const [otherId, otherCol] of colMap.entries()) {
      const other = sorted.find((c) => c.id === otherId)
      if (other && citasOverlap(cita, other)) usedCols.add(otherCol)
    }
    let col = 0
    while (usedCols.has(col)) col++
    colMap.set(cita.id, col)
  }

  for (const cita of sorted) {
    const overlapping = sorted.filter((c) => c.id !== cita.id && citasOverlap(cita, c))
    const allCols = [colMap.get(cita.id)!, ...overlapping.map((c) => colMap.get(c.id)!)]
    const totalCols = Math.max(...allCols) + 1
    result.set(cita.id, { col: colMap.get(cita.id)!, totalCols })
  }

  return result
}

// Slots de 30 min: 10:00 → 20:00 (21 slots: 10:00, 10:30 … 20:00)
const TIME_SLOTS = Array.from({ length: 21 }, (_, i) => {
  const hour = Math.floor(i / 2) + 10
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
  // Ausencias del día
  const [isAusenciasOpen, setIsAusenciasOpen] = useState(false)
  const [ausencias, setAusencias] = useState<Ausencia[]>([])
  const [isLoadingAusencias, setIsLoadingAusencias] = useState(false)
  const [ausenciaForm, setAusenciaForm] = useState({
    empleadoId: '', tipo: 'falta' as TipoAusencia, motivo: '', duracionHoras: '',
    diaCompleto: true, horaInicio: '10:00', horaFin: '12:00',
  })
  const [isSavingAusencia, setIsSavingAusencia] = useState(false)
  const [motivoRechazoAusencia, setMotivoRechazoAusencia] = useState('')
  const [rechazandoAusenciaId, setRechazandoAusenciaId] = useState<string | null>(null)

  // Detalle de cita (click en tarjeta)
  const [detalleCita, setDetalleCita] = useState<Cita | null>(null)

  // Edición de duración inline
  const [editingDuracionCita, setEditingDuracionCita] = useState<Cita | null>(null)
  const [isDuracionDialogOpen, setIsDuracionDialogOpen] = useState(false)
  const [nuevaDuracion, setNuevaDuracion] = useState<number>(60)
  const [isSavingDuracion, setIsSavingDuracion] = useState(false)
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
          const [citasData, ausenciasData] = await Promise.all([
            getCitasByDateAndSucursalFromDB(selectedDate, selectedSucursal),
            getAusenciasFromDB({ fechaDesde: selectedDate, fechaHasta: selectedDate }),
          ])
          setCitas(citasData)
          // Enriquecer ausencias con nombres de empleados
          const conNombres = ausenciasData.map((a: Ausencia) => {
            const emp = empleadosSucursal.find(e => e.id === a.empleadoId)
            return { ...a, empleadoNombre: emp ? `${emp.nombre} ${emp.apellido}` : a.empleadoNombre }
          })
          setAusencias(conNombres)
        } catch (error) {
          console.error('Error cargando citas:', error)
          toast.error('Error al cargar las citas')
        } finally {
          setIsLoadingCitas(false)
        }
      }
    }
    loadCitas()
  }, [selectedSucursal, selectedDate, refreshCitasKey, empleadosSucursal])

  // Devuelve ausencias aprobadas/pendientes del día para un empleado
  const getAusenciasEmpleadoHoy = (empleadoId: string): Ausencia[] =>
    ausencias.filter(a =>
      a.empleadoId === empleadoId &&
      (a.estatus === 'aprobada' || a.estatus === 'pendiente')
    )

  // Devuelve la ausencia parcial si el slot (HH:MM) cae dentro de su rango
  const isSlotBloqueadoPorAusencia = (slot: string, ausenciasEmp: Ausencia[]): Ausencia | null => {
    for (const a of ausenciasEmp) {
      // Si tiene hora_inicio y hora_fin explícitas, usarlas directamente
      if (a.horaInicio && a.horaFin) {
        const minSlot   = horaToMins(slot)
        const minInicio = horaToMins(a.horaInicio)
        const minFin    = horaToMins(a.horaFin)
        if (minSlot >= minInicio && minSlot < minFin) return a
      }
      // Sin hora_inicio/hora_fin → día completo, se maneja a nivel de columna
    }
    return null
  }

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

  const cargarAusencias = async () => {
    setIsLoadingAusencias(true)
    try {
      const data = await getAusenciasFromDB({ fechaDesde: selectedDate, fechaHasta: selectedDate })
      // Completar nombres desde empleadosSucursal
      const conNombres = data.map(a => ({
        ...a,
        empleadoNombre: a.empleadoNombre
          ?? empleadosSucursal.find(e => e.id === a.empleadoId)?.nombre
          ?? a.empleadoId,
      }))
      setAusencias(conNombres)
    } catch {
      toast.error('Error al cargar ausencias')
    } finally {
      setIsLoadingAusencias(false)
    }
  }

  const handleCrearAusencia = async () => {
    if (!ausenciaForm.empleadoId) { toast.error('Selecciona una empleada'); return }
    setIsSavingAusencia(true)
    try {
      const esParcial = !ausenciaForm.diaCompleto
      const durMin = esParcial
        ? (horaToMins(ausenciaForm.horaFin) - horaToMins(ausenciaForm.horaInicio)) / 60
        : undefined
      const result = await createAusencia({
        empleadoId: ausenciaForm.empleadoId,
        tipo: ausenciaForm.tipo,
        motivo: ausenciaForm.motivo || undefined,
        fechaInicio: selectedDate,
        fechaFin: selectedDate,
        horaInicio: esParcial ? ausenciaForm.horaInicio : undefined,
        horaFin:    esParcial ? ausenciaForm.horaFin    : undefined,
        duracionHoras: esParcial && durMin && durMin > 0 ? durMin : undefined,
      })
      if (result.success) {
        toast.success('Ausencia registrada')
        setAusenciaForm({ empleadoId: '', tipo: 'falta', motivo: '', duracionHoras: '', diaCompleto: true, horaInicio: '10:00', horaFin: '12:00' })
        await cargarAusencias()
      } else {
        toast.error(result.error ?? 'Error al registrar')
      }
    } finally {
      setIsSavingAusencia(false)
    }
  }

  const handleAprobarAusencia = async (id: string) => {
    const resp = currentUser?.email ?? currentUser?.name ?? 'Admin'
    const r = await aprobarAusencia(id, resp)
    if (r.success) { toast.success('Aprobada'); await cargarAusencias() }
    else toast.error(r.error ?? 'Error')
  }

  const handleRechazarAusencia = async (id: string) => {
    if (!motivoRechazoAusencia.trim()) { toast.error('Indica el motivo'); return }
    const resp = currentUser?.email ?? currentUser?.name ?? 'Admin'
    const r = await rechazarAusencia(id, resp, motivoRechazoAusencia)
    if (r.success) {
      toast.success('Rechazada')
      setRechazandoAusenciaId(null)
      setMotivoRechazoAusencia('')
      await cargarAusencias()
    } else toast.error(r.error ?? 'Error')
  }

  const handleGuardarDuracion = async () => {
    if (!editingDuracionCita || nuevaDuracion < 5) return
    setIsSavingDuracion(true)
    try {
      const result = await updateCita(editingDuracionCita.id, {
        hora_inicio: editingDuracionCita.horaInicio,
        duracion: nuevaDuracion,
      })
      if (result.success) {
        toast.success(`Duración actualizada a ${nuevaDuracion} min`)
        setIsDuracionDialogOpen(false)
        setEditingDuracionCita(null)
        await handleCitaCreated()
      } else {
        toast.error(`Error al actualizar duración: ${result.error}`)
      }
    } catch (err: any) {
      toast.error(err.message || "Error inesperado")
    } finally {
      setIsSavingDuracion(false)
    }
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setIsAusenciasOpen(true); cargarAusencias() }}
            className="ml-2"
            title="Registrar ausencias del día"
          >
            <UserX className="h-4 w-4 mr-2" />
            Ausencias
            {ausencias.filter(a => a.estatus === 'pendiente').length > 0 && (
              <Badge className="ml-2 h-5 min-w-5 px-1 text-xs bg-yellow-500 hover:bg-yellow-500">
                {ausencias.filter(a => a.estatus === 'pendiente').length}
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
                      const ausenciasEmp = getAusenciasEmpleadoHoy(empleado.id)
                      const ausenciaDiaCompleto = ausenciasEmp.find(a => !a.horaInicio && !a.horaFin)
                      const noDisponible = !!(vacacionEmpleado || descansoHoy || ausenciaDiaCompleto)

                    return (
                      <div key={empleado.id} className={cn("space-y-1", noDisponible && "opacity-60")}>
                        {/* Encabezado compacto de empleada */}
                        <div
                          className={cn(
                            "flex items-center gap-1.5 pb-1.5 border-b sticky top-0 bg-background z-10",
                            vacacionEmpleado && "bg-amber-50 rounded-t-md px-1.5 pt-1.5",
                            descansoHoy && "bg-slate-100 dark:bg-slate-800 rounded-t-md px-1.5 pt-1.5",
                            ausenciaDiaCompleto && "bg-red-50 rounded-t-md px-1.5 pt-1.5",
                          )}
                        >
                          <div
                            className={cn(
                              "h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0",
                              vacacionEmpleado && "bg-amber-200",
                              descansoHoy && "bg-slate-300 dark:bg-slate-600",
                              ausenciaDiaCompleto && "bg-red-200",
                              !noDisponible && "bg-primary/10",
                            )}
                          >
                            {vacacionEmpleado ? (
                              <Palmtree className="h-3.5 w-3.5 text-amber-600" />
                            ) : descansoHoy ? (
                              <UtensilsCrossed className="h-3.5 w-3.5 text-slate-500" />
                            ) : ausenciaDiaCompleto ? (
                              <UserX className="h-3.5 w-3.5 text-red-600" />
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
                            ) : ausenciaDiaCompleto ? (
                              <p className="text-[10px] text-red-600 font-medium leading-tight capitalize">{TIPO_AUSENCIA_LABELS[ausenciaDiaCompleto.tipo]} · {ausenciaDiaCompleto.estatus}</p>
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
                        ) : ausenciaDiaCompleto ? (
                          <div className="flex items-center justify-center h-24 bg-red-50 rounded-lg border border-red-200">
                            <div className="text-center">
                              <UserX className="h-6 w-6 text-red-400 mx-auto mb-1" />
                              <p className="text-xs text-red-700 font-medium capitalize">{TIPO_AUSENCIA_LABELS[ausenciaDiaCompleto.tipo]}</p>
                              {ausenciaDiaCompleto.motivo && (
                                <p className="text-[10px] text-red-500 max-w-[120px] mx-auto truncate">{ausenciaDiaCompleto.motivo}</p>
                              )}
                              <p className="text-[10px] text-red-400 capitalize">{ausenciaDiaCompleto.estatus}</p>
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
                          /* Timeline absoluto — soporta citas solapadas */
                          (() => {
                            const overlapMap = getOverlapInfo(citasEmpleado)
                            const totalH = TIME_SLOTS.length * SLOT_H
                            return (
                              <div className="relative" style={{ height: `${totalH}px` }}>
                                {/* Etiquetas de hora + fondos de slot */}
                                {TIME_SLOTS.map((slot, idx) => {
                                  const isInRange =
                                    slot >= empleado.horarioInicio && slot < empleado.horarioFin
                                  const bloqueComida = bloquesAgenda.find(
                                    (b) =>
                                      b.empleadoId === empleado.id &&
                                      b.tipo === 'comida' &&
                                      b.horaInicio && b.horaFin &&
                                      slot >= b.horaInicio.substring(0, 5) &&
                                      slot < b.horaFin.substring(0, 5)
                                  )
                                  const isComida = !!bloqueComida
                                  const ausenciaSlot = isSlotBloqueadoPorAusencia(slot, ausenciasEmp)
                                  const isAusenciaParcial = !!ausenciaSlot
                                  const isOcupado = citasEmpleado.some((c) => {
                                    const ni = c.horaInicio.substring(0, 5)
                                    const nf = c.horaFin.substring(0, 5)
                                    return slot >= ni && slot < nf
                                  })
                                  const bloqueado = isComida || isAusenciaParcial
                                  return (
                                    <div
                                      key={slot}
                                      className={cn(
                                        "absolute flex gap-1 group",
                                        (!isInRange || bloqueado) && "bg-muted/30",
                                        isComida && "bg-orange-50 dark:bg-orange-950/20",
                                        isAusenciaParcial && "bg-red-50 dark:bg-red-950/20",
                                        isInRange && !isOcupado && !bloqueado && "hover:bg-accent/40 cursor-pointer",
                                        (isOcupado || bloqueado) && "cursor-default",
                                      )}
                                      style={{ top: `${idx * SLOT_H}px`, height: `${SLOT_H - 2}px`, left: 0, right: 0 }}
                                      onClick={() => {
                                        if (!bloqueado && isInRange && !isOcupado)
                                          handleSlotClick(slot, empleado.id, true)
                                      }}
                                    >
                                      <div className="text-[10px] text-muted-foreground pt-1 w-9 flex-shrink-0 leading-tight select-none">
                                        {slot}
                                      </div>
                                      <div className="flex-1 border-l border-border/40 relative">
                                        {isComida && (
                                          <span className="absolute inset-0 flex items-center pl-1 text-[10px] text-orange-600 dark:text-orange-400 pointer-events-none">
                                            <UtensilsCrossed className="h-2.5 w-2.5 mr-0.5" /> Comida
                                          </span>
                                        )}
                                        {isAusenciaParcial && !isComida && (
                                          <span className="absolute inset-0 flex items-center pl-1 text-[10px] text-red-600 dark:text-red-400 pointer-events-none">
                                            <UserX className="h-2.5 w-2.5 mr-0.5" />
                                            <span className="capitalize truncate">{TIPO_AUSENCIA_LABELS[ausenciaSlot.tipo]}</span>
                                          </span>
                                        )}
                                        {isInRange && !isOcupado && !bloqueado && (
                                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                            <Plus className="h-3 w-3 text-muted-foreground" />
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}

                                {/* Tarjetas de citas — posicionadas absolutamente */}
                                {citasEmpleado.map((cita) => {
                                  const { col, totalCols } = overlapMap.get(cita.id) ?? { col: 0, totalCols: 1 }
                                  const topPx = horaToPx(cita.horaInicio)
                                  const heightPx = duracionToPx(cita.duracion)
                                  const LEFT_OFFSET = 36
                                  const widthFrac = 1 / totalCols
                                  const estadoUI = getEstadoUI(cita)
                                  const cardStyle = ESTADO_CARD[estadoUI] ?? ESTADO_CARD["pendiente"]
                                  const initials = getInitials(cita.clienteNombre)
                                  // Modo compacto cuando la tarjeta es muy estrecha (solapamiento 3+)
                                  const isCompact = totalCols >= 3

                                  return (
                                    <div
                                      key={cita.id}
                                      className={cn(
                                        "absolute z-10 rounded-md border shadow-sm cursor-pointer select-none",
                                        "hover:shadow-md hover:z-20 transition-all",
                                        cardStyle.bg,
                                        cardStyle.border,
                                      )}
                                      onClick={(e) => { e.stopPropagation(); setDetalleCita(cita) }}
                                      style={{
                                        top: `${topPx}px`,
                                        left: `calc(${LEFT_OFFSET}px + ${col * widthFrac} * (100% - ${LEFT_OFFSET}px))`,
                                        width: `calc(${widthFrac} * (100% - ${LEFT_OFFSET}px))`,
                                        height: `${heightPx}px`,
                                        overflow: "visible",
                                      }}
                                    >
                                      {/* Barra de color = drag handle */}
                                      <div
                                        className={cn("h-2 w-full rounded-t-md shrink-0 cursor-grab active:cursor-grabbing", cardStyle.bar)}
                                        draggable
                                        onDragStart={(e) => { e.stopPropagation(); handleDragStart(cita) }}
                                        onClick={(e) => e.stopPropagation()}
                                        title="Arrastrar"
                                      />

                                      {/* Contenido */}
                                      <div className="px-1.5 pt-0.5 pb-1 h-[calc(100%-4px)] flex flex-col gap-0.5 overflow-hidden">

                                        {/* Fila superior: iniciales + nombre + botón menú */}
                                        <div className="flex items-center gap-1 shrink-0">
                                          {/* Avatar iniciales */}
                                          <div className={cn(
                                            "rounded-full flex items-center justify-center font-bold shrink-0",
                                            cardStyle.bar,
                                            isCompact ? "h-4 w-4 text-[7px]" : "h-5 w-5 text-[8px]",
                                            "text-white"
                                          )}>
                                            {initials}
                                          </div>

                                          {/* Nombre cliente */}
                                          {!isCompact && (
                                            <p className="flex-1 font-semibold text-[11px] text-foreground leading-tight truncate min-w-0" title={cita.clienteNombre}>
                                              {cita.clienteNombre}
                                            </p>
                                          )}

                                          {/* Menú de acciones — siempre visible */}
                                          <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                              <button
                                                className={cn(
                                                  "shrink-0 rounded flex items-center justify-center",
                                                  "hover:bg-black/10 transition-colors",
                                                  isCompact ? "h-4 w-4" : "h-5 w-5",
                                                )}
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                <MoreVertical className={isCompact ? "h-2 w-2" : "h-3 w-3"} />
                                              </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent
                                              align="end"
                                              side="bottom"
                                              className="z-[200]"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              {/* Info del cliente en cabecera del menú */}
                                              <div className="px-2 py-1.5 border-b mb-1">
                                                <p className="text-xs font-semibold truncate max-w-[180px]">{cita.clienteNombre}</p>
                                                <p className="text-[11px] text-muted-foreground truncate max-w-[180px]">{cita.servicioNombre}</p>
                                              </div>
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
                                                  setEditingDuracionCita(cita)
                                                  setNuevaDuracion(cita.duracion)
                                                  setIsDuracionDialogOpen(true)
                                                }}
                                              >
                                                <Timer className="h-4 w-4 mr-2" />
                                                Editar Duración
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
                                              <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                                                Cambiar Estado:
                                              </div>
                                              {ESTADOS.map((estado) => {
                                                const isCurrentState = estadoUI === estado.value
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
                                                    <div className={cn("h-2 w-2 rounded-full mr-2 shrink-0", estado.color)} />
                                                    {estado.label}
                                                  </DropdownMenuItem>
                                                )
                                              })}
                                            </DropdownMenuContent>
                                          </DropdownMenu>
                                        </div>

                                        {/* Nombre en modo compacto */}
                                        {isCompact && (
                                          <p className="text-[9px] font-medium text-foreground leading-tight truncate">
                                            {cita.clienteNombre}
                                          </p>
                                        )}

                                        {/* Servicio */}
                                        <p className={cn(
                                          "text-muted-foreground leading-tight truncate shrink-0",
                                          isCompact ? "text-[9px]" : "text-[10px]"
                                        )} title={cita.servicioNombre}>
                                          {cita.servicioNombre}
                                        </p>

                                        {/* Footer: hora + precio */}
                                        <div className={cn(
                                          "flex items-center justify-between mt-auto shrink-0",
                                          cardStyle.text,
                                          isCompact ? "text-[8px]" : "text-[10px]"
                                        )}>
                                          <span className="flex items-center gap-0.5 font-medium">
                                            <Clock className={isCompact ? "h-2 w-2 shrink-0" : "h-2.5 w-2.5 shrink-0"} />
                                            {cita.horaInicio.substring(0, 5)}
                                            {!isCompact && <>–{cita.horaFin.substring(0, 5)}</>}
                                          </span>
                                          {!isCompact && (
                                            <span className="font-semibold">${cita.precio}</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )
                          })()
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

      {/* Dialog edición de duración */}
      <Dialog
        open={isDuracionDialogOpen}
        onOpenChange={(open) => {
          setIsDuracionDialogOpen(open)
          if (!open) setEditingDuracionCita(null)
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Timer className="h-4 w-4" />
              Editar duración
            </DialogTitle>
            <DialogDescription>
              {editingDuracionCita && (
                <>
                  <span className="font-medium">{editingDuracionCita.clienteNombre}</span>
                  {" — "}{editingDuracionCita.servicioNombre}
                  <br />
                  <span className="text-xs">Hora inicio: {editingDuracionCita.horaInicio.substring(0, 5)}</span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Duración (minutos)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={5}
                  max={480}
                  step={5}
                  value={nuevaDuracion}
                  onChange={(e) => setNuevaDuracion(Number(e.target.value))}
                  className="w-28"
                />
                <span className="text-sm text-muted-foreground">
                  = {Math.floor(nuevaDuracion / 60) > 0 && `${Math.floor(nuevaDuracion / 60)}h `}
                  {nuevaDuracion % 60 > 0 && `${nuevaDuracion % 60}min`}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {[30, 45, 60, 90, 120].map((min) => (
                <Button
                  key={min}
                  size="sm"
                  variant={nuevaDuracion === min ? "default" : "outline"}
                  onClick={() => setNuevaDuracion(min)}
                >
                  {min < 60 ? `${min}min` : `${min / 60}h`}
                </Button>
              ))}
            </div>
            {editingDuracionCita && (
              <p className="text-xs text-muted-foreground">
                Nueva hora fin:{" "}
                <span className="font-medium text-foreground">
                  {(() => {
                    const [h, m] = editingDuracionCita.horaInicio.substring(0, 5).split(":").map(Number)
                    const total = h * 60 + m + nuevaDuracion
                    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
                  })()}
                </span>
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setIsDuracionDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleGuardarDuracion} disabled={isSavingDuracion || nuevaDuracion < 5}>
              {isSavingDuracion ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog Ausencias del día ──────────────────────────────────── */}
      <Dialog open={isAusenciasOpen} onOpenChange={(v) => { setIsAusenciasOpen(v); if (!v) { setRechazandoAusenciaId(null); setMotivoRechazoAusencia('') } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-5 pb-3 border-b flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <UserX className="h-4 w-4" />
              Ausencias — {selectedDate.split('-').reverse().join('/')}
            </DialogTitle>
            <DialogDescription>
              Registra y gestiona faltas, permisos e incapacidades del día
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            {/* Formulario rápido de registro */}
            <div className="px-6 py-4 bg-muted/30 border-b space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Registrar ausencia</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Empleada *</Label>
                  <Select value={ausenciaForm.empleadoId} onValueChange={(v) => setAusenciaForm(p => ({ ...p, empleadoId: v }))}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {empleadosSucursal.map(e => (
                        <SelectItem key={e.id} value={e.id}>{e.nombre} {e.apellido}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tipo *</Label>
                  <Select value={ausenciaForm.tipo} onValueChange={(v) => setAusenciaForm(p => ({ ...p, tipo: v as TipoAusencia }))}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(TIPO_AUSENCIA_LABELS) as TipoAusencia[]).map(t => (
                        <SelectItem key={t} value={t}>{TIPO_AUSENCIA_LABELS[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {/* Motivo */}
              <div className="space-y-1">
                <Label className="text-xs">Motivo (opcional)</Label>
                <Input className="h-8 text-sm" placeholder="Ej. cita médica, familiar..."
                  value={ausenciaForm.motivo} onChange={e => setAusenciaForm(p => ({ ...p, motivo: e.target.value }))} />
              </div>

              {/* Toggle día completo / rango de horas */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAusenciaForm(p => ({ ...p, diaCompleto: true }))}
                  className={cn(
                    "flex-1 h-8 text-xs rounded border font-medium transition-colors",
                    ausenciaForm.diaCompleto
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:bg-muted"
                  )}
                >
                  Día completo
                </button>
                <button
                  type="button"
                  onClick={() => setAusenciaForm(p => ({ ...p, diaCompleto: false }))}
                  className={cn(
                    "flex-1 h-8 text-xs rounded border font-medium transition-colors",
                    !ausenciaForm.diaCompleto
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:bg-muted"
                  )}
                >
                  Rango de horas
                </button>
              </div>

              {/* Selectores de hora (sólo en modo parcial) */}
              {!ausenciaForm.diaCompleto && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Hora inicio</Label>
                    <Select value={ausenciaForm.horaInicio} onValueChange={(v) => setAusenciaForm(p => ({ ...p, horaInicio: v }))}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-52">
                        {Array.from({ length: 21 }, (_, i) => {
                          const h = Math.floor(i / 2) + 10
                          const m = i % 2 === 0 ? '00' : '30'
                          const val = `${String(h).padStart(2, '0')}:${m}`
                          return <SelectItem key={val} value={val}>{val}</SelectItem>
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Hora fin</Label>
                    <Select value={ausenciaForm.horaFin} onValueChange={(v) => setAusenciaForm(p => ({ ...p, horaFin: v }))}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-52">
                        {Array.from({ length: 21 }, (_, i) => {
                          const h = Math.floor(i / 2) + 10
                          const m = i % 2 === 0 ? '00' : '30'
                          const val = `${String(h).padStart(2, '0')}:${m}`
                          return <SelectItem key={val} value={val}>{val}</SelectItem>
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button size="sm" onClick={handleCrearAusencia} disabled={isSavingAusencia} className="h-8">
                  {isSavingAusencia ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                  Registrar
                </Button>
              </div>
            </div>

            {/* Lista de ausencias del día */}
            <div className="px-6 py-4 space-y-3">
              {isLoadingAusencias ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : ausencias.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <UserX className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Sin ausencias registradas para este día</p>
                </div>
              ) : (
                ausencias.map(a => (
                  <div key={a.id} className="rounded-lg border bg-card p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold">{a.empleadoNombre}</p>
                          <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", TIPO_AUSENCIA_COLORS[a.tipo])}>
                            {TIPO_AUSENCIA_LABELS[a.tipo]}
                          </span>
                          <Badge className={cn("text-xs border", ESTATUS_AUSENCIA_COLORS[a.estatus])}>
                            {ESTATUS_AUSENCIA_LABELS[a.estatus]}
                          </Badge>
                        </div>
                        {a.motivo && <p className="text-xs text-muted-foreground mt-0.5">{a.motivo}</p>}
                        {a.duracionHoras != null && (
                          <p className="text-xs text-muted-foreground">{a.duracionHoras}h de ausencia</p>
                        )}
                        {a.aprobadoPor && (
                          <p className="text-xs text-muted-foreground">
                            {a.estatus === 'aprobada' ? 'Aprobada' : 'Rechazada'} por {a.aprobadoPor}
                          </p>
                        )}
                      </div>
                      {/* Acciones */}
                      {a.estatus === 'pendiente' && isAdmin && (
                        <div className="flex gap-1 shrink-0">
                          <Button size="sm" variant="outline"
                            className="h-7 text-xs text-green-700 border-green-300 hover:bg-green-50"
                            onClick={() => handleAprobarAusencia(a.id)}>
                            <CheckCircle className="h-3 w-3 mr-1" />Aprobar
                          </Button>
                          <Button size="sm" variant="outline"
                            className="h-7 text-xs text-red-700 border-red-300 hover:bg-red-50"
                            onClick={() => setRechazandoAusenciaId(a.id)}>
                            <XCircle className="h-3 w-3 mr-1" />Rechazar
                          </Button>
                        </div>
                      )}
                    </div>
                    {/* Formulario inline de rechazo */}
                    {rechazandoAusenciaId === a.id && (
                      <div className="mt-2 space-y-2 border-t pt-2">
                        <Textarea rows={2} placeholder="Motivo del rechazo..."
                          className="text-sm"
                          value={motivoRechazoAusencia}
                          onChange={e => setMotivoRechazoAusencia(e.target.value)} />
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="ghost" className="h-7 text-xs"
                            onClick={() => { setRechazandoAusenciaId(null); setMotivoRechazoAusencia('') }}>
                            Cancelar
                          </Button>
                          <Button size="sm" variant="destructive" className="h-7 text-xs"
                            onClick={() => handleRechazarAusencia(a.id)}>
                            Confirmar rechazo
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="px-6 py-3 border-t flex-shrink-0 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setIsAusenciasOpen(false)}>
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Sheet detalle de cita ── */}
      <Sheet open={!!detalleCita} onOpenChange={(o) => { if (!o) setDetalleCita(null) }}>
        <SheetContent side="right" className="w-[380px] sm:max-w-none p-0 flex flex-col gap-0 overflow-hidden">
          {detalleCita && (() => {
            const estadoUI = getEstadoUI(detalleCita)
            const cardStyle = ESTADO_CARD[estadoUI] ?? ESTADO_CARD["pendiente"]
            const estadoLabel = ESTADOS.find(e => e.value === estadoUI)?.label ?? estadoUI
            const estadoColor = ESTADOS.find(e => e.value === estadoUI)?.color ?? "bg-gray-400"
            const fecha = detalleCita.fecha
              ? new Date(detalleCita.fecha + "T12:00:00").toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
              : "—"
            return (
              <>
                {/* Cabecera con color del estado */}
                <div className={cn("px-5 pt-5 pb-4", cardStyle.bg)}>
                  <div className={cn("h-1 w-full rounded-full mb-4", cardStyle.bar)} />
                  <SheetHeader className="p-0 space-y-1">
                    <SheetTitle className="text-base font-bold leading-tight">{detalleCita.clienteNombre}</SheetTitle>
                    <p className="text-sm text-muted-foreground">{detalleCita.servicioNombre}</p>
                  </SheetHeader>
                  <div className="mt-3 flex items-center gap-2">
                    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full text-white", estadoColor)}>
                      <span className="h-1.5 w-1.5 rounded-full bg-white/70" />
                      {estadoLabel}
                    </span>
                    {detalleCita.pagado && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-300">
                        <CheckCircle className="h-3 w-3" /> Pagado
                      </span>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Datos */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-0.5">
                      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Fecha</p>
                      <p className="text-sm font-semibold capitalize">{fecha}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Horario</p>
                      <p className="text-sm font-semibold">{detalleCita.horaInicio.substring(0, 5)} – {detalleCita.horaFin.substring(0, 5)}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Duración</p>
                      <p className="text-sm font-semibold">{detalleCita.duracion} min</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Precio</p>
                      <p className="text-sm font-semibold">${detalleCita.precio}</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-0.5">
                    <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Empleada</p>
                    <p className="text-sm font-semibold">{detalleCita.empleadoNombre}</p>
                  </div>

                  {detalleCita.notas && (
                    <>
                      <Separator />
                      <div className="space-y-1">
                        <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Notas</p>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{detalleCita.notas}</p>
                      </div>
                    </>
                  )}
                </div>

                <Separator />

                {/* Acciones */}
                <div className="px-5 py-4 flex flex-col gap-2">
                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                    onClick={() => {
                      setCajaCita(detalleCita)
                      setIsCajaOpen(true)
                      setDetalleCita(null)
                    }}
                  >
                    <ShoppingBag className="h-4 w-4" />
                    Ir a Caja
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full gap-1.5"
                    onClick={() => {
                      setEditingCita(detalleCita)
                      setIsEditDialogOpen(true)
                      setDetalleCita(null)
                    }}
                  >
                    <Edit className="h-4 w-4" />
                    Editar Cita
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full gap-1.5"
                    onClick={() => {
                      setEditingDuracionCita(detalleCita)
                      setNuevaDuracion(detalleCita.duracion)
                      setIsDuracionDialogOpen(true)
                      setDetalleCita(null)
                    }}
                  >
                    <Timer className="h-4 w-4" />
                    Editar Duración
                  </Button>
                </div>
              </>
            )
          })()}
        </SheetContent>
      </Sheet>
    </div>
  )
}
