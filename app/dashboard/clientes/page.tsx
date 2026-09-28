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
  Building2,
} from "lucide-react"
import {
  getClientesPaginated, searchClientesPaginated, getClientesResumenTarjetas,
  createCliente, updateCliente, updateClienteEmbajadora,
  getClientesByIds, fetchAllClientesListado, fetchAllClientesBusqueda,
  getClientesNuevosListadoEnPeriodo, type Cliente, type ClienteNuevoPeriodoRow,
} from "@/lib/data/clientes"
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
import {
  getCurrentUser,
  isGlobalAdministrator,
  canExportClientesListado,
  effectivePrimarySucursalId,
  type User,
} from "@/lib/auth"

type VisitaFilter =
  | "todos"
  | "con-visitas"
  | "sin-visita-reciente"
  | "sin-visitas"
  | "embajadoras"
  | "vetadas"
  | "problematicas"
  | "descuento"
  | "nuevos-este-mes"
  | "primera-vez-sucursal"

function esFiltroNuevosPeriodo(f: VisitaFilter): boolean {
  return f === "nuevos-este-mes" || f === "primera-vez-sucursal"
}

function fmtFechaExport(iso: string | null | undefined): string {
  if (!iso) return ""
  return new Date(`${iso}T12:00:00`).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function ordenarClientesParaExport(clientes: Cliente[]): Cliente[] {
  return [...clientes].sort((a, b) => {
    const fa = a.ultimaVisita || a.fechaRegistro
    const fb = b.ultimaVisita || b.fechaRegistro
    return fb.localeCompare(fa)
  })
}

function labelFiltroClientes(f: VisitaFilter): string {
  const map: Record<VisitaFilter, string> = {
    todos: "Todos",
    embajadoras: "Embajadoras",
    "con-visitas": "Con visitas",
    "sin-visita-reciente": "Sin visita reciente (+60 días)",
    "sin-visitas": "Sin visitas",
    vetadas: "Vetadas",
    problematicas: "Problemáticas",
    descuento: "Descuento",
    "nuevos-este-mes": "Clientes nuevos (sin historial previo)",
    "primera-vez-sucursal": "Primera vez en sucursal (ya existían)",
  }
  return map[f]
}

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
  const [stats, setStats] = useState({
    total: 0,
    embajadoras: 0,
    conVisitas: 0,
    nuevosPrimeraVisitaEver: 0,
    primeraVezEnSucursal: 0,
  })
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [searchActivo, setSearchActivo] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalClientes, setTotalClientes] = useState(0)
  const [pageSize] = useState(50) // 50 clientes por página
  const [visitaFilter, setVisitaFilter] = useState<VisitaFilter>("todos")
  const [sucursalFilter, setSucursalFilter] = useState<string>("all")
  const [embajadoraUpdatingId, setEmbajadoraUpdatingId] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const isAdmin = isGlobalAdministrator(currentUser)
  const canExportClientes = canExportClientesListado(currentUser)
  const isBranchAdmin = currentUser?.role === "branch-admin"
  const sucursalTarjetasId = isBranchAdmin ? effectivePrimarySucursalId(currentUser) : undefined
  const sucursalAlcanceAdmin =
    isAdmin && sucursalFilter !== "all" ? sucursalFilter : undefined
  const sucursalNombreActiva =
    sucursalFilter === "all"
      ? null
      : (sucursales.find(s => s.id === sucursalFilter)?.nombre ?? null)
  /** Primera vez en sucursal solo aplica con una sucursal concreta (admin debe elegirla). */
  const primeraVezRequiereSeleccionSucursal =
    isAdmin && sucursalFilter === "all"

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

  /** Mismo rango que reportes con filtro "Este mes" (inicio de mes → hoy). */
  const fechasEsteMes = () => {
    const hoy = new Date()
    const pad = (n: number) => String(n).padStart(2, "0")
    const hasta = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    const desde = `${inicio.getFullYear()}-${pad(inicio.getMonth() + 1)}-${pad(inicio.getDate())}`
    return { desde, hasta }
  }

  // Función para cargar estadísticas
  const loadStats = async () => {
    try {
      setStatsLoading(true)
      const { desde, hasta } = fechasEsteMes()
      const user = getCurrentUser()
      const admin = isGlobalAdministrator(user)
      const sucIdBranch =
        user?.role === "branch-admin" ? effectivePrimarySucursalId(user) : undefined
      const scopeResumen =
        sucIdBranch
          ? { sucursalId: sucIdBranch }
          : admin && sucursalFilter !== "all"
            ? { sucursalId: sucursalFilter }
            : undefined
      const resumen = await getClientesResumenTarjetas(desde, hasta, scopeResumen)
      setStats({
        total: resumen.total,
        embajadoras: resumen.embajadoras,
        conVisitas: resumen.conVisitas,
        nuevosPrimeraVisitaEver: resumen.nuevosPrimeraVisitaEver,
        primeraVezEnSucursal: resumen.primeraVezEnSucursal,
      })
    } catch (err) {
      console.error('Error cargando estadísticas:', err)
      setStats({
        total: 0,
        embajadoras: 0,
        conVisitas: 0,
        nuevosPrimeraVisitaEver: 0,
        primeraVezEnSucursal: 0,
      })
    } finally {
      setStatsLoading(false)
    }
  }

  const buildFiltrosListado = (
    filtroVisita: VisitaFilter,
    sucIdBranch?: string,
    sucIdAdmin?: string,
  ) => {
    const sucIdActivos =
      filtroVisita === "con-visitas" ? (sucIdAdmin ?? sucIdBranch) : undefined
    const alcanceSucursalId =
      !esFiltroNuevosPeriodo(filtroVisita) &&
      filtroVisita !== "con-visitas" &&
      sucIdAdmin
        ? sucIdAdmin
        : undefined

    return {
      soloEmbajadoras: filtroVisita === "embajadoras",
      soloVetadas: filtroVisita === "vetadas",
      soloProblematicas: filtroVisita === "problematicas",
      soloDescuento: filtroVisita === "descuento",
      sinVisitas: filtroVisita === "sin-visitas",
      conVisitas: filtroVisita === "con-visitas",
      activosEnSucursalId: sucIdActivos,
      alcanceSucursalId,
      sinVisitaReciente: filtroVisita === "sin-visita-reciente",
    }
  }

  const scopeNuevosClientes = (sucIdBranch: string | undefined, filtro: VisitaFilter) => {
    if (sucIdBranch) return { sucursalId: sucIdBranch }
    if (sucursalAlcanceAdmin) return { sucursalId: sucursalAlcanceAdmin }
    return {}
  }

  const filtrarNuevosPorBusqueda = (
    rows: ClienteNuevoPeriodoRow[],
    term: string,
  ): ClienteNuevoPeriodoRow[] => {
    const q = term.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r => r.nombre.toLowerCase().includes(q))
  }

  // Función para cargar clientes
  const loadClientes = async (
    page: number = currentPage,
    term: string = searchActivo,
    filtroVisita: VisitaFilter = visitaFilter
  ) => {
    try {
      setIsLoading(true)
      setError(null)

      const user = getCurrentUser()
      const sucIdBranch =
        user?.role === "branch-admin" ? effectivePrimarySucursalId(user) : undefined

      if (esFiltroNuevosPeriodo(filtroVisita)) {
        if (
          filtroVisita === "primera-vez-sucursal" &&
          primeraVezRequiereSeleccionSucursal
        ) {
          setClientes([])
          setTotalClientes(0)
          setTotalPages(0)
          return
        }
        const { desde, hasta } = fechasEsteMes()
        const motivo =
          filtroVisita === "nuevos-este-mes" ? "nuevo_en_sucursal" : "primera_sucursal"
        let detalle = await getClientesNuevosListadoEnPeriodo(
          desde,
          hasta,
          scopeNuevosClientes(sucIdBranch, filtroVisita),
          motivo,
        )
        detalle = filtrarNuevosPorBusqueda(detalle, term)
        const total = detalle.length
        const totalPagesCalc = Math.max(1, Math.ceil(total / pageSize))
        const from = (page - 1) * pageSize
        const slice = detalle.slice(from, from + pageSize)
        const clientesPagina = await getClientesByIds(slice.map(r => r.clienteId))
        setClientes(clientesPagina)
        setTotalClientes(total)
        setTotalPages(totalPagesCalc)
        return
      }

      const filtros = buildFiltrosListado(filtroVisita, sucIdBranch, sucursalAlcanceAdmin)

      let result
      if (term.trim()) {
        result = await searchClientesPaginated(term.trim(), page, pageSize, filtros)
      } else {
        result = await getClientesPaginated(page, pageSize, filtros)
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

  const handleExportClientes = async () => {
    if (!canExportClientesListado(getCurrentUser()) || isExporting) return

    setIsExporting(true)
    try {
      const user = getCurrentUser()
      const sucIdBranch =
        user?.role === "branch-admin" ? effectivePrimarySucursalId(user) : undefined
      const XLSX = await import("xlsx")
      const { desde, hasta } = fechasEsteMes()
      const filtroLabel = labelFiltroClientes(visitaFilter)
      const sucursalLabel = sucursalNombreActiva ? ` · ${sucursalNombreActiva}` : ""
      const busquedaLabel = searchActivo.trim() ? ` · Búsqueda: «${searchActivo.trim()}»` : ""

      type FilaExport = (string | number)[]
      let headers: string[]
      let filas: FilaExport[]

      if (esFiltroNuevosPeriodo(visitaFilter)) {
        const motivo =
          visitaFilter === "nuevos-este-mes" ? "nuevo_en_sucursal" : "primera_sucursal"
        let detalle = await getClientesNuevosListadoEnPeriodo(
          desde,
          hasta,
          scopeNuevosClientes(sucIdBranch, visitaFilter),
          motivo,
        )
        detalle = filtrarNuevosPorBusqueda(detalle, searchActivo)
        const clientesMap = new Map(
          (await getClientesByIds(detalle.map(d => d.clienteId))).map(c => [c.id, c]),
        )

        headers = [
          "Fecha 1.ª visita",
          "Cliente",
          "Teléfono",
          "Email",
          "Sucursal (1.ª visita)",
          "Servicios (1.ª vez)",
          "Total visitas",
          "Total gastado",
          "Última visita",
          "Estado",
        ]
        filas = detalle.map(d => {
          const c = clientesMap.get(d.clienteId)
          return [
            fmtFechaExport(d.fechaPrimeraVisita),
            d.nombre,
            c?.telefono ?? "",
            c?.email ?? "",
            d.sucursalNombre,
            d.servicios.length > 0 ? d.servicios.join(", ") : "",
            c?.totalVisitas ?? 0,
            c?.totalGastado ?? 0,
            fmtFechaExport(c?.ultimaVisita),
            c?.estado?.toUpperCase() ?? "",
          ]
        })
      } else {
        const filtros = buildFiltrosListado(visitaFilter, sucIdBranch, sucursalAlcanceAdmin)
        const listado = searchActivo.trim()
          ? await fetchAllClientesBusqueda(searchActivo, filtros)
          : await fetchAllClientesListado(filtros)
        const ordenados = ordenarClientesParaExport(listado)

        headers = [
          "Última visita",
          "Fecha registro",
          "Nombre",
          "Apellido",
          "Teléfono",
          "Email",
          "Visitas",
          "Total gastado",
          "Puntos",
          "Estado",
          "Embajadora",
          "Vetada",
          "Problemática",
          "Descuento",
        ]
        filas = ordenados.map(c => [
          fmtFechaExport(c.ultimaVisita),
          fmtFechaExport(c.fechaRegistro),
          c.nombre,
          c.apellido,
          c.telefono,
          c.email,
          c.totalVisitas,
          c.totalGastado,
          c.puntosFidelidad,
          c.estado.toUpperCase(),
          c.embajadora ? "Sí" : "No",
          c.esVetado ? "Sí" : "No",
          c.esProblematico ? "Sí" : "No",
          c.esDescuento ? "Sí" : "No",
        ])
      }

      const titulo = `Listado de clientes — ${filtroLabel}${sucursalLabel}${busquedaLabel}`
      const rows: FilaExport[] = [
        [titulo],
        [`Generado: ${fmtFechaExport(new Date().toISOString().slice(0, 10))} · ${filas.length} registro(s)`],
        [],
        headers,
        ...filas,
      ]

      const ws = XLSX.utils.aoa_to_sheet(rows)
      ws["!cols"] = headers.map((h, i) => {
        if (i === 0 && esFiltroNuevosPeriodo(visitaFilter)) return { wch: 14 }
        if (h === "Cliente" || h === "Nombre") return { wch: 28 }
        if (h === "Apellido") return { wch: 22 }
        if (h === "Email") return { wch: 28 }
        if (h === "Servicios (1.ª vez)") return { wch: 36 }
        if (h === "Teléfono") return { wch: 14 }
        return { wch: Math.min(24, Math.max(10, h.length + 2)) }
      })

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Clientes")

      const slug = visitaFilter.replace(/[^a-z0-9]+/gi, "-").toLowerCase()
      const hoy = new Date()
      const pad = (n: number) => String(n).padStart(2, "0")
      const stamp = `${hoy.getFullYear()}${pad(hoy.getMonth() + 1)}${pad(hoy.getDate())}`
      XLSX.writeFile(wb, `clientes-${slug}-${stamp}.xlsx`)
      toast.success(`Excel descargado (${filas.length} clientes)`)
    } catch (err) {
      console.error("Error exportando clientes:", err)
      toast.error("No se pudo generar el Excel. Intenta de nuevo.")
    } finally {
      setIsExporting(false)
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

  useEffect(() => {
    if (!currentUser) return
    void loadStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sucursalFilter, currentUser, sucursales.length])

  // Cargar clientes cuando cambia la página, el término de búsqueda activo o el filtro de visita
  useEffect(() => {
    loadClientes(currentPage, searchActivo, visitaFilter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, searchActivo, visitaFilter, sucursalFilter])

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

  const clientesFiltrados = clientes.filter((c) => {
    if (visitaFilter === 'embajadoras') return c.embajadora
    if (visitaFilter === 'vetadas') return c.esVetado
    if (visitaFilter === 'problematicas') return c.esProblematico
    if (visitaFilter === 'descuento') return c.esDescuento
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
          {canExportClientes && (
            <Button variant="outline" onClick={handleExportClientes} disabled={isExporting}>
              {isExporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total en base</CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
              ) : (
                <div className="text-2xl font-bold">{stats.total.toLocaleString()}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Activos, VIP e inactivos</p>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:border-primary/40 transition-colors"
            onClick={() => {
              setVisitaFilter("embajadoras")
              setCurrentPage(1)
            }}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Embajadoras</CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
              ) : (
                <div className="text-2xl font-bold">{stats.embajadoras.toLocaleString()}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Marcadas como embajadora · clic para ver lista</p>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:border-primary/40 transition-colors"
            onClick={() => {
              setVisitaFilter("con-visitas")
              setCurrentPage(1)
            }}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Clientes activos</CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
              ) : (
                <div className="text-2xl font-bold">{stats.conVisitas.toLocaleString()}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {isBranchAdmin && sucursalTarjetasId
                  ? "≥1 cita completada en tu sucursal (igual que Reportes) · clic para ver lista"
                  : sucursalNombreActiva
                    ? `≥1 cita completada en ${sucursalNombreActiva} · clic para ver lista`
                    : "≥1 cita completada (igual que Reportes) · clic para ver lista"}
              </p>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:border-primary/40 transition-colors"
            onClick={() => {
              setVisitaFilter("nuevos-este-mes")
              setCurrentPage(1)
            }}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Clientes nuevos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
              ) : (
                <div className="text-2xl font-bold">
                  {stats.nuevosPrimeraVisitaEver.toLocaleString()}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {sucursalNombreActiva
                  ? `Sin historial previo; 1.ª cita este mes en ${sucursalNombreActiva} · clic para lista`
                  : isBranchAdmin && sucursalTarjetasId
                    ? "Sin historial previo en ninguna sucursal; 1.ª cita este mes en la tuya · clic para lista"
                    : "Sin historial previo en ninguna sucursal; 1.ª cita este mes · clic para lista"}
              </p>
            </CardContent>
          </Card>
          <Card
            className={
              primeraVezRequiereSeleccionSucursal
                ? "opacity-95"
                : "cursor-pointer hover:border-primary/40 transition-colors"
            }
            onClick={() => {
              if (primeraVezRequiereSeleccionSucursal) return
              setVisitaFilter("primera-vez-sucursal")
              setCurrentPage(1)
            }}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Primera vez en sucursal
              </CardTitle>
              <CardDescription className="text-[11px]">
                No son clientes nuevos al negocio
              </CardDescription>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
              ) : primeraVezRequiereSeleccionSucursal ? (
                <p className="text-sm text-muted-foreground leading-snug">
                  Selecciona una sucursal en el filtro de arriba para ver este dato.
                </p>
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {stats.primeraVezEnSucursal.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {sucursalNombreActiva
                      ? `Ya visitaban otras sucursales; 1.ª cita en ${sucursalNombreActiva} este mes · clic para lista`
                      : "Ya visitaban otras sucursales; 1.ª cita en la tuya este mes · clic para lista"}
                  </p>
                </>
              )}
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
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div className="relative flex-1 min-w-[200px]">
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
            {isAdmin && sucursales.length > 0 && (
              <Select
                value={sucursalFilter}
                onValueChange={v => {
                  setSucursalFilter(v)
                  setCurrentPage(1)
                }}
              >
                <SelectTrigger className="w-52">
                  <Building2 className="h-4 w-4 mr-2 shrink-0 text-muted-foreground" />
                  <SelectValue placeholder="Sucursal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las sucursales</SelectItem>
                  {sucursales.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select
              value={visitaFilter}
              onValueChange={(v) => {
                setVisitaFilter(v as typeof visitaFilter)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-60">
                <SelectValue placeholder="Filtrar por visita" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="nuevos-este-mes">Clientes nuevos (sin historial previo)</SelectItem>
                {(isAdmin || isBranchAdmin) && (
                  <SelectItem value="primera-vez-sucursal">
                    Primera vez en sucursal (ya existían)
                  </SelectItem>
                )}
                <SelectItem value="embajadoras">Embajadoras</SelectItem>
                <SelectItem value="con-visitas">Con visitas</SelectItem>
                <SelectItem value="sin-visita-reciente">Sin visita reciente (+60 días)</SelectItem>
                <SelectItem value="sin-visitas">Sin visitas</SelectItem>
                {isAdmin && (
                  <>
                    <SelectItem value="vetadas">Vetadas</SelectItem>
                    <SelectItem value="problematicas">Problemáticas</SelectItem>
                    <SelectItem value="descuento">Descuento</SelectItem>
                  </>
                )}
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
                      {visitaFilter === "primera-vez-sucursal" && primeraVezRequiereSeleccionSucursal
                        ? "Selecciona una sucursal en el filtro de arriba para ver clientes con primera visita en sucursal."
                        : searchActivo
                          ? "No se encontraron clientes con ese criterio de búsqueda"
                          : "No hay clientes registrados"}
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
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium">
                              {cliente.nombre} {cliente.apellido}
                            </p>
                            {isAdmin && cliente.esVetado && (
                              <Badge className="bg-red-600 text-white hover:bg-red-600">🚫 Vetada</Badge>
                            )}
                            {isAdmin && cliente.esProblematico && (
                              <Badge className="bg-orange-500 text-white hover:bg-orange-500">⚠️ Problemática</Badge>
                            )}
                            {isAdmin && cliente.esDescuento && (
                              <Badge className="bg-blue-500 text-white hover:bg-blue-500">% Descuento</Badge>
                            )}
                          </div>
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
