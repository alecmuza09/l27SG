"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Plus,
  Search,
  MoreHorizontal,
  CreditCard,
  DollarSign,
  Gift,
  Ban,
  Eye,
  RefreshCw,
  CheckCircle,
  CheckCircle2,
  Loader2,
  ArrowDownCircle,
  ArrowUpCircle,
  XCircle,
  User as UserIcon,
  Trash2,
  RotateCcw,
  Calendar,
  BadgeCheck,
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { searchClientes, createCliente, type Cliente } from "@/lib/data/clientes"
import {
  getGiftCardsFromDB,
  getGiftCardsKPIsFromDB,
  getGiftCardByIdFromDB,
  getGiftCardByCodigoFromDB,
  getGiftCardTransaccionesFromDB,
  generarCodigoGiftCard,
  crearGiftCard,
  activarGiftCard,
  canjearGiftCard,
  recargarGiftCard,
  cancelarGiftCard,
  eliminarGiftCard,
} from "@/lib/data/gift-cards"
import {
  analizarFolioTiendaEnLinea,
  detectarFolioTiendaCompleto,
  intentandoFormatoTiendaEnLinea,
} from "@/lib/data/gift-card-folios-tienda"
import type { GiftCard, GiftCardTransaccion } from "@/lib/types/gift-cards"
import { getSucursalesActivasFromDB, type Sucursal } from "@/lib/data/sucursales"
import { getCurrentUser, refreshSession, isGlobalAdministrator, type User } from "@/lib/auth"

// ─── Configuración de estados ─────────────────────────────────────────────

