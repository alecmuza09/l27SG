"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { format, eachDayOfInterval, isSameDay, isWithinInterval } from "date-fns"
import { es } from "date-fns/locale"
import { Plus, CalendarIcon, CheckCircle, Users, AlertCircle, Edit, Trash2, Loader2 } from "lucide-react"
import { getEmpleadosFromDB, type Empleado } from "@/lib/data/empleados"
import { type Periodo, calcularPeriodo, formatearRangoPeriodo } from "@/lib/periodos"
import {
  refreshSession,
  effectivePrimarySucursalId,
  collectEffectiveSucursalIds,
  type User,
} from "@/lib/auth"
import { getSucursalesByIdsFromDB, getSucursalesActivasFromDB, type Sucursal } from "@/lib/data/sucursales"
import {
  getVacacionesFromDB,
  calcularDias,
  verificarConflictoVacaciones,
  createVacacionInDB,
  updateVacacionInDB,
  deleteVacacionInDB,
} from "@/lib/data/vacaciones"
import type { Vacacion } from "@/lib/types/vacaciones"
import { canAccessVacacionesModule } from "@/lib/auth-vacaciones"

function formatDateTimeMx(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const estadoColors: Record<Vacacion["estado"], string> = {
  pendiente: "bg-yellow-100 text-yellow-800",
  aprobada: "bg-green-100 text-green-800",
  rechazada: "bg-red-100 text-red-800",
  cancelada: "bg-gray-100 text-gray-800",
}

export default function VacacionesPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [vacaciones, setVacaciones] = useState<Vacacion[]>([])

  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [filterSucursal, setFilterSucursal] = useState<string>("todos")
  const [filterEstado, setFilterEstado] = useState<string>("todos")
  const [filterEmpleada, setFilterEmpleada] = useState<string>("")
  const [activeTab, setActiveTab] = useState("solicitudes")
  const [resumenPeriodo, setResumenPeriodo] = useState<Periodo>("año")
  const [resumenDesde, setResumenDesde] = useState("")
  const [resumenHasta, setResumenHasta] = useState("")
  const [resumenFilterSucursal, setResumenFilterSucursal] = useState<string>("todos")
  const [resumenFilterEmpleada, setResumenFilterEmpleada] = useState<string>("todos")
  const [isLoading, setIsLoading] = useState(true)

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditVacacionDialogOpen, setIsEditVacacionDialogOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)

  const [selectedVacacion, setSelectedVacacion] = useState<Vacacion | null>(null)

  // Form states
  const [formSucursal, setFormSucursal] = useState("")
  const [formEmpleado, setFormEmpleado] = useState("")
  const [formFechaInicio, setFormFechaInicio] = useState<Date>()
  const [formFechaFin, setFormFechaFin] = useState<Date>()
  const [formNotas, setFormNotas] = useState("")
  const [error, setError] = useState("")

  // Edit vacation form states
  const [editFechaInicio, setEditFechaInicio] = useState<Date>()
  const [editFechaFin, setEditFechaFin] = useState<Date>()
  const [editNotas, setEditNotas] = useState("")
  const [editError, setEditError] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  // Calendar view
  const [calendarMonth, setCalendarMonth] = useState(new Date())

  const isAdmin = Boolean(currentUser?.role === "admin" || currentUser?.role === "superadmin")
  const branchIds = collectEffectiveSucursalIds(currentUser)
  const primarySucursalScope = effectivePrimarySucursalId(currentUser)
  /** Una sede: filtra datos a esa sede. Varias o admin: sin filtro extra (RLS + filtros en UI). */
  const vacacionesScope = isAdmin ? undefined : branchIds.length > 1 ? undefined : primarySucursalScope

  const reloadVacacionesData = useCallback(async () => {
    const u = currentUser
    if (!u) return
    const adm = u.role === "admin" || u.role === "superadmin"
    const ids = collectEffectiveSucursalIds(u)
    const sc = adm ? undefined : ids.length > 1 ? undefined : effectivePrimarySucursalId(u)
    const v = await getVacacionesFromDB(sc)
    setVacaciones(v)
  }, [currentUser])

  useEffect(() => {
    let cancelled = false
    async function init() {
      setIsLoading(true)
      const user = await refreshSession()
      if (cancelled) return
      if (!user) {
        router.replace("/")
        return
      }
      if (!canAccessVacacionesModule(user)) {
        router.replace("/dashboard/citas")
        return
      }
      setCurrentUser(user)
      const isAdm = user.role === "admin" || user.role === "superadmin"
      const primary = effectivePrimarySucursalId(user)
      const ids = collectEffectiveSucursalIds(user)
      const scope = isAdm ? undefined : ids.length > 1 ? undefined : primary
      if (!isAdm && ids.length > 1) {
        setFilterSucursal("todos")
      } else if (!isAdm && primary) {
        setFilterSucursal(primary)
      } else {
        setFilterSucursal("todos")
      }

      if (isAdm) {
        setResumenFilterSucursal("todos")
      } else if (ids.length > 1) {
        setResumenFilterSucursal(primary ?? ids[0] ?? "todos")
      } else if (primary) {
        setResumenFilterSucursal(primary)
      } else {
        setResumenFilterSucursal("todos")
      }

      try {
        const [vacacionesData, empleadosData, sucursalesAll, sucursalesPorId] =
          await Promise.all([
          getVacacionesFromDB(scope),
          getEmpleadosFromDB(scope),
          getSucursalesActivasFromDB(),
          !isAdm && ids.length > 0 ? getSucursalesByIdsFromDB(ids) : Promise.resolve([] as Sucursal[]),
        ])
        const sucursalesData = isAdm ? sucursalesAll : sucursalesPorId
        if (cancelled) return
        setVacaciones(vacacionesData)
        setEmpleados(empleadosData)
        setSucursales(sucursalesData)
      } catch (err) {
        console.error("Error cargando vacaciones:", err)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void init()
    return () => {
      cancelled = true
    }
  }, [router])

  const filteredVacaciones = vacaciones.filter((vac) => {
    const matchesSucursal = filterSucursal === "todos" || vac.sucursalId === filterSucursal
    const matchesEstado = filterEstado === "todos" || vac.estado === filterEstado
    const nombre = vac.empleadoNombre.toLowerCase()
    const matchesEmpleada =
      !filterEmpleada.trim() || nombre.includes(filterEmpleada.trim().toLowerCase())
    return matchesSucursal && matchesEstado && matchesEmpleada
  })

  const resumenRango = useMemo(() => {
    if (resumenPeriodo === "personalizado" && (!resumenDesde || !resumenHasta)) return null
    return calcularPeriodo(resumenPeriodo, resumenDesde, resumenHasta)
  }, [resumenPeriodo, resumenDesde, resumenHasta])

  const resumenEmpleadasOptions = useMemo(() => {
    return empleados
      .filter((e) => resumenFilterSucursal === "todos" || e.sucursalId === resumenFilterSucursal)
      .map((e) => ({ id: e.id, nombre: `${e.nombre} ${e.apellido}`.trim() }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
  }, [empleados, resumenFilterSucursal])

  useEffect(() => {
    if (resumenFilterEmpleada === "todos") return
    if (!resumenEmpleadasOptions.some((e) => e.id === resumenFilterEmpleada)) {
      setResumenFilterEmpleada("todos")
    }
  }, [resumenFilterSucursal, resumenEmpleadasOptions, resumenFilterEmpleada])

  const resumenPorEmpleada = useMemo(() => {
    const empleadosScope = empleados.filter((e) => {
      if (resumenFilterSucursal !== "todos" && e.sucursalId !== resumenFilterSucursal) return false
      if (resumenFilterEmpleada !== "todos" && e.id !== resumenFilterEmpleada) return false
      return true
    })
    const sucursalNombreById = new Map(sucursales.map((s) => [s.id, s.nombre]))
    const fechaDesde = resumenRango?.fechaDesde
    const fechaHasta = resumenRango?.fechaHasta

    return empleadosScope
      .map((emp) => {
        const nombreCompleto = `${emp.nombre} ${emp.apellido}`.trim()
        const delPeriodo =
          fechaDesde && fechaHasta
            ? vacaciones.filter((v) => {
                if (v.empleadoId !== emp.id) return false
                const fi = v.fechaInicio.split("T")[0]
                return fi >= fechaDesde && fi <= fechaHasta
              })
            : []
        const aprobadasPeriodo = delPeriodo.filter((v) => v.estado === "aprobada")
        const ultima = [...aprobadasPeriodo].sort((a, b) =>
          b.fechaInicio.localeCompare(a.fechaInicio),
        )[0]

        return {
          empleadoId: emp.id,
          nombre: nombreCompleto,
          sucursal: sucursalNombreById.get(emp.sucursalId) ?? "—",
          veces: aprobadasPeriodo.length,
          diasTomados: aprobadasPeriodo.reduce((sum, v) => sum + v.diasSolicitados, 0),
          ultimaVacacion: ultima
            ? { inicio: ultima.fechaInicio, fin: ultima.fechaFin }
            : null,
        }
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
  }, [empleados, vacaciones, sucursales, resumenFilterSucursal, resumenFilterEmpleada, resumenRango])

  // Estadísticas
  const aprobadas = vacaciones.filter((v) => v.estado === "aprobada").length
  const empleadosConVacaciones = new Set(vacaciones.filter((v) => v.estado === "aprobada").map((v) => v.empleadoId))
    .size

  // Parsea "YYYY-MM-DD" como fecha local (evita el desfase UTC)
  const parseLocalDate = (dateStr: string): Date => {
    const clean = dateStr.split("T")[0] // ignorar parte horaria si la hay
    const [y, m, d] = clean.split("-").map(Number)
    return new Date(y, m - 1, d)
  }

  const formatDate = (dateString: string) => {
    // Para timestamps ISO completos usamos Date directamente (la hora ya tiene info de TZ)
    // Para cadenas solo-fecha usamos parseLocalDate para evitar desfase UTC
    const date = dateString.length === 10 ? parseLocalDate(dateString) : new Date(dateString)
    return date.toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  const empleadosFiltradosPorSucursal = formSucursal
    ? empleados.filter((e) => e.sucursalId === formSucursal)
    : empleados

  const resetForm = () => {
    const adm = currentUser?.role === "admin" || currentUser?.role === "superadmin"
    const ids = collectEffectiveSucursalIds(currentUser)
    const pid = effectivePrimarySucursalId(currentUser)
    if (adm) setFormSucursal("")
    else if (ids.length > 1) setFormSucursal("")
    else setFormSucursal(pid ?? "")
    setFormEmpleado("")
    setFormFechaInicio(undefined)
    setFormFechaFin(undefined)
    setFormNotas("")
    setError("")
  }

  useEffect(() => {
    if (!isCreateDialogOpen || !currentUser) return
    const adm = currentUser.role === "admin" || currentUser.role === "superadmin"
    const ids = collectEffectiveSucursalIds(currentUser)
    const pid = effectivePrimarySucursalId(currentUser)
    if (!adm && ids.length === 1 && pid) {
      setFormSucursal(pid)
    }
  }, [isCreateDialogOpen, currentUser])

  const handleCreateVacacion = async () => {
    if (!formEmpleado || !formFechaInicio || !formFechaFin) {
      setError("Completa todos los campos requeridos")
      return
    }
    const ids = collectEffectiveSucursalIds(currentUser)
    if (!isAdmin && ids.length > 1 && !formSucursal) {
      setError("Selecciona la sucursal")
      return
    }

    const empleado = empleados.find((e) => e.id === formEmpleado)
    if (!empleado) return

    const fechaInicioStr = format(formFechaInicio, "yyyy-MM-dd")
    const fechaFinStr = format(formFechaFin, "yyyy-MM-dd")

    // Verificar conflictos
    const conflicto = await verificarConflictoVacaciones(formEmpleado, fechaInicioStr, fechaFinStr, undefined, branchIds.length > 1 ? undefined : vacacionesScope)
    if (conflicto) {
      setError(
        `El empleado ya tiene vacaciones del ${formatDate(conflicto.fechaInicio)} al ${formatDate(conflicto.fechaFin)}`,
      )
      return
    }

    const nuevaVacacion = await createVacacionInDB({
      empleadoId: formEmpleado,
      fechaInicio: fechaInicioStr,
      fechaFin: fechaFinStr,
      diasSolicitados: calcularDias(fechaInicioStr, fechaFinStr),
      notas: formNotas || undefined,
      registradoPorId: currentUser?.id ?? null,
      registradoPorNombre: currentUser?.name || currentUser?.email || null,
    })

    if (!nuevaVacacion) {
      setError("Error al guardar la solicitud. Intenta de nuevo.")
      return
    }

    await reloadVacacionesData()

    resetForm()
    setIsCreateDialogOpen(false)
  }

  const openEditDialog = (vac: Vacacion) => {
    setSelectedVacacion(vac)
    setEditFechaInicio(parseLocalDate(vac.fechaInicio))
    setEditFechaFin(parseLocalDate(vac.fechaFin))
    setEditNotas(vac.notas || "")
    setEditError("")
    setIsEditVacacionDialogOpen(true)
  }

  const handleEditVacacion = async () => {
    if (!selectedVacacion || !editFechaInicio || !editFechaFin) {
      setEditError("Selecciona las fechas de inicio y fin")
      return
    }
    if (editFechaFin < editFechaInicio) {
      setEditError("La fecha de fin no puede ser anterior a la de inicio")
      return
    }

    const fechaInicioStr = format(editFechaInicio, "yyyy-MM-dd")
    const fechaFinStr = format(editFechaFin, "yyyy-MM-dd")

    const conflicto = await verificarConflictoVacaciones(
      selectedVacacion.empleadoId,
      fechaInicioStr,
      fechaFinStr,
      selectedVacacion.id,
      branchIds.length > 1 ? undefined : vacacionesScope,
    )
    if (conflicto) {
      setEditError(
        `El empleado ya tiene vacaciones del ${formatDate(conflicto.fechaInicio)} al ${formatDate(conflicto.fechaFin)}`,
      )
      return
    }

    setIsSaving(true)
    const ok = await updateVacacionInDB(selectedVacacion.id, {
      fechaInicio: fechaInicioStr,
      fechaFin: fechaFinStr,
      diasSolicitados: calcularDias(fechaInicioStr, fechaFinStr),
      notas: editNotas || undefined,
    })
    setIsSaving(false)

    if (!ok) {
      setEditError("Error al guardar los cambios. Intenta de nuevo.")
      return
    }

    await reloadVacacionesData()
    setIsEditVacacionDialogOpen(false)
    setSelectedVacacion(null)
  }

  const handleDeleteVacacion = async () => {
    if (!selectedVacacion) return
    setIsSaving(true)
    const ok = await deleteVacacionInDB(selectedVacacion.id)
    setIsSaving(false)

    if (!ok) {
      setEditError("Error al eliminar la solicitud. Intenta de nuevo.")
      return
    }

    await reloadVacacionesData()
    setIsDeleteConfirmOpen(false)
    setIsEditVacacionDialogOpen(false)
    setSelectedVacacion(null)
  }

  // Generar días del mes para el calendario visual
  const getDaysInMonth = () => {
    const year = calendarMonth.getFullYear()
    const month = calendarMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    return eachDayOfInterval({ start: firstDay, end: lastDay })
  }

  // Celdas vacías de relleno al inicio (grid Lun–Dom, offset en base-lunes)
  const getLeadingEmptyCells = () => {
    const year = calendarMonth.getFullYear()
    const month = calendarMonth.getMonth()
    const firstDayOfWeek = new Date(year, month, 1).getDay() // 0=Dom … 6=Sáb
    // Convertir a base-lunes: Lun=0, Mar=1, … Dom=6
    return (firstDayOfWeek + 6) % 7
  }

  const getVacacionesForDay = (day: Date) => {
    return vacaciones.filter((vac) => {
      if (vac.estado !== "aprobada") return false
      const inicio = parseLocalDate(vac.fechaInicio)
      const fin = parseLocalDate(vac.fechaFin)
      return isWithinInterval(day, { start: inicio, end: fin })
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Cargando vacaciones...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestión de Vacaciones</h1>
          <p className="text-muted-foreground">Administra los periodos de descanso del personal</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              resetForm()
              setIsCreateDialogOpen(true)
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nueva Solicitud
          </Button>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aprobadas</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aprobadas}</div>
            <p className="text-xs text-muted-foreground">este año</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Empleados</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{empleadosConVacaciones}</div>
            <p className="text-xs text-muted-foreground">con vacaciones programadas</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="solicitudes">Solicitudes</TabsTrigger>
          <TabsTrigger value="calendario">Calendario</TabsTrigger>
          <TabsTrigger value="resumen">Resumen por empleada</TabsTrigger>
        </TabsList>

        {/* Tab: Solicitudes */}
        <TabsContent value="solicitudes">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Solicitudes de Vacaciones</CardTitle>
                  <CardDescription>Gestiona las solicitudes del personal</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Input
                    className="w-[180px]"
                    placeholder="Empleada"
                    value={filterEmpleada}
                    onChange={(e) => setFilterEmpleada(e.target.value)}
                  />
                  <Select
                    value={filterSucursal}
                    onValueChange={setFilterSucursal}
                    disabled={!isAdmin && branchIds.length <= 1}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Sucursal" />
                    </SelectTrigger>
                    <SelectContent>
                      {(isAdmin || branchIds.length > 1) && (
                        <SelectItem value="todos">Todas las sucursales</SelectItem>
                      )}
                      {sucursales.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filterEstado} onValueChange={setFilterEstado}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="aprobada">Aprobada</SelectItem>
                      <SelectItem value="cancelada">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empleado</TableHead>
                    <TableHead>Sucursal</TableHead>
                    <TableHead>Periodo</TableHead>
                    <TableHead>Días</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Solicitud</TableHead>
                    <TableHead>Registró</TableHead>
                    <TableHead>Aprobó</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVacaciones.map((vac) => (
                    <TableRow key={vac.id}>
                      <TableCell className="font-medium">{vac.empleadoNombre}</TableCell>
                      <TableCell>{vac.sucursalNombre}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{formatDate(vac.fechaInicio)}</p>
                          <p className="text-muted-foreground">a {formatDate(vac.fechaFin)}</p>
                        </div>
                      </TableCell>
                      <TableCell>{vac.diasSolicitados}</TableCell>
                      <TableCell>
                        <Badge className={estadoColors[vac.estado]}>
                          {vac.estado.charAt(0).toUpperCase() + vac.estado.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(vac.fechaSolicitud)}</TableCell>
                      <TableCell className="text-xs">
                        {vac.registradoPorNombre ?? "—"}
                        {vac.creadoEn && (
                          <span className="block text-muted-foreground">{formatDateTimeMx(vac.creadoEn)}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {vac.aprobadoPorNombre ?? "—"}
                        {vac.resueltoEn && (
                          <span className="block text-muted-foreground">{formatDateTimeMx(vac.resueltoEn)}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-transparent"
                            onClick={() => openEditDialog(vac)}
                            title="Editar solicitud"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Calendario */}
        <TabsContent value="calendario">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Calendario de Vacaciones</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setCalendarMonth(new Date(calendarMonth.setMonth(calendarMonth.getMonth() - 1)))}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setCalendarMonth(new Date(calendarMonth.setMonth(calendarMonth.getMonth() + 1)))}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
              <CardDescription>{format(calendarMonth, "MMMM yyyy", { locale: es })}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1">
                {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
                  <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
                    {day}
                  </div>
                ))}
                {/* Celdas vacías para alinear el primer día en su columna correcta */}
                {Array.from({ length: getLeadingEmptyCells() }).map((_, i) => (
                  <div key={`empty-${i}`} className="min-h-24" />
                ))}
                {getDaysInMonth().map((day) => {
                  const vacacionesDelDia = getVacacionesForDay(day)
                  const isToday = isSameDay(day, new Date())
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "min-h-24 p-1 border rounded-lg",
                        isToday && "border-primary",
                        vacacionesDelDia.length > 0 && "bg-green-50",
                      )}
                    >
                      <p className={cn("text-sm font-medium mb-1", isToday && "text-primary")}>{format(day, "d")}</p>
                      {vacacionesDelDia.slice(0, 2).map((vac) => (
                        <div key={vac.id} className="text-xs bg-green-200 text-green-800 rounded px-1 mb-1 truncate">
                          {vac.empleadoNombre.split(" ")[0]}
                        </div>
                      ))}
                      {vacacionesDelDia.length > 2 && (
                        <p className="text-xs text-muted-foreground">+{vacacionesDelDia.length - 2} más</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Resumen por empleada */}
        <TabsContent value="resumen">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <CardTitle>Resumen por empleada</CardTitle>
                  <CardDescription>
                    Vacaciones tomadas del periodo seleccionado
                  </CardDescription>
                  {resumenRango && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatearRangoPeriodo(resumenRango.fechaDesde, resumenRango.fechaHasta)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {(isAdmin || branchIds.length > 1) && (
                    <Select
                      value={resumenFilterSucursal}
                      onValueChange={setResumenFilterSucursal}
                    >
                      <SelectTrigger className="h-9 w-[160px] text-sm">
                        <SelectValue placeholder="Sucursal" />
                      </SelectTrigger>
                      <SelectContent>
                        {isAdmin && (
                          <SelectItem value="todos">Todas las sucursales</SelectItem>
                        )}
                        {sucursales.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Select
                    value={resumenFilterEmpleada}
                    onValueChange={setResumenFilterEmpleada}
                  >
                    <SelectTrigger className="h-9 w-[180px] text-sm">
                      <SelectValue placeholder="Empleada" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todas las empleadas</SelectItem>
                      {resumenEmpleadasOptions.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={resumenPeriodo}
                    onValueChange={(v) => setResumenPeriodo(v as Periodo)}
                  >
                    <SelectTrigger className="h-9 w-44 text-sm">
                      <CalendarIcon className="h-4 w-4 mr-1.5 text-muted-foreground" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="semana">Esta Semana</SelectItem>
                      <SelectItem value="mes">Este Mes</SelectItem>
                      <SelectItem value="trimestre">Trimestre</SelectItem>
                      <SelectItem value="año">Este Año</SelectItem>
                      <SelectItem value="personalizado">Personalizado…</SelectItem>
                    </SelectContent>
                  </Select>
                  {resumenPeriodo === "personalizado" && (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="date"
                        value={resumenDesde}
                        onChange={(e) => setResumenDesde(e.target.value)}
                        className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <span className="text-muted-foreground text-sm">—</span>
                      <input
                        type="date"
                        value={resumenHasta}
                        onChange={(e) => setResumenHasta(e.target.value)}
                        className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empleada</TableHead>
                    <TableHead>Sucursal</TableHead>
                    <TableHead>Veces</TableHead>
                    <TableHead>Días tomados</TableHead>
                    <TableHead>Última vacación</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resumenPorEmpleada.map((row) => (
                    <TableRow
                      key={row.empleadoId}
                      className="cursor-pointer"
                      onClick={() => {
                        setFilterEmpleada(row.nombre)
                        setActiveTab("solicitudes")
                      }}
                    >
                      <TableCell className="py-2 font-medium">{row.nombre}</TableCell>
                      <TableCell className="py-2">{row.sucursal || "—"}</TableCell>
                      <TableCell className="py-2">{row.veces}</TableCell>
                      <TableCell className="py-2">{row.diasTomados}</TableCell>
                      <TableCell className="py-2">
                        {row.ultimaVacacion
                          ? `${formatDate(row.ultimaVacacion.inicio)} – ${formatDate(row.ultimaVacacion.fin)}`
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      {/* Dialog: Nueva Solicitud */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Solicitud de Vacaciones</DialogTitle>
            <DialogDescription>Registra un periodo de vacaciones para un empleado</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Sucursal *</Label>
              <Select
                value={formSucursal}
                onValueChange={(v) => { setFormSucursal(v); setFormEmpleado("") }}
                disabled={!isAdmin && branchIds.length <= 1}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar sucursal" />
                </SelectTrigger>
                <SelectContent>
                  {sucursales.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Empleado *</Label>
              <Select
                value={formEmpleado}
                onValueChange={setFormEmpleado}
                disabled={!formSucursal}
              >
                <SelectTrigger>
                  <SelectValue placeholder={formSucursal ? "Seleccionar empleado" : "Primero selecciona una sucursal"} />
                </SelectTrigger>
                <SelectContent>
                  {empleadosFiltradosPorSucursal.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.nombre} {emp.apellido}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Fecha Inicio *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start bg-transparent">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formFechaInicio ? format(formFechaInicio, "dd/MM/yyyy") : "Seleccionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={formFechaInicio} onSelect={setFormFechaInicio} locale={es} />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid gap-2">
                <Label>Fecha Fin *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start bg-transparent">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formFechaFin ? format(formFechaFin, "dd/MM/yyyy") : "Seleccionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formFechaFin}
                      onSelect={setFormFechaFin}
                      locale={es}
                      disabled={(date) => (formFechaInicio ? date < formFechaInicio : false)}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            {formFechaInicio && formFechaFin && (
              <p className="text-sm text-muted-foreground">
                Total:{" "}
                <strong>
                  {calcularDias(format(formFechaInicio, "yyyy-MM-dd"), format(formFechaFin, "yyyy-MM-dd"))} días
                </strong>
              </p>
            )}
            <div className="grid gap-2">
              <Label>Notas</Label>
              <Textarea
                value={formNotas}
                onChange={(e) => setFormNotas(e.target.value)}
                placeholder="Motivo o notas adicionales..."
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateVacacion}>Crear Solicitud</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Editar Solicitud de Vacaciones */}
      <Dialog open={isEditVacacionDialogOpen} onOpenChange={(open) => { if (!open) { setIsEditVacacionDialogOpen(false); setSelectedVacacion(null) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Solicitud de Vacaciones</DialogTitle>
            <DialogDescription>
              {selectedVacacion?.empleadoNombre} · modifica las fechas o elimina esta solicitud
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Fecha Inicio *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start bg-transparent">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editFechaInicio ? format(editFechaInicio, "dd/MM/yyyy") : "Seleccionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={editFechaInicio} onSelect={setEditFechaInicio} locale={es} />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid gap-2">
                <Label>Fecha Fin *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start bg-transparent">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editFechaFin ? format(editFechaFin, "dd/MM/yyyy") : "Seleccionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={editFechaFin} onSelect={setEditFechaFin} locale={es} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            {editFechaInicio && editFechaFin && (
              <p className="text-sm text-muted-foreground">
                {calcularDias(format(editFechaInicio, "yyyy-MM-dd"), format(editFechaFin, "yyyy-MM-dd"))} día(s)
              </p>
            )}
            <div className="grid gap-2">
              <Label>Notas</Label>
              <Textarea
                value={editNotas}
                onChange={(e) => setEditNotas(e.target.value)}
                placeholder="Observaciones opcionales..."
                rows={2}
              />
            </div>
            {editError && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" /> {editError}
              </p>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="destructive"
              className="mr-auto"
              onClick={() => setIsDeleteConfirmOpen(true)}
              disabled={isSaving}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </Button>
            <Button variant="outline" onClick={() => setIsEditVacacionDialogOpen(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleEditVacacion} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmar eliminación */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar solicitud?</DialogTitle>
            <DialogDescription>
              Esta acción eliminará permanentemente las vacaciones de{" "}
              <strong>{selectedVacacion?.empleadoNombre}</strong> del{" "}
              {selectedVacacion && formatDate(selectedVacacion.fechaInicio)} al{" "}
              {selectedVacacion && formatDate(selectedVacacion.fechaFin)}. La agenda se actualizará
              automáticamente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteVacacion} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
