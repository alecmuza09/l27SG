"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  CreditCard, Banknote, ArrowLeftRight, Plus, ShoppingBag,
  RefreshCw, Receipt, Search, Gift, Loader2, Wallet,
  Eye, Pencil, X, Check, Star, ChevronDown, Trash2, AlertTriangle,
} from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import {
  getPagosFromDB, calcularResumenDesdePagos, updatePago, deletePago,
  distribuirMontoPago,
  etiquetaMetodosPago,
  debePersistirMetodoMixtoEfectivoTarjeta,
  esReferenciaEmisionGiftCard,
  sincronizarPagosEmisionGiftCardsFaltantes,
  totalizarVentasSaldoGiftCards,
  esVentaSaldoGiftCard,
  type Pago, type ResumenCajaDiario,
} from "@/lib/data/pagos"
import { searchClientes, type Cliente } from "@/lib/data/clientes"
import { getCitasByDateAndSucursalFromDB, updateCita, updateCitaEstado, type Cita } from "@/lib/data/citas"
import { getSucursalesActivasFromDB, getSucursalesByIdsFromDB, getSucursalById, type Sucursal } from "@/lib/data/sucursales"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { CajaDialog } from "@/components/punto-venta/caja-dialog"
import { cn } from "@/lib/utils"
import { getCurrentUser } from "@/lib/auth"
import { toast } from "sonner"

// ─── helpers ────────────────────────────────────────────────────────────────
const fmtMXN = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n)

// Usa fecha local para que no cambie de día a las 6 PM (UTC−6)
const hoy = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

// ─── tipos locales ───────────────────────────────────────────────────────────
interface Gasto {
  id: string
  descripcion: string
  monto: number
  categoria: string
  hora: string
}

// ─── StatRow helper ──────────────────────────────────────────────────────────
function StatRow({
  label, value, highlight = false,
}: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cn(
      "flex justify-between items-center py-1.5 px-2 rounded text-xs",
      highlight ? "bg-amber-50 font-semibold text-amber-900" : "text-muted-foreground",
    )}>
      <span>{label}</span>
      <span className={highlight ? "text-amber-800 font-bold" : "font-medium text-foreground"}>{value}</span>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════

