"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Plus,
  Search,
  Mail,
  Phone,
  CalendarDays,
  Edit,
  Trash2,
  Award,
  Loader2,
  Filter,
  RotateCcw,
  Building2,
  ChevronsUpDown,
  Check,
  ChevronDown,
  ChevronUp,
  UserX,
} from "lucide-react"
import {
  guardarAsignacionSucursalDia,
  quitarAsignacionSucursalDia,
  getHistorialEmpleadoSucursalDia,
  getOverrideSucursalDia,
  type HistorialEmpleadoSucursalDiaItem,
} from "@/lib/data/empleado-sucursal-dia"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  getCurrentUser,
  collectEffectiveSucursalIds,
  effectivePrimarySucursalId,
  userHasMultiBranchScope,
  checkPermission,
  type User,
} from "@/lib/auth"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { getSucursalesActivasFromDB, getSucursalesByIdsFromDB, type Sucursal } from "@/lib/data/sucursales"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import {
  getEmpleadosFromDB,
  getEmpleadosEliminadosFromDB,
  createEmpleado,
  eliminarEmpleado,
  restaurarEmpleado,
  updateEmpleado,
  type Empleado,
} from "@/lib/data/empleados"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
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

function formatearFechaEmpleadoMX(iso: string | null | undefined) {
  if (!iso) return ""
  const part = iso.split("T")[0]
  const [y, m, d] = part.split("-").map(Number)
  if (!y || !m || !d) return part
  return new Date(y, m - 1, d).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export default function EmpleadosPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [empleadosEliminados, setEmpleadosEliminados] = useState<Empleado[]>([])
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [sucursalFilter, setSucursalFilter] = useState<string>("todas")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingEmpleado, setEditingEmpleado] = useState<Empleado | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [empleadoToDelete, setEmpleadoToDelete] = useState<Empleado | null>(null)
  const [desactivarDialogOpen, setDesactivarDialogOpen] = useState(false)
  const [empleadoToDesactivar, setEmpleadoToDesactivar] = useState<Empleado | null>(null)
  const [activeTab, setActiveTab] = useState<"activos" | "eliminados">("activos")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formNuevo, setFormNuevo] = useState({
    nombre: "",
    apellido: "",
    email: "",
    telefono: "",
    rol: "" as "" | "terapeuta" | "esteticista" | "recepcionista" | "manager",
    sucursalId: "",
    horarioInicio: "09:00",
    horarioFin: "18:00",
    diasTrabajo: [1, 2, 3, 4, 5] as number[],
    comision: 30,
    fechaIngreso: "",
    fechaContratoHasta: "",
  })

  const hoyStr = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  }

  const [fechaAsignacionDia, setFechaAsignacionDia] = useState(hoyStr)
  const [empleadoAsignacionId, setEmpleadoAsignacionId] = useState("")
  const [sucursalAsignacionDestinoId, setSucursalAsignacionDestinoId] = useState("")
  const [hayOverrideAsignacion, setHayOverrideAsignacion] = useState(false)
  const [historialSucursalDia, setHistorialSucursalDia] = useState<HistorialEmpleadoSucursalDiaItem[]>([])
  const [loadingHistorialSucursal, setLoadingHistorialSucursal] = useState(false)
  const [guardandoAsignacionDia, setGuardandoAsignacionDia] = useState(false)
  const [empleadoAsignPopoverOpen, setEmpleadoAsignPopoverOpen] = useState(false)
  const [historialExpandido, setHistorialExpandido] = useState(false)
  const [listaExpandida, setListaExpandida] = useState(false)
  const [especialidadesExpandidas, setEspecialidadesExpandidas] = useState(false)

  // Calcular isAdmin de forma segura (siempre definido)
  const isAdmin: boolean = Boolean(currentUser?.role === 'admin' || currentUser?.role === 'superadmin')
  const canEditEmpleados = checkPermission(currentUser, "manager")
  const userBranchIds = collectEffectiveSucursalIds(currentUser)
  const multiBranch = userHasMultiBranchScope(currentUser)
  const singleBranchId = userBranchIds.length === 1 ? userBranchIds[0] : undefined

  async function loadEmpleados() {
    try {
      setIsLoading(true)
      setError(null)
      
      const sucursalIdFilter = isAdmin ? undefined : multiBranch ? undefined : effectivePrimarySucursalId(currentUser)
      
      const [empleadosData, empleadosEliminadosData, sucursalesData] = await Promise.all([
        getEmpleadosFromDB(sucursalIdFilter),
        getEmpleadosEliminadosFromDB(sucursalIdFilter),
        isAdmin ? getSucursalesActivasFromDB() : getSucursalesByIdsFromDB(userBranchIds),
      ])
      
      setEmpleados(empleadosData)
      setEmpleadosEliminados(empleadosEliminadosData)
      setSucursales(sucursalesData)
      
      if (!isAdmin && singleBranchId && sucursalesData.length > 0) {
        setSucursalFilter(singleBranchId)
      }
      if (!isAdmin && multiBranch) {
        setSucursalFilter("todas")
      }
    } catch (err) {
      console.error('Error cargando empleados:', err)
      setError('Error al cargar los empleados. Por favor, intenta de nuevo.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const user = getCurrentUser()
    setCurrentUser(user)
  }, [])

  useEffect(() => {
    if (currentUser) {
      loadEmpleados()
    }
  }, [currentUser])

  useEffect(() => {
    if (isDialogOpen && !isAdmin && !multiBranch && singleBranchId) {
      setFormNuevo((prev) => ({ ...prev, sucursalId: singleBranchId }))
    }
  }, [isDialogOpen, isAdmin, multiBranch, singleBranchId])

  useEffect(() => {
    if (!empleadoAsignacionId || !fechaAsignacionDia) {
      setHayOverrideAsignacion(false)
      setSucursalAsignacionDestinoId("")
      return
    }
    let cancelled = false
    void (async () => {
      const ov = await getOverrideSucursalDia(empleadoAsignacionId, fechaAsignacionDia)
      const emp = empleados.find((e) => e.id === empleadoAsignacionId)
      if (cancelled) return
      setHayOverrideAsignacion(!!ov)
      setSucursalAsignacionDestinoId(ov ?? emp?.sucursalId ?? "")
    })()
    return () => {
      cancelled = true
    }
  }, [empleadoAsignacionId, fechaAsignacionDia, empleados])

  async function loadHistorialSucursal() {
    if (!isAdmin) return
    setLoadingHistorialSucursal(true)
    try {
      const rows = await getHistorialEmpleadoSucursalDia({ limit: 50 })
      setHistorialSucursalDia(rows)
    } finally {
      setLoadingHistorialSucursal(false)
    }
  }

  useEffect(() => {
    if (currentUser && isAdmin) void loadHistorialSucursal()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar usuario/admin
  }, [currentUser, isAdmin])

  const filteredEmpleados = (activeTab === "activos" ? empleados : empleadosEliminados).filter((e) => {
    const matchesSearch = searchQuery
      ? e.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.apellido.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.email && e.email.toLowerCase().includes(searchQuery.toLowerCase()))
      : true

    const matchesSucursal = sucursalFilter === "todas" || e.sucursalId === sucursalFilter

    return matchesSearch && matchesSucursal
  })

  function contratoVencido(fecha?: string | null): boolean {
    if (!fecha) return false
    return new Date(fecha + "T12:00:00") < new Date()
  }

  function diasParaVencer(fecha?: string | null): number | null {
    if (!fecha) return null
    const diff = new Date(fecha + "T12:00:00").getTime() - new Date().getTime()
    return Math.ceil(diff / 86400000)
  }

  const handleEliminar = async () => {
    if (!empleadoToDelete) return
    
    const result = await eliminarEmpleado(empleadoToDelete.id)
    if (result.success) {
      toast.success(`Empleado ${empleadoToDelete.nombre} ${empleadoToDelete.apellido} eliminado`)
      setDeleteDialogOpen(false)
      setEmpleadoToDelete(null)
      await loadEmpleados()
    } else {
      toast.error(`Error al eliminar empleado: ${result.error}`)
    }
  }

  const handleDesactivar = async () => {
    if (!empleadoToDesactivar) return
    const result = await updateEmpleado(empleadoToDesactivar.id, { activo: false })
    if (result.success) {
      toast.success(`${empleadoToDesactivar.nombre} ${empleadoToDesactivar.apellido} desactivada por contrato vencido`)
      setDesactivarDialogOpen(false)
      setEmpleadoToDesactivar(null)
      await loadEmpleados()
    } else {
      toast.error(`Error al desactivar: ${result.error}`)
    }
  }

  const handleRestaurar = async (empleado: Empleado) => {
    const result = await restaurarEmpleado(empleado.id)
    if (result.success) {
      toast.success(`Empleado ${empleado.nombre} ${empleado.apellido} restaurado`)
      await loadEmpleados()
    } else {
      toast.error(`Error al restaurar empleado: ${result.error}`)
    }
  }

  const handleEdit = (empleado: Empleado) => {
    setEditingEmpleado(empleado)
    setIsEditDialogOpen(true)
  }

  const handleGuardarAsignacionDia = async () => {
    if (!empleadoAsignacionId || !sucursalAsignacionDestinoId) {
      toast.error("Selecciona empleada y sucursal destino")
      return
    }
    setGuardandoAsignacionDia(true)
    try {
      const res = await guardarAsignacionSucursalDia({
        empleadoId: empleadoAsignacionId,
        fecha: fechaAsignacionDia,
        sucursalId: sucursalAsignacionDestinoId,
        usuarioId: currentUser?.id ?? null,
      })
      if (!res.success) {
        toast.error(res.error ?? "Error al guardar")
        return
      }
      toast.success("Asignación guardada para ese día")
      await loadHistorialSucursal()
      const ov = await getOverrideSucursalDia(empleadoAsignacionId, fechaAsignacionDia)
      setHayOverrideAsignacion(!!ov)
    } finally {
      setGuardandoAsignacionDia(false)
    }
  }

  const handleQuitarAsignacionDia = async () => {
    if (!empleadoAsignacionId) return
    setGuardandoAsignacionDia(true)
    try {
      const res = await quitarAsignacionSucursalDia(
        empleadoAsignacionId,
        fechaAsignacionDia,
        currentUser?.id ?? null,
      )
      if (!res.success) {
        toast.error(res.error ?? "Error al quitar asignación")
        return
      }
      toast.success("Se quitó la asignación especial; aplica sucursal base")
      await loadHistorialSucursal()
      const emp = empleados.find((e) => e.id === empleadoAsignacionId)
      setHayOverrideAsignacion(false)
      setSucursalAsignacionDestinoId(emp?.sucursalId ?? "")
    } finally {
      setGuardandoAsignacionDia(false)
    }
  }

  const stats = {
    total: empleados.length,
    activos: empleados.filter((e) => e.activo).length,
    terapeutas: empleados.filter((e) => e.rol === "terapeuta").length,
    esteticistas: empleados.filter((e) => e.rol === "esteticista").length,
  }

  const diasSemana = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

  const handleSubmitNuevo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formNuevo.nombre.trim() || !formNuevo.apellido.trim()) {
      toast.error("Nombre y apellido son obligatorios")
      return
    }
    if (!formNuevo.rol) {
      toast.error("Selecciona un rol")
      return
    }
    if (!formNuevo.sucursalId) {
      toast.error("Selecciona una sucursal")
      return
    }
    setIsSubmitting(true)
    try {
      const result = await createEmpleado({
        nombre: formNuevo.nombre.trim(),
        apellido: formNuevo.apellido.trim(),
        rol: formNuevo.rol,
        sucursal_id: formNuevo.sucursalId,
        email: formNuevo.email.trim() || null,
        telefono: formNuevo.telefono.trim() || null,
        horario_inicio: formNuevo.horarioInicio,
        horario_fin: formNuevo.horarioFin,
        dias_trabajo: formNuevo.diasTrabajo,
        comision: formNuevo.comision,
        fecha_ingreso: formNuevo.fechaIngreso.trim() || null,
        fecha_contrato_hasta: formNuevo.fechaContratoHasta.trim() || null,
      })
      if (result.success) {
        toast.success("Empleado creado correctamente")
        setIsDialogOpen(false)
        setFormNuevo({
          nombre: "",
          apellido: "",
          email: "",
          telefono: "",
          rol: "",
          sucursalId: "",
          horarioInicio: "09:00",
          horarioFin: "18:00",
          diasTrabajo: [1, 2, 3, 4, 5],
          comision: 30,
          fechaIngreso: "",
          fechaContratoHasta: "",
        })
        await loadEmpleados()
      } else {
        toast.error(result.error || "Error al crear empleado")
      }
    } catch (err) {
      console.error(err)
      toast.error("Error al crear empleado")
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleDiaNuevo = (index: number) => {
    if (formNuevo.diasTrabajo.includes(index)) {
      setFormNuevo({ ...formNuevo, diasTrabajo: formNuevo.diasTrabajo.filter((d) => d !== index) })
    } else {
      setFormNuevo({ ...formNuevo, diasTrabajo: [...formNuevo.diasTrabajo, index].sort((a, b) => a - b) })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Empleados</h1>
          <p className="text-muted-foreground">Gestiona tu equipo de trabajo</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          {isAdmin || multiBranch ? (
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Empleado
              </Button>
            </DialogTrigger>
          ) : null}
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nuevo Empleado</DialogTitle>
              <DialogDescription>Registra un nuevo miembro del equipo</DialogDescription>
            </DialogHeader>
            <form className="space-y-4" onSubmit={handleSubmitNuevo}>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre *</Label>
                  <Input
                    id="nombre"
                    placeholder="María"
                    value={formNuevo.nombre}
                    onChange={(e) => setFormNuevo({ ...formNuevo, nombre: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apellido">Apellido *</Label>
                  <Input
                    id="apellido"
                    placeholder="González"
                    value={formNuevo.apellido}
                    onChange={(e) => setFormNuevo({ ...formNuevo, apellido: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="maria@luna27.com"
                    value={formNuevo.email}
                    onChange={(e) => setFormNuevo({ ...formNuevo, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefono">Teléfono</Label>
                  <Input
                    id="telefono"
                    placeholder="+52 55 1234 5678"
                    value={formNuevo.telefono}
                    onChange={(e) => setFormNuevo({ ...formNuevo, telefono: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rol">Rol *</Label>
                  <Select
                    value={formNuevo.rol}
                    onValueChange={(v) => setFormNuevo({ ...formNuevo, rol: v as typeof formNuevo.rol })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar rol" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="terapeuta">Terapeuta</SelectItem>
                      <SelectItem value="esteticista">Esteticista</SelectItem>
                      <SelectItem value="recepcionista">Recepcionista</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sucursal">Sucursal *</Label>
                  <Select
                    value={formNuevo.sucursalId || (!isAdmin && !multiBranch && singleBranchId ? singleBranchId : "")}
                    onValueChange={(v) => setFormNuevo({ ...formNuevo, sucursalId: v })}
                    disabled={!isAdmin && !multiBranch && !!singleBranchId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar sucursal" />
                    </SelectTrigger>
                    <SelectContent>
                      {sucursales.map((sucursal) => (
                        <SelectItem key={sucursal.id} value={sucursal.id}>
                          {sucursal.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!isAdmin && singleBranchId && !multiBranch && (
                    <p className="text-xs text-muted-foreground">
                      Solo puedes agregar empleados a tu sucursal
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fechaIngreso">Fecha de ingreso</Label>
                  <Input
                    id="fechaIngreso"
                    type="date"
                    value={formNuevo.fechaIngreso}
                    onChange={(e) => setFormNuevo({ ...formNuevo, fechaIngreso: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">Opcional — día en que comenzó a trabajar</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fechaContratoHasta">Vigencia del contrato hasta</Label>
                  <Input
                    id="fechaContratoHasta"
                    type="date"
                    value={formNuevo.fechaContratoHasta}
                    onChange={(e) => setFormNuevo({ ...formNuevo, fechaContratoHasta: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">Opcional — hasta cuándo está vigente el contrato</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="horarioInicio">Horario Inicio</Label>
                  <Input
                    id="horarioInicio"
                    type="time"
                    value={formNuevo.horarioInicio}
                    onChange={(e) => setFormNuevo({ ...formNuevo, horarioInicio: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="horarioFin">Horario Fin</Label>
                  <Input
                    id="horarioFin"
                    type="time"
                    value={formNuevo.horarioFin}
                    onChange={(e) => setFormNuevo({ ...formNuevo, horarioFin: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Días de Trabajo</Label>
                <div className="grid grid-cols-4 gap-3">
                  {diasSemana.map((dia, index) => (
                    <div key={dia} className="flex items-center space-x-2">
                      <Checkbox
                        id={`dia-${index}`}
                        checked={formNuevo.diasTrabajo.includes(index)}
                        onCheckedChange={() => toggleDiaNuevo(index)}
                      />
                      <label htmlFor={`dia-${index}`} className="text-sm cursor-pointer">
                        {dia}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="comision">Comisión (%)</Label>
                <Input
                  id="comision"
                  type="number"
                  min={0}
                  max={100}
                  value={formNuevo.comision}
                  onChange={(e) => setFormNuevo({ ...formNuevo, comision: Number(e.target.value) || 0 })}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Guardar Empleado
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Empleados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activos}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Terapeutas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.terapeutas}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Esteticistas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.esteticistas}</div>
          </CardContent>
        </Card>
      </div>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Asignación de sucursal por día
            </CardTitle>
            <CardDescription>
              Define en qué sucursal trabajará cada empleada en una fecha concreta. No cambia la sucursal base del perfil.
              Si la sucursal elegida coincide con la base, se elimina la asignación especial.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-12 xl:items-end">
              <div className="space-y-2 xl:col-span-2">
                <Label htmlFor="fecha-asignacion-sucursal">Fecha</Label>
                <Input
                  id="fecha-asignacion-sucursal"
                  type="date"
                  value={fechaAsignacionDia}
                  onChange={(e) => setFechaAsignacionDia(e.target.value)}
                />
              </div>
              <div className="space-y-2 min-w-0 xl:col-span-5">
                <Label>Empleada</Label>
                <Popover modal={false} open={empleadoAsignPopoverOpen} onOpenChange={setEmpleadoAsignPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      aria-expanded={empleadoAsignPopoverOpen}
                      className="h-9 w-full justify-between px-3 font-normal"
                    >
                      <span className="truncate">
                        {(() => {
                          const e = empleados.find((x) => x.id === empleadoAsignacionId)
                          return e
                            ? `${e.nombre} ${e.apellido}`
                            : "Buscar y elegir empleada…"
                        })()}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="z-[100] w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0 shadow-md sm:min-w-[320px]"
                    align="start"
                    sideOffset={4}
                    onWheel={(e) => e.stopPropagation()}
                  >
                    <Command>
                      <CommandInput placeholder="Buscar por nombre o apellido…" />
                      <CommandList
                        className="max-h-[min(320px,55vh)] overflow-y-auto overscroll-contain"
                        onWheel={(e) => e.stopPropagation()}
                      >
                        <CommandEmpty>No hay coincidencias.</CommandEmpty>
                        <CommandGroup>
                          {empleados.length === 0 ? (
                            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                              No hay empleadas en la lista. Recarga la página o revisa permisos de admin.
                            </div>
                          ) : (
                            empleados.map((e) => {
                              const sucNombre = sucursales.find((s) => s.id === e.sucursalId)?.nombre ?? ""
                              return (
                                <CommandItem
                                  key={e.id}
                                  value={`${e.nombre} ${e.apellido} ${e.email ?? ""} ${sucNombre}`}
                                  onSelect={() => {
                                    setEmpleadoAsignacionId(e.id)
                                    setEmpleadoAsignPopoverOpen(false)
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4 shrink-0",
                                      empleadoAsignacionId === e.id ? "opacity-100" : "opacity-0",
                                    )}
                                  />
                                  <div className="flex min-w-0 flex-col">
                                    <span className="truncate font-medium">
                                      {e.nombre} {e.apellido}
                                    </span>
                                    <span className="truncate text-xs text-muted-foreground">
                                      {sucNombre ? `${sucNombre} · ` : ""}
                                      <span className="capitalize">{e.rol}</span>
                                    </span>
                                  </div>
                                </CommandItem>
                              )
                            })
                          )}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2 xl:col-span-3">
                <Label>Sucursal ese día</Label>
                <Select
                  value={sucursalAsignacionDestinoId || undefined}
                  onValueChange={setSucursalAsignacionDestinoId}
                  disabled={!empleadoAsignacionId}
                >
                  <SelectTrigger className="w-full min-w-0">
                    <SelectValue placeholder="Elige sucursal destino" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="max-h-[min(288px,50vh)]">
                    {sucursales.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap gap-2 xl:col-span-2">
                <Button
                  type="button"
                  disabled={guardandoAsignacionDia || !empleadoAsignacionId || !sucursalAsignacionDestinoId}
                  onClick={() => void handleGuardarAsignacionDia()}
                >
                  {guardandoAsignacionDia ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Guardar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={guardandoAsignacionDia || !empleadoAsignacionId || !hayOverrideAsignacion}
                  onClick={() => void handleQuitarAsignacionDia()}
                >
                  Quitar asignación
                </Button>
              </div>
            </div>
            {empleadoAsignacionId && hayOverrideAsignacion && (
              <p className="text-xs text-muted-foreground">
                Esta empleada tiene una sucursal distinta a la base para la fecha seleccionada.
              </p>
            )}

            <div>
              <h3 className="text-sm font-semibold mb-2">Últimos movimientos</h3>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Cuándo</TableHead>
                      <TableHead className="text-xs">Empleada</TableHead>
                      <TableHead className="text-xs">Fecha día</TableHead>
                      <TableHead className="text-xs">Acción</TableHead>
                      <TableHead className="text-xs">De</TableHead>
                      <TableHead className="text-xs">A</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingHistorialSucursal ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          <Loader2 className="inline h-5 w-5 animate-spin" />
                        </TableCell>
                      </TableRow>
                    ) : historialSucursalDia.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                          Sin registros aún. Ejecuta la migración SQL en Supabase si la tabla no existe.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (() => {
                        const historialVisible = historialExpandido ? historialSucursalDia : historialSucursalDia.slice(0, 7)
                        return historialVisible.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="text-xs whitespace-nowrap">
                            {new Date(row.createdAt).toLocaleString("es-MX", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </TableCell>
                          <TableCell className="text-xs">{row.empleadoNombre}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{row.fecha}</TableCell>
                          <TableCell className="text-xs capitalize">{row.accion}</TableCell>
                          <TableCell className="text-xs">
                            {row.sucursalEfectivaAnteriorId
                              ? sucursales.find((s) => s.id === row.sucursalEfectivaAnteriorId)?.nombre ?? "—"
                              : "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {row.sucursalEfectivaNuevaId
                              ? sucursales.find((s) => s.id === row.sucursalEfectivaNuevaId)?.nombre ?? "—"
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))
                      })()
                    )}
                  </TableBody>
                </Table>
                {historialSucursalDia.length > 7 && (
                  <button
                    type="button"
                    onClick={() => setHistorialExpandido(!historialExpandido)}
                    className="w-full py-2 text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 border-t"
                  >
                    {historialExpandido
                      ? <><ChevronUp className="h-3.5 w-3.5" /> Ver menos</>
                      : <><ChevronDown className="h-3.5 w-3.5" /> Ver {historialSucursalDia.length - 7} más</>
                    }
                  </button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Lista de Empleados</CardTitle>
          <CardDescription>Gestiona tu equipo de trabajo</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            {isAdmin && (
              <Select value={sucursalFilter} onValueChange={setSucursalFilter}>
                <SelectTrigger className="w-[200px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filtrar por sucursal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las sucursales</SelectItem>
                  {sucursales.map((sucursal) => (
                    <SelectItem key={sucursal.id} value={sucursal.id}>
                      {sucursal.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empleado</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Sucursal</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Horario</TableHead>
                  <TableHead>Comisión</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmpleados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {searchQuery || sucursalFilter !== "todas" 
                        ? 'No se encontraron empleados con ese criterio de búsqueda' 
                        : 'No hay empleados registrados'}
                    </TableCell>
                  </TableRow>
                ) : (
                  (() => {
                    const empleadosVisibles = listaExpandida ? filteredEmpleados : filteredEmpleados.slice(0, 7)
                    return empleadosVisibles.map((empleado) => (
                  <TableRow key={empleado.id}>
                    <TableCell>
                      <div className="flex items-start gap-1">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-sm font-medium text-primary">
                            {empleado.nombre.charAt(0)}
                            {empleado.apellido.charAt(0)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0 flex items-start gap-1">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">
                              {empleado.nombre} {empleado.apellido}
                            </p>
                            <p className="text-xs text-muted-foreground">ID: {empleado.id}</p>
                            {(empleado.fechaIngreso || empleado.fechaContratoHasta) && (
                              <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                {empleado.fechaIngreso ? (
                                  <p>Ingreso: {formatearFechaEmpleadoMX(empleado.fechaIngreso)}</p>
                                ) : null}
                                {empleado.fechaContratoHasta ? (
                                  <p>Contrato hasta: {formatearFechaEmpleadoMX(empleado.fechaContratoHasta)}</p>
                                ) : null}
                              </div>
                            )}
                            {contratoVencido(empleado.fechaContratoHasta) && (
                              <Badge variant="outline" className="text-xs border-amber-400 text-amber-600 bg-amber-50">
                                Contrato vencido
                              </Badge>
                            )}
                            {!contratoVencido(empleado.fechaContratoHasta) && diasParaVencer(empleado.fechaContratoHasta) !== null && diasParaVencer(empleado.fechaContratoHasta)! <= 30 && (
                              <Badge variant="outline" className="text-xs border-orange-300 text-orange-500 bg-orange-50">
                                Vence en {diasParaVencer(empleado.fechaContratoHasta)} días
                              </Badge>
                            )}
                          </div>
                          {canEditEmpleados && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="shrink-0 h-8 w-8 text-muted-foreground hover:text-foreground"
                              title="Editar datos"
                              onClick={() => handleEdit(empleado)}
                            >
                              <Edit className="h-4 w-4" />
                              <span className="sr-only">Editar datos del empleado</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs">{empleado.email}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs">{empleado.telefono}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {sucursales.find((s) => s.id === empleado.sucursalId)?.nombre || 'Sin sucursal'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {empleado.rol}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <CalendarDays className="h-3 w-3 text-muted-foreground" />
                        <span>
                          {empleado.horarioInicio} - {empleado.horarioFin}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Award className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{empleado.comision}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={empleado.activo ? "default" : "outline"}>
                        {empleado.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {isAdmin && (
                        <div className="flex justify-end gap-2">
                          {activeTab === "activos" ? (
                            <>
                              {contratoVencido(empleado.fechaContratoHasta) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Contrato vencido — desactivar empleada"
                                  className="text-amber-500 hover:text-amber-700"
                                  onClick={() => {
                                    setEmpleadoToDesactivar(empleado)
                                    setDesactivarDialogOpen(true)
                                  }}
                                >
                                  <UserX className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEmpleadoToDelete(empleado)
                                  setDeleteDialogOpen(true)
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRestaurar(empleado)}
                              title="Restaurar empleado"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                  ))
                  })()
                )}
              </TableBody>
            </Table>
            {filteredEmpleados.length > 7 && (
              <button
                type="button"
                onClick={() => setListaExpandida(!listaExpandida)}
                className="w-full py-2 text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 border-t"
              >
                {listaExpandida
                  ? <><ChevronUp className="h-3.5 w-3.5" /> Ver menos</>
                  : <><ChevronDown className="h-3.5 w-3.5" /> Ver {filteredEmpleados.length - 7} más</>
                }
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {activeTab === "activos" && (
        <Card>
          <CardHeader>
            <CardTitle>Especialidades por Empleado</CardTitle>
            <CardDescription>Servicios que puede realizar cada empleado</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(() => {
                const empleadosEspVisibles = especialidadesExpandidas ? empleados : empleados.slice(0, 7)
                return empleadosEspVisibles.map((empleado) => (
                <div key={empleado.id} className="flex items-center justify-between gap-4 p-4 rounded-lg bg-muted/50">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">
                        {empleado.nombre} {empleado.apellido}
                      </p>
                      {canEditEmpleados && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 shrink-0"
                          onClick={() => handleEdit(empleado)}
                        >
                          <Edit className="h-3.5 w-3.5 mr-1" />
                          Editar
                        </Button>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground capitalize">{empleado.rol}</p>
                    {(empleado.fechaIngreso || empleado.fechaContratoHasta) && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {empleado.fechaIngreso ? `Ingreso: ${formatearFechaEmpleadoMX(empleado.fechaIngreso)}` : null}
                        {empleado.fechaIngreso && empleado.fechaContratoHasta ? " · " : null}
                        {empleado.fechaContratoHasta
                          ? `Contrato hasta: ${formatearFechaEmpleadoMX(empleado.fechaContratoHasta)}`
                          : null}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 max-w-md">
                    {empleado.especialidades && empleado.especialidades.length > 0 ? (
                      empleado.especialidades.map((esp, i) => (
                        <Badge key={i} variant="outline">
                          {esp}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">Sin especialidades</span>
                    )}
                  </div>
                </div>
              ))
              })()}
            </div>
            {empleados.length > 7 && (
              <button
                type="button"
                onClick={() => setEspecialidadesExpandidas(!especialidadesExpandidas)}
                className="w-full py-2 text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 border-t mt-2"
              >
                {especialidadesExpandidas
                  ? <><ChevronUp className="h-3.5 w-3.5" /> Ver menos</>
                  : <><ChevronDown className="h-3.5 w-3.5" /> Ver {empleados.length - 7} más</>
                }
              </button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Diálogo de confirmación de eliminación */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar empleado?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar a {empleadoToDelete?.nombre} {empleadoToDelete?.apellido}?
              El empleado se moverá a la sección de empleados eliminados y podrá ser restaurado más tarde.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleEliminar} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de confirmación de desactivar */}
      <AlertDialog open={desactivarDialogOpen} onOpenChange={setDesactivarDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar empleada?</AlertDialogTitle>
            <AlertDialogDescription>
              El contrato de {empleadoToDesactivar?.nombre} {empleadoToDesactivar?.apellido} está vencido.
              Al desactivarla ya no aparecerá en citas ni podrá ser agendada.
              Quedará guardada en la base de datos y podrás reactivarla si se renueva su contrato.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDesactivar}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de edición de empleado */}
      {editingEmpleado && (
        <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
          setIsEditDialogOpen(open)
          if (!open) setEditingEmpleado(null)
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Empleado</DialogTitle>
              <DialogDescription>Modifica la información del empleado</DialogDescription>
            </DialogHeader>
            <EditarEmpleadoDialog
              empleado={editingEmpleado}
              sucursales={sucursales}
              canEditSucursal={isAdmin || multiBranch}
              onClose={() => {
                setIsEditDialogOpen(false)
                setEditingEmpleado(null)
              }}
              onSuccess={loadEmpleados}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

// Componente de diálogo de edición
function EditarEmpleadoDialog({
  empleado,
  sucursales,
  canEditSucursal,
  onClose,
  onSuccess,
}: {
  empleado: Empleado
  sucursales: Sucursal[]
  canEditSucursal: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [formData, setFormData] = useState({
    nombre: empleado.nombre,
    apellido: empleado.apellido,
    email: empleado.email,
    telefono: empleado.telefono,
    rol: empleado.rol,
    sucursalId: empleado.sucursalId,
    horarioInicio: empleado.horarioInicio,
    horarioFin: empleado.horarioFin,
    comision: empleado.comision,
    fechaIngreso: empleado.fechaIngreso ?? "",
    fechaContratoHasta: empleado.fechaContratoHasta ?? "",
  })
  const [diasTrabajo, setDiasTrabajo] = useState<number[]>(empleado.diasTrabajo || [])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const diasSemana = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const result = await updateEmpleado(empleado.id, {
        nombre: formData.nombre,
        apellido: formData.apellido,
        email: formData.email,
        telefono: formData.telefono,
        rol: formData.rol,
        sucursal_id: formData.sucursalId,
        horario_inicio: formData.horarioInicio,
        horario_fin: formData.horarioFin,
        comision: formData.comision,
        dias_trabajo: diasTrabajo,
        fecha_ingreso: formData.fechaIngreso.trim() || null,
        fecha_contrato_hasta: formData.fechaContratoHasta.trim() || null,
      })

      if (result.success) {
        toast.success("Empleado actualizado exitosamente")
        onSuccess()
        onClose()
      } else {
        toast.error(`Error al actualizar empleado: ${result.error}`)
      }
    } catch (error: any) {
      console.error("Error inesperado:", error)
      toast.error("Error inesperado al actualizar el empleado")
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleDia = (index: number) => {
    if (diasTrabajo.includes(index)) {
      setDiasTrabajo(diasTrabajo.filter(d => d !== index))
    } else {
      setDiasTrabajo([...diasTrabajo, index])
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="edit-nombre">Nombre *</Label>
          <Input
            id="edit-nombre"
            value={formData.nombre}
            onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-apellido">Apellido *</Label>
          <Input
            id="edit-apellido"
            value={formData.apellido}
            onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="edit-email">Email</Label>
          <Input
            id="edit-email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-telefono">Teléfono</Label>
          <Input
            id="edit-telefono"
            value={formData.telefono}
            onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="edit-rol">Rol *</Label>
          <Select value={formData.rol} onValueChange={(value: any) => setFormData({ ...formData, rol: value })}>
            <SelectTrigger id="edit-rol">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="terapeuta">Terapeuta</SelectItem>
              <SelectItem value="esteticista">Esteticista</SelectItem>
              <SelectItem value="recepcionista">Recepcionista</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-sucursal">Sucursal *</Label>
          <Select 
            value={formData.sucursalId} 
            onValueChange={(value) => setFormData({ ...formData, sucursalId: value })}
            disabled={!canEditSucursal}
          >
            <SelectTrigger id="edit-sucursal">
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
          {!canEditSucursal && (
            <p className="text-xs text-muted-foreground">
              La sucursal base no se puede cambiar desde tu perfil
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="edit-fechaIngreso">Fecha de ingreso</Label>
          <Input
            id="edit-fechaIngreso"
            type="date"
            value={formData.fechaIngreso}
            onChange={(e) => setFormData({ ...formData, fechaIngreso: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">Opcional</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-fechaContratoHasta">Vigencia del contrato hasta</Label>
          <Input
            id="edit-fechaContratoHasta"
            type="date"
            value={formData.fechaContratoHasta}
            onChange={(e) => setFormData({ ...formData, fechaContratoHasta: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">Opcional</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="edit-horarioInicio">Horario Inicio</Label>
          <Input
            id="edit-horarioInicio"
            type="time"
            value={formData.horarioInicio}
            onChange={(e) => setFormData({ ...formData, horarioInicio: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-horarioFin">Horario Fin</Label>
          <Input
            id="edit-horarioFin"
            type="time"
            value={formData.horarioFin}
            onChange={(e) => setFormData({ ...formData, horarioFin: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Días de Trabajo</Label>
        <div className="grid grid-cols-4 gap-3">
          {diasSemana.map((dia, index) => (
            <div key={dia} className="flex items-center space-x-2">
              <Checkbox
                id={`edit-dia-${index}`}
                checked={diasTrabajo.includes(index)}
                onCheckedChange={() => toggleDia(index)}
              />
              <label htmlFor={`edit-dia-${index}`} className="text-sm cursor-pointer">
                {dia}
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-comision">Comisión (%)</Label>
        <Input
          id="edit-comision"
          type="number"
          min="0"
          max="100"
          value={formData.comision}
          onChange={(e) => setFormData({ ...formData, comision: Number(e.target.value) })}
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Guardando...
            </>
          ) : (
            "Guardar Cambios"
          )}
        </Button>
      </div>
    </form>
  )
}
