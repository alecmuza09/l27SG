"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Plus,
  Search,
  Filter,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  Award,
  Eye,
  Edit,
  Trash2,
  Download,
  Loader2,
  Star,
} from "lucide-react"
import { getClientesPaginated, searchClientesPaginated, getClientesStats, createCliente, updateCliente, updateClienteEmbajadora, type Cliente } from "@/lib/data/clientes"
import { getSucursalesActivasFromDB, type Sucursal } from "@/lib/data/sucursales"
import { toast } from "sonner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
import { Textarea } from "@/components/ui/textarea"
import Link from "next/link"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { getCurrentUser, isGlobalAdministrator, type User } from "@/lib/auth"

// Ordena clientes por última visita descendente; quienes no tienen visitas van al final
function ordenarPorUltimaVisita(clientes: Cliente[]): Cliente[] {
  return [...clientes].sort((a, b) => {
    if (!a.ultimaVisita && !b.ultimaVisita) return 0
    if (!a.ultimaVisita) return 1
    if (!b.ultimaVisita) return -1
    return new Date(b.ultimaVisita).getTime() - new Date(a.ultimaVisita).getTime()
  })
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [stats, setStats] = useState({ total: 0, activos: 0, vip: 0, nuevos: 0 })
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [searchActivo, setSearchActivo] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalClientes, setTotalClientes] = useState(0)
  const [pageSize] = useState(50) // 50 clientes por página
  const [visitaFilter, setVisitaFilter] = useState<'todos' | 'sin-visita-reciente' | 'sin-visitas' | 'embajadoras'>('todos')
  const [embajadoraUpdatingId, setEmbajadoraUpdatingId] = useState<string | null>(null)
  const isAdmin = isGlobalAdministrator(currentUser)

  // Estado del formulario (genero y sucursal con valores no vacíos por requisito de Select)
  const [formData, setFormData] = useState({
    nombre: "",
    apellido: "",
    telefono: "",
    email: "",
    fechaNacimiento: "",
    genero: "no-especificar",
    notas: "",
    sucursalPreferida: "sin-sucursal",
  })

  // Función para cargar estadísticas
  const loadStats = async () => {
    try {
      const statsData = await getClientesStats()
      setStats(statsData)
    } catch (err) {
      console.error('Error cargando estadísticas:', err)
      // Establecer valores por defecto en caso de error
      setStats({ total: 0, activos: 0, vip: 0, nuevos: 0 })
    }
  }

  // Función para cargar clientes
  const loadClientes = async (page: number = currentPage, term: string = searchActivo) => {
    try {
      setIsLoading(true)
      setError(null)
      
      let result
      if (term.trim()) {
        result = await searchClientesPaginated(term.trim(), page, pageSize)
      } else {
        result = await getClientesPaginated(page, pageSize)
      }
      
      setClientes(ordenarPorUltimaVisita(result.clientes))
      setTotalClientes(result.total)
      setTotalPages(result.totalPages)
    } catch (err) {
      console.error('Error cargando clientes:', err)
      setError('Error al cargar los clientes. Por favor, intenta de nuevo.')
    } finally {
      setIsLoading(false)
    }
  }

  // Cargar estadísticas y sucursales solo una vez al montar
  useEffect(() => {
    setCurrentUser(getCurrentUser())
    async function loadInitialData() {
      try {
        await Promise.all([
          loadStats(),
          getSucursalesActivasFromDB().then(setSucursales).catch(err => {
            console.error('Error cargando sucursales:', err)
            setSucursales([])
          })
        ])
      } catch (err) {
        console.error('Error cargando datos iniciales:', err)
      }
    }
    loadInitialData()
  }, [])

  // Cargar clientes cuando cambia la página o el término de búsqueda activo
  useEffect(() => {
    loadClientes(currentPage, searchActivo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, searchActivo])

  const handleBuscar = () => {
    setCurrentPage(1)
    setSearchActivo(searchQuery)
    loadClientes(1, searchQuery)
  }

  // Manejar cambios en el formulario
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target
    setFormData(prev => ({ ...prev, [id]: value }))
  }

  const handleSelectChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // Manejar submit del formulario (alta de clienta nueva)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const nombre = formData.nombre.trim()
    const apellido = formData.apellido.trim()
    const telefono = formData.telefono.trim()

    if (!nombre || !apellido) {
      toast.error(
        'Debes ingresar el nombre y el apellido. Ambos campos son obligatorios.',
      )
      return
    }

    if (!telefono) {
      toast.error('El teléfono es obligatorio.')
      return
    }

    setIsSubmitting(true)

    try {
      const clienteData: any = {
        nombre,
        apellido,
        telefono,
      }

      // Agregar campos opcionales solo si tienen valor
      if (formData.email) clienteData.email = formData.email
      if (formData.fechaNacimiento) clienteData.fechaNacimiento = formData.fechaNacimiento
      if (formData.genero && formData.genero !== 'no-especificar') clienteData.genero = formData.genero as 'masculino' | 'femenino' | 'otro'
      if (formData.notas) clienteData.notas = formData.notas
      if (formData.sucursalPreferida && formData.sucursalPreferida !== 'sin-sucursal') clienteData.sucursalPreferida = formData.sucursalPreferida

      const result = await createCliente(clienteData)

      if (result.success) {
        toast.success('Cliente creado exitosamente')
        setIsDialogOpen(false)
        // Resetear formulario
        setFormData({
          nombre: "",
          apellido: "",
          telefono: "",
          email: "",
          fechaNacimiento: "",
          genero: "no-especificar",
          notas: "",
          sucursalPreferida: "sin-sucursal",
        })
        // Recargar clientes y estadísticas
        await Promise.all([loadClientes(), loadStats()])
      } else {
        toast.error(`Error al crear cliente: ${result.error}`)
      }
    } catch (err: any) {
      console.error('Error creando cliente:', err)
      toast.error('Error inesperado al crear el cliente')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Alternar el estado de embajadora de un cliente (solo admins)
  const handleToggleEmbajadora = async (cliente: Cliente) => {
    if (!isAdmin || embajadoraUpdatingId) return

    const nuevoValor = !cliente.embajadora
    setEmbajadoraUpdatingId(cliente.id)
    try {
      const result = await updateClienteEmbajadora(cliente.id, nuevoValor)
      if (result.success) {
        setClientes((prev) =>
          prev.map((c) => (c.id === cliente.id ? { ...c, embajadora: nuevoValor } : c))
        )
        toast.success(
          nuevoValor
            ? `${cliente.nombre} ${cliente.apellido} ahora es embajadora`
            : `${cliente.nombre} ${cliente.apellido} ya no es embajadora`
        )
      } else {
        toast.error(`Error al actualizar embajadora: ${result.error}`)
      }
    } catch (err) {
      console.error('Error actualizando embajadora:', err)
      toast.error('Error inesperado al actualizar embajadora')
    } finally {
      setEmbajadoraUpdatingId(null)
    }
  }

  // Manejar edición de cliente
  const handleEdit = (cliente: Cliente) => {
    setEditingCliente(cliente)
    setFormData({
      nombre: cliente.nombre,
      apellido: cliente.apellido,
      telefono: cliente.telefono,
      email: cliente.email || "",
      fechaNacimiento: cliente.fechaNacimiento || "",
      genero: cliente.genero || "no-especificar",
      notas: cliente.notas || "",
      sucursalPreferida: cliente.sucursalPreferida || "sin-sucursal",
    })
    setIsEditDialogOpen(true)
  }

  // Manejar actualización de cliente
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCliente) return

    setIsSubmitting(true)

    try {
      const clienteData: any = {
        nombre: formData.nombre,
        apellido: formData.apellido,
        telefono: formData.telefono,
      }

      // Agregar campos opcionales solo si tienen valor
      if (formData.email) clienteData.email = formData.email
      if (formData.fechaNacimiento) clienteData.fechaNacimiento = formData.fechaNacimiento
      if (formData.genero && formData.genero !== 'no-especificar') clienteData.genero = formData.genero as 'masculino' | 'femenino' | 'otro'
      if (formData.notas) clienteData.notas = formData.notas
      if (formData.sucursalPreferida && formData.sucursalPreferida !== 'sin-sucursal') clienteData.sucursalPreferida = formData.sucursalPreferida

      const result = await updateCliente(editingCliente.id, clienteData)

      if (result.success) {
        toast.success('Cliente actualizado exitosamente')
        setIsEditDialogOpen(false)
        setEditingCliente(null)
        // Resetear formulario
        setFormData({
          nombre: "",
          apellido: "",
          telefono: "",
          email: "",
          fechaNacimiento: "",
          genero: "no-especificar",
          notas: "",
          sucursalPreferida: "sin-sucursal",
        })
        // Recargar clientes y estadísticas
        await Promise.all([loadClientes(), loadStats()])
      } else {
        toast.error(`Error al actualizar cliente: ${result.error}`)
      }
    } catch (err: any) {
      console.error('Error actualizando cliente:', err)
      toast.error('Error inesperado al actualizar el cliente')
    } finally {
      setIsSubmitting(false)
    }
  }


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Cargando clientes...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.reload()}>Reintentar</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const hoy60 = Date.now() - 60 * 24 * 60 * 60 * 1000
  const clientesFiltrados = clientes.filter((c) => {
    if (visitaFilter === 'sin-visitas') return !c.ultimaVisita
    if (visitaFilter === 'sin-visita-reciente')
      return !c.ultimaVisita || new Date(c.ultimaVisita + 'T12:00:00').getTime() < hoy60
    if (visitaFilter === 'embajadoras') return c.embajadora
    return true
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground">Gestiona tu base de clientes</p>
        </div>
        <div className="flex gap-2">
          {currentUser?.role !== 'manager' && (
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
          )}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nuevo Cliente</DialogTitle>
                <DialogDescription>Registra un nuevo cliente en el sistema</DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nombre">Nombre *</Label>
                    <Input 
                      id="nombre" 
                      placeholder="Ana" 
                      value={formData.nombre}
                      onChange={handleInputChange}
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apellido">Apellido *</Label>
                    <Input 
                      id="apellido" 
                      placeholder="García" 
                      value={formData.apellido}
                      onChange={handleInputChange}
                      required 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="telefono">Teléfono *</Label>
                    <Input 
                      id="telefono" 
                      placeholder="8112345678" 
                      value={formData.telefono}
                      onChange={handleInputChange}
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      placeholder="ana@email.com" 
                      value={formData.email}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fechaNacimiento">Fecha de Nacimiento</Label>
                    <Input 
                      id="fechaNacimiento" 
                      type="date" 
                      value={formData.fechaNacimiento}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="genero">Género</Label>
                    <Select value={formData.genero} onValueChange={(value) => handleSelectChange('genero', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
<SelectContent>
                        <SelectItem value="no-especificar">No especificar</SelectItem>
                        <SelectItem value="femenino">Femenino</SelectItem>
                        <SelectItem value="masculino">Masculino</SelectItem>
                        <SelectItem value="otro">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sucursalPreferida">Sucursal Preferida</Label>
                  <Select value={formData.sucursalPreferida} onValueChange={(value) => handleSelectChange('sucursalPreferida', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar sucursal (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sin-sucursal">Sin sucursal preferida</SelectItem>
                      {sucursales.map((sucursal) => (
                        <SelectItem key={sucursal.id} value={sucursal.id}>
                          {sucursal.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Sucursal donde se registró o donde suele asistir
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notas">Notas</Label>
                  <Textarea 
                    id="notas" 
                    placeholder="Preferencias, alergias, observaciones..." 
                    rows={3} 
                    value={formData.notas}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      isSubmitting ||
                      !formData.nombre.trim() ||
                      !formData.apellido.trim() ||
                      !formData.telefono.trim()
                    }
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      'Guardar Cliente'
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {currentUser?.role !== "manager" && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Clientes</CardTitle>
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
              <CardTitle className="text-sm font-medium text-muted-foreground">VIP</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.vip}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Nuevos (30d)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.nuevos}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Lista de Clientes</CardTitle>
              <CardDescription>Gestiona y visualiza todos tus clientes</CardDescription>
            </div>
            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, email o teléfono en toda la base de datos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleBuscar()
                }}
                className="pl-10"
              />
            </div>
            <Button onClick={handleBuscar} variant="outline">
              <Search className="h-4 w-4 mr-2" />
              Buscar
            </Button>
            <Select value={visitaFilter} onValueChange={(v) => setVisitaFilter(v as typeof visitaFilter)}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Filtrar por visita" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="embajadoras">Embajadoras</SelectItem>
                <SelectItem value="sin-visita-reciente">Sin visita reciente (+60 días)</SelectItem>
                <SelectItem value="sin-visitas">Sin visitas</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-sm text-muted-foreground">
              {searchActivo ? (
                <span>Mostrando {totalClientes} resultado{totalClientes !== 1 ? 's' : ''} de búsqueda</span>
              ) : (
                <span>Total: {totalClientes.toLocaleString()} clientes</span>
              )}
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Última Visita</TableHead>
                  <TableHead>Visitas</TableHead>
                  {currentUser?.role !== 'manager' && <TableHead>Total Gastado</TableHead>}
                  <TableHead>Puntos</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientesFiltrados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={currentUser?.role === 'manager' ? 7 : 8} className="text-center py-8 text-muted-foreground">
                      {searchActivo ? 'No se encontraron clientes con ese criterio de búsqueda' : 'No hay clientes registrados'}
                    </TableCell>
                  </TableRow>
                ) : (
                  clientesFiltrados.map((cliente) => (
                  <TableRow key={cliente.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleEmbajadora(cliente)}
                          disabled={!isAdmin || embajadoraUpdatingId === cliente.id}
                          className={isAdmin ? "cursor-pointer" : "cursor-default"}
                          title={
                            isAdmin
                              ? cliente.embajadora
                                ? "Quitar como embajadora"
                                : "Marcar como embajadora"
                              : cliente.embajadora
                                ? "Embajadora"
                                : undefined
                          }
                        >
                          {embajadoraUpdatingId === cliente.id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : (
                            <Star
                              className={
                                cliente.embajadora
                                  ? "h-4 w-4 fill-yellow-400 text-yellow-400"
                                  : "h-4 w-4 text-muted-foreground"
                              }
                            />
                          )}
                        </button>
                        <div>
                          <p className="font-medium">
                            {cliente.nombre} {cliente.apellido}
                          </p>
                          <p className="text-xs text-muted-foreground">ID: {cliente.id}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {cliente.email && (
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs">{cliente.email}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs">{cliente.telefono}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {cliente.ultimaVisita ? (
                        <span className={
                          new Date(cliente.ultimaVisita + 'T12:00:00') < new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
                            ? 'text-orange-500 text-sm'
                            : 'text-sm'
                        }>
                          {new Date(cliente.ultimaVisita + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">Sin visitas</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{cliente.totalVisitas}</span>
                      </div>
                    </TableCell>
                    {currentUser?.role !== 'manager' && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">${cliente.totalGastado.toLocaleString()}</span>
                        </div>
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Award className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{cliente.puntosFidelidad}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          cliente.estado === "vip" ? "default" : cliente.estado === "activo" ? "secondary" : "outline"
                        }
                      >
                        {cliente.estado.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/dashboard/clientes/detail?id=${cliente.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(cliente)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Mostrando página {currentPage} de {totalPages} ({totalClientes.toLocaleString()} clientes en total)
              </div>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        if (currentPage > 1) {
                          setCurrentPage(currentPage - 1)
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }
                      }}
                      className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  
                  {/* Mostrar páginas cercanas */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum
                    if (totalPages <= 5) {
                      pageNum = i + 1
                    } else if (currentPage <= 3) {
                      pageNum = i + 1
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    } else {
                      pageNum = currentPage - 2 + i
                    }
                    
                    return (
                      <PaginationItem key={pageNum}>
                        <PaginationLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault()
                            setCurrentPage(pageNum)
                            window.scrollTo({ top: 0, behavior: 'smooth' })
                          }}
                          isActive={currentPage === pageNum}
                          className="cursor-pointer"
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    )
                  })}
                  
                  {totalPages > 5 && currentPage < totalPages - 2 && (
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )}
                  
                  {totalPages > 5 && (
                    <PaginationItem>
                      <PaginationLink
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          setCurrentPage(totalPages)
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                        isActive={currentPage === totalPages}
                        className="cursor-pointer"
                      >
                        {totalPages}
                      </PaginationLink>
                    </PaginationItem>
                  )}
                  
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        if (currentPage < totalPages) {
                          setCurrentPage(currentPage + 1)
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }
                      }}
                      className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diálogo de edición de cliente */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open)
        if (!open) {
          setEditingCliente(null)
          // Resetear formulario
          setFormData({
            nombre: "",
            apellido: "",
            telefono: "",
            email: "",
            fechaNacimiento: "",
            genero: "no-especificar",
            notas: "",
            sucursalPreferida: "sin-sucursal",
          })
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
            <DialogDescription>Modifica la información del cliente</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleUpdate}>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre *</Label>
                <Input 
                  id="nombre" 
                  placeholder="Ana" 
                  value={formData.nombre}
                  onChange={handleInputChange}
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apellido">Apellido *</Label>
                <Input 
                  id="apellido" 
                  placeholder="García" 
                  value={formData.apellido}
                  onChange={handleInputChange}
                  required 
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono *</Label>
                <Input 
                  id="telefono" 
                  placeholder="8112345678" 
                  value={formData.telefono}
                  onChange={handleInputChange}
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="ana@email.com" 
                  value={formData.email}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fechaNacimiento">Fecha de Nacimiento</Label>
                <Input 
                  id="fechaNacimiento" 
                  type="date" 
                  value={formData.fechaNacimiento}
                  onChange={handleInputChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="genero">Género</Label>
                <Select value={formData.genero} onValueChange={(value) => handleSelectChange('genero', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no-especificar">No especificar</SelectItem>
                    <SelectItem value="femenino">Femenino</SelectItem>
                    <SelectItem value="masculino">Masculino</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sucursalPreferida">Sucursal Preferida</Label>
              <Select value={formData.sucursalPreferida} onValueChange={(value) => handleSelectChange('sucursalPreferida', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar sucursal (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sin-sucursal">Sin sucursal preferida</SelectItem>
                  {sucursales.map((sucursal) => (
                    <SelectItem key={sucursal.id} value={sucursal.id}>
                      {sucursal.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Sucursal donde se registró o donde suele asistir
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notas">Notas</Label>
              <Textarea 
                id="notas" 
                placeholder="Preferencias, alergias, observaciones..." 
                rows={3} 
                value={formData.notas}
                onChange={handleInputChange}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar Cambios'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