const estadoConfig: Record<GiftCard["estado"], { label: string; className: string }> = {
  pendiente: { label: "Pendiente",  className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  activa:    { label: "Activa",     className: "bg-green-100 text-green-800 border-green-200"   },
  agotada:   { label: "Agotada",    className: "bg-gray-100 text-gray-700 border-gray-200"      },
  cancelada: { label: "Cancelada",  className: "bg-red-100 text-red-800 border-red-200"         },
  expirada:  { label: "Expirada",   className: "bg-orange-100 text-orange-800 border-orange-200"},
}

const tipoTransaccionConfig: Record<string, { label: string; signo: string; color: string }> = {
  emision:     { label: "Emisión",     signo: "+", color: "text-blue-600" },
  activacion:  { label: "Activación",  signo: "—", color: "text-green-600" },
  canje:       { label: "Canje",       signo: "−", color: "text-red-600" },
  recarga:     { label: "Recarga",     signo: "+", color: "text-emerald-600" },
  cancelacion: { label: "Cancelación", signo: "—", color: "text-red-600" },
  compra:      { label: "Compra",      signo: "+", color: "text-blue-600" },
  uso:         { label: "Uso",         signo: "−", color: "text-red-600" },
  reembolso:   { label: "Reembolso",   signo: "+", color: "text-emerald-600" },
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const fmtMXN = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n)

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("es-MX", { year: "numeric", month: "short", day: "numeric" }) : "—"

/** Alcance cuando el usuario pertenece a una sola sucursal explícita; si hay varias, RLS acota. */
function narrowGiftCardScopeSucursalId(user: User | null): string | undefined {
  if (!user || isGlobalAdministrator(user)) return undefined
  if (user.sucursalIds?.length === 1) return user.sucursalIds[0]
  if ((!user.sucursalIds || user.sucursalIds.length === 0) && user.sucursalId) return user.sucursalId
  return undefined
}

// ═══════════════════════════════════════════════════════════════════════════
// Página
// ═══════════════════════════════════════════════════════════════════════════

// Opciones de vigencia predefinidas
const VIGENCIA_OPCIONES = [
  { value: "sin_vigencia",  label: "Sin vigencia" },
  { value: "3_meses",       label: "3 meses" },
  { value: "6_meses",       label: "6 meses" },
  { value: "1_anio",        label: "1 año" },
  { value: "2_anios",       label: "2 años" },
  { value: "personalizada", label: "Fecha personalizada" },
] as const

function calcularFechaExpiracion(opcion: string, fechaPersonalizada: string): string | null {
  if (opcion === "sin_vigencia") return null
  if (opcion === "personalizada") return fechaPersonalizada || null
  const hoy = new Date()
  if (opcion === "3_meses") hoy.setMonth(hoy.getMonth() + 3)
  else if (opcion === "6_meses") hoy.setMonth(hoy.getMonth() + 6)
  else if (opcion === "1_anio") hoy.setFullYear(hoy.getFullYear() + 1)
  else if (opcion === "2_anios") hoy.setFullYear(hoy.getFullYear() + 2)
  return hoy.toISOString().split("T")[0]
}

export default function GiftCardsPage() {
  // ── Datos ──────────────────────────────────────────────────────────────
  const [giftCards, setGiftCards]     = useState<GiftCard[]>([])
  const [sucursales, setSucursales]   = useState<Sucursal[]>([])
  const [transacciones, setTransacciones] = useState<GiftCardTransaccion[]>([])
  const [isLoading, setIsLoading]     = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isActivandoTarjeta, setIsActivandoTarjeta] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  /** Filtro explícito sólo cuando el usuario tiene una sucursal (p. ej. branch-admin). */
  const [giftCardsSucursalScope, setGiftCardsSucursalScope] = useState<string | undefined>(undefined)

  // ── KPIs ───────────────────────────────────────────────────────────────
  const [kpis, setKpis] = useState({
    totalEmitidas: 0, totalActivas: 0, totalPendientes: 0, saldoTotal: 0,
  })

  // ── Paginación ─────────────────────────────────────────────────────────
  const PAGE_SIZE      = 50
  const [currentPage, setCurrentPage]   = useState(0)
  const [totalCount,  setTotalCount]    = useState(0)

  // ── Búsqueda / filtros ─────────────────────────────────────────────────
  const [searchTerm, setSearchTerm]         = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [filterEstado, setFilterEstado]     = useState<string>("todos")
  const initialized = useRef(false)

  // ── Modales ────────────────────────────────────────────────────────────
  const [isCreateOpen,   setIsCreateOpen]   = useState(false)
  const [isViewOpen,     setIsViewOpen]     = useState(false)
  const [isRedeemOpen,   setIsRedeemOpen]   = useState(false)
  const [isRechargeOpen, setIsRechargeOpen] = useState(false)
  const [isCancelOpen,   setIsCancelOpen]   = useState(false)
  const [isDeleteOpen,   setIsDeleteOpen]   = useState(false)
  const [selectedCard,   setSelectedCard]   = useState<GiftCard | null>(null)

  // ── Formulario Crear ───────────────────────────────────────────────────
  const [newMonto,           setNewMonto]          = useState("")
  const [newCodigo,          setNewCodigo]         = useState("")
  const [newVigencia,        setNewVigencia]        = useState("sin_vigencia")
  const [newExpiracion,      setNewExpiracion]      = useState("")
  const [newSucursalId,      setNewSucursalId]      = useState("")
  const [newMetodoPago,      setNewMetodoPago]      = useState("")
  const [newMetodoPagoOtro,  setNewMetodoPagoOtro]  = useState("")

  // ── Selector de cliente (modal Crear) ──────────────────────────────────
  const [clienteMode,        setClienteMode]        = useState<"existing" | "new">("existing")
  const [clienteSearchQuery, setClienteSearchQuery] = useState("")
  const [clientesBusqueda,   setClientesBusqueda]   = useState<Cliente[]>([])
  const [isLoadingClientes,  setIsLoadingClientes]  = useState(false)
  const [selectedCliente,    setSelectedCliente]    = useState<Cliente | null>(null)
  const [nuevoClienteData,   setNuevoClienteData]   = useState({
    nombre: "", apellido: "", telefono: "", email: "",
  })

  // ── Formulario Canjear ─────────────────────────────────────────────────
  const [redeemMonto, setRedeemMonto] = useState("")
  const [redeemNotas, setRedeemNotas] = useState("")

  // ── Formulario Recargar ────────────────────────────────────────────────
  const [rechargeMonto, setRechargeMonto] = useState("")
  const [rechargeNotas, setRechargeNotas] = useState("")

  // ── Consulta rápida por código ─────────────────────────────────────────
  const [consultaCodigo, setConsultaCodigo] = useState("")
  const [consultaCard,   setConsultaCard]   = useState<GiftCard | null>(null)
  const [consultaError,  setConsultaError]  = useState("")
  /** Folio válido tienda en línea aún no dado de alta */
  const [consultaTiendaPreview, setConsultaTiendaPreview] = useState<{
    codigoNormalizado: string
    servicio: string
    valor: number
  } | null>(null)
  const [isSearching,    setIsSearching]    = useState(false)

  // ── Cargar datos ───────────────────────────────────────────────────────
  const loadGiftCards = async (page: number, search: string, estado: string) => {
    const result = await getGiftCardsFromDB({
      page,
      pageSize: PAGE_SIZE,
      estado: estado !== 'todos' ? estado : undefined,
      search: search || undefined,
      sucursalId: giftCardsSucursalScope,
    })
    setGiftCards(result.data)
    setTotalCount(result.total)
  }

  const reload = async () => {
    const [result, kpiData] = await Promise.all([
      getGiftCardsFromDB({
        page: currentPage,
        pageSize: PAGE_SIZE,
        estado: filterEstado !== 'todos' ? filterEstado : undefined,
        search: debouncedSearch || undefined,
        sucursalId: giftCardsSucursalScope,
      }),
      getGiftCardsKPIsFromDB(giftCardsSucursalScope),
    ])
    setGiftCards(result.data)
    setTotalCount(result.total)
    setKpis(kpiData)
  }

  // Carga inicial: sucursales + KPIs + primera página en paralelo
  useEffect(() => {
    async function init() {
      setIsLoading(true)
      try {
        const user = await refreshSession()
        setCurrentUser(user ?? getCurrentUser())
        const sid = narrowGiftCardScopeSucursalId(user ?? getCurrentUser())
        setGiftCardsSucursalScope(sid)
        const [result, kpiData, sucData] = await Promise.all([
          getGiftCardsFromDB({ page: 0, pageSize: PAGE_SIZE, sucursalId: sid }),
          getGiftCardsKPIsFromDB(sid),
          getSucursalesActivasFromDB(),
        ])
        setGiftCards(result.data)
        setTotalCount(result.total)
        setKpis(kpiData)
        setSucursales(sucData)
      } catch (err) {
        console.error("Error cargando datos:", err)
        toast.error("Error al cargar los datos")
      } finally {
        setIsLoading(false)
        initialized.current = true
      }
    }
    init()
  }, [])

  // Debounce de búsqueda + reset de página
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchTerm)
      setCurrentPage(0)
    }, 300)
    return () => clearTimeout(t)
  }, [searchTerm])

  // Recargar tabla cuando cambian filtros o página (no en mount)
  useEffect(() => {
    if (!initialized.current) return
    loadGiftCards(currentPage, debouncedSearch, filterEstado)
  }, [currentPage, debouncedSearch, filterEstado, giftCardsSucursalScope]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Búsqueda de clientes (modal Crear) ────────────────────────────────
  useEffect(() => {
    if (!isCreateOpen || clienteMode !== "existing") return
    const trimmed = clienteSearchQuery.trim()
    if (!trimmed) { setClientesBusqueda([]); return }
    const timer = setTimeout(async () => {
      setIsLoadingClientes(true)
      try {
        setClientesBusqueda(await searchClientes(trimmed, 100))
      } catch {
        toast.error("Error al buscar clientes")
      } finally {
        setIsLoadingClientes(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [isCreateOpen, clienteMode, clienteSearchQuery])

  // Los filtros son server-side; la tabla muestra la página actual tal cual
  const filtered = giftCards

  /** Autocompletado folio tienda en línea (modal crear). */
  const tiendaDetectadaForm = detectarFolioTiendaCompleto(newCodigo)

  const abrirRegistroTiendaPreview = () => {
    if (!consultaTiendaPreview) return
    setNewCodigo(consultaTiendaPreview.codigoNormalizado)
    setNewMonto(String(consultaTiendaPreview.valor))
    setConsultaTiendaPreview(null)
    setConsultaError("")
    setIsCreateOpen(true)
  }

  // ── KPIs (desde query COUNT rápida) ───────────────────────────────────
  const { totalEmitidas, totalActivas, totalPendientes, saldoTotal } = kpis

  // ─────────────────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────────────────

  const resetCreateForm = () => {
    setNewMonto(""); setNewCodigo(""); setNewVigencia("sin_vigencia")
    setNewExpiracion(""); setNewSucursalId("")
    setNewMetodoPago(""); setNewMetodoPagoOtro("")
    setClienteMode("existing"); setClienteSearchQuery(""); setClientesBusqueda([])
    setSelectedCliente(null); setNuevoClienteData({ nombre: "", apellido: "", telefono: "", email: "" })
  }

  const handleCreate = async () => {
    if (!newMonto || !newSucursalId) return

    const codigoTrim = newCodigo.trim()
    if (intentandoFormatoTiendaEnLinea(codigoTrim)) {
      const a = analizarFolioTiendaEnLinea(codigoTrim)
      if (a.tipo === "error") {
        toast.error(a.mensaje)
        return
      }
      if (a.tipo !== "valido") {
        toast.error("Completa el folio de 10 caracteres (prefijo tienda en línea + 4 caracteres).")
        return
      }
    }

    if (!newMetodoPago) {
      toast.error("Selecciona el método de pago")
      return
    }
    if (newMetodoPago === "otro" && !newMetodoPagoOtro.trim()) {
      toast.error("Especifica el método de pago")
      return
    }
    setIsSubmitting(true)

    let clienteIdFinal: string | null = null
    if (clienteMode === "new") {
      if (!nuevoClienteData.nombre || !nuevoClienteData.apellido || !nuevoClienteData.telefono) {
        toast.error("Completa nombre, apellido y teléfono del cliente")
        setIsSubmitting(false)
        return
      }
      const creado = await createCliente({
        nombre: nuevoClienteData.nombre,
        apellido: nuevoClienteData.apellido,
        telefono: nuevoClienteData.telefono,
        email: nuevoClienteData.email || undefined,
      })
      if (!creado.success || !creado.cliente) {
        toast.error(`Error al crear cliente: ${creado.error}`)
        setIsSubmitting(false)
        return
      }
      clienteIdFinal = creado.cliente.id
    } else {
      clienteIdFinal = selectedCliente?.id ?? null
    }

    const metodoPagoFinal = newMetodoPago === "otro" ? newMetodoPagoOtro.trim() : newMetodoPago

    const res = await crearGiftCard({
      montoInicial: parseFloat(newMonto),
      sucursalId: newSucursalId,
      clienteId: clienteIdFinal,
      fechaVencimiento: calcularFechaExpiracion(newVigencia, newExpiracion),
      codigoPersonalizado: newCodigo || null,
      metodoPago: metodoPagoFinal,
    })
    setIsSubmitting(false)
    if (!res.success) {
      toast.error(`Error al crear: ${res.error}`)
      return
    }
    toast.success(`Gift card ${res.gc?.codigo}: la venta del saldo quedó registrada en Pagos → Cobros.`)
    if (res.advertenciaPago) {
      toast.warning(`Gift card guardada, pero hubo un problema al registrar el cobro en caja: ${res.advertenciaPago}`)
    }
    resetCreateForm()
    setIsCreateOpen(false)
    await reload()
  }

  // Helper: recarga el historial y abre el dialog de detalles para la card dada
  const abrirHistorial = async (cardId: string) => {
    const [updated, txns] = await Promise.all([
      getGiftCardByIdFromDB(cardId),
      getGiftCardTransaccionesFromDB(cardId),
    ])
    if (updated) {
      setSelectedCard(updated)
      if (consultaCard?.id === cardId) setConsultaCard(updated)
    }
    setTransacciones(txns)
    setIsViewOpen(true)
  }

  const handleActivarTarjeta = async () => {
    if (!selectedCard || selectedCard.estado !== "pendiente") return
    setIsActivandoTarjeta(true)
    const cardId = selectedCard.id
    const res = await activarGiftCard(cardId)
    setIsActivandoTarjeta(false)
    if (!res.success) {
      toast.error(res.error ?? "No se pudo activar la tarjeta")
      return
    }
    toast.success("Tarjeta activada")
    await reload()
    await abrirHistorial(cardId)
  }

  const handleCanjear = async () => {
    if (!selectedCard || !redeemMonto) return
    const monto = parseFloat(redeemMonto)
    if (monto <= 0 || monto > selectedCard.saldoActual) return
    setIsSubmitting(true)
    const cardId = selectedCard.id
    const res = await canjearGiftCard(cardId, monto, redeemNotas || undefined)
    setIsSubmitting(false)
    if (!res.success) { toast.error(`Error: ${res.error}`); return }
    toast.success(`Canjeados ${fmtMXN(monto)}. Saldo restante: ${fmtMXN(res.saldoNuevo ?? 0)}`)
    setRedeemMonto(""); setRedeemNotas(""); setIsRedeemOpen(false)
    await reload()
    await abrirHistorial(cardId)
  }

  const handleRecargar = async () => {
    if (!selectedCard || !rechargeMonto) return
    const monto = parseFloat(rechargeMonto)
    if (monto <= 0) return
    setIsSubmitting(true)
    const cardId = selectedCard.id
    const res = await recargarGiftCard(cardId, monto, rechargeNotas || undefined)
    setIsSubmitting(false)
    if (!res.success) { toast.error(`Error: ${res.error}`); return }
    toast.success(`Recargados ${fmtMXN(monto)}. Nuevo saldo: ${fmtMXN(res.saldoNuevo ?? 0)}`)
    setRechargeMonto(""); setRechargeNotas(""); setIsRechargeOpen(false)
    await reload()
    await abrirHistorial(cardId)
  }

  const handleCancelar = async () => {
    if (!selectedCard) return
    setIsSubmitting(true)
    const res = await cancelarGiftCard(selectedCard.id)
    setIsSubmitting(false)
    if (!res.success) { toast.error(`Error: ${res.error}`); return }
    toast.success(`Gift card ${selectedCard.codigo} cancelada`)
    setIsCancelOpen(false); setSelectedCard(null)
    await reload()
  }

  const handleEliminar = async () => {
    if (!selectedCard) return
    setIsSubmitting(true)
    const res = await eliminarGiftCard(selectedCard.id)
    setIsSubmitting(false)
    if (!res.success) { toast.error(`Error al eliminar: ${res.error}`); return }
    toast.success(`Gift card ${selectedCard.codigo} eliminada`)
    setIsDeleteOpen(false); setSelectedCard(null)
    await reload()
  }

  const handleConsultarCodigo = async () => {
    const raw = consultaCodigo.trim()
    if (!raw) return
    setIsSearching(true)
    setConsultaError("")
    setConsultaCard(null)
    setConsultaTiendaPreview(null)

    if (intentandoFormatoTiendaEnLinea(raw)) {
      const a = analizarFolioTiendaEnLinea(raw)
      if (a.tipo === "error") {
        setConsultaError(a.mensaje)
        setIsSearching(false)
        return
      }
      if (a.tipo === "valido") {
        const local = giftCards.find(
          (c) => c.codigo.toLowerCase() === a.codigoNormalizado.toLowerCase(),
        )
        if (local) {
          setConsultaCard(local)
        } else {
          const found = await getGiftCardByCodigoFromDB(a.codigoNormalizado)
          if (found) setConsultaCard(found)
          else {
            setConsultaTiendaPreview({
              codigoNormalizado: a.codigoNormalizado,
              servicio: a.servicio,
              valor: a.valor,
            })
          }
        }
        setIsSearching(false)
        return
      }
    }

    const codigo = raw.toUpperCase()
    const local = giftCards.find((c) => c.codigo.toUpperCase() === codigo)
    if (local) {
      setConsultaCard(local)
    } else {
      const found = await getGiftCardByCodigoFromDB(codigo)
      if (found) {
        setConsultaCard(found)
      } else {
        setConsultaError("No se encontró una gift card con ese código")
      }
    }
    setIsSearching(false)
  }

  const handleVerDetalles = async (card: GiftCard) => {
    setSelectedCard(card)
    const txns = await getGiftCardTransaccionesFromDB(card.id)
    setTransacciones(txns)
    setIsViewOpen(true)
  }

  // ─────────────────────────────────────────────────────────────────────
  // Loading skeleton
  // ─────────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Cargando gift cards...</p>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gift Cards</h1>
          <p className="text-muted-foreground">Gestiona tarjetas de regalo para tus clientes</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Gift Card
        </Button>
      </div>

      {/* ── Panel consulta rápida por código ── */}
      <Card className="border-2 border-primary/20 bg-primary/5">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-primary">Consultar / Usar Gift Card</p>
            <span className="text-xs text-muted-foreground">— ingresa el código para agregar o descontar saldo</span>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Código (GC-… o folio tienda: LUNA1m••••, 10 caracteres)"
              value={consultaCodigo}
              onChange={(e) => {
                setConsultaCodigo(e.target.value)
                setConsultaCard(null)
                setConsultaError("")
                setConsultaTiendaPreview(null)
              }}
              onKeyDown={(e) => e.key === "Enter" && handleConsultarCodigo()}
              className="font-mono bg-white"
            />
            <Button onClick={handleConsultarCodigo} disabled={isSearching || !consultaCodigo.trim()}>
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-2">Buscar</span>
            </Button>
          </div>

          {/* Resultado de la consulta */}
          {consultaError && (
            <p className="mt-3 text-sm text-red-600 flex items-center gap-1.5">
              <XCircle className="h-4 w-4" /> {consultaError}
            </p>
          )}

          {consultaTiendaPreview && !consultaCard && (
            <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <BadgeCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">Folio de tienda en línea reconocido</p>
                  <p className="text-sm text-muted-foreground">
                    Aún no está registrado en el sistema. Al registrarlo quedará <strong>activo</strong> con saldo{" "}
                    <strong>{fmtMXN(consultaTiendaPreview.valor)}</strong>.
                  </p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 text-sm border-t border-primary/10 pt-3">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-medium">Servicio</p>
                  <p className="font-medium">{consultaTiendaPreview.servicio}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-medium">Código normalizado</p>
                  <p className="font-mono font-semibold">{consultaTiendaPreview.codigoNormalizado}</p>
                </div>
              </div>
              <Button type="button" className="w-full sm:w-auto" onClick={abrirRegistroTiendaPreview}>
                <Plus className="h-4 w-4 mr-2" /> Registrar en sistema…
              </Button>
            </div>
          )}

          {consultaCard && (() => {
            const esValida = consultaCard.estado === 'activa' && consultaCard.saldoActual > 0
            return (
              <div className={cn(
                "mt-3 rounded-lg border p-4 flex flex-col gap-3",
                esValida ? "bg-emerald-50 border-emerald-200" : "bg-white"
              )}>
                {/* Badge de estado de validez */}
                <div className="flex items-center gap-2">
                  {esValida ? (
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
                      <CheckCircle className="h-4 w-4" /> Gift card válida — lista para usar
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700">
                      <XCircle className="h-4 w-4" /> Gift card {estadoConfig[consultaCard.estado]?.label ?? consultaCard.estado} — no disponible para cobro
                    </span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Info */}
                  <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-medium">Código</p>
                      <p className="font-mono font-bold text-sm">{consultaCard.codigo}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-medium">Saldo disponible</p>
                      <p className={cn(
                        "font-bold text-lg leading-tight",
                        consultaCard.saldoActual > 0 ? "text-emerald-600" : "text-red-500"
                      )}>
                        {fmtMXN(consultaCard.saldoActual)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-medium">Carga original</p>
                      <p className="font-semibold text-sm">{fmtMXN(consultaCard.saldoInicial)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-medium">Vence</p>
                      <p className="text-sm font-medium">
                        {consultaCard.fechaExpiracion
                          ? new Date(consultaCard.fechaExpiracion + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
                          : <span className="text-muted-foreground">Sin vencimiento</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-medium">Cliente</p>
                      <p className="text-sm font-medium">
                        {consultaCard.clienteNombre ?? <span className="text-muted-foreground">Sin asignar</span>}
                      </p>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex gap-2 sm:flex-col">
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 flex-1 sm:flex-none"
                      disabled={consultaCard.estado === 'cancelada' || consultaCard.estado === 'expirada'}
                      onClick={() => { setSelectedCard(consultaCard); setRechargeMonto(""); setRechargeNotas(""); setIsRechargeOpen(true) }}
                    >
                      <ArrowUpCircle className="h-4 w-4" /> Agregar saldo
                    </Button>
                    <Button
                      size="sm"
                      variant={esValida ? "default" : "outline"}
                      className={cn("gap-1.5 flex-1 sm:flex-none", esValida && "bg-primary")}
                      disabled={!esValida}
                      onClick={() => { setSelectedCard(consultaCard); setRedeemMonto(""); setRedeemNotas(""); setIsRedeemOpen(true) }}
                    >
                      <ArrowDownCircle className="h-4 w-4" /> Cobrar / Descontar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 flex-1 sm:flex-none text-muted-foreground"
                      onClick={() => handleVerDetalles(consultaCard)}
                    >
                      <Eye className="h-4 w-4" /> Ver historial
                    </Button>
                  </div>
                </div>
              </div>
            )
          })()}
        </CardContent>
      </Card>

      {/* KPIs */}
      {currentUser?.role !== "manager" && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Emitidas</CardTitle>
              <Gift className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalEmitidas}</div>
              <p className="text-xs text-muted-foreground">tarjetas creadas</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Activas</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalActivas}</div>
              <p className="text-xs text-muted-foreground">en circulación</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
              <CreditCard className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalPendientes}</div>
              <p className="text-xs text-muted-foreground">tarjetas en estado Pendiente</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saldo Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{fmtMXN(saldoTotal)}</div>
              <p className="text-xs text-muted-foreground">en tarjetas activas</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabla */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Gift Cards</CardTitle>
          <CardDescription>Administra todas las tarjetas de regalo</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filtros */}
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por código o cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterEstado} onValueChange={(v) => { setFilterEstado(v); setCurrentPage(0) }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="activa">Activa</SelectItem>
                <SelectItem value="agotada">Agotada</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
                <SelectItem value="expirada">Expirada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Saldo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Sucursal</TableHead>
                <TableHead>Emisión</TableHead>
                <TableHead>Expiración</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((card) => {
                const cfg = estadoConfig[card.estado]
                return (
                  <TableRow key={card.id}>
                    <TableCell className="font-mono font-semibold text-sm">{card.codigo}</TableCell>
                    <TableCell className="text-sm">{card.clienteNombre || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>
                      <span className="font-semibold">{fmtMXN(card.saldoActual)}</span>
                      {card.saldoActual !== card.saldoInicial && (
                        <span className="text-xs text-muted-foreground ml-1">/ {fmtMXN(card.saldoInicial)}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${cfg.className} border text-xs`}>{cfg.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{card.sucursalNombre}</TableCell>
                    <TableCell className="text-sm">{fmtDate(card.fechaEmision)}</TableCell>
                    <TableCell className="text-sm">{fmtDate(card.fechaExpiracion)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleVerDetalles(card)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Ver Detalles
                          </DropdownMenuItem>

                          {card.estado === "activa" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => { setSelectedCard(card); setIsRedeemOpen(true) }}>
                                <ArrowDownCircle className="mr-2 h-4 w-4" />
                                Canjear saldo
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setSelectedCard(card); setIsRechargeOpen(true) }}>
                                <ArrowUpCircle className="mr-2 h-4 w-4" />
                                Recargar saldo
                              </DropdownMenuItem>
                            </>
                          )}

                          {card.estado === "agotada" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => { setSelectedCard(card); setIsRechargeOpen(true) }}>
                                <ArrowUpCircle className="mr-2 h-4 w-4" />
                                Recargar saldo
                              </DropdownMenuItem>
                            </>
                          )}

                          {(card.estado === "activa" || card.estado === "pendiente") && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => { setSelectedCard(card); setIsCancelOpen(true) }}
                                className="text-red-600 focus:text-red-600 focus:bg-red-50"
                              >
                                <XCircle className="mr-2 h-4 w-4" />
                                Cancelar tarjeta
                              </DropdownMenuItem>
                            </>
                          )}

                          {currentUser?.role === "admin" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => { setSelectedCard(card); setIsDeleteOpen(true) }}
                                className="text-red-700 focus:text-red-700 focus:bg-red-50 font-medium"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Eliminar permanentemente
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                    {searchTerm || filterEstado !== "todos"
                      ? "No se encontraron resultados para los filtros aplicados"
                      : "Aún no hay gift cards. ¡Crea la primera!"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* ── Paginación ────────────────────────────────────── */}
          {totalCount > PAGE_SIZE && (
            <div className="flex items-center justify-between pt-3 border-t mt-2">
              <span className="text-xs text-muted-foreground">
                {totalCount} tarjetas · página {currentPage + 1} de {Math.ceil(totalCount / PAGE_SIZE)}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => p - 1)}
                  disabled={currentPage === 0}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => p + 1)}
                  disabled={currentPage >= Math.ceil(totalCount / PAGE_SIZE) - 1}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════════════════
          DIALOGS
      ══════════════════════════════════════════════════════ */}

      {/* Crear */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => { if (!open) resetCreateForm(); setIsCreateOpen(open) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Gift Card</DialogTitle>
            <DialogDescription>Ingresa los datos de la nueva tarjeta de regalo</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">

            {/* Código */}
            <div className="grid gap-2">
              <Label>Código / Clave de la tarjeta *</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Ej. GC-… o folio tienda LUNA1m + 4 caracteres"
                  value={newCodigo}
                  onChange={(e) => {
                    const v = e.target.value
                    setNewCodigo(v)
                    const det = detectarFolioTiendaCompleto(v)
                    if (det) setNewMonto(String(det.valor))
                  }}
                  className="font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="Generar código automático"
                  onClick={() => setNewCodigo(generarCodigoGiftCard())}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Folios LUNA1m, LUNA2m, LUNA3m o LUNA4m (10 caracteres en total): se reconoce el servicio y el monto; la tarjeta queda activa al crear.
              </p>
              {tiendaDetectadaForm && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-900">
                  <span className="font-semibold">Tienda en línea:</span> {tiendaDetectadaForm.servicio} —{" "}
                  {fmtMXN(tiendaDetectadaForm.valor)}
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Monto Inicial *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input
                  type="number"
                  min="1"
                  step="any"
                  placeholder="500.00"
                  value={newMonto}
                  onChange={(e) => setNewMonto(e.target.value)}
                  readOnly={!!tiendaDetectadaForm}
                  className={cn("pl-7", tiendaDetectadaForm && "bg-muted/60 cursor-not-allowed")}
                />
              </div>
              {tiendaDetectadaForm && (
                <p className="text-xs text-muted-foreground">El monto lo fija el folio de la tienda en línea.</p>
              )}
            </div>
            {/* Método de pago */}
            <div className="grid gap-2">
              <Label>Método de Pago *</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: "efectivo",     label: "Efectivo" },
                  { value: "tarjeta",      label: "Tarjeta" },
                  { value: "cortesia",     label: "Cortesía" },
                  { value: "otro",         label: "Otro" },
                ].map((op) => (
                  <button
                    key={op.value}
                    type="button"
                    onClick={() => { setNewMetodoPago(op.value); if (op.value !== "otro") setNewMetodoPagoOtro("") }}
                    className={cn(
                      "rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                      newMetodoPago === op.value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:bg-accent"
                    )}
                  >
                    {op.label}
                  </button>
                ))}
              </div>
              {newMetodoPago === "otro" && (
                <Input
                  placeholder="Especifica el método de pago..."
                  value={newMetodoPagoOtro}
                  onChange={(e) => setNewMetodoPagoOtro(e.target.value)}
                  className="mt-1"
                  autoFocus
                />
              )}
              {!newMetodoPago && (
                <p className="text-xs text-muted-foreground">Selecciona cómo se pagó esta gift card</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Sucursal *</Label>
              <Select value={newSucursalId} onValueChange={setNewSucursalId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar sucursal" />
                </SelectTrigger>
                <SelectContent>
                  {sucursales.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ── Cliente ── */}
            <div className="grid gap-2">
              <Label>Cliente (Opcional)</Label>
              <Tabs
                value={clienteMode}
                onValueChange={(v) => {
                  setClienteMode(v as "existing" | "new")
                  setClienteSearchQuery("")
                  setClientesBusqueda([])
                  setSelectedCliente(null)
                }}
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="existing">Cliente existente</TabsTrigger>
                  <TabsTrigger value="new">Nuevo cliente</TabsTrigger>
                </TabsList>

                <TabsContent value="existing" className="space-y-2 mt-2">
                  {selectedCliente ? (
                    <div className="flex items-center gap-3 px-3 py-2 rounded-md bg-primary/5 border border-primary/20">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{selectedCliente.nombre} {selectedCliente.apellido}</p>
                        <p className="text-xs text-muted-foreground">{selectedCliente.telefono}</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => { setSelectedCliente(null); setClienteSearchQuery("") }}
                      >
                        Cambiar
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar por nombre, teléfono o email..."
                          value={clienteSearchQuery}
                          onChange={(e) => setClienteSearchQuery(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      <div className="border rounded-md">
                        <ScrollArea className="h-[140px]">
                          <div className="p-2 space-y-1">
                            {isLoadingClientes ? (
                              <div className="flex items-center justify-center py-6">
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                              </div>
                            ) : clienteSearchQuery.trim() === "" ? (
                              <p className="p-3 text-sm text-muted-foreground text-center">
                                Escribe para buscar clientes
                              </p>
                            ) : clientesBusqueda.length === 0 ? (
                              <p className="p-3 text-sm text-muted-foreground text-center">
                                Sin resultados. Prueba otro término.
                              </p>
                            ) : clientesBusqueda.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => setSelectedCliente(c)}
                                className="w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors flex items-center gap-3"
                              >
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                  <UserIcon className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium">{c.nombre} {c.apellido}</p>
                                  <p className="text-xs text-muted-foreground">{c.telefono}{c.email ? ` · ${c.email}` : ""}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    </>
                  )}
                </TabsContent>

                <TabsContent value="new" className="space-y-3 mt-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Nombre *</Label>
                      <Input
                        value={nuevoClienteData.nombre}
                        onChange={(e) => setNuevoClienteData({ ...nuevoClienteData, nombre: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Apellido *</Label>
                      <Input
                        value={nuevoClienteData.apellido}
                        onChange={(e) => setNuevoClienteData({ ...nuevoClienteData, apellido: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Teléfono *</Label>
                      <Input
                        type="tel"
                        value={nuevoClienteData.telefono}
                        onChange={(e) => setNuevoClienteData({ ...nuevoClienteData, telefono: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Email</Label>
                      <Input
                        type="email"
                        value={nuevoClienteData.email}
                        onChange={(e) => setNuevoClienteData({ ...nuevoClienteData, email: e.target.value })}
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Vigencia */}
            <div className="grid gap-2">
              <Label className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Vigencia
              </Label>
              <Select value={newVigencia} onValueChange={setNewVigencia}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VIGENCIA_OPCIONES.map((op) => (
                    <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {newVigencia === "personalizada" && (
                <Input
                  type="date"
                  value={newExpiracion}
                  onChange={(e) => setNewExpiracion(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                />
              )}
              {newVigencia !== "sin_vigencia" && newVigencia !== "personalizada" && (
                <p className="text-xs text-muted-foreground">
                  Expira el: <strong>{fmtDate(calcularFechaExpiracion(newVigencia, ""))}</strong>
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetCreateForm(); setIsCreateOpen(false) }} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={isSubmitting || !newMonto || !newSucursalId || !newCodigo.trim() || !newMetodoPago || (newMetodoPago === "otro" && !newMetodoPagoOtro.trim())}>
              {isSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creando...</> : "Crear Gift Card"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Canjear */}
      <Dialog open={isRedeemOpen} onOpenChange={setIsRedeemOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Canjear Saldo</DialogTitle>
            <DialogDescription>
              {selectedCard?.codigo} · Saldo disponible: <strong>{selectedCard && fmtMXN(selectedCard.saldoActual)}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Monto a Canjear *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input
                  type="number"
                  min="0.01"
                  step="any"
                  max={selectedCard?.saldoActual}
                  placeholder="0.00"
                  value={redeemMonto}
                  onChange={(e) => setRedeemMonto(e.target.value)}
                  className="pl-7"
                />
              </div>
              {redeemMonto && parseFloat(redeemMonto) > (selectedCard?.saldoActual ?? 0) && (
                <p className="text-xs text-red-500">El monto supera el saldo disponible</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Notas (Opcional)</Label>
              <Textarea
                placeholder="Descripción del canje..."
                value={redeemNotas}
                onChange={(e) => setRedeemNotas(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRedeemOpen(false)} disabled={isSubmitting}>Cancelar</Button>
            <Button
              onClick={handleCanjear}
              disabled={
                isSubmitting ||
                !redeemMonto ||
                parseFloat(redeemMonto) <= 0 ||
                parseFloat(redeemMonto) > (selectedCard?.saldoActual ?? 0)
              }
            >
              {isSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Canjeando...</> : <><ArrowDownCircle className="h-4 w-4 mr-2" />Canjear</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recargar */}
      <Dialog open={isRechargeOpen} onOpenChange={setIsRechargeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recargar Saldo</DialogTitle>
            <DialogDescription>
              {selectedCard?.codigo} · Saldo actual: <strong>{selectedCard && fmtMXN(selectedCard.saldoActual)}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Monto a Recargar *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input
                  type="number"
                  min="0.01"
                  step="any"
                  placeholder="0.00"
                  value={rechargeMonto}
                  onChange={(e) => setRechargeMonto(e.target.value)}
                  className="pl-7"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Notas (Opcional)</Label>
              <Textarea
                placeholder="Motivo de la recarga..."
                value={rechargeNotas}
                onChange={(e) => setRechargeNotas(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRechargeOpen(false)} disabled={isSubmitting}>Cancelar</Button>
            <Button
              onClick={handleRecargar}
              disabled={isSubmitting || !rechargeMonto || parseFloat(rechargeMonto) <= 0}
            >
              {isSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Recargando...</> : <><ArrowUpCircle className="h-4 w-4 mr-2" />Recargar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancelar (AlertDialog) */}
      <AlertDialog open={isCancelOpen} onOpenChange={setIsCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar esta gift card?</AlertDialogTitle>
            <AlertDialogDescription>
              La tarjeta <strong>{selectedCard?.codigo}</strong> quedará cancelada de forma permanente y no podrá ser utilizada. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>No, conservar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelar}
              disabled={isSubmitting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Cancelando...</> : "Sí, cancelar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Eliminar (solo admin) */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-700">
              <Trash2 className="h-5 w-5" />
              Eliminar gift card permanentemente
            </AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de eliminar la gift card <strong className="font-mono">{selectedCard?.codigo}</strong> de forma definitiva.
              Se borrarán también todas sus transacciones. <strong>Esta acción es irreversible.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEliminar}
              disabled={isSubmitting}
              className="bg-red-700 hover:bg-red-800"
            >
              {isSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Eliminando...</> : "Sí, eliminar definitivamente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Ver Detalles + Historial */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="flex h-auto max-h-[min(90dvh,calc(100vh-2rem))] min-h-0 w-[calc(100%-2rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="flex-shrink-0 border-b px-6 pt-5 pb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Gift className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <DialogTitle className="font-mono text-lg">{selectedCard?.codigo}</DialogTitle>
                  {selectedCard && (
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={`${estadoConfig[selectedCard.estado].className} border text-xs`}>
                        {estadoConfig[selectedCard.estado].label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {transacciones.length} movimiento{transacciones.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              {/* Acciones rápidas dentro del dialog */}
              {selectedCard && (
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  {selectedCard.estado === "pendiente" && (
                    <Button
                      size="sm"
                      className="h-8 gap-1.5 bg-green-600 hover:bg-green-700"
                      disabled={isActivandoTarjeta}
                      onClick={handleActivarTarjeta}
                    >
                      {isActivandoTarjeta ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <BadgeCheck className="h-3.5 w-3.5" />
                      )}
                      Activar tarjeta
                    </Button>
                  )}
                  {selectedCard.estado === "activa" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                      onClick={() => {
                        setIsViewOpen(false)
                        setRechargeMonto("")
                        setRechargeNotas("")
                        setIsRechargeOpen(true)
                      }}
                    >
                      <ArrowUpCircle className="h-3.5 w-3.5" /> Agregar
                    </Button>
                  )}
                  {selectedCard.estado === 'activa' && selectedCard.saldoActual > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 h-8"
                      onClick={() => { setIsViewOpen(false); setRedeemMonto(""); setRedeemNotas(""); setIsRedeemOpen(true) }}
                    >
                      <ArrowDownCircle className="h-3.5 w-3.5" /> Descontar
                    </Button>
                  )}
                </div>
              )}
            </div>
          </DialogHeader>

          {selectedCard && (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
              <div className="space-y-5">
                {/* Saldo + gastos destacados */}
                <div className="grid grid-cols-3 gap-3 p-4 bg-muted/40 rounded-xl">
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground uppercase font-medium mb-1">Saldo actual</p>
                    <p className={cn("text-xl font-bold", selectedCard.saldoActual > 0 ? "text-emerald-600" : "text-red-500")}>
                      {fmtMXN(selectedCard.saldoActual)}
                    </p>
                  </div>
                  <div className="text-center border-x">
                    <p className="text-[10px] text-muted-foreground uppercase font-medium mb-1">Carga total</p>
                    <p className="text-xl font-bold">{fmtMXN(selectedCard.saldoInicial)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground uppercase font-medium mb-1">Total usado</p>
                    <p className="text-xl font-bold text-orange-600">{fmtMXN(selectedCard.saldoInicial - selectedCard.saldoActual)}</p>
                  </div>
                </div>

                {/* Detalles */}
                {(() => {
                  // Extraer método de pago: primero del objeto, luego de la transacción de emisión
                  const metodoPagoDisplay = selectedCard.metodoPago
                    ?? transacciones.find(t => t.tipo === "emision")?.notas?.match(/Pago:\s*(.+)/)?.[1]
                    ?? null

                  const METODO_LABELS: Record<string, string> = {
                    efectivo: "Efectivo",
                    tarjeta: "Tarjeta",
                    cortesia: "Cortesía",
                  }

                  const metodoPagoLabel = metodoPagoDisplay
                    ? (METODO_LABELS[metodoPagoDisplay.toLowerCase()] ?? metodoPagoDisplay)
                    : "—"

                  return (
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {[
                        { label: "Cliente",         value: selectedCard.clienteNombre || "Sin asignar" },
                        { label: "Sucursal",         value: selectedCard.sucursalNombre },
                        { label: "Método de Pago",   value: metodoPagoLabel },
                        { label: "Emisor",           value: selectedCard.empleadoEmisorNombre || "—" },
                        { label: "Fecha Emisión",    value: fmtDate(selectedCard.fechaEmision) },
                        { label: "Activación",       value: fmtDate(selectedCard.fechaActivacion) },
                        { label: "Expiración",       value: fmtDate(selectedCard.fechaExpiracion) },
                      ].map(({ label, value }) => (
                        <div key={label} className="space-y-0.5">
                          <p className="text-xs text-muted-foreground">{label}</p>
                          <p className="font-medium">{value}</p>
                        </div>
                      ))}
                    </div>
                  )
                })()}

                {/* Historial de transacciones */}
                <div>
                  <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                    Historial de Movimientos
                  </h4>
                  {transacciones.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6 border rounded-lg bg-muted/20">
                      Sin movimientos registrados
                    </p>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="text-xs">Fecha</TableHead>
                            <TableHead className="text-xs">Tipo</TableHead>
                            <TableHead className="text-xs text-right">Monto</TableHead>
                            <TableHead className="text-xs text-right">Saldo resultante</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {transacciones.map((t) => {
                            const cfg = tipoTransaccionConfig[t.tipo] ?? { label: t.tipo, signo: "·", color: "" }
                            const esIngreso = cfg.signo === "+"
                            const esEgreso  = cfg.signo === "−" || cfg.signo === "-"
                            return (
                              <TableRow key={t.id} className="hover:bg-muted/20">
                                <TableCell className="text-sm py-2.5">{fmtDate(t.fecha)}</TableCell>
                                <TableCell className="py-2.5">
                                  <div className="flex items-center gap-2">
                                    <span className={cn(
                                      "inline-flex h-5 w-5 rounded-full items-center justify-center flex-shrink-0",
                                      esIngreso ? "bg-emerald-100" : esEgreso ? "bg-red-100" : "bg-gray-100"
                                    )}>
                                      {esIngreso
                                        ? <ArrowUpCircle className="h-3 w-3 text-emerald-600" />
                                        : esEgreso
                                          ? <ArrowDownCircle className="h-3 w-3 text-red-500" />
                                          : <RefreshCw className="h-3 w-3 text-gray-500" />
                                      }
                                    </span>
                                    <div>
                                      <span className="text-sm font-medium">{cfg.label}</span>
                                      {t.notas && <p className="text-xs text-muted-foreground leading-tight">{t.notas}</p>}
                                      {t.empleadoNombre && <p className="text-xs text-muted-foreground leading-tight">Por: {t.empleadoNombre}</p>}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className={cn("text-sm font-semibold text-right py-2.5", cfg.color)}>
                                  {cfg.signo !== "—" ? `${cfg.signo}${fmtMXN(t.monto)}` : "—"}
                                </TableCell>
                                <TableCell className="text-sm font-medium text-right py-2.5">{fmtMXN(t.saldoNuevo)}</TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex-shrink-0 border-t px-6 py-4">
            <Button variant="outline" onClick={() => setIsViewOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
