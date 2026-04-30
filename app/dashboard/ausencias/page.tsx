"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import {
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Plus,
  Search,
  Loader2,
  Filter,
  UserX,
  Calendar,
  Stethoscope,
  LogOut,
  AlertTriangle,
  FileText,
  ChevronDown,
  History,
  Edit,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { getEmpleadosFromDB, type Empleado } from "@/lib/data/empleados"
import { getSucursalesActivasFromDB, type Sucursal } from "@/lib/data/sucursales"
import { getCurrentUser, type User } from "@/lib/auth"
import {
  getAusenciasFromDB,
  createAusencia,
  updateAusencia,
  aprobarAusencia,
  rechazarAusencia,
  cancelarAusencia,
  deleteAusencia,
  TIPO_AUSENCIA_LABELS,
  ESTATUS_AUSENCIA_LABELS,
  ESTATUS_AUSENCIA_COLORS,
  TIPO_AUSENCIA_COLORS,
  type Ausencia,
  type TipoAusencia,
  type EstatusAusencia,
} from "@/lib/data/ausencias"

// ─── Iconos por tipo ──────────────────────────────────────────────────────────
const TIPO_ICONS: Record<TipoAusencia, React.ReactNode> = {
  falta:             <UserX className="h-3.5 w-3.5" />,
  falta_justificada: <FileText className="h-3.5 w-3.5" />,
  permiso:           <Calendar className="h-3.5 w-3.5" />,
  incapacidad:       <Stethoscope className="h-3.5 w-3.5" />,
  salida:            <LogOut className="h-3.5 w-3.5" />,
  tarde:             <AlertTriangle className="h-3.5 w-3.5" />,
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function AusenciasPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [ausencias, setAusencias] = useState<Ausencia[]>([])
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Filtros
  const [filterEmpleado, setFilterEmpleado] = useState("todos")
  const [filterEstatus, setFilterEstatus] = useState<EstatusAusencia | "todos">("pendiente")
  const [filterTipo, setFilterTipo] = useState<TipoAusencia | "todos">("todos")
  const [searchText, setSearchText] = useState("")

  // Dialog: crear
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [formEmpleado, setFormEmpleado] = useState("")
  const [formTipo, setFormTipo] = useState<TipoAusencia>("falta")
  const [formMotivo, setFormMotivo] = useState("")
  const [formFechaInicio, setFormFechaInicio] = useState(new Date().toISOString().slice(0, 10))
  const [formFechaFin, setFormFechaFin] = useState(new Date().toISOString().slice(0, 10))
  const [formDuracionHoras, setFormDuracionHoras] = useState<string>("")
  const [formNotas, setFormNotas] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  // Dialog: rechazar
  const [isRechazarOpen, setIsRechazarOpen] = useState(false)
  const [selectedAusencia, setSelectedAusencia] = useState<Ausencia | null>(null)
  const [motivoRechazo, setMotivoRechazo] = useState("")
  const [isActuando, setIsActuando] = useState(false)

  /** Edición completa (tipo, fechas, horario, estatus) */
  const [ausenciaParaEditar, setAusenciaParaEditar] = useState<Ausencia | null>(null)
  const [formEditAusencia, setFormEditAusencia] = useState({
    empleadoId: "",
    tipo: "falta" as TipoAusencia,
    motivo: "",
    fechaInicio: "",
    fechaFin: "",
    diaCompleto: true,
    horaInicio: "10:00",
    horaFin: "12:00",
    estatus: "pendiente" as EstatusAusencia,
    motivoRechazo: "",
    notas: "",
  })
  const [isSavingEditAusencia, setIsSavingEditAusencia] = useState(false)

  // Dialog: detalle / historial
  const [isDetalleOpen, setIsDetalleOpen] = useState(false)
  const [detalleAusencia, setDetalleAusencia] = useState<Ausencia | null>(null)

  const isAdmin: boolean = Boolean(currentUser?.role === "admin")

  // ─── Carga inicial ──────────────────────────────────────────────────────────
  useEffect(() => {
    setCurrentUser(getCurrentUser())
  }, [])

  useEffect(() => {
    loadAll()
  }, [])

  useEffect(() => {
    if (!ausenciaParaEditar) return
    const a = ausenciaParaEditar
    const partial = !!(a.horaInicio && a.horaFin)
    setFormEditAusencia({
      empleadoId: a.empleadoId,
      tipo: a.tipo,
      motivo: a.motivo ?? "",
      fechaInicio: a.fechaInicio,
      fechaFin: a.fechaFin,
      diaCompleto: !partial,
      horaInicio: (a.horaInicio ?? "10:00").substring(0, 5),
      horaFin: (a.horaFin ?? "12:00").substring(0, 5),
      estatus: a.estatus,
      motivoRechazo: a.motivoRechazo ?? "",
      notas: a.notas ?? "",
    })
  }, [ausenciaParaEditar])

  async function loadAll() {
    setIsLoading(true)
    try {
      const [ausenciasData, empleadosData, sucursalesData] = await Promise.all([
        getAusenciasFromDB(),
        getEmpleadosFromDB(),
        getSucursalesActivasFromDB(),
      ])
      setAusencias(ausenciasData)
      setEmpleados(empleadosData)
      setSucursales(sucursalesData)
    } catch (err) {
      toast.error("Error al cargar datos")
    } finally {
      setIsLoading(false)
    }
  }

  // ─── Filtros derivados ──────────────────────────────────────────────────────
  const ausenciasFiltradas = useMemo(() => {
    return ausencias.filter((a) => {
      if (filterEmpleado !== "todos" && a.empleadoId !== filterEmpleado) return false
      if (filterEstatus !== "todos" && a.estatus !== filterEstatus) return false
      if (filterTipo !== "todos" && a.tipo !== filterTipo) return false
      if (searchText) {
        const q = searchText.toLowerCase()
        const nombre = (a.empleadoNombre ?? "").toLowerCase()
        const motivo = (a.motivo ?? "").toLowerCase()
        if (!nombre.includes(q) && !motivo.includes(q)) return false
      }
      return true
    })
  }, [ausencias, filterEmpleado, filterEstatus, filterTipo, searchText])

  // Contadores para el summary
  const pendientesCount = ausencias.filter((a) => a.estatus === "pendiente").length
  const aprobadasCount  = ausencias.filter((a) => a.estatus === "aprobada").length
  const rechazadasCount = ausencias.filter((a) => a.estatus === "rechazada").length

  // ─── CRUD handlers ──────────────────────────────────────────────────────────
  async function handleCrear() {
    if (!formEmpleado) { toast.error("Selecciona un empleado"); return }
    if (!formFechaInicio || !formFechaFin) { toast.error("Indica las fechas"); return }
    if (formFechaFin < formFechaInicio) { toast.error("La fecha fin debe ser >= inicio"); return }
    setIsSaving(true)
    try {
      const result = await createAusencia({
        empleadoId:    formEmpleado,
        tipo:          formTipo,
        motivo:        formMotivo || undefined,
        fechaInicio:   formFechaInicio,
        fechaFin:      formFechaFin,
        duracionHoras: formDuracionHoras ? Number(formDuracionHoras) : undefined,
        notas:         formNotas || undefined,
      })
      if (result.success) {
        toast.success("Ausencia registrada correctamente")
        setIsCreateOpen(false)
        resetForm()
        await loadAll()
      } else {
        toast.error(result.error ?? "Error al registrar")
      }
    } finally {
      setIsSaving(false)
    }
  }

  function resetForm() {
    setFormEmpleado("")
    setFormTipo("falta")
    setFormMotivo("")
    setFormFechaInicio(new Date().toISOString().slice(0, 10))
    setFormFechaFin(new Date().toISOString().slice(0, 10))
    setFormDuracionHoras("")
    setFormNotas("")
  }

  async function handleAprobar(ausencia: Ausencia) {
    setIsActuando(true)
    try {
      const responsable = currentUser?.email ?? currentUser?.name ?? "Admin"
      const result = await aprobarAusencia(ausencia.id, responsable)
      if (result.success) {
        toast.success("Ausencia aprobada")
        await loadAll()
      } else {
        toast.error(result.error ?? "Error al aprobar")
      }
    } finally {
      setIsActuando(false)
    }
  }

  async function handleRechazar() {
    if (!selectedAusencia) return
    if (!motivoRechazo.trim()) { toast.error("Indica el motivo del rechazo"); return }
    setIsActuando(true)
    try {
      const responsable = currentUser?.email ?? currentUser?.name ?? "Admin"
      const result = await rechazarAusencia(selectedAusencia.id, responsable, motivoRechazo)
      if (result.success) {
        toast.success("Ausencia rechazada")
        setIsRechazarOpen(false)
        setMotivoRechazo("")
        setSelectedAusencia(null)
        await loadAll()
      } else {
        toast.error(result.error ?? "Error al rechazar")
      }
    } finally {
      setIsActuando(false)
    }
  }

  async function handleCancelar(ausencia: Ausencia) {
    setIsActuando(true)
    try {
      const result = await cancelarAusencia(ausencia.id)
      if (result.success) {
        toast.success("Ausencia cancelada")
        await loadAll()
      } else {
        toast.error(result.error ?? "Error al cancelar")
      }
    } finally {
      setIsActuando(false)
    }
  }

  async function handleEliminar(ausencia: Ausencia) {
    if (!confirm(`¿Eliminar este registro permanentemente?`)) return
    const result = await deleteAusencia(ausencia.id)
    if (result.success) {
      toast.success("Registro eliminado")
      setAusenciaParaEditar((cur) => (cur?.id === ausencia.id ? null : cur))
      await loadAll()
    } else {
      toast.error(result.error ?? "Error al eliminar")
    }
  }

  async function handleGuardarEdicionAusencia() {
    if (!ausenciaParaEditar) return
    if (formEditAusencia.fechaFin < formEditAusencia.fechaInicio) {
      toast.error("La fecha fin debe ser igual o posterior al inicio")
      return
    }
    if (formEditAusencia.estatus === "rechazada" && !formEditAusencia.motivoRechazo.trim()) {
      toast.error("Indica el motivo del rechazo")
      return
    }
    const esParcial = !formEditAusencia.diaCompleto
    if (esParcial && horaToMinsAg(formEditAusencia.horaFin) <= horaToMinsAg(formEditAusencia.horaInicio)) {
      toast.error("La hora fin debe ser posterior a la de inicio")
      return
    }
    const durMin = esParcial
      ? (horaToMinsAg(formEditAusencia.horaFin) - horaToMinsAg(formEditAusencia.horaInicio)) / 60
      : null
    setIsSavingEditAusencia(true)
    try {
      const actor = currentUser?.name || currentUser?.email || "Usuario"
      const result = await updateAusencia(ausenciaParaEditar.id, {
        empleadoId: formEditAusencia.empleadoId,
        tipo: formEditAusencia.tipo,
        motivo: formEditAusencia.motivo.trim() || null,
        fechaInicio: formEditAusencia.fechaInicio,
        fechaFin: formEditAusencia.fechaFin,
        horaInicio: esParcial ? formEditAusencia.horaInicio : null,
        horaFin: esParcial ? formEditAusencia.horaFin : null,
        duracionHoras: esParcial && durMin != null && durMin > 0 ? durMin : null,
        estatus: formEditAusencia.estatus,
        motivoRechazo:
          formEditAusencia.estatus === "rechazada"
            ? formEditAusencia.motivoRechazo.trim() || null
            : null,
        notas: formEditAusencia.notas.trim() || null,
        actorNombre: actor,
      })
      if (result.success) {
        toast.success("Ausencia actualizada")
        setAusenciaParaEditar(null)
        await loadAll()
      } else {
        toast.error(result.error ?? "Error al guardar")
      }
    } finally {
      setIsSavingEditAusencia(false)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Ausencias</h1>
          <p className="text-muted-foreground">
            Registro y aprobación de faltas, permisos, incapacidades y salidas
          </p>
        </div>
        <Button onClick={() => { resetForm(); setIsCreateOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" />
          Registrar Ausencia
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{pendientesCount}</p>
                <p className="text-xs text-muted-foreground">Pendientes de revisión</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-2xl font-bold text-green-600">{aprobadasCount}</p>
                <p className="text-xs text-muted-foreground">Aprobadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-2xl font-bold text-red-600">{rechazadasCount}</p>
                <p className="text-xs text-muted-foreground">Rechazadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-primary" />
              <div>
                <p className="text-2xl font-bold">{ausencias.length}</p>
                <p className="text-xs text-muted-foreground">Total registros</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros + tabla */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Búsqueda */}
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por empleado o motivo..."
                className="pl-8"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>

            {/* Empleado */}
            <Select value={filterEmpleado} onValueChange={setFilterEmpleado}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Empleado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los empleados</SelectItem>
                {empleados.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nombre} {e.apellido}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Estatus */}
            <Select value={filterEstatus} onValueChange={(v) => setFilterEstatus(v as any)}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Estatus" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estatus</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="aprobada">Aprobada</SelectItem>
                <SelectItem value="rechazada">Rechazada</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>

            {/* Tipo */}
            <Select value={filterTipo} onValueChange={(v) => setFilterTipo(v as any)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los tipos</SelectItem>
                {(Object.keys(TIPO_AUSENCIA_LABELS) as TipoAusencia[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {TIPO_AUSENCIA_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : ausenciasFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <UserX className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">No hay registros con los filtros actuales</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empleado</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Fechas</TableHead>
                  <TableHead>Duración</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Estatus</TableHead>
                  <TableHead>Responsable</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ausenciasFiltradas.map((a) => (
                  <TableRow key={a.id} className="cursor-pointer hover:bg-muted/30" onClick={() => { setDetalleAusencia(a); setIsDetalleOpen(true) }}>
                    <TableCell>
                      <p className="font-medium text-sm">{a.empleadoNombre ?? a.empleadoId}</p>
                    </TableCell>
                    <TableCell>
                      <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium", TIPO_AUSENCIA_COLORS[a.tipo])}>
                        {TIPO_ICONS[a.tipo]}
                        {TIPO_AUSENCIA_LABELS[a.tipo]}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {a.fechaInicio === a.fechaFin
                        ? formatDate(a.fechaInicio)
                        : `${formatDate(a.fechaInicio)} – ${formatDate(a.fechaFin)}`}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {a.duracionHoras != null ? `${a.duracionHoras}h` : "—"}
                    </TableCell>
                    <TableCell className="text-sm max-w-[160px] truncate text-muted-foreground" title={a.motivo ?? ""}>
                      {a.motivo ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-xs border", ESTATUS_AUSENCIA_COLORS[a.estatus])}>
                        {ESTATUS_AUSENCIA_LABELS[a.estatus]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {a.aprobadoPor ?? "—"}
                      {a.fechaAprobacion && (
                        <span className="block text-[11px]">{formatDateTime(a.fechaAprobacion)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div
                        className="flex items-center justify-end gap-1 flex-wrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={isActuando}
                          onClick={() => setAusenciaParaEditar(a)}
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          Editar
                        </Button>
                        {a.estatus === "pendiente" && isAdmin && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs text-green-700 border-green-300 hover:bg-green-50"
                              disabled={isActuando}
                              onClick={() => handleAprobar(a)}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Aprobar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs text-red-700 border-red-300 hover:bg-red-50"
                              disabled={isActuando}
                              onClick={() => {
                                setSelectedAusencia(a)
                                setMotivoRechazo("")
                                setIsRechazarOpen(true)
                              }}
                            >
                              <XCircle className="h-3 w-3 mr-1" />
                              Rechazar
                            </Button>
                          </>
                        )}
                        {(a.estatus === "pendiente" || a.estatus === "aprobada") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-muted-foreground hover:text-foreground"
                            disabled={isActuando}
                            onClick={() => handleCancelar(a)}
                          >
                            Cancelar
                          </Button>
                        )}
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-destructive hover:text-destructive"
                            onClick={() => handleEliminar(a)}
                          >
                            Eliminar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ─── Dialog Crear ──────────────────────────────────────────────────────── */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar Ausencia</DialogTitle>
            <DialogDescription>
              Ingresa los datos de la ausencia. Quedará en estatus "Pendiente" hasta que sea aprobada.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Empleado *</Label>
                <Select value={formEmpleado} onValueChange={setFormEmpleado}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar empleado" />
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

              <div className="col-span-2 space-y-1.5">
                <Label>Tipo de ausencia *</Label>
                <Select value={formTipo} onValueChange={(v) => setFormTipo(v as TipoAusencia)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TIPO_AUSENCIA_LABELS) as TipoAusencia[]).map((t) => (
                      <SelectItem key={t} value={t}>
                        <span className="flex items-center gap-2">
                          {TIPO_ICONS[t]}
                          {TIPO_AUSENCIA_LABELS[t]}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Fecha inicio *</Label>
                <Input
                  type="date"
                  value={formFechaInicio}
                  onChange={(e) => {
                    setFormFechaInicio(e.target.value)
                    if (e.target.value > formFechaFin) setFormFechaFin(e.target.value)
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Fecha fin *</Label>
                <Input
                  type="date"
                  value={formFechaFin}
                  min={formFechaInicio}
                  onChange={(e) => setFormFechaFin(e.target.value)}
                />
              </div>

              {(formTipo === "salida" || formTipo === "tarde") && (
                <div className="col-span-2 space-y-1.5">
                  <Label>Horas de ausencia</Label>
                  <Input
                    type="number"
                    min={0.5}
                    max={12}
                    step={0.5}
                    placeholder="Ej. 2.5"
                    value={formDuracionHoras}
                    onChange={(e) => setFormDuracionHoras(e.target.value)}
                  />
                </div>
              )}

              <div className="col-span-2 space-y-1.5">
                <Label>Motivo</Label>
                <Textarea
                  placeholder="Describe brevemente el motivo..."
                  rows={2}
                  value={formMotivo}
                  onChange={(e) => setFormMotivo(e.target.value)}
                />
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label>Notas internas</Label>
                <Textarea
                  placeholder="Notas para el equipo administrativo (opcional)..."
                  rows={2}
                  value={formNotas}
                  onChange={(e) => setFormNotas(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCrear} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog Rechazar ───────────────────────────────────────────────────── */}
      <Dialog open={isRechazarOpen} onOpenChange={setIsRechazarOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-4 w-4" />
              Rechazar ausencia
            </DialogTitle>
            <DialogDescription>
              {selectedAusencia && (
                <>
                  <span className="font-medium">{selectedAusencia.empleadoNombre}</span>
                  {" — "}{TIPO_AUSENCIA_LABELS[selectedAusencia.tipo]}
                  <br />
                  {formatDate(selectedAusencia.fechaInicio)}
                  {selectedAusencia.fechaInicio !== selectedAusencia.fechaFin &&
                    ` – ${formatDate(selectedAusencia.fechaFin)}`}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Motivo del rechazo *</Label>
            <Textarea
              placeholder="Explica el motivo del rechazo..."
              rows={3}
              value={motivoRechazo}
              onChange={(e) => setMotivoRechazo(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRechazarOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleRechazar} disabled={isActuando}>
              {isActuando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Rechazar ausencia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog Editar ───────────────────────────────────────────────────────── */}
      <Dialog
        open={!!ausenciaParaEditar}
        onOpenChange={(open) => {
          if (!open) setAusenciaParaEditar(null)
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-4 w-4" />
              Editar ausencia
            </DialogTitle>
            <DialogDescription>
              Actualiza tipo, fechas, horario parcial o día completo, y estatus.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Empleado *</Label>
                <Select
                  value={formEditAusencia.empleadoId}
                  onValueChange={(v) => setFormEditAusencia((p) => ({ ...p, empleadoId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar..." />
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

              <div className="col-span-2 space-y-1.5">
                <Label>Tipo *</Label>
                <Select
                  value={formEditAusencia.tipo}
                  onValueChange={(v) => setFormEditAusencia((p) => ({ ...p, tipo: v as TipoAusencia }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TIPO_AUSENCIA_LABELS) as TipoAusencia[]).map((t) => (
                      <SelectItem key={t} value={t}>
                        <span className="flex items-center gap-2">
                          {TIPO_ICONS[t]}
                          {TIPO_AUSENCIA_LABELS[t]}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Fecha inicio *</Label>
                <Input
                  type="date"
                  value={formEditAusencia.fechaInicio}
                  onChange={(e) => {
                    const v = e.target.value
                    setFormEditAusencia((p) => ({
                      ...p,
                      fechaInicio: v,
                      fechaFin: v > p.fechaFin ? v : p.fechaFin,
                    }))
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Fecha fin *</Label>
                <Input
                  type="date"
                  min={formEditAusencia.fechaInicio}
                  value={formEditAusencia.fechaFin}
                  onChange={(e) => setFormEditAusencia((p) => ({ ...p, fechaFin: e.target.value }))}
                />
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label>Estatus</Label>
                <Select
                  value={formEditAusencia.estatus}
                  onValueChange={(v) => setFormEditAusencia((p) => ({ ...p, estatus: v as EstatusAusencia }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ESTATUS_AUSENCIA_LABELS) as EstatusAusencia[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {ESTATUS_AUSENCIA_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormEditAusencia((p) => ({ ...p, diaCompleto: true }))}
                  className={cn(
                    "flex-1 h-9 text-xs rounded-md border font-medium transition-colors",
                    formEditAusencia.diaCompleto
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:bg-muted",
                  )}
                >
                  Día completo
                </button>
                <button
                  type="button"
                  onClick={() => setFormEditAusencia((p) => ({ ...p, diaCompleto: false }))}
                  className={cn(
                    "flex-1 h-9 text-xs rounded-md border font-medium transition-colors",
                    !formEditAusencia.diaCompleto
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:bg-muted",
                  )}
                >
                  Rango de horas
                </button>
              </div>

              {!formEditAusencia.diaCompleto && (
                <>
                  <div className="space-y-1.5">
                    <Label>Hora inicio</Label>
                    <Select
                      value={formEditAusencia.horaInicio}
                      onValueChange={(v) => setFormEditAusencia((p) => ({ ...p, horaInicio: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-52">
                        {Array.from({ length: 21 }, (_, i) => {
                          const h = Math.floor(i / 2) + 10
                          const m = i % 2 === 0 ? "00" : "30"
                          const val = `${String(h).padStart(2, "0")}:${m}`
                          return (
                            <SelectItem key={val} value={val}>
                              {val}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Hora fin</Label>
                    <Select
                      value={formEditAusencia.horaFin}
                      onValueChange={(v) => setFormEditAusencia((p) => ({ ...p, horaFin: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-52">
                        {Array.from({ length: 21 }, (_, i) => {
                          const h = Math.floor(i / 2) + 10
                          const m = i % 2 === 0 ? "00" : "30"
                          const val = `${String(h).padStart(2, "0")}:${m}`
                          return (
                            <SelectItem key={val} value={val}>
                              {val}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <div className="col-span-2 space-y-1.5">
                <Label>Motivo</Label>
                <Textarea
                  rows={2}
                  value={formEditAusencia.motivo}
                  onChange={(e) => setFormEditAusencia((p) => ({ ...p, motivo: e.target.value }))}
                />
              </div>

              {formEditAusencia.estatus === "rechazada" && (
                <div className="col-span-2 space-y-1.5">
                  <Label>Motivo del rechazo *</Label>
                  <Textarea
                    rows={2}
                    placeholder="Motivo..."
                    value={formEditAusencia.motivoRechazo}
                    onChange={(e) => setFormEditAusencia((p) => ({ ...p, motivoRechazo: e.target.value }))}
                  />
                </div>
              )}

              <div className="col-span-2 space-y-1.5">
                <Label>Notas internas</Label>
                <Textarea
                  rows={2}
                  placeholder="Notas administrativas..."
                  value={formEditAusencia.notas}
                  onChange={(e) => setFormEditAusencia((p) => ({ ...p, notas: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="destructive"
              disabled={!ausenciaParaEditar || isSavingEditAusencia}
              onClick={() => ausenciaParaEditar && handleEliminar(ausenciaParaEditar)}
            >
              Eliminar
            </Button>
            <div className="flex gap-2 w-full sm:w-auto justify-end">
              <Button type="button" variant="outline" onClick={() => setAusenciaParaEditar(null)}>
                Cancelar
              </Button>
              <Button type="button" disabled={isSavingEditAusencia} onClick={() => void handleGuardarEdicionAusencia()}>
                {isSavingEditAusencia && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Guardar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog Detalle / Historial ────────────────────────────────────────── */}
      <Dialog open={isDetalleOpen} onOpenChange={setIsDetalleOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Detalle de ausencia
            </DialogTitle>
          </DialogHeader>
          {detalleAusencia && (
            <div className="space-y-4 py-2 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Empleado</p>
                  <p className="font-medium">{detalleAusencia.empleadoNombre}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tipo</p>
                  <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", TIPO_AUSENCIA_COLORS[detalleAusencia.tipo])}>
                    {TIPO_ICONS[detalleAusencia.tipo]}
                    {TIPO_AUSENCIA_LABELS[detalleAusencia.tipo]}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fecha inicio</p>
                  <p>{formatDate(detalleAusencia.fechaInicio)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fecha fin</p>
                  <p>{formatDate(detalleAusencia.fechaFin)}</p>
                </div>
                {detalleAusencia.duracionHoras != null && (
                  <div>
                    <p className="text-xs text-muted-foreground">Duración</p>
                    <p>{detalleAusencia.duracionHoras} horas</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Estatus</p>
                  <Badge className={cn("text-xs border", ESTATUS_AUSENCIA_COLORS[detalleAusencia.estatus])}>
                    {ESTATUS_AUSENCIA_LABELS[detalleAusencia.estatus]}
                  </Badge>
                </div>
              </div>

              {detalleAusencia.motivo && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Motivo</p>
                  <p className="bg-muted/50 rounded p-2 text-sm">{detalleAusencia.motivo}</p>
                </div>
              )}

              {detalleAusencia.notas && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Notas internas</p>
                  <p className="bg-muted/50 rounded p-2 text-sm">{detalleAusencia.notas}</p>
                </div>
              )}

              <Separator />

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Historial de aprobación
                </p>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="h-2 w-2 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                    <div>
                      <p className="text-xs font-medium">Solicitud registrada</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(detalleAusencia.createdAt)}</p>
                    </div>
                  </div>
                  {detalleAusencia.fechaAprobacion && (
                    <div className="flex items-start gap-2">
                      <div className={cn("h-2 w-2 rounded-full mt-1.5 shrink-0",
                        detalleAusencia.estatus === "aprobada" ? "bg-green-500" : "bg-red-500"
                      )} />
                      <div>
                        <p className="text-xs font-medium">
                          {detalleAusencia.estatus === "aprobada" ? "Aprobada" : "Rechazada"} por{" "}
                          <span className="text-foreground">{detalleAusencia.aprobadoPor}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">{formatDateTime(detalleAusencia.fechaAprobacion)}</p>
                        {detalleAusencia.motivoRechazo && (
                          <p className="text-xs text-red-600 mt-0.5">"{detalleAusencia.motivoRechazo}"</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetalleOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Helpers de formato ───────────────────────────────────────────────────────
function horaToMinsAg(hora: string): number {
  const [h, m] = hora.substring(0, 5).split(":").map(Number)
  return h * 60 + m
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function formatDateTime(isoStr: string): string {
  return new Date(isoStr).toLocaleString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}