export default function PagosPage() {
  const currentUser = getCurrentUser()
  const isAdmin     = currentUser?.role === "admin" || currentUser?.role === "superadmin"
  const isSuperAdmin = currentUser?.role === "superadmin"

  // Sucursales asignadas al usuario (para managers con múltiples sucursales)
  const userSucursalIds = currentUser?.sucursalIds ?? (currentUser?.sucursalId ? [currentUser.sucursalId] : [])
  const hasMultipleSucursales = isAdmin || userSucursalIds.length > 1

  const [fecha, setFecha]                       = useState(hoy())
  const [sucursales, setSucursales]             = useState<Sucursal[]>([])
  const [sucursalId, setSucursalId]             = useState<string>(
    currentUser?.sucursalId ?? "todas",
  )
  const [citas, setCitas]                       = useState<Cita[]>([])
  const [pagos, setPagos]                       = useState<Pago[]>([])
  const [resumen, setResumen]                   = useState<ResumenCajaDiario | null>(null)
  const [gastos, setGastos]                     = useState<Gasto[]>([])
  const [isLoading, setIsLoading]               = useState(true)
  const [cajaOpen, setCajaOpen]                 = useState(false)
  const [citasSeleccionadas, setCitasSeleccionadas] = useState<Set<string>>(new Set())
  const [gastoDialogOpen, setGastoDialogOpen]   = useState(false)
  const [nuevoGasto, setNuevoGasto]             = useState({ descripcion: "", monto: "", categoria: "operativo" })
  const [busqueda, setBusqueda]                 = useState("")
  const [busquedaCitas, setBusquedaCitas]       = useState("")
  const [citaDetalle, setCitaDetalle]           = useState<Cita | null>(null)
  const [editandoCita, setEditandoCita]         = useState(false)
  const [editCitaPrecio, setEditCitaPrecio]     = useState("")
  const [editCitaNotas, setEditCitaNotas]       = useState("")
  const [editCitaEstado, setEditCitaEstado]     = useState("")
  const [isSavingCita, setIsSavingCita]         = useState(false)
  const [pagoDetalle, setPagoDetalle]           = useState<Pago | null>(null)
  const [editando, setEditando]                 = useState(false)
  const [editPropina, setEditPropina]                   = useState("")
  const [editNotas, setEditNotas]                       = useState("")
  const [editReferencia, setEditReferencia]             = useState("")
  const [editMetodoPago, setEditMetodoPago]             = useState("")
  const [editMontoEfectivo, setEditMontoEfectivo]       = useState("")
  const [editMontoTarjeta, setEditMontoTarjeta]         = useState("")
  const [editMotivo, setEditMotivo]                     = useState("")
  const [editMonto, setEditMonto]                       = useState("")
  const [editFecha, setEditFecha]                       = useState("")
  const [editServicio, setEditServicio]                 = useState("")
  const [editClienteId, setEditClienteId]               = useState("")
  const [editClienteNombre, setEditClienteNombre]       = useState("")
  const [editClienteBusqueda, setEditClienteBusqueda]   = useState("")
  const [editClienteResultados, setEditClienteResultados] = useState<Cliente[]>([])
  const [editClienteBuscando, setEditClienteBuscando]   = useState(false)
  const [isDeletePagoOpen, setIsDeletePagoOpen]         = useState(false)
  const [isSavingPago, setIsSavingPago]                 = useState(false)
  const [syncingGcPagos, setSyncingGcPagos]             = useState(false)

  // ── carga de datos ──────────────────────────────────────────────────────────
  const cargarDatos = useCallback(async () => {
    setIsLoading(true)
    try {
      const sidFiltro = sucursalId !== "todas" ? sucursalId : undefined
      const citasSucursalId = sucursalId !== "todas" ? sucursalId : null

      const [sucData, pagosData, citasData] = await Promise.all([
        isAdmin
          ? getSucursalesActivasFromDB()
          : userSucursalIds.length > 1
            ? getSucursalesByIdsFromDB(userSucursalIds)
            : Promise.resolve([] as Sucursal[]),
        getPagosFromDB(sidFiltro, fecha),
        citasSucursalId
          ? getCitasByDateAndSucursalFromDB(fecha, citasSucursalId)
          : Promise.resolve([] as Cita[]),
      ])

      // Sucursales — admins ven todas; managers multi-sucursal ven las suyas
      if (isAdmin || userSucursalIds.length > 1) setSucursales(sucData)

      // Pagos + resumen
      setPagos(pagosData)
      setResumen(calcularResumenDesdePagos(pagosData, fecha))

      // Citas
      if (citasSucursalId) {
        setCitas(citasData)
      } else if (sucData.length > 0) {
        // Admin con "todas" → cargar primera sucursal de la lista
        const primerasCitas = await getCitasByDateAndSucursalFromDB(fecha, sucData[0].id)
        setCitas(primerasCitas)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }, [fecha, sucursalId, isAdmin, userSucursalIds.join(',')])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  // ── estado derivado ─────────────────────────────────────────────────────────
  const citasPendientes = citas.filter(c =>
    !c.pagado &&
    c.estado !== "cancelada" &&
    c.estado !== "no-asistio",
  )

  const citasPendientesFiltradas = busquedaCitas
    ? citasPendientes.filter(c =>
        c.clienteNombre.toLowerCase().includes(busquedaCitas.toLowerCase()) ||
        c.empleadoNombre.toLowerCase().includes(busquedaCitas.toLowerCase()) ||
        c.servicioNombre.toLowerCase().includes(busquedaCitas.toLowerCase()),
      )
    : citasPendientes

  const qBusquedaPagos = busqueda.trim().toLowerCase()
  const pagosFiltrados = qBusquedaPagos
    ? pagos.filter(p => {
        const enCliente = p.clienteNombre.toLowerCase().includes(qBusquedaPagos)
        const enEmp = (p.empleadoNombre ?? "").toLowerCase().includes(qBusquedaPagos)
        const enServ = (p.servicios ?? []).some(s => s.toLowerCase().includes(qBusquedaPagos))
        const enRef = (p.referencia ?? "").toLowerCase().includes(qBusquedaPagos)
        return enCliente || enEmp || enServ || enRef
      })
    : pagos

  let totalEfectivo = 0
  let totalTarjeta = 0
  let totalTransf = 0
  let totalOtro = 0
  for (const p of pagos) {
    if (p.estado !== "completado") continue
    const d = distribuirMontoPago(p)
    totalEfectivo += d.efectivo
    totalTarjeta += d.tarjeta
    totalTransf += d.transferencia
    totalOtro += d.otro
  }

  const ventasSaldoGiftCards = totalizarVentasSaldoGiftCards(pagos)

  const cobrosCompletadosCount = pagos.filter(p => p.estado === "completado").length

  const totalGastos     = gastos.reduce((s, g) => s + g.monto, 0)
  const totalGeneral    = totalEfectivo + totalTarjeta + totalTransf + totalOtro
  const totalNeto       = totalGeneral - totalGastos

  // ── helpers de selección ────────────────────────────────────────────────────
  const toggleCita = (id: string) => {
    setCitasSeleccionadas(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleTodas = () => {
    const ids = citasPendientesFiltradas.map(c => c.id)
    const todasSeleccionadas = ids.every(id => citasSeleccionadas.has(id))
    if (todasSeleccionadas) {
      setCitasSeleccionadas(new Set())
    } else {
      setCitasSeleccionadas(new Set(ids))
    }
  }

  const citasACobrar = citasPendientes.filter(c => citasSeleccionadas.has(c.id))
  const totalSeleccionado = citasACobrar.reduce((s, c) => s + c.precio, 0)

  const abrirCajaConSeleccion = () => {
    if (citasSeleccionadas.size === 0) return
    setCajaOpen(true)
  }

  const ESTADOS_CITA = [
    { value: "pendiente",   label: "Pendiente",    color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
    { value: "confirmada",  label: "Confirmada",   color: "bg-blue-100 text-blue-800 border-blue-300" },
    { value: "en-progreso", label: "En atención",  color: "bg-purple-100 text-purple-800 border-purple-300" },
    { value: "completada",  label: "Completada",   color: "bg-green-100 text-green-800 border-green-300" },
    { value: "pagado",      label: "✓ Pagado",     color: "bg-emerald-100 text-emerald-800 border-emerald-300" },
    { value: "cancelada",   label: "Cancelada",    color: "bg-red-100 text-red-700 border-red-300" },
  ]

  const handleCambiarEstadoRapido = async (cita: Cita, nuevoEstado: string) => {
    const esPagado = nuevoEstado === "pagado"
    const estadoDB = esPagado ? "completada" : nuevoEstado as any
    const res = await updateCitaEstado(cita.id, estadoDB, esPagado ? true : undefined)
    if (!res.success) return
    // Si quedó pagado o cancelada, sacar de la lista; si no, actualizar estado
    if (esPagado || nuevoEstado === "cancelada") {
      setCitas(prev => prev.filter(c => c.id !== cita.id))
      setCitasSeleccionadas(prev => { const s = new Set(prev); s.delete(cita.id); return s })
    } else {
      setCitas(prev => prev.map(c => c.id === cita.id ? { ...c, estado: estadoDB } : c))
    }
  }

  const abrirDetalleCita = (cita: Cita) => {
    setCitaDetalle(cita)
    setEditandoCita(false)
    setEditCitaPrecio(String(cita.precio))
    setEditCitaNotas(cita.notas ?? "")
    setEditCitaEstado(cita.estado)
  }

  const handleGuardarCita = async () => {
    if (!citaDetalle) return
    setIsSavingCita(true)
    const res = await updateCita(citaDetalle.id, {
      precio: Number(editCitaPrecio) || citaDetalle.precio,
      notas: editCitaNotas.trim() || undefined,
      estado: editCitaEstado as any,
    })
    setIsSavingCita(false)
    if (!res.success) { alert(`Error: ${res.error}`); return }
    const updated = { ...citaDetalle, precio: Number(editCitaPrecio) || citaDetalle.precio, notas: editCitaNotas.trim() || undefined, estado: editCitaEstado }
    setCitas(prev => prev.map(c => c.id === citaDetalle.id ? updated as Cita : c))
    setCitaDetalle(updated as Cita)
    setEditandoCita(false)
  }

  const handleCancelarCita = async () => {
    if (!citaDetalle) return
    if (!confirm("¿Cancelar esta cita? Esta acción no se puede deshacer fácilmente.")) return
    setIsSavingCita(true)
    const res = await updateCitaEstado(citaDetalle.id, "cancelada")
    setIsSavingCita(false)
    if (!res.success) { alert(`Error: ${res.error}`); return }
    setCitas(prev => prev.map(c => c.id === citaDetalle.id ? { ...c, estado: "cancelada" } as Cita : c))
    setCitaDetalle(null)
  }

  const abrirDetallePago = (pago: Pago) => {
    setPagoDetalle(pago)
    setEditando(false)
    setEditPropina(String(pago.propina ?? 0))
    setEditNotas(pago.notas ?? "")
    setEditReferencia(pago.referencia ?? "")
    setEditMetodoPago(pago.metodoPago ?? "efectivo")
    setEditMontoEfectivo(String(pago.montoEfectivo ?? 0))
    setEditMontoTarjeta(String(pago.montoTarjeta ?? 0))
    setEditMotivo("")
    setEditMonto(String(pago.monto))
    setEditFecha(pago.fecha)
    setEditServicio(pago.servicios.join(", "))
    setEditClienteId(pago.clienteId ?? "")
    setEditClienteNombre(pago.clienteNombre)
    setEditClienteBusqueda("")
    setEditClienteResultados([])
  }

  const handleGuardarEdicion = async () => {
    if (!pagoDetalle) return
    setIsSavingPago(true)

    // Añadir traza de auditoría al campo notas
    const timestamp = new Date().toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })
    const auditSuffix = `[Corrección ${timestamp} — ${currentUser?.name}${editMotivo.trim() ? `: ${editMotivo.trim()}` : ""}]`
    const notaFinal = [editNotas.trim(), auditSuffix].filter(Boolean).join(" | ")

    const efEd = Number(editMontoEfectivo) || 0
    const tarEd = Number(editMontoTarjeta) || 0
    const metodoPagoFinal = debePersistirMetodoMixtoEfectivoTarjeta(efEd, tarEd) ? "otro" : editMetodoPago

    const res = await updatePago(pagoDetalle.id, {
      monto:          Number(editMonto) || pagoDetalle.monto,
      subtotal:       Number(editMonto) || pagoDetalle.monto,
      propina:        Number(editPropina) || 0,
      notas:          notaFinal || undefined,
      referencia:     editReferencia.trim() || undefined,
      metodo_pago:    metodoPagoFinal,
      monto_efectivo: efEd,
      monto_tarjeta:  tarEd,
      fecha:          editFecha || pagoDetalle.fecha,
      servicios:      editServicio.split(",").map(s => s.trim()).filter(Boolean),
      cliente_id:     editClienteId || (pagoDetalle.clienteId ?? null),
    })
    setIsSavingPago(false)
    if (!res.success) { alert(`Error: ${res.error}`); return }

    const updated = {
      monto:          Number(editMonto) || pagoDetalle.monto,
      propina:        Number(editPropina) || 0,
      notas:          notaFinal || undefined,
      referencia:     editReferencia.trim() || undefined,
      metodoPago:     metodoPagoFinal as Pago["metodoPago"],
      montoEfectivo:  efEd,
      montoTarjeta:   tarEd,
      fecha:          editFecha || pagoDetalle.fecha,
      servicios:      editServicio.split(",").map(s => s.trim()).filter(Boolean),
      clienteId:      editClienteId || (pagoDetalle.clienteId ?? null),
      clienteNombre:  editClienteNombre || pagoDetalle.clienteNombre,
    }
    setPagos(prev => prev.map(p => p.id === pagoDetalle.id ? { ...p, ...updated } : p))
    setPagoDetalle(prev => prev ? { ...prev, ...updated } : null)
    setEditando(false)
  }

  const handleBuscarClienteEdicion = useCallback(async (query: string) => {
    setEditClienteBusqueda(query)
    if (!query.trim()) { setEditClienteResultados([]); return }
    setEditClienteBuscando(true)
    try {
      const res = await searchClientes(query, 8)
      setEditClienteResultados(res)
    } finally {
      setEditClienteBuscando(false)
    }
  }, [])

  const handleEliminarPago = async () => {
    if (!pagoDetalle) return
    setIsSavingPago(true)
    // Pasa el citaId para que la cita vuelva a pendiente-por-cobrar
    const res = await deletePago(pagoDetalle.id, pagoDetalle.citaId || null)
    setIsSavingPago(false)
    if (!res.success) { alert(`Error: ${res.error}`); return }

    const pagosSinEliminado = pagos.filter(p => p.id !== pagoDetalle.id)
    setPagos(pagosSinEliminado)
    setResumen(calcularResumenDesdePagos(pagosSinEliminado, fecha))
    setIsDeletePagoOpen(false)
    setPagoDetalle(null)

    // Recargar citas para que aparezca nuevamente en la lista de cobro
    if (pagoDetalle.citaId && sucursalId !== "todas") {
      const citasActualizadas = await getCitasByDateAndSucursalFromDB(fecha, sucursalId)
      setCitas(citasActualizadas)
    } else if (pagoDetalle.citaId) {
      // Admin con "todas" — recargar datos completos
      cargarDatos()
    }
  }

  // ── acciones ────────────────────────────────────────────────────────────────

  const agregarGasto = () => {
    if (!nuevoGasto.descripcion || !nuevoGasto.monto) return
    setGastos(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        descripcion: nuevoGasto.descripcion,
        monto: parseFloat(nuevoGasto.monto),
        categoria: nuevoGasto.categoria,
        hora: new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
      },
    ])
    setNuevoGasto({ descripcion: "", monto: "", categoria: "operativo" })
    setGastoDialogOpen(false)
  }

  const handleSincronizarCobrosGiftCards = async () => {
    setSyncingGcPagos(true)
    try {
      const sid = sucursalId !== "todas" ? sucursalId : undefined
      const res = await sincronizarPagosEmisionGiftCardsFaltantes({ sucursalId: sid })
      const detalle = `Gift cards revisadas: ${res.tarjetasRevisadas}. Cobros nuevos: ${res.insertados}. Omitidas (ya en pagos o cortesía): ${res.omitidos}.`

      if (res.errores.length > 0) {
        toast.error(
          `${res.errores.slice(0, 5).join(" · ")}${res.errores.length > 5 ? "…" : ""}`,
          { duration: 14_000 },
        )
      }

      if (res.tarjetasRevisadas === 0 && res.errores.length === 0) {
        toast.warning(
          `${detalle} No se obtuvo ninguna fila de gift_cards (revisa políticas RLS en Supabase o que hayas iniciado sesión).`,
          { duration: 14_000 },
        )
      } else if (res.insertados > 0) {
        toast.success(
          `${detalle} Usa la fecha de emisión en el calendario y la pestaña Cobros para ver cada movimiento.`,
          { duration: 10_000 },
        )
      } else if (res.errores.length === 0) {
        toast.message(detalle, { duration: 9000 })
      }

      await cargarDatos()
    } finally {
      setSyncingGcPagos(false)
    }
  }

  const estadoColor = (estado: string) => {
    const m: Record<string, string> = {
      "pendiente":   "bg-yellow-100 text-yellow-800 border-yellow-200",
      "confirmada":  "bg-blue-100 text-blue-800 border-blue-200",
      "en-progreso": "bg-purple-100 text-purple-800 border-purple-200",
      "completada":  "bg-green-100 text-green-800 border-green-200",
    }
    return m[estado] ?? "bg-gray-100 text-gray-700 border-gray-200"
  }

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex gap-0 -m-6 h-[calc(100vh-4rem)]">

      {/* ════════════════════════ PANEL IZQUIERDO ══════════════════════════════ */}
      <aside className="w-56 flex-shrink-0 bg-gray-50 border-r flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b bg-white">
          <h2 className="font-bold text-base text-foreground mb-3">Cobros Luna27</h2>

          {/* Sucursal — selector para admins y managers con múltiples sucursales */}
          {hasMultipleSucursales ? (
            <Select value={sucursalId} onValueChange={setSucursalId}>
              <SelectTrigger className="h-8 text-xs mb-2">
                <SelectValue placeholder="Sucursal…" />
              </SelectTrigger>
              <SelectContent>
                {isAdmin && (
                  <SelectItem value="todas">Todas las sucursales</SelectItem>
                )}
                {sucursales.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nombre.replace("Luna 27 ", "").replace("Luna27 ", "")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="h-8 text-xs mb-2 flex items-center px-2 rounded-md border bg-muted/40 text-muted-foreground font-medium truncate">
              {getSucursalById(sucursalId)?.nombre.replace("Luna 27 ", "").replace("Luna27 ", "") ?? "Mi sucursal"}
            </div>
          )}

          {/* Fecha */}
          <input
            type="date"
            value={fecha}
            onChange={e => setFecha(e.target.value)}
            className="w-full h-8 text-xs rounded-md border bg-background px-2 text-foreground"
          />
        </div>

        {/* Botones de acción */}
        <div className="p-3 space-y-2 border-b">
          <button
            onClick={() => setGastoDialogOpen(true)}
            className="w-full flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg px-3 py-2.5 transition-colors"
          >
            <Plus className="h-3.5 w-3.5 flex-shrink-0" />
            Nuevo gasto
          </button>
          <button
            onClick={() => { setCitasSeleccionadas(new Set()); setCajaOpen(true) }}
            className="w-full flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg px-3 py-2.5 transition-colors"
          >
            <ShoppingBag className="h-3.5 w-3.5 flex-shrink-0" />
            Cobro espontáneo
          </button>
          <button className="w-full flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg px-3 py-2.5 transition-colors">
            <Gift className="h-3.5 w-3.5 flex-shrink-0" />
            Transferir saldo GC
          </button>
          <button
            onClick={cargarDatos}
            className="w-full flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground border rounded-lg px-3 py-2 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5 flex-shrink-0" />
            Actualizar
          </button>
          <button
            type="button"
            disabled={syncingGcPagos}
            onClick={handleSincronizarCobrosGiftCards}
            className="w-full flex items-center justify-center gap-2 text-xs font-medium text-violet-700 hover:text-violet-900 border border-violet-200 bg-violet-50 hover:bg-violet-100 rounded-lg px-3 py-2 transition-colors disabled:opacity-50"
          >
            {syncingGcPagos ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
            ) : (
              <Gift className="h-3.5 w-3.5 shrink-0" />
            )}
            Registrar cobros GC faltantes
          </button>
        </div>

        {/* Resumen financiero del día */}
        <div className="p-3 flex-1 space-y-1">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wide mb-2">
            Resumen del día
          </p>

          <StatRow label="Servicios — Tarjeta" value={fmtMXN(totalTarjeta)} />
          <StatRow label="Servicios — Efectivo" value={fmtMXN(totalEfectivo)} />
          <StatRow label="Ventas saldo gift cards" value={fmtMXN(ventasSaldoGiftCards.monto)} />
          <StatRow label="Transferencias" value={fmtMXN(totalTransf)} />
          {totalOtro > 0 && (
            <StatRow label="Otros medios / mixto (detalle)" value={fmtMXN(totalOtro)} />
          )}
          <StatRow label="Propinas" value={fmtMXN(resumen?.totalPropinas ?? 0)} />
          <StatRow label="Descuentos" value={fmtMXN(resumen?.totalDescuentos ?? 0)} />

          <Separator className="my-2" />

          <StatRow label="Gastos del día" value={fmtMXN(totalGastos)} />

          <Separator className="my-2" />

          <StatRow label="Total Efectivo"    value={fmtMXN(totalEfectivo)} highlight />
          <StatRow label="Total Tarjeta"     value={fmtMXN(totalTarjeta)} highlight />
          <StatRow label="Total"             value={fmtMXN(totalNeto)} highlight />
        </div>

        {/* Contador de pendientes */}
        <div className="p-3 border-t bg-white">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Por cobrar hoy</span>
            <Badge variant="secondary" className="text-orange-700 bg-orange-50 border-orange-200">
              {citasPendientes.length} citas
            </Badge>
          </div>
          <p className="text-sm font-bold text-orange-600 mt-0.5">
            {fmtMXN(citasPendientes.reduce((s, c) => s + c.precio, 0))}
          </p>
        </div>
      </aside>

      {/* ════════════════════════ ÁREA PRINCIPAL ═══════════════════════════════ */}
      <main className="flex-1 flex flex-col overflow-hidden bg-background">
        <Tabs defaultValue="pendientes" className="flex flex-col h-full">
          {/* Barra de tabs */}
          <div className="px-4 pt-4 border-b bg-background flex-shrink-0">
            <TabsList className="h-9">
              <TabsTrigger value="pendientes" className="text-xs">
                Servicios por cobrar
                {citasPendientes.length > 0 && (
                  <span className="ml-1.5 bg-orange-500 text-white text-[10px] rounded-full px-1.5 py-0.5 leading-none">
                    {citasPendientes.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="cobros" className="text-xs">
                Cobros
                {cobrosCompletadosCount > 0 && (
                  <span className="ml-1.5 bg-emerald-600 text-white text-[10px] rounded-full px-1.5 py-0.5 leading-none">
                    {cobrosCompletadosCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="giftcards" className="text-xs">Giftcards cobradas</TabsTrigger>
              <TabsTrigger value="gastos" className="text-xs">
                Gastos del día
                {gastos.length > 0 && (
                  <span className="ml-1.5 bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5 leading-none">
                    {gastos.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ─── TAB: Servicios por cobrar ─────────────────────────────────── */}
          <TabsContent value="pendientes" className="flex-1 overflow-hidden m-0 flex flex-col">

            {/* Barra de búsqueda + selección masiva */}
            <div className="px-4 pt-4 pb-3 border-b bg-background flex-shrink-0 space-y-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar cliente, empleada o servicio…"
                    value={busquedaCitas}
                    onChange={e => { setBusquedaCitas(e.target.value); setCitasSeleccionadas(new Set()) }}
                    className="pl-9 h-8 text-xs"
                  />
                </div>
                {citasPendientesFiltradas.length > 0 && (
                  <button
                    onClick={toggleTodas}
                    className="text-xs text-primary underline underline-offset-2 whitespace-nowrap"
                  >
                    {citasPendientesFiltradas.every(c => citasSeleccionadas.has(c.id))
                      ? "Deseleccionar todas"
                      : "Seleccionar todas"}
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {new Date(fecha + "T12:00:00").toLocaleDateString("es-MX", {
                    weekday: "long", day: "numeric", month: "long",
                  })}
                  {" · "}
                  <span className="font-medium text-foreground">
                    {citasPendientesFiltradas.length} por cobrar
                  </span>
                </span>
                {sucursalId === "todas" && (
                  <span className="text-amber-600 font-medium">Selecciona una sucursal para ver citas</span>
                )}
              </div>
            </div>

            {/* Lista de citas */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : sucursalId === "todas" ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <Receipt className="h-10 w-10 mb-3 opacity-20" />
                  <p className="text-sm font-medium">Selecciona una sucursal</p>
                  <p className="text-xs mt-1">Elige la sucursal en el panel izquierdo para ver las citas del día</p>
                </div>
              ) : citasPendientesFiltradas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <Receipt className="h-10 w-10 mb-3 opacity-20" />
                  <p className="text-sm">Sin servicios pendientes por cobrar</p>
                  <p className="text-xs mt-1">Cambia la fecha o el filtro de búsqueda</p>
                </div>
              ) : (
                <div className="divide-y">
                  {citasPendientesFiltradas.map((cita) => {
                    const seleccionada = citasSeleccionadas.has(cita.id)
                    return (
                      <div
                        key={cita.id}
                        onClick={() => toggleCita(cita.id)}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors select-none",
                          seleccionada
                            ? "bg-emerald-50 hover:bg-emerald-100 border-l-4 border-l-emerald-500"
                            : "hover:bg-muted/40 border-l-4 border-l-transparent",
                        )}
                      >
                        {/* Checkbox */}
                        <div className={cn(
                          "h-5 w-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors",
                          seleccionada
                            ? "bg-emerald-600 border-emerald-600"
                            : "border-gray-300 bg-white",
                        )}>
                          {seleccionada && (
                            <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>

                        {/* Info principal */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-semibold truncate">{cita.clienteNombre}</p>
                            {/* Badge de estado clickeable */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  onClick={e => e.stopPropagation()}
                                  className={cn(
                                    "flex items-center gap-0.5 text-[10px] border rounded-full px-2 py-0.5 font-medium flex-shrink-0 hover:opacity-80 transition-opacity",
                                    estadoColor(cita.estado),
                                  )}
                                >
                                  {cita.estado.replace("-", " ")}
                                  <ChevronDown className="h-2.5 w-2.5 ml-0.5" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="w-40" onClick={e => e.stopPropagation()}>
                                {ESTADOS_CITA.map(est => (
                                  <DropdownMenuItem
                                    key={est.value}
                                    className="text-xs cursor-pointer"
                                    onClick={() => handleCambiarEstadoRapido(cita, est.value)}
                                  >
                                    <span className={cn("h-2 w-2 rounded-full mr-2 flex-shrink-0 border", est.color)} />
                                    {est.label}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{cita.servicioNombre}</p>
                        </div>

                        {/* Empleada */}
                        <div className="hidden sm:block text-center flex-shrink-0 w-28">
                          <p className="text-xs text-muted-foreground truncate">{cita.empleadoNombre}</p>
                          <p className="text-xs tabular-nums text-muted-foreground/70">
                            {cita.horaInicio} – {cita.horaFin}
                          </p>
                        </div>

                        {/* Precio */}
                        <div className="flex-shrink-0 text-right">
                          <p className="text-sm font-bold tabular-nums">{fmtMXN(cita.precio)}</p>
                        </div>

                        {/* Botones de acción */}
                        <div className="flex-shrink-0 flex gap-0.5">
                          <button
                            onClick={e => { e.stopPropagation(); abrirDetalleCita(cita) }}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-violet-600 hover:bg-violet-50 transition-colors"
                            title="Ver detalle"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); abrirDetalleCita(cita); setEditandoCita(true) }}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Barra flotante de cobro cuando hay selección */}
            {citasSeleccionadas.size > 0 && (
              <div className="flex-shrink-0 border-t bg-emerald-700 text-white px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">
                    {citasSeleccionadas.size} servicio{citasSeleccionadas.size > 1 ? "s" : ""} seleccionado{citasSeleccionadas.size > 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-emerald-200">Total: {fmtMXN(totalSeleccionado)}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCitasSeleccionadas(new Set())}
                    className="text-xs text-emerald-200 hover:text-white underline"
                  >
                    Limpiar
                  </button>
                  <Button
                    size="sm"
                    className="h-8 bg-white text-emerald-700 hover:bg-emerald-50 font-semibold text-xs"
                    onClick={abrirCajaConSeleccion}
                  >
                    <Wallet className="h-3.5 w-3.5 mr-1.5" />
                    Cobrar {citasSeleccionadas.size > 1 ? `(${citasSeleccionadas.size})` : ""}
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ─── TAB: Cobros ───────────────────────────────────────────────── */}
          <TabsContent value="cobros" className="flex-1 overflow-auto m-0 p-4">
            {/* Buscador */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente o empleada…"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <div className="rounded-lg border overflow-hidden">
              <div className="px-4 py-3 bg-muted/40 border-b flex items-center justify-between">
                <p className="text-sm font-semibold">Cobros del día</p>
                <span className="text-xs text-muted-foreground">{pagosFiltrados.length} registros</span>
              </div>
              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : pagosFiltrados.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground px-4">
                  <CreditCard className="h-10 w-10 mb-3 opacity-30" />
                  <p className="text-sm font-medium text-center">Sin cobros registrados para esta fecha y sucursal</p>
                  <p className="text-xs mt-2 text-center max-w-md">
                    Las <strong>ventas de gift card</strong> aparecen aquí (pestaña <strong>Cobros</strong>), no en «Servicios por cobrar».
                    Si la tarjeta se vendió <strong>antes</strong> de activar el registro automático, usa en el panel izquierdo{" "}
                    <strong>Registrar cobros GC faltantes</strong> y luego elige la <strong>fecha de emisión</strong> de la tarjeta en el calendario.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/20">
                      <TableHead className="text-xs">Hora</TableHead>
                      <TableHead className="text-xs">Cliente</TableHead>
                      <TableHead className="text-xs">Empleada</TableHead>
                      <TableHead className="text-xs">Servicios</TableHead>
                      <TableHead className="text-xs">Método</TableHead>
                      <TableHead className="text-xs">Propina</TableHead>
                      <TableHead className="text-xs text-right">Total</TableHead>
                      <TableHead className="text-xs w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagosFiltrados.map(pago => (
                      <TableRow key={pago.id} className="hover:bg-muted/30">
                        <TableCell className="text-xs text-muted-foreground tabular-nums">{pago.hora?.slice(0, 5)}</TableCell>
                        <TableCell className="text-sm font-medium">{pago.clienteNombre}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{pago.empleadoNombre}</TableCell>
                        <TableCell className="text-xs max-w-[220px]">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="truncate">{pago.servicios.join(", ")}</span>
                            {esVentaSaldoGiftCard(pago) && (
                              <Badge variant="outline" className="text-[10px] shrink-0 px-1 py-0 border-violet-300 text-violet-800 bg-violet-50">
                                Venta saldo
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const d = distribuirMontoPago(pago)
                            const lbl = etiquetaMetodosPago(pago)
                            return (
                              <span className="inline-flex items-center gap-1 flex-wrap text-xs border rounded px-1.5 py-0.5 max-w-[200px]">
                                {d.efectivo > 0.009 && <Banknote className="h-3 w-3 text-emerald-500 shrink-0" aria-hidden />}
                                {d.tarjeta > 0.009 && <CreditCard className="h-3 w-3 text-blue-500 shrink-0" aria-hidden />}
                                {d.transferencia > 0.009 && <ArrowLeftRight className="h-3 w-3 text-indigo-500 shrink-0" aria-hidden />}
                                {d.otro > 0.009 && !(d.efectivo > 0.009 || d.tarjeta > 0.009 || d.transferencia > 0.009) && (
                                  <Wallet className="h-3 w-3 text-muted-foreground shrink-0" aria-hidden />
                                )}
                                <span className="leading-tight">{lbl}</span>
                              </span>
                            )
                          })()}
                        </TableCell>
                        <TableCell className="text-xs font-medium">
                          {(pago.propina ?? 0) > 0
                            ? <span className="text-amber-600">+{fmtMXN(pago.propina!)}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-sm">{fmtMXN(pago.monto)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-violet-600" onClick={() => abrirDetallePago(pago)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>

          {/* ─── TAB: Giftcards ────────────────────────────────────────────── */}
          <TabsContent value="giftcards" className="flex-1 overflow-auto m-0 p-4">
            <div className="rounded-lg border overflow-hidden">
              <div className="px-4 py-3 bg-muted/40 border-b">
                <p className="text-sm font-semibold">Giftcards cobradas hoy</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Cobros donde el cliente pagó con gift card (no incluye venta de tarjetas nuevas).
                </p>
              </div>
              {(() => {
                const gcPagos = pagos.filter(p => {
                  if (debePersistirMetodoMixtoEfectivoTarjeta(p.montoEfectivo, p.montoTarjeta)) return false
                  if (esReferenciaEmisionGiftCard(p.referencia)) return false
                  return p.metodoPago === "otro" || (p.referencia ?? "").toLowerCase().includes("giftcard")
                })
                return gcPagos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                    <Gift className="h-10 w-10 mb-3 opacity-30" />
                    <p className="text-sm">Sin pagos con gift card hoy</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/20">
                        <TableHead className="text-xs">Hora</TableHead>
                        <TableHead className="text-xs">Cliente</TableHead>
                        <TableHead className="text-xs">Servicios</TableHead>
                        <TableHead className="text-xs">Referencia</TableHead>
                        <TableHead className="text-xs text-right">Monto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gcPagos.map(p => (
                        <TableRow key={p.id} className="hover:bg-muted/30">
                          <TableCell className="text-xs tabular-nums">{p.hora}</TableCell>
                          <TableCell className="text-sm font-medium">{p.clienteNombre}</TableCell>
                          <TableCell className="text-xs max-w-[180px] truncate">{p.servicios.join(", ")}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{p.referencia ?? "—"}</TableCell>
                          <TableCell className="text-right font-semibold text-sm">{fmtMXN(p.monto)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )
              })()}
            </div>
          </TabsContent>

          {/* ─── TAB: Gastos ───────────────────────────────────────────────── */}
          <TabsContent value="gastos" className="flex-1 overflow-auto m-0 p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold">Gastos del día</p>
                <p className="text-xs text-muted-foreground">Total: {fmtMXN(totalGastos)}</p>
              </div>
              <Button size="sm" onClick={() => setGastoDialogOpen(true)} className="h-8 text-xs">
                <Plus className="h-3.5 w-3.5 mr-1" />
                Nuevo gasto
              </Button>
            </div>
            <div className="rounded-lg border overflow-hidden">
              {gastos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <Banknote className="h-10 w-10 mb-3 opacity-30" />
                  <p className="text-sm">Sin gastos registrados hoy</p>
                  <p className="text-xs mt-1">Usa "Nuevo gasto" para registrar un egreso</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/20">
                      <TableHead className="text-xs">Hora</TableHead>
                      <TableHead className="text-xs">Descripción</TableHead>
                      <TableHead className="text-xs">Categoría</TableHead>
                      <TableHead className="text-xs text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gastos.map(g => (
                      <TableRow key={g.id} className="hover:bg-muted/30">
                        <TableCell className="text-xs tabular-nums text-muted-foreground">{g.hora}</TableCell>
                        <TableCell className="text-sm">{g.descripcion}</TableCell>
                        <TableCell>
                          <span className="text-xs border rounded px-1.5 py-0.5 capitalize text-muted-foreground">
                            {g.categoria}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-red-600">{fmtMXN(g.monto)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* ════ DIALOG: Nuevo gasto ═════════════════════════════════════════════ */}
      <Dialog open={gastoDialogOpen} onOpenChange={setGastoDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar gasto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs">Descripción</Label>
              <Input
                placeholder="Ej: Materiales, limpieza…"
                value={nuevoGasto.descripcion}
                onChange={e => setNuevoGasto(p => ({ ...p, descripcion: e.target.value }))}
                className="h-9 text-sm mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Monto (MXN)</Label>
              <Input
                type="number"
                min="0"
                step="any"
                placeholder="0.00"
                value={nuevoGasto.monto}
                onChange={e => setNuevoGasto(p => ({ ...p, monto: e.target.value }))}
                className="h-9 text-sm mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Categoría</Label>
              <Select value={nuevoGasto.categoria} onValueChange={v => setNuevoGasto(p => ({ ...p, categoria: v }))}>
                <SelectTrigger className="h-9 text-sm mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operativo">Operativo</SelectItem>
                  <SelectItem value="insumos">Insumos</SelectItem>
                  <SelectItem value="nomina">Nómina</SelectItem>
                  <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1 h-9 text-sm" onClick={() => setGastoDialogOpen(false)}>
                Cancelar
              </Button>
              <Button className="flex-1 h-9 text-sm bg-blue-600 hover:bg-blue-700" onClick={agregarGasto}>
                Guardar gasto
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ════ CAJA DIALOG ════════════════════════════════════════════════════ */}
      <CajaDialog
        open={cajaOpen}
        onOpenChange={(v) => {
          setCajaOpen(v)
          if (!v) setCitasSeleccionadas(new Set())
        }}
        sucursalIdInicial={sucursalId !== "todas" ? sucursalId : ""}
        clienteNombre={citasACobrar[0]?.clienteNombre ?? ""}
        clienteId={citasACobrar[0]?.clienteId ?? ""}
        citasIniciales={citasACobrar.map(c => ({
          id: c.id,
          clienteId: c.clienteId,
          clienteNombre: c.clienteNombre,
          servicioNombre: c.servicioNombre,
          precio: c.precio,
          empleadoId: c.empleadoId,
        }))}
        onPagoCompletado={() => {
          cargarDatos()
          setCajaOpen(false)
          setCitasSeleccionadas(new Set())
        }}
      />

      {/* ════ DIALOG DETALLE / EDICIÓN DE CITA ══════════════════════════════════ */}
      <Dialog open={!!citaDetalle} onOpenChange={v => { if (!v) { setCitaDetalle(null); setEditandoCita(false) } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-emerald-600" />
              {editandoCita ? "Editar servicio" : "Detalle del servicio"}
            </DialogTitle>
          </DialogHeader>
          {citaDetalle && (
            <div className="space-y-4 text-sm">
              {/* Info fija */}
              <div className="grid grid-cols-2 gap-3 bg-muted/40 rounded-lg p-3">
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground font-semibold">Cliente</p>
                  <p className="font-medium">{citaDetalle.clienteNombre}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground font-semibold">Empleada</p>
                  <p className="font-medium">{citaDetalle.empleadoNombre}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground font-semibold">Servicio</p>
                  <p className="font-medium">{citaDetalle.servicioNombre}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground font-semibold">Horario</p>
                  <p className="font-medium tabular-nums">{citaDetalle.horaInicio} – {citaDetalle.horaFin}</p>
                </div>
              </div>

              {/* Estado — editable */}
              <div>
                <Label className="text-[10px] uppercase text-muted-foreground font-semibold">Estado</Label>
                {editandoCita ? (
                  <select
                    value={editCitaEstado}
                    onChange={e => setEditCitaEstado(e.target.value)}
                    className="mt-1 w-full h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="confirmada">Confirmada</option>
                    <option value="en-progreso">En progreso</option>
                    <option value="completada">Completada</option>
                  </select>
                ) : (
                  <span className={cn("mt-1 text-[10px] border rounded-full px-2 py-0.5 font-medium inline-block", estadoColor(citaDetalle.estado))}>
                    {citaDetalle.estado.replace("-", " ")}
                  </span>
                )}
              </div>

              <Separator />

              {/* Precio — editable */}
              <div className="flex justify-between items-center font-bold text-base">
                <span>Total a cobrar</span>
                {editandoCita ? (
                  <div className="relative w-32">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input type="number" min="0" step="any" value={editCitaPrecio} onChange={e => setEditCitaPrecio(e.target.value)} className="h-8 text-sm pl-6 text-right font-bold" />
                  </div>
                ) : (
                  <span className="text-emerald-700">{fmtMXN(citaDetalle.precio)}</span>
                )}
              </div>

              {/* Notas — editable */}
              <div>
                <Label className="text-[10px] uppercase text-muted-foreground font-semibold">Notas</Label>
                {editandoCita ? (
                  <Textarea value={editCitaNotas} onChange={e => setEditCitaNotas(e.target.value)} className="mt-1 text-sm resize-none" rows={2} placeholder="Instrucciones, recordatorios…" />
                ) : (
                  <p className="mt-0.5 text-sm text-muted-foreground">{citaDetalle.notas || "—"}</p>
                )}
              </div>

              {/* Botones */}
              {editandoCita ? (
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" className="flex-1" onClick={() => setEditandoCita(false)} disabled={isSavingCita}>
                    <X className="h-4 w-4 mr-1.5" /> Cancelar
                  </Button>
                  <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={handleGuardarCita} disabled={isSavingCita}>
                    {isSavingCita ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Check className="h-4 w-4 mr-1.5" />}
                    Guardar
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50 border-red-200" onClick={handleCancelarCita} disabled={isSavingCita}>
                    <X className="h-3.5 w-3.5 mr-1" /> Cancelar cita
                  </Button>
                  <Button variant="outline" size="sm" className="text-blue-600 hover:bg-blue-50 border-blue-200" onClick={() => setEditandoCita(true)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => {
                      setCitaDetalle(null)
                      setCitasSeleccionadas(new Set([citaDetalle.id]))
                      setCajaOpen(true)
                    }}
                  >
                    <Wallet className="h-3.5 w-3.5 mr-1" /> Cobrar
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ════ DIALOG DETALLE / EDICIÓN DE PAGO ════════════════════════════════ */}
      <Dialog open={!!pagoDetalle} onOpenChange={v => { if (!v) { setPagoDetalle(null); setEditando(false) } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-violet-600" />
              {editando ? "Editar cobro" : "Detalle del cobro"}
            </DialogTitle>
          </DialogHeader>

          {pagoDetalle && (
            <div className="space-y-4 text-sm">
              {/* Info principal */}
              <div className="grid grid-cols-2 gap-3 bg-muted/40 rounded-lg p-3">
                {/* Cliente — editable */}
                <div className="col-span-2 sm:col-span-1">
                  <p className="text-[10px] uppercase text-muted-foreground font-semibold">Cliente</p>
                  {editando ? (
                    <div className="mt-0.5 relative">
                      <Input
                        value={editClienteBusqueda || editClienteNombre}
                        onChange={e => {
                          setEditClienteNombre(e.target.value)
                          handleBuscarClienteEdicion(e.target.value)
                        }}
                        className="h-8 text-sm pr-7"
                        placeholder="Buscar cliente…"
                      />
                      {editClienteBuscando && <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-muted-foreground" />}
                      {editClienteResultados.length > 0 && (
                        <div className="absolute z-50 w-full bg-white border rounded-md shadow-md mt-1 max-h-40 overflow-y-auto">
                          {editClienteResultados.map(c => (
                            <button
                              key={c.id}
                              type="button"
                              className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted/50"
                              onClick={() => {
                                setEditClienteId(c.id)
                                setEditClienteNombre(`${c.nombre} ${c.apellido}`)
                                setEditClienteBusqueda("")
                                setEditClienteResultados([])
                              }}
                            >
                              {c.nombre} {c.apellido}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="font-medium">{pagoDetalle.clienteNombre}</p>
                  )}
                </div>

                <div>
                  <p className="text-[10px] uppercase text-muted-foreground font-semibold">Empleada</p>
                  <p className="font-medium">{pagoDetalle.empleadoNombre}</p>
                </div>

                {/* Fecha — editable */}
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground font-semibold">Fecha</p>
                  {editando ? (
                    <input
                      type="date"
                      value={editFecha}
                      onChange={e => setEditFecha(e.target.value)}
                      className="mt-0.5 w-full h-8 rounded-md border border-input bg-background px-2 text-sm"
                    />
                  ) : (
                    <p className="font-medium tabular-nums">{pagoDetalle.fecha} · {pagoDetalle.hora?.slice(0, 5)}</p>
                  )}
                </div>

                {/* Método de pago — editable */}
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground font-semibold">Método de pago</p>
                  {editando ? (
                    <select
                      value={editMetodoPago}
                      onChange={e => setEditMetodoPago(e.target.value)}
                      className="mt-0.5 w-full h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="efectivo">💵 Efectivo</option>
                      <option value="tarjeta">💳 Tarjeta</option>
                      <option value="transferencia">🔄 Transferencia</option>
                      <option value="otro">🔖 Otro</option>
                    </select>
                  ) : (
                    (() => {
                      const d = distribuirMontoPago(pagoDetalle)
                      const lbl = etiquetaMetodosPago(pagoDetalle)
                      return (
                        <span className="inline-flex items-center gap-1 flex-wrap text-xs border rounded px-1.5 py-0.5 bg-background mt-0.5 max-w-full">
                          {d.efectivo > 0.009 && <Banknote className="h-3 w-3 text-emerald-500 shrink-0" aria-hidden />}
                          {d.tarjeta > 0.009 && <CreditCard className="h-3 w-3 text-blue-500 shrink-0" aria-hidden />}
                          {d.transferencia > 0.009 && <ArrowLeftRight className="h-3 w-3 text-indigo-500 shrink-0" aria-hidden />}
                          {d.otro > 0.009 && !(d.efectivo > 0.009 || d.tarjeta > 0.009 || d.transferencia > 0.009) && (
                            <Wallet className="h-3 w-3 text-muted-foreground shrink-0" aria-hidden />
                          )}
                          <span className="leading-tight">{lbl}</span>
                        </span>
                      )
                    })()
                  )}
                </div>
              </div>

              {/* Concepto / Servicios — editable */}
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">Concepto / Servicios</p>
                {editando ? (
                  <Input
                    value={editServicio}
                    onChange={e => setEditServicio(e.target.value)}
                    className="h-8 text-sm"
                    placeholder="Ej: Corte, Tinte, Masaje…"
                  />
                ) : (
                  <p className="text-sm">{pagoDetalle.servicios.join(", ")}</p>
                )}
              </div>

              <Separator />

              {/* Montos */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{fmtMXN(pagoDetalle.subtotal ?? pagoDetalle.monto)}</span>
                </div>
                {(pagoDetalle.descuentoMonto ?? 0) > 0 && (
                  <div className="flex justify-between text-violet-600">
                    <span>Descuento {pagoDetalle.descuentoCodigo ? `(${pagoDetalle.descuentoCodigo})` : ""}</span>
                    <span>−{fmtMXN(pagoDetalle.descuentoMonto!)}</span>
                  </div>
                )}

                {/* Propina — editable */}
                <div className="flex justify-between items-center text-amber-600">
                  <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5" /> Propina</span>
                  {editando ? (
                    <div className="relative w-28">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">$</span>
                      <Input type="number" min="0" step="any" value={editPropina} onChange={e => setEditPropina(e.target.value)} className="h-7 text-xs pl-5 text-right" />
                    </div>
                  ) : (
                    <span className="font-medium">{(pagoDetalle.propina ?? 0) > 0 ? `+${fmtMXN(pagoDetalle.propina!)}` : "—"}</span>
                  )}
                </div>

                <Separator />
                <div className="flex justify-between font-bold text-base items-center">
                  <span>Total</span>
                  {editando ? (
                    <div className="relative w-36">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input
                        type="number" min="0" step="any"
                        value={editMonto}
                        onChange={e => setEditMonto(e.target.value)}
                        className="h-8 text-sm pl-6 text-right font-bold"
                      />
                    </div>
                  ) : (
                    <span className="text-emerald-700">{fmtMXN(pagoDetalle.monto)}</span>
                  )}
                </div>
              </div>

              {/* Desglose de métodos — solo visible en edición */}
              {editando && (
                <div className="space-y-2 border border-amber-200 bg-amber-50/60 rounded-lg p-3">
                  <p className="text-[10px] uppercase text-amber-700 font-semibold tracking-wide">Desglose de cobro</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Efectivo $</Label>
                      <div className="relative mt-0.5">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">$</span>
                        <Input type="number" min="0" step="any" value={editMontoEfectivo} onChange={e => setEditMontoEfectivo(e.target.value)} className="h-8 text-xs pl-5" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Tarjeta $</Label>
                      <div className="relative mt-0.5">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">$</span>
                        <Input type="number" min="0" step="any" value={editMontoTarjeta} onChange={e => setEditMontoTarjeta(e.target.value)} className="h-8 text-xs pl-5" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Desglose lectura — visible cuando no edita y hay desglose */}
              {!editando && ((pagoDetalle.montoEfectivo ?? 0) > 0 || (pagoDetalle.montoTarjeta ?? 0) > 0) && (
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg p-2.5">
                  {(pagoDetalle.montoEfectivo ?? 0) > 0 && (
                    <div className="flex items-center gap-1">
                      <Banknote className="h-3 w-3 text-emerald-500" />
                      <span>Efectivo: <strong className="text-foreground">{fmtMXN(pagoDetalle.montoEfectivo!)}</strong></span>
                    </div>
                  )}
                  {(pagoDetalle.montoTarjeta ?? 0) > 0 && (
                    <div className="flex items-center gap-1">
                      <CreditCard className="h-3 w-3 text-blue-500" />
                      <span>Tarjeta: <strong className="text-foreground">{fmtMXN(pagoDetalle.montoTarjeta!)}</strong></span>
                    </div>
                  )}
                </div>
              )}

              {/* Referencia — editable */}
              {(pagoDetalle.metodoPago === "transferencia" || editando) && (
                <div>
                  <Label className="text-[10px] uppercase text-muted-foreground font-semibold">Referencia</Label>
                  {editando ? (
                    <Input value={editReferencia} onChange={e => setEditReferencia(e.target.value)} className="mt-1 h-8 text-sm" placeholder="Número de referencia…" />
                  ) : (
                    <p className="mt-0.5 text-sm">{pagoDetalle.referencia || "—"}</p>
                  )}
                </div>
              )}

              {/* Notas — editable */}
              <div>
                <Label className="text-[10px] uppercase text-muted-foreground font-semibold">Notas</Label>
                {editando ? (
                  <Textarea value={editNotas} onChange={e => setEditNotas(e.target.value)} className="mt-1 text-sm resize-none" rows={2} placeholder="Notas adicionales…" />
                ) : (
                  <p className="mt-0.5 text-sm text-muted-foreground">{pagoDetalle.notas || "—"}</p>
                )}
              </div>

              {/* Motivo de corrección — solo en edición */}
              {editando && (
                <div>
                  <Label className="text-[10px] uppercase text-muted-foreground font-semibold">
                    Motivo de corrección <span className="text-muted-foreground/60 normal-case">(opcional)</span>
                  </Label>
                  <Input
                    value={editMotivo}
                    onChange={e => setEditMotivo(e.target.value)}
                    className="mt-1 h-8 text-sm"
                    placeholder="Ej: cliente pagó en efectivo, no con tarjeta…"
                  />
                </div>
              )}

              {/* Botones */}
              <div className="flex gap-2 pt-1 flex-wrap">
                {editando ? (
                  <>
                    <Button variant="outline" className="flex-1" onClick={() => setEditando(false)} disabled={isSavingPago}>
                      <X className="h-4 w-4 mr-1.5" /> Cancelar
                    </Button>
                    <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleGuardarEdicion} disabled={isSavingPago}>
                      {isSavingPago ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Check className="h-4 w-4 mr-1.5" />}
                      Guardar cambios
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" className="flex-1" onClick={() => setPagoDetalle(null)}>
                      Cerrar
                    </Button>
                    {isAdmin && (
                      <>
                        <Button
                          variant="outline"
                          className="text-red-600 hover:bg-red-50 border-red-200"
                          onClick={() => setIsDeletePagoOpen(true)}
                          title="Eliminar cobro"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button className="flex-1 bg-violet-600 hover:bg-violet-700 text-white" onClick={() => setEditando(true)}>
                          <Pencil className="h-4 w-4 mr-1.5" /> Editar cobro
                        </Button>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ════ DIALOG CONFIRMAR ELIMINACIÓN DE COBRO ═══════════════════════════ */}
      <Dialog open={isDeletePagoOpen} onOpenChange={setIsDeletePagoOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" /> ¿Eliminar este cobro?
            </DialogTitle>
          </DialogHeader>
          {pagoDetalle && (
            <div className="space-y-4 pt-1 text-sm">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
                <p><span className="text-muted-foreground">Cliente:</span> <strong>{pagoDetalle.clienteNombre}</strong></p>
                <p><span className="text-muted-foreground">Concepto:</span> {pagoDetalle.servicios.join(", ")}</p>
                <p><span className="text-muted-foreground">Fecha:</span> {pagoDetalle.fecha} · {pagoDetalle.hora?.slice(0, 5)}</p>
                <p><span className="text-muted-foreground">Total:</span> <strong className="text-red-700">{fmtMXN(pagoDetalle.monto)}</strong></p>
              </div>
              <p className="text-muted-foreground text-xs">
                Esta acción eliminará el cobro de forma permanente y no se puede deshacer.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsDeletePagoOpen(false)}
                  disabled={isSavingPago}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={handleEliminarPago}
                  disabled={isSavingPago}
                >
                  {isSavingPago
                    ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    : <Trash2 className="h-4 w-4 mr-1.5" />}
                  Eliminar cobro
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
