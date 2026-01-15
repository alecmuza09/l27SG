"use client"

import { useState, useEffect } from "react"
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
import { Plus, CalendarIcon, CheckCircle, XCircle, Clock, Users, AlertCircle, Lock, Edit } from "lucide-react"
import { getEmpleadosFromDB, type Empleado } from "@/lib/data/empleados"
import { getSucursalesActivasFromDB, type Sucursal } from "@/lib/data/sucursales"
import {
  getVacaciones,
  saveVacaciones,
  getSaldosVacaciones,
  saveSaldosVacaciones,
  getPeriodosBloqueados,
  savePeriodosBloqueados,
  calcularDias,
  verificarConflictoVacaciones,
} from "@/lib/data/vacaciones"
import type { Vacacion, SaldoVacaciones, PeriodoBloqueado } from "@/lib/types/vacaciones"

const estadoColors: Record<Vacacion["estado"], string> = {
  pendiente: "bg-yellow-100 text-yellow-800",
  aprobada: "bg-green-100 text-green-800",
  rechazada: "bg-red-100 text-red-800",
  cancelada: "bg-gray-100 text-gray-800",
}

export default function VacacionesPage() {
  const [vacaciones, setVacaciones] = useState<Vacacion[]>([])
  const [saldos, setSaldos] = useState<SaldoVacaciones[]>([])
  const [periodos, setPeriodos] = useState<PeriodoBloqueado[]>([])
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [filterSucursal, setFilterSucursal] = useState<string>("todos")
  const [filterEstado, setFilterEstado] = useState<string>("todos")

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false)
  const [isEditSaldoDialogOpen, setIsEditSaldoDialogOpen] = useState(false)
  const [isBlockPeriodDialogOpen, setIsBlockPeriodDialogOpen] = useState(false)
  const [selectedVacacion, setSelectedVacacion] = useState<Vacacion | null>(null)
  const [selectedSaldo, setSelectedSaldo] = useState<SaldoVacaciones | null>(null)

  // Form states
  const [formEmpleado, setFormEmpleado] = useState("")
  const [formFechaInicio, setFormFechaInicio] = useState<Date>()
  const [formFechaFin, setFormFechaFin] = useState<Date>()
  const [formNotas, setFormNotas] = useState("")
  const [rejectMotivo, setRejectMotivo] = useState("")
  const [editDiasCorrespondientes, setEditDiasCorrespondientes] = useState("")
  const [editDiasTomados, setEditDiasTomados] = useState("")
  const [blockFechaInicio, setBlockFechaInicio] = useState<Date>()
  const [blockFechaFin, setBlockFechaFin] = useState<Date>()
  const [blockMotivo, setBlockMotivo] = useState("")
  const [blockSucursal, setBlockSucursal] = useState("all")
  const [error, setError] = useState("")

  // Calendar view
  const [calendarMonth, setCalendarMonth] = useState(new Date())

  useEffect(() => {
    setVacaciones(getVacaciones())
    setSaldos(getSaldosVacaciones())
    setPeriodos(getPeriodosBloqueados())
    
    async function loadData() {
      const [empleadosData, sucursalesData] = await Promise.all([
        getEmpleadosFromDB(),
        getSucursalesActivasFromDB()
      ])
      setEmpleados(empleadosData)
      setSucursales(sucursalesData)
    }
    loadData()
  }, [])

  const filteredVacaciones = vacaciones.filter((vac) => {
    const matchesSucursal = filterSucursal === "todos" || vac.sucursalId === filterSucursal
    const matchesEstado = filterEstado === "todos" || vac.estado === filterEstado
    return matchesSucursal && matchesEstado
  })

  // Estadísticas
  const pendientes = vacaciones.filter((v) => v.estado === "pendiente").length
  const aprobadas = vacaciones.filter((v) => v.estado === "aprobada").length
  const empleadosConVacaciones = new Set(vacaciones.filter((v) => v.estado === "aprobada").map((v) => v.empleadoId))
    .size

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  const resetForm = () => {
    setFormEmpleado("")
    setFormFechaInicio(undefined)
    setFormFechaFin(undefined)
    setFormNotas("")
    setError("")
  }

  const handleCreateVacacion = () => {
    if (!formEmpleado || !formFechaInicio || !formFechaFin) {
      setError("Completa todos los campos requeridos")
      return
    }

    const empleado = empleados.find((e) => e.id === formEmpleado)
    if (!empleado) return

    const fechaInicioStr = format(formFechaInicio, "yyyy-MM-dd")
    const fechaFinStr = format(formFechaFin, "yyyy-MM-dd")

    // Verificar conflictos
    const conflicto = verificarConflictoVacaciones(formEmpleado, fechaInicioStr, fechaFinStr)
    if (conflicto) {
      setError(
        `El empleado ya tiene vacaciones del ${formatDate(conflicto.fechaInicio)} al ${formatDate(conflicto.fechaFin)}`,
      )
      return
    }

    const dias = calcularDias(fechaInicioStr, fechaFinStr)
    const sucursal = sucursales.find((s) => s.id === empleado.sucursalId)

    const newVacacion: Vacacion = {
      id: `vac-${Date.now()}`,
      empleadoId: empleado.id,
      empleadoNombre: empleado.nombre,
      sucursalId: empleado.sucursalId,
      sucursalNombre: sucursal?.nombre || "",
      fechaInicio: fechaInicioStr,
      fechaFin: fechaFinStr,
      diasSolicitados: dias,
      estado: "pendiente",
      motivoRechazo: null,
      aprobadoPorId: null,
      aprobadoPorNombre: null,
      fechaSolicitud: new Date().toISOString(),
      fechaResolucion: null,
      notas: formNotas || null,
    }

    const updated = [...vacaciones, newVacacion]
    setVacaciones(updated)
    saveVacaciones(updated)
    resetForm()
    setIsCreateDialogOpen(false)
  }

  const handleAprobarVacacion = (vac: Vacacion) => {
    // Actualizar saldo del empleado
    const updatedSaldos = saldos.map((s) =>
      s.empleadoId === vac.empleadoId
        ? {
            ...s,
            diasTomados: s.diasTomados + vac.diasSolicitados,
            diasDisponibles: s.diasDisponibles - vac.diasSolicitados,
            fechaActualizacion: new Date().toISOString(),
          }
        : s,
    )
    setSaldos(updatedSaldos)
    saveSaldosVacaciones(updatedSaldos)

    const updated = vacaciones.map((v) =>
      v.id === vac.id
        ? {
            ...v,
            estado: "aprobada" as const,
            aprobadoPorId: "admin",
            aprobadoPorNombre: "Admin Luna27",
            fechaResolucion: new Date().toISOString(),
          }
        : v,
    )
    setVacaciones(updated)
    saveVacaciones(updated)
  }

  const handleRechazarVacacion = () => {
    if (!selectedVacacion || !rejectMotivo) return

    const updated = vacaciones.map((v) =>
      v.id === selectedVacacion.id
        ? {
            ...v,
            estado: "rechazada" as const,
            motivoRechazo: rejectMotivo,
            aprobadoPorId: "admin",
            aprobadoPorNombre: "Admin Luna27",
            fechaResolucion: new Date().toISOString(),
          }
        : v,
    )
    setVacaciones(updated)
    saveVacaciones(updated)
    setRejectMotivo("")
    setSelectedVacacion(null)
    setIsRejectDialogOpen(false)
  }

  const handleEditSaldo = () => {
    if (!selectedSaldo) return

    const updated = saldos.map((s) =>
      s.id === selectedSaldo.id
        ? {
            ...s,
            diasCorrespondientes: Number.parseInt(editDiasCorrespondientes) || s.diasCorrespondientes,
            diasTomados: Number.parseInt(editDiasTomados) || 0,
            diasDisponibles:
              (Number.parseInt(editDiasCorrespondientes) || s.diasCorrespondientes) -
              (Number.parseInt(editDiasTomados) || 0),
            fechaActualizacion: new Date().toISOString(),
          }
        : s,
    )
    setSaldos(updated)
    saveSaldosVacaciones(updated)
    setIsEditSaldoDialogOpen(false)
    setSelectedSaldo(null)
  }

  const handleBlockPeriod = () => {
    if (!blockFechaInicio || !blockFechaFin || !blockMotivo) return

    const sucursal =
      blockSucursal === "all"
        ? { id: "all", nombre: "Todas las Sucursales" }
        : sucursales.find((s) => s.id === blockSucursal)

    const newPeriodo: PeriodoBloqueado = {
      id: `pb-${Date.now()}`,
      sucursalId: blockSucursal,
      sucursalNombre: sucursal?.nombre || "",
      fechaInicio: format(blockFechaInicio, "yyyy-MM-dd"),
      fechaFin: format(blockFechaFin, "yyyy-MM-dd"),
      motivo: blockMotivo,
      creadoPorId: "admin",
      creadoPorNombre: "Admin Luna27",
    }

    const updated = [...periodos, newPeriodo]
    setPeriodos(updated)
    savePeriodosBloqueados(updated)
    setBlockFechaInicio(undefined)
    setBlockFechaFin(undefined)
    setBlockMotivo("")
    setBlockSucursal("all")
    setIsBlockPeriodDialogOpen(false)
  }

  // Generar días del mes para el calendario visual
  const getDaysInMonth = () => {
    const year = calendarMonth.getFullYear()
    const month = calendarMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    return eachDayOfInterval({ start: firstDay, end: lastDay })
  }

  const getVacacionesForDay = (day: Date) => {
    return vacaciones.filter((vac) => {
      if (vac.estado !== "aprobada") return false
      const inicio = new Date(vac.fechaInicio)
      const fin = new Date(vac.fechaFin)
      return isWithinInterval(day, { start: inicio, end: fin })
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestión de Vacaciones</h1>
          <p className="text-muted-foreground">Administra los periodos de descanso del personal</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsBlockPeriodDialogOpen(true)}>
            <Lock className="mr-2 h-4 w-4" />
            Bloquear Periodo
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva Solicitud
          </Button>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendientes}</div>
            <p className="text-xs text-muted-foreground">por aprobar</p>
          </CardContent>
        </Card>
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Periodos Bloqueados</CardTitle>
            <Lock className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{periodos.length}</div>
            <p className="text-xs text-muted-foreground">configurados</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="solicitudes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="solicitudes">
            Solicitudes
            {pendientes > 0 && (
              <Badge variant="destructive" className="ml-2">
                {pendientes}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="calendario">Calendario</TabsTrigger>
          <TabsTrigger value="saldos">Saldos</TabsTrigger>
          <TabsTrigger value="periodos">Periodos Bloqueados</TabsTrigger>
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
                  <Select value={filterSucursal} onValueChange={setFilterSucursal}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Sucursal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todas las sucursales</SelectItem>
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
                      <SelectItem value="pendiente">Pendiente</SelectItem>
                      <SelectItem value="aprobada">Aprobada</SelectItem>
                      <SelectItem value="rechazada">Rechazada</SelectItem>
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
                      <TableCell className="text-right">
                        {vac.estado === "pendiente" && (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600 bg-transparent"
                              onClick={() => handleAprobarVacacion(vac)}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 bg-transparent"
                              onClick={() => {
                                setSelectedVacacion(vac)
                                setIsRejectDialogOpen(true)
                              }}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                        {vac.motivoRechazo && <p className="text-xs text-red-600 mt-1">{vac.motivoRechazo}</p>}
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
                {getDaysInMonth().map((day, index) => {
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

        {/* Tab: Saldos */}
        <TabsContent value="saldos">
          <Card>
            <CardHeader>
              <CardTitle>Saldo de Vacaciones por Empleado</CardTitle>
              <CardDescription>Días asignados y disponibles (configuración manual)</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empleado</TableHead>
                    <TableHead>Año</TableHead>
                    <TableHead>Días Correspondientes</TableHead>
                    <TableHead>Días Tomados</TableHead>
                    <TableHead>Días Disponibles</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {saldos.map((saldo) => (
                    <TableRow key={saldo.id}>
                      <TableCell className="font-medium">{saldo.empleadoNombre}</TableCell>
                      <TableCell>{saldo.anio}</TableCell>
                      <TableCell>{saldo.diasCorrespondientes}</TableCell>
                      <TableCell>{saldo.diasTomados}</TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            saldo.diasDisponibles > 5
                              ? "bg-green-100 text-green-800"
                              : saldo.diasDisponibles > 0
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-red-100 text-red-800",
                          )}
                        >
                          {saldo.diasDisponibles}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedSaldo(saldo)
                            setEditDiasCorrespondientes(saldo.diasCorrespondientes.toString())
                            setEditDiasTomados(saldo.diasTomados.toString())
                            setIsEditSaldoDialogOpen(true)
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Periodos Bloqueados */}
        <TabsContent value="periodos">
          <Card>
            <CardHeader>
              <CardTitle>Periodos Bloqueados</CardTitle>
              <CardDescription>Fechas donde no se permiten vacaciones</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sucursal</TableHead>
                    <TableHead>Periodo</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Creado por</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periodos.map((periodo) => (
                    <TableRow key={periodo.id}>
                      <TableCell>{periodo.sucursalNombre}</TableCell>
                      <TableCell>
                        {formatDate(periodo.fechaInicio)} - {formatDate(periodo.fechaFin)}
                      </TableCell>
                      <TableCell>{periodo.motivo}</TableCell>
                      <TableCell>{periodo.creadoPorNombre}</TableCell>
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
              <Label>Empleado *</Label>
              <Select value={formEmpleado} onValueChange={setFormEmpleado}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar empleado" />
                </SelectTrigger>
                <SelectContent>
                  {empleados.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.nombre}
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

      {/* Dialog: Rechazar */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar Solicitud</DialogTitle>
            <DialogDescription>Indica el motivo del rechazo para {selectedVacacion?.empleadoNombre}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Motivo del Rechazo *</Label>
            <Textarea
              value={rejectMotivo}
              onChange={(e) => setRejectMotivo(e.target.value)}
              placeholder="Ej: Coincide con periodo de alta demanda..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleRechazarVacacion} disabled={!rejectMotivo}>
              Rechazar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Editar Saldo */}
      <Dialog open={isEditSaldoDialogOpen} onOpenChange={setIsEditSaldoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Saldo de Vacaciones</DialogTitle>
            <DialogDescription>{selectedSaldo?.empleadoNombre}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Días Correspondientes</Label>
              <Input
                type="number"
                value={editDiasCorrespondientes}
                onChange={(e) => setEditDiasCorrespondientes(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Días Tomados</Label>
              <Input type="number" value={editDiasTomados} onChange={(e) => setEditDiasTomados(e.target.value)} />
            </div>
            <p className="text-sm text-muted-foreground">
              Días Disponibles:{" "}
              <strong>
                {(Number.parseInt(editDiasCorrespondientes) || 0) - (Number.parseInt(editDiasTomados) || 0)}
              </strong>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditSaldoDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEditSaldo}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Bloquear Periodo */}
      <Dialog open={isBlockPeriodDialogOpen} onOpenChange={setIsBlockPeriodDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bloquear Periodo</DialogTitle>
            <DialogDescription>Define un periodo donde no se permiten vacaciones</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Sucursal</Label>
              <Select value={blockSucursal} onValueChange={setBlockSucursal}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las Sucursales</SelectItem>
                  {sucursales.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nombre}
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
                      {blockFechaInicio ? format(blockFechaInicio, "dd/MM/yyyy") : "Seleccionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={blockFechaInicio} onSelect={setBlockFechaInicio} locale={es} />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid gap-2">
                <Label>Fecha Fin *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start bg-transparent">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {blockFechaFin ? format(blockFechaFin, "dd/MM/yyyy") : "Seleccionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={blockFechaFin} onSelect={setBlockFechaFin} locale={es} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Motivo *</Label>
              <Input
                value={blockMotivo}
                onChange={(e) => setBlockMotivo(e.target.value)}
                placeholder="Ej: Temporada alta, evento especial..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBlockPeriodDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleBlockPeriod}>Bloquear Periodo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
