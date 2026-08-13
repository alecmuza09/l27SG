"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Plus, Minus, X, Search, Banknote, CreditCard, ArrowLeftRight,
  CheckCircle2, Loader2, ShoppingCart, User, Tag, Gift, Scissors,
  Package, BadgePercent, Receipt, Clock, Star, AlertTriangle,
  Sparkles, Wallet, History, TrendingDown, Heart, Crown,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { getClientes, type Cliente } from "@/lib/data/clientes"
import { getServiciosActivosFromDB, type Servicio } from "@/lib/data/servicios"
import { getProductosInventarioFromDB, descontarStockPorVenta, type ProductoInventario } from "@/lib/data/inventario"
import {
  registrarPago, validarCuponByCode, validarGiftCard,
  getHistorialClienteFromDB, getGiftCardActivaClienteFromDB, getSaldoPendienteClienteFromDB,
  type HistorialCliente, type GiftCardValidada,
} from "@/lib/data/pagos"
import { updateCitaEstado } from "@/lib/data/citas"
import { supabase } from "@/lib/supabase/client"
import { getSucursalesActivasFromDB, type Sucursal } from "@/lib/data/sucursales"

// ─── Tipos internos ────────────────────────────────────────────────────────

interface CartItem {
  id: string
  tipo: "servicio" | "producto"
  nombre: string
  precio: number
  cantidad: number
  categoriaServicio?: string   // para auto-sugerencias
  empleadoId?: string          // empleado que realizó el servicio
  citaId?: string              // id de la cita original para marcarla como pagada
}

interface DescuentoAplicado {
  tipo: "cupon" | "gift_card" | "manual_pct" | "manual_monto" | "vip_pass"
  codigo?: string
  gcId?: string
  label: string
  monto: number
}

// ─── Sugerencias de productos por categoría de servicio ───────────────────
const SUGERENCIAS_POR_SERVICIO: Record<string, string[]> = {
  masaje:    ["aceite", "crema", "aromaterapia", "esencial"],
  facial:    ["suero", "crema", "mascarilla", "hidrat"],
  manicure:  ["esmalte", "aceite cuticulas", "crema manos", "acetona"],
  pedicure:  ["esmalte", "crema pies", "lixa", "sales"],
  depilacion:["pos", "calmante", "aloe", "aceite rojo"],
  default:   [],
}

function getCategoriaServicio(nombre: string): string {
  const n = nombre.toLowerCase()
  if (n.includes("masaje") || n.includes("relajante") || n.includes("corporal")) return "masaje"
  if (n.includes("facial") || n.includes("hidrat")) return "facial"
  if (n.includes("manicure") || n.includes("mani")) return "manicure"
  if (n.includes("pedicure") || n.includes("pedi")) return "pedicure"
  if (n.includes("depil") || n.includes("cera") || n.includes("wax")) return "depilacion"
  return "default"
}

function productoEsSugerido(productoNombre: string, categoriasServicio: string[]): boolean {
  if (categoriasServicio.includes("default")) return false
  return categoriasServicio.some(cat => {
    const keywords = SUGERENCIAS_POR_SERVICIO[cat] || []
    return keywords.some(kw => productoNombre.toLowerCase().includes(kw))
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const fmtMXN = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n)

const fmtFecha = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" })

// Sólo productos reales del catálogo (no personalizados) descuentan stock de la sucursal.
function itemsProductoParaDescontarStock(cart: { id: string; tipo: string; cantidad: number }[]) {
  return cart
    .filter((i) => i.tipo === "producto" && !i.id.startsWith("custom-"))
    .map((i) => ({ productoId: i.id, cantidad: i.cantidad }))
}

// ─── Props ────────────────────────────────────────────────────────────────

interface CitaInicial {
  id: string
  clienteId: string
  clienteNombre: string
  servicioNombre: string
  precio: number
  empleadoId?: string
}

interface CajaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clienteNombre?: string
  clienteId?: string
  citasIniciales?: CitaInicial[]    // servicios pre-cargados desde la lista de cobros
  sucursalIdInicial?: string        // sucursal pre-seleccionada desde la página padre
  onPagoCompletado?: (total: number) => void
}

// ═══════════════════════════════════════════════════════════════════════════

export function CajaDialog({
  open, onOpenChange,
  clienteNombre: propClienteNombre = "",
  clienteId: propClienteId = "",
  citasIniciales = [],
  sucursalIdInicial = "",
  onPagoCompletado,
}: CajaDialogProps) {

  // ── Datos maestros ─────────────────────────────────────────────────────
  const [clientes, setClientes]    = useState<Cliente[]>([])
  const [servicios, setServicios]  = useState<Servicio[]>([])
  const [productos, setProductos]  = useState<ProductoInventario[]>([])
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [isLoadingData, setIsLoadingData] = useState(false)

  // ── Cliente ────────────────────────────────────────────────────────────
  const [clienteId, setClienteId]       = useState(propClienteId)
  const [clienteSearch, setClienteSearch] = useState(propClienteNombre)
  const [showClienteList, setShowClienteList] = useState(false)
  const clienteRef = useRef<HTMLDivElement>(null)
  const cobrandoRef = useRef(false)

  // ── Panel cliente ──────────────────────────────────────────────────────
  const [historial, setHistorial]             = useState<HistorialCliente[]>([])
  const [gcActiva, setGcActiva]               = useState<GiftCardValidada | null>(null)
  const [saldoPendiente, setSaldoPendiente]   = useState(0)
  const [isLoadingPanel, setIsLoadingPanel]   = useState(false)

  // ── Sucursal ───────────────────────────────────────────────────────────
  const [sucursalId, setSucursalId] = useState("")

  // ── Carrito ────────────────────────────────────────────────────────────
  const [cart, setCart]               = useState<CartItem[]>([])
  const [searchServicio, setSearchServicio] = useState("")
  const [searchProducto, setSearchProducto] = useState("")

  // ── Producto personalizado ─────────────────────────────────────────────
  const [showProductoCustom, setShowProductoCustom] = useState(false)
  const [productoCustomNombre, setProductoCustomNombre] = useState("")
  const [productoCustomPrecio, setProductoCustomPrecio] = useState("")

  // ── Descuento ──────────────────────────────────────────────────────────
  const [codigoCupon, setCodigoCupon]       = useState("")
  const [codigoGC, setCodigoGC]             = useState("")
  const [descManualVal, setDescManualVal]   = useState("")
  const [descManualTipo, setDescManualTipo] = useState<"pct" | "monto">("pct")
  const [descuentoAplicado, setDescuentoAplicado] = useState<DescuentoAplicado | null>(null)
  const [isValidandoCupon, setIsValidandoCupon] = useState(false)
  const [isValidandoGC, setIsValidandoGC]   = useState(false)

  // ── Propina ────────────────────────────────────────────────────────────
  const [propina, setPropina] = useState("")

  // ── Pago multi-método ──────────────────────────────────────────────────
  // Se permite combinar efectivo + tarjeta + gift card
  const [pagoEfectivo, setPagoEfectivo]     = useState("")
  const [pagoTarjeta, setPagoTarjeta]       = useState("")
  const [pagoTransferencia, setPagoTransferencia] = useState("")
  const [pagoGiftCard, setPagoGiftCard]     = useState("")
  const [gcPagoId, setGcPagoId]             = useState("")
  const [gcPagoCodigo, setGcPagoCodigo]     = useState("")
  const [gcPagoSaldo, setGcPagoSaldo]       = useState(0)
  const [gcPagoBuscando, setGcPagoBuscando] = useState(false)
  const [referencia, setReferencia]         = useState("")
  const [notasVenta, setNotasVenta]         = useState("")
  const [isCobrandо, setIsCobrando]         = useState(false)

  // ── VIP Pass ───────────────────────────────────────────────────────────────
  const [vipPassInput, setVipPassInput]           = useState("")
  const [vipPassId, setVipPassId]                 = useState("")
  const [vipPassCodigo, setVipPassCodigo]         = useState("")
  const [vipPassSaldo, setVipPassSaldo]           = useState(0)
  const [vipPassBuscando, setVipPassBuscando]     = useState(false)
  const [vipPassDiferencia, setVipPassDiferencia] = useState("") // descuento: precio normal − precio VIP
  const [pagoVipPass, setPagoVipPass]             = useState("")

  // ─── Cargar datos al abrir ─────────────────────────────────────────────
  useEffect(() => {
    if (!open) return

    // Reset completo
    setClienteId(propClienteId)
    setClienteSearch(propClienteNombre)
    setShowClienteList(false)
    setCart([])
    setHistorial([]); setGcActiva(null); setSaldoPendiente(0)
    setDescuentoAplicado(null)
    setCodigoCupon(""); setCodigoGC(""); setDescManualVal("")
    setPropina("")
    setPagoEfectivo(""); setPagoTarjeta(""); setPagoTransferencia(""); setPagoGiftCard("")
    setGcPagoId(""); setGcPagoCodigo(""); setGcPagoSaldo(0)
    setReferencia(""); setNotasVenta("")
    setVipPassInput(""); setVipPassId(""); setVipPassCodigo(""); setVipPassSaldo(0)
    setVipPassDiferencia(""); setPagoVipPass("")
    setSucursalId(sucursalIdInicial || "")
    setShowProductoCustom(false); setProductoCustomNombre(""); setProductoCustomPrecio("")

    // Pre-cargar citas seleccionadas como items del carrito
    if (citasIniciales.length > 0) {
      const itemsIniciales: CartItem[] = citasIniciales.map(c => ({
        id: `cita-${c.id}`,
        tipo: "servicio" as const,
        nombre: c.servicioNombre,
        precio: c.precio,
        cantidad: 1,
        empleadoId: c.empleadoId,
        citaId: c.id,
      }))
      setCart(itemsIniciales)
      // Si hay un solo cliente en las citas, pre-seleccionarlo
      const clientesUnicos = [...new Set(citasIniciales.map(c => c.clienteId))]
      if (clientesUnicos.length === 1) {
        setClienteId(citasIniciales[0].clienteId)
        setClienteSearch(citasIniciales[0].clienteNombre)
      }
    }

    setIsLoadingData(true)
    Promise.all([
      getClientes(),
      getServiciosActivosFromDB(),
      getProductosInventarioFromDB(),
      getSucursalesActivasFromDB(),
    ])
      .then(([cls, svcs, prods, sucs]) => {
        setClientes(cls)
        setServicios(svcs)
        setProductos(prods.filter(p => p.disponibleVenta === true))
        setSucursales(sucs)
        // Auto-seleccionar: prioriza la sucursal del padre, sino la única disponible
        if (!sucursalIdInicial && sucs.length === 1) setSucursalId(sucs[0].id)
      })
      .catch(() => toast.error("Error cargando datos"))
      .finally(() => setIsLoadingData(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // ── Cargar panel de cliente al seleccionar ─────────────────────────────
  useEffect(() => {
    if (!clienteId) {
      setHistorial([]); setGcActiva(null); setSaldoPendiente(0)
      return
    }
    setIsLoadingPanel(true)
    Promise.all([
      getHistorialClienteFromDB(clienteId, 4),
      getGiftCardActivaClienteFromDB(clienteId),
      getSaldoPendienteClienteFromDB(clienteId),
    ])
      .then(([hist, gc, saldo]) => {
        setHistorial(hist)
        setGcActiva(gc)
        setSaldoPendiente(saldo)
      })
      .finally(() => setIsLoadingPanel(false))
  }, [clienteId])

  // ── Cálculos ──────────────────────────────────────────────────────────
  const subtotal     = cart.reduce((s, i) => s + i.precio * i.cantidad, 0)
  const descuento    = descuentoAplicado?.monto ?? 0
  const propinaNum   = parseFloat(propina) || 0
  const totalSinPropina = Math.max(0, subtotal - descuento)
  const total        = totalSinPropina + propinaNum

  const efNum  = parseFloat(pagoEfectivo)     || 0
  const tarNum = parseFloat(pagoTarjeta)      || 0
  const trfNum = parseFloat(pagoTransferencia)|| 0
  const gcNum  = parseFloat(pagoGiftCard)     || 0
  const vipNum = parseFloat(pagoVipPass)      || 0
  const totalPagado = efNum + tarNum + trfNum + gcNum + vipNum
  const cambio      = Math.max(0, efNum - (total - tarNum - trfNum - gcNum - vipNum))
  const faltante    = Math.max(0, total - totalPagado)

  const errEfectivo = total > 0 && efNum > total + 0.009
    ? `El monto en efectivo no puede ser mayor al total del cobro (${fmtMXN(total)})`
    : null
  const errTarjeta = total > 0 && tarNum > total + 0.009
    ? `El monto en tarjeta no puede ser mayor al total del cobro (${fmtMXN(total)})`
    : null
  const soloEfTar = efNum > 0.009 && tarNum > 0.009 && trfNum < 0.009 && gcNum < 0.009 && vipNum < 0.009
  const errMixto = soloEfTar && Math.abs(efNum + tarNum - total) > 0.02
    ? `La suma de efectivo (${fmtMXN(efNum)}) y tarjeta (${fmtMXN(tarNum)}) debe ser igual al total (${fmtMXN(total)})`
    : null
  const hayErrorMontos = !!errEfectivo || !!errTarjeta || !!errMixto

  // ── Categorías de servicios en carrito para sugerencias ───────────────
  const categoriasEnCarrito = [...new Set(
    cart.filter(i => i.tipo === "servicio").map(i => i.categoriaServicio || "default")
  )]

  // ── Carrito helpers ────────────────────────────────────────────────────
  const addToCart = (item: Omit<CartItem, "cantidad">) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id && c.tipo === item.tipo)
      if (existing) return prev.map(c =>
        c.id === item.id && c.tipo === item.tipo ? { ...c, cantidad: c.cantidad + 1 } : c
      )
      return [...prev, { ...item, cantidad: 1 }]
    })
  }
  const changeQty = (id: string, tipo: CartItem["tipo"], delta: number) =>
    setCart(prev => prev.map(c =>
      c.id === id && c.tipo === tipo ? { ...c, cantidad: Math.max(1, c.cantidad + delta) } : c
    ))
  const removeItem = (id: string, tipo: CartItem["tipo"]) =>
    setCart(prev => prev.filter(c => !(c.id === id && c.tipo === tipo)))

  // ── Descuentos ────────────────────────────────────────────────────────
  const limpiarDescuento = () => {
    setDescuentoAplicado(null)
    setCodigoCupon(""); setCodigoGC(""); setDescManualVal("")
    // Si el descuento era VIP Pass, también limpiar su pago y búsqueda
    setVipPassId(""); setVipPassCodigo(""); setVipPassSaldo(0)
    setVipPassInput(""); setVipPassDiferencia(""); setPagoVipPass("")
  }

  const handleAplicarCupon = useCallback(async () => {
    if (!codigoCupon.trim()) return
    setIsValidandoCupon(true)
    const res = await validarCuponByCode(codigoCupon)
    setIsValidandoCupon(false)
    if (!res.valido || !res.promo) { toast.error(res.error || "Cupón inválido"); return }
    const monto = res.promo.tipo === "porcentaje"
      ? (subtotal * res.promo.valor) / 100
      : Math.min(res.promo.valor, subtotal)
    setDescuentoAplicado({
      tipo: "cupon", codigo: res.promo.codigo,
      label: `${res.promo.nombre} (${res.promo.tipo === "porcentaje" ? res.promo.valor + "%" : fmtMXN(res.promo.valor)})`,
      monto,
    })
    toast.success(`Cupón aplicado: ${res.promo.nombre}`)
  }, [codigoCupon, subtotal])

  const handleAplicarGC = useCallback(async () => {
    if (!codigoGC.trim()) return
    setIsValidandoGC(true)
    let res = await validarGiftCard(codigoGC)

    // Si está pendiente, intentar activarla directamente
    if (!res.valida && res.error === 'Gift card pendiente de activación') {
      const { data: rows } = await (supabase as any)
        .from('gift_cards')
        .select('id, codigo, saldo_actual, estado')
        .ilike('codigo', codigoGC.trim())
        .limit(1)
      const gcRow = Array.isArray(rows) ? rows[0] : null
      if (gcRow && Number(gcRow.saldo_actual) > 0) {
        const hoyISO = new Date().toISOString().split('T')[0]
        await (supabase as any)
          .from('gift_cards')
          .update({ estado: 'activa', fecha_activacion: hoyISO })
          .eq('id', gcRow.id)
        toast.success('Gift card activada y lista para usar')
        res = await validarGiftCard(codigoGC)
      }
    }

    setIsValidandoGC(false)
    if (!res.valida || !res.gc) { toast.error(res.error || "Gift card inválida"); return }
    const monto = Math.min(res.gc.saldoActual, totalSinPropina)
    setDescuentoAplicado({
      tipo: "gift_card", codigo: res.gc.codigo, gcId: res.gc.id,
      label: `Gift Card ${res.gc.codigo} (saldo: ${fmtMXN(res.gc.saldoActual)})`,
      monto,
    })
    toast.success(`Gift card aplicada: ${fmtMXN(monto)} de descuento`)
  }, [codigoGC, totalSinPropina])

  const handleAplicarManual = useCallback(() => {
    const val = parseFloat(descManualVal)
    if (!val || val <= 0) return
    const monto = descManualTipo === "pct"
      ? Math.min((subtotal * val) / 100, subtotal)
      : Math.min(val, subtotal)
    setDescuentoAplicado({
      tipo: descManualTipo === "pct" ? "manual_pct" : "manual_monto",
      label: descManualTipo === "pct" ? `Descuento ${val}%` : `Descuento ${fmtMXN(val)}`,
      monto,
    })
    toast.success("Descuento aplicado")
  }, [descManualVal, descManualTipo, subtotal])

  // ── Buscar gift card para pago ────────────────────────────────────────
  const handleBuscarGCPago = async () => {
    if (!gcPagoCodigo.trim()) return
    setGcPagoBuscando(true)
    let res = await validarGiftCard(gcPagoCodigo)

    // Si está pendiente, intentar activarla directamente
    if (!res.valida && res.error === 'Gift card pendiente de activación') {
      const { data: rows } = await (supabase as any)
        .from('gift_cards')
        .select('id, codigo, saldo_actual, estado')
        .ilike('codigo', gcPagoCodigo.trim())
        .limit(1)
      const gcRow = Array.isArray(rows) ? rows[0] : null
      if (gcRow && Number(gcRow.saldo_actual) > 0) {
        const hoyISO = new Date().toISOString().split('T')[0]
        await (supabase as any)
          .from('gift_cards')
          .update({ estado: 'activa', fecha_activacion: hoyISO })
          .eq('id', gcRow.id)
        toast.success('Gift card activada y lista para usar')
        res = await validarGiftCard(gcPagoCodigo)
      }
    }

    setGcPagoBuscando(false)
    if (!res.valida || !res.gc) { toast.error(res.error || "Gift card inválida"); return }
    setGcPagoId(res.gc.id)
    if (descuentoAplicado?.tipo === "gift_card" && descuentoAplicado.gcId === res.gc.id) {
      limpiarDescuento()
      toast.warning("Se quitó el descuento de esta gift card porque ahora se usa como método de pago.")
    }
    setGcPagoSaldo(res.gc.saldoActual)
    const montoSugerido = Math.min(res.gc.saldoActual, total)
    setPagoGiftCard(String(montoSugerido))
    toast.success(`Gift card: saldo ${fmtMXN(res.gc.saldoActual)}`)
  }

  // Aplicar gift card activa del cliente directamente
  const handleUsarGCActiva = () => {
    if (!gcActiva) return
    setGcPagoId(gcActiva.id)
    if (descuentoAplicado?.tipo === "gift_card" && descuentoAplicado.gcId === gcActiva.id) {
      limpiarDescuento()
      toast.warning("Se quitó el descuento de esta gift card porque ahora se usa como método de pago.")
    }
    setGcPagoCodigo(gcActiva.codigo)
    setGcPagoSaldo(gcActiva.saldoActual)
    const montoSugerido = Math.min(gcActiva.saldoActual, total)
    setPagoGiftCard(String(montoSugerido))
  }

  // ── VIP Pass ──────────────────────────────────────────────────────────────
  const handleBuscarVipPass = async () => {
    if (!vipPassInput.trim()) return
    setVipPassBuscando(true)
    const res = await validarGiftCard(vipPassInput)
    setVipPassBuscando(false)
    if (!res.valida || !res.gc) { toast.error(res.error || "VIP Pass no encontrado"); return }
    setVipPassId(res.gc.id)
    setVipPassCodigo(res.gc.codigo)
    setVipPassSaldo(res.gc.saldoActual)
    toast.success(`VIP Pass encontrado · Saldo: ${fmtMXN(res.gc.saldoActual)}`)
  }

  const handleAplicarVipPass = () => {
    if (!vipPassId) { toast.error("Primero busca el VIP Pass"); return }
    const diferencia = parseFloat(vipPassDiferencia) || 0
    if (diferencia <= 0) { toast.error("Ingresa la diferencia de descuento VIP"); return }
    if (diferencia >= subtotal) { toast.error("La diferencia no puede ser igual o mayor al total del servicio"); return }
    const cobroVip = subtotal - diferencia // lo que se descuenta del saldo del VIP Pass
    if (cobroVip > vipPassSaldo + 0.01) {
      toast.error(`Saldo insuficiente en el VIP Pass (disponible: ${fmtMXN(vipPassSaldo)})`); return
    }
    setDescuentoAplicado({
      tipo: "vip_pass",
      codigo: vipPassCodigo,
      gcId: vipPassId,
      label: `VIP Pass ${vipPassCodigo} · diferencia ${fmtMXN(diferencia)} · comisión sobre ${fmtMXN(subtotal)}`,
      monto: diferencia,
    })
    setPagoVipPass(String(cobroVip))
    toast.success(`VIP Pass aplicado · Descuento: ${fmtMXN(diferencia)} · Cobro VIP: ${fmtMXN(cobroVip)}`)
  }

  // ── Cortesía ──────────────────────────────────────────────────────────
  const handleCortesia = async () => {
    if (cart.length === 0) { toast.error("Agrega al menos un servicio o producto"); return }
    if (!clienteId) { toast.error("Selecciona un cliente"); return }
    if (!sucursalId) { toast.error("Selecciona una sucursal"); return }

    const confirmado = window.confirm(`¿Registrar como CORTESÍA?\n\nSe registrará $0 para:\n${cart.map(i => i.nombre).join(", ")}\n\nEsto quedará en el historial como cortesía.`)
    if (!confirmado) return

    setIsCobrando(true)
    const empleadoPrincipal = cart.find(i => i.tipo === "servicio" && i.empleadoId)?.empleadoId ?? null
    const serviciosNombre = cart.map(i => `${i.nombre} x${i.cantidad}`).join(", ")

    const res = await registrarPago({
      citaId: null,
      clienteId,
      empleadoId: empleadoPrincipal as any,
      sucursalId,
      servicioNombre: serviciosNombre,
      subtotal,
      descuentoMonto: subtotal,
      descuentoTipo: "manual",
      descuentoCodigo: "CORTESIA",
      propina: 0,
      total: 0,
      metodoPago: "otro",
      montoEfectivo: 0,
      montoTarjeta: 0,
      montoGiftCard: 0,
      notas: `CORTESÍA${notasVenta.trim() ? ` — ${notasVenta.trim()}` : ""}`,
    })

    setIsCobrando(false)
    if (!res.success) { toast.error(`Error: ${res.error}`); return }

    const citasIds = cart.filter(i => i.tipo === "servicio" && i.citaId).map(i => i.citaId!)
    await Promise.all(citasIds.map(id => updateCitaEstado(id, "completada", true)))

    // Descontar stock de productos vendidos como cortesía (no bloquea la venta si falla)
    const itemsProducto = itemsProductoParaDescontarStock(cart)
    if (itemsProducto.length > 0) {
      descontarStockPorVenta(sucursalId, itemsProducto).catch((err) =>
        console.error("Error descontando stock por cortesía:", err),
      )
    }

    toast.success("Cortesía registrada", {
      description: `${cart.length} servicio(s) registrado(s) como cortesía`,
    })
    onPagoCompletado?.(0)
    onOpenChange(false)
  }

  // ── Cobrar ────────────────────────────────────────────────────────────
  const handleCobrar = async () => {
    if (cobrandoRef.current) return
    cobrandoRef.current = true

    // Guard: misma GC no puede ser descuento Y método de pago al mismo tiempo
    if (
      descuentoAplicado?.tipo === "gift_card" &&
      descuentoAplicado.gcId &&
      gcPagoId &&
      gcPagoId === descuentoAplicado.gcId &&
      gcNum > 0
    ) {
      toast.error("La misma gift card no puede usarse como descuento y como método de pago. Quita una de las dos.")
      cobrandoRef.current = false
      setIsCobrando(false)
      return
    }

    if (cart.length === 0) { toast.error("Agrega al menos un servicio o producto"); cobrandoRef.current = false; return }
    if (!clienteId) { toast.error("Selecciona un cliente"); cobrandoRef.current = false; return }
    if (!sucursalId) { toast.error("Selecciona una sucursal"); cobrandoRef.current = false; return }
    if (totalPagado < total - 0.01) { toast.error(`Faltan ${fmtMXN(faltante)} por asignar a un método de pago`); cobrandoRef.current = false; return }
    if (trfNum > 0 && !referencia.trim()) { toast.error("Ingresa la referencia de la transferencia"); cobrandoRef.current = false; return }
    if (gcNum > 0 && gcNum > gcPagoSaldo + 0.01) { toast.error("El monto en gift card excede el saldo disponible"); cobrandoRef.current = false; return }
    if (vipNum > 0 && vipNum > vipPassSaldo + 0.01) { toast.error("El monto VIP Pass excede el saldo disponible"); cobrandoRef.current = false; return }
    setIsCobrando(true)

    // Determinar método principal
    let metodoPrincipal: 'efectivo' | 'tarjeta' | 'transferencia' | 'otro' = 'otro'
    const montos = [
      { metodo: 'efectivo' as const, monto: efNum },
      { metodo: 'tarjeta' as const, monto: tarNum },
      { metodo: 'transferencia' as const, monto: trfNum },
    ]
    const mayor = montos.sort((a, b) => b.monto - a.monto)[0]
    if (mayor.monto > 0) metodoPrincipal = mayor.metodo

    const metodoPagoRegistro =
      efNum > 0.009 && tarNum > 0.009 ? "otro" : metodoPrincipal

    // Tomar el empleado principal del primer servicio del carrito
    const empleadoPrincipal = cart.find(i => i.tipo === "servicio" && i.empleadoId)?.empleadoId ?? null

    // VIP Pass usa el mismo campo que gift card (giftCardId / montoGiftCard)
    // El descuento de VIP Pass se registra con tipo "vip_pass" para cálculo de comisiones
    //
    // Monto efectivo del VIP Pass: solo cubre lo que no pagaron los otros métodos.
    // Ejemplo: total $740, efectivo $320 → VIP cubre $420, no $740.
    const vipNumEfectivo = vipNum > 0
      ? Math.min(vipNum, Math.max(0, total - efNum - tarNum - trfNum - gcNum))
      : 0
    const giftCardIdFinal = vipNumEfectivo > 0 ? vipPassId : (gcNum > 0 ? gcPagoId : undefined)
    const giftCardCodigoFinal = vipNumEfectivo > 0 ? vipPassCodigo : (gcNum > 0 ? gcPagoCodigo : undefined)
    const montoGiftCardFinal = vipNumEfectivo > 0 ? vipNumEfectivo : (gcNum > 0 ? gcNum : 0)
    const descuentoTipoFinal = descuentoAplicado?.tipo === "cupon" ? "cupon"
      : descuentoAplicado?.tipo === "gift_card" ? "gift_card"
      : descuentoAplicado?.tipo === "vip_pass"  ? "vip_pass"
      : descuentoAplicado ? "manual" : undefined

    // Leer saldo del VIP Pass ANTES de registrar el pago
    let vipPassSaldoAntes = 0
    if (vipNumEfectivo > 0 && vipPassId) {
      const { data: vipData } = await (supabase as any)
        .from("gift_cards")
        .select("saldo_actual")
        .eq("id", vipPassId)
        .single()
      if (vipData) vipPassSaldoAntes = Number(vipData.saldo_actual)
    }

    const res = await registrarPago({
      citaId: null,
      clienteId,
      empleadoId: empleadoPrincipal as any,
      sucursalId,
      servicioNombre: cart.map(i => `${i.nombre} x${i.cantidad}`).join(", "),
      subtotal,
      descuentoMonto: descuento,
      descuentoTipo:  descuentoTipoFinal,
      descuentoCodigo: descuentoAplicado?.codigo,
      descuentoGcId: descuentoAplicado?.tipo === 'gift_card' ? descuentoAplicado.gcId : undefined,
      propina: propinaNum,
      total,
      metodoPago: metodoPagoRegistro,
      montoEfectivo: efNum,
      montoTarjeta: tarNum,
      montoGiftCard: montoGiftCardFinal,
      giftCardId: giftCardIdFinal,
      giftCardCodigo: giftCardCodigoFinal || undefined,
      clienteNombre: clienteSeleccionado ? `${clienteSeleccionado.nombre} ${clienteSeleccionado.apellido || ""}`.trim() : undefined,
      referencia: referencia.trim() || undefined,
      notas: notasVenta.trim() || undefined,
    })

    setIsCobrando(false)
    cobrandoRef.current = false

    if (!res.success) { toast.error(`Error: ${res.error}`); return }

    // Marcar todas las citas del carrito como completadas y pagadas
    const citasIds = cart
      .filter(i => i.tipo === "servicio" && i.citaId)
      .map(i => i.citaId!)
    await Promise.all(
      citasIds.map(id => updateCitaEstado(id, "completada", true))
    )

    // Registrar transacción de VIP Pass si se usó uno
    if (vipNumEfectivo > 0 && vipPassId) {
      const hoy = new Date()
      const fechaLocal = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`
      const saldoNuevo = Math.max(0, vipPassSaldoAntes - vipNumEfectivo)

      // Solo insertar transacción — el saldo ya fue descontado por registrarPago (Paso 5)
      await (supabase as any)
        .from("gift_card_transacciones")
        .insert({
          gift_card_id: vipPassId,
          tipo: "vip_pass",
          monto: vipNumEfectivo,
          saldo_anterior: vipPassSaldoAntes,
          saldo_nuevo: saldoNuevo,
          venta_id: res.pagoId ?? null,
          fecha: fechaLocal,
          notas: `VIP Pass usado · descuento $${descuento} · cobro al saldo $${vipNumEfectivo}`,
        })

      if (vipNum > 0 && vipPassId && clienteId) {
        const { data: vipRow } = await (supabase as any)
          .from("gift_cards")
          .select("cliente_id")
          .eq("id", vipPassId)
          .single()

        if (vipRow && !vipRow.cliente_id) {
          await (supabase as any)
            .from("gift_cards")
            .update({ cliente_id: clienteId })
            .eq("id", vipPassId)
        }
      }
    }

    // Registrar transacción de Gift Card si se usó como descuento
    if (descuentoAplicado?.tipo === "gift_card" && descuentoAplicado.gcId && descuento > 0) {
      const hoy = new Date()
      const fechaLocal = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`

      const { data: gcData } = await (supabase as any)
        .from("gift_cards")
        .select("saldo_actual")
        .eq("id", descuentoAplicado.gcId)
        .single()

      if (gcData) {
        const saldoAnterior = Number(gcData.saldo_actual)
        const saldoNuevo = Math.max(0, saldoAnterior - descuento)
        const nuevoEstado = saldoNuevo <= 0 ? "agotada" : "activa"

        await (supabase as any)
          .from("gift_cards")
          .update({
            saldo_actual: saldoNuevo,
            estado: nuevoEstado,
            updated_at: new Date().toISOString()
          })
          .eq("id", descuentoAplicado.gcId)

        await (supabase as any)
          .from("gift_card_transacciones")
          .insert({
            gift_card_id: descuentoAplicado.gcId,
            tipo: "canje",
            monto: descuento,
            saldo_anterior: saldoAnterior,
            saldo_nuevo: saldoNuevo,
            venta_id: res.pagoId ?? null,
            fecha: fechaLocal,
            notas: `Canje como descuento · ${descuentoAplicado.codigo}`,
          })
      }

      if (descuentoAplicado?.tipo === "gift_card" && descuentoAplicado.gcId && clienteId) {
        const { data: gcRow } = await (supabase as any)
          .from("gift_cards")
          .select("cliente_id")
          .eq("id", descuentoAplicado.gcId)
          .single()

        if (gcRow && !gcRow.cliente_id) {
          await (supabase as any)
            .from("gift_cards")
            .update({ cliente_id: clienteId })
            .eq("id", descuentoAplicado.gcId)
        }
      }
    }

    if (gcNum > 0 && gcPagoId && clienteId) {
      const { data: gcPagoRow } = await (supabase as any)
        .from("gift_cards")
        .select("cliente_id")
        .eq("id", gcPagoId)
        .single()

      if (gcPagoRow && !gcPagoRow.cliente_id) {
        await (supabase as any)
          .from("gift_cards")
          .update({ cliente_id: clienteId })
          .eq("id", gcPagoId)
      }
    }

    // Descontar stock de productos vendidos en esta sucursal (no bloquea la venta si falla)
    const itemsProducto = itemsProductoParaDescontarStock(cart)
    if (itemsProducto.length > 0) {
      descontarStockPorVenta(sucursalId, itemsProducto).catch((err) =>
        console.error("Error descontando stock por venta:", err),
      )
    }

    toast.success("¡Cobro registrado!", {
      description: `Total ${fmtMXN(total)}${cambio > 0 ? ` · Cambio: ${fmtMXN(cambio)}` : ""}`,
    })
    onPagoCompletado?.(total)
    onOpenChange(false)
  }

  // ── Filtros ────────────────────────────────────────────────────────────
  const clientesFiltrados = clientes.filter(c =>
    `${c.nombre} ${c.apellido} ${c.telefono}`.toLowerCase().includes(clienteSearch.toLowerCase())
  )
  const serviciosFiltrados = servicios.filter(s =>
    s.nombre.toLowerCase().includes(searchServicio.toLowerCase())
  )
  const productosFiltrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(searchProducto.toLowerCase())
  )
  const productosSugeridos = productos.filter(p =>
    productoEsSugerido(p.nombre, categoriasEnCarrito) &&
    !cart.find(c => c.id === p.id && c.tipo === "producto")
  ).slice(0, 4)

  const clienteSeleccionado = clientes.find(c => c.id === clienteId)
  const hayMultiMetodo = (efNum > 0 ? 1 : 0) + (tarNum > 0 ? 1 : 0) + (trfNum > 0 ? 1 : 0) + (gcNum > 0 ? 1 : 0) + (vipNum > 0 ? 1 : 0) > 1

  // ════════════════════════════════════════════════════════════════════════
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[95vw] sm:max-w-none p-0 flex flex-col gap-0 overflow-hidden"
      >
        {/* Header ──────────────────────────────────────────────────────── */}
        <SheetHeader className="px-5 pt-4 pb-3 flex-shrink-0 border-b bg-gradient-to-r from-violet-50 to-indigo-50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-violet-100">
              <Receipt className="h-5 w-5 text-violet-700" />
            </div>
            <SheetTitle className="text-lg font-semibold text-violet-900">Centro de Cobro</SheetTitle>
            <Badge variant="secondary" className="ml-auto mr-8 text-xs">Nueva Venta</Badge>
          </div>
        </SheetHeader>

        {isLoadingData ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
          </div>
        ) : (
          /* Layout 3 columnas ─────────────────────────────────────────── */
          <div className="flex-1 overflow-hidden grid grid-cols-[1fr_360px_320px] min-h-0">

            {/* ═══ COL 1: Items ════════════════════════════════════════ */}
            <div className="border-r flex flex-col overflow-hidden">
              {/* Sucursal + Cliente */}
              <div className="p-3 border-b bg-muted/20 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] font-semibold uppercase text-muted-foreground">Sucursal *</Label>
                    <select
                      value={sucursalId}
                      onChange={e => setSucursalId(e.target.value)}
                      className="w-full h-8 mt-0.5 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="">Seleccionar…</option>
                      {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                    </select>
                  </div>
                  {/* Búsqueda de cliente */}
                  <div ref={clienteRef} className="relative">
                    <Label className="text-[10px] font-semibold uppercase text-muted-foreground">Cliente * (nombre o teléfono)</Label>
                    <div className="relative mt-0.5">
                      <User className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        value={clienteSearch}
                        onChange={e => { setClienteSearch(e.target.value); setShowClienteList(true); if (!e.target.value) { setClienteId(""); } }}
                        onFocus={() => setShowClienteList(true)}
                        placeholder="Buscar cliente…"
                        className="pl-7 h-8 text-sm"
                      />
                      {clienteId && (
                        <button className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => { setClienteId(""); setClienteSearch("") }}>
                          <X className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                    {showClienteList && clienteSearch.length >= 2 && !clienteId && (
                      <div className="absolute z-50 top-full mt-1 w-full rounded-md border bg-popover shadow-md max-h-48 overflow-y-auto">
                        {clientesFiltrados.slice(0, 20).length === 0 ? (
                          <p className="p-3 text-xs text-muted-foreground text-center">Sin resultados</p>
                        ) : clientesFiltrados.slice(0, 20).map(c => (
                          <button key={c.id} type="button"
                            className="w-full flex items-start gap-2 px-3 py-2 hover:bg-accent text-left"
                            onClick={() => { setClienteId(c.id); setClienteSearch(`${c.nombre} ${c.apellido}`); setShowClienteList(false) }}
                          >
                            <User className="h-3.5 w-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
                            <div>
                              <p className="text-sm font-medium">{c.nombre} {c.apellido}</p>
                              <p className="text-[10px] text-muted-foreground">{c.telefono}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Catálogo de items */}
              <div className="flex-1 overflow-y-auto">
                <Tabs defaultValue="servicios" className="flex flex-col h-full">
                  <TabsList className="h-8 rounded-none border-b bg-background flex-shrink-0 w-full justify-start px-3 gap-1">
                    <TabsTrigger value="servicios" className="text-xs gap-1 h-6">
                      <Scissors className="h-3 w-3" /> Servicios
                    </TabsTrigger>
                    <TabsTrigger value="productos" className="text-xs gap-1 h-6">
                      <Package className="h-3 w-3" /> Productos
                    </TabsTrigger>
                  </TabsList>

                  {/* ── Servicios ── */}
                  <TabsContent value="servicios" className="flex-1 p-3 mt-0 space-y-2 overflow-y-auto">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input placeholder="Buscar servicio…" value={searchServicio} onChange={e => setSearchServicio(e.target.value)} className="pl-8 h-8 text-sm" />
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {serviciosFiltrados.map(s => (
                        <button key={s.id}
                          onClick={() => addToCart({ id: s.id, tipo: "servicio", nombre: s.nombre, precio: s.precio, categoriaServicio: getCategoriaServicio(s.nombre) })}
                          className="flex flex-col items-start p-2 rounded-lg border bg-background hover:border-violet-300 hover:bg-violet-50 transition-all text-left group"
                        >
                          <span className="font-medium text-xs truncate w-full group-hover:text-violet-700">{s.nombre}</span>
                          <span className="text-emerald-600 font-semibold text-xs mt-0.5">{fmtMXN(s.precio)}</span>
                        </button>
                      ))}
                    </div>
                  </TabsContent>

                  {/* ── Productos ── */}
                  <TabsContent value="productos" className="flex-1 p-3 mt-0 space-y-2 overflow-y-auto">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input placeholder="Buscar producto…" value={searchProducto} onChange={e => setSearchProducto(e.target.value)} className="pl-8 h-8 text-sm" />
                    </div>

                    {/* Producto personalizado */}
                    {!showProductoCustom ? (
                      <button
                        type="button"
                        onClick={() => setShowProductoCustom(true)}
                        className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground border border-dashed rounded-lg px-3 py-2 hover:border-emerald-400 hover:text-emerald-600 transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" /> Agregar producto no registrado
                      </button>
                    ) : (
                      <div className="border rounded-lg p-2.5 space-y-2 bg-muted/30">
                        <p className="text-[10px] font-semibold uppercase text-muted-foreground">Producto personalizado</p>
                        <Input
                          placeholder="Nombre del producto"
                          value={productoCustomNombre}
                          onChange={e => setProductoCustomNombre(e.target.value)}
                          className="h-8 text-sm"
                        />
                        <Input
                          type="number"
                          placeholder="Precio ($)"
                          value={productoCustomPrecio}
                          onChange={e => setProductoCustomPrecio(e.target.value)}
                          className="h-8 text-sm"
                          min="0"
                        />
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            className="h-7 text-xs flex-1"
                            onClick={() => {
                              const precio = parseFloat(productoCustomPrecio)
                              if (!productoCustomNombre.trim() || isNaN(precio) || precio <= 0) {
                                toast.error("Ingresa nombre y precio válidos")
                                return
                              }
                              addToCart({
                                id: `custom-${Date.now()}`,
                                tipo: "producto",
                                nombre: productoCustomNombre.trim(),
                                precio,
                              })
                              setProductoCustomNombre("")
                              setProductoCustomPrecio("")
                              setShowProductoCustom(false)
                            }}
                          >
                            Agregar al carrito
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => { setShowProductoCustom(false); setProductoCustomNombre(""); setProductoCustomPrecio("") }}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Sugerencias basadas en servicios */}
                    {productosSugeridos.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase text-violet-600 flex items-center gap-1 mb-1.5">
                          <Sparkles className="h-3 w-3" /> Recomendados para este servicio
                        </p>
                        <div className="grid grid-cols-2 gap-1.5 mb-3">
                          {productosSugeridos.map(p => (
                            <button key={p.id}
                              onClick={() => addToCart({ id: p.id, tipo: "producto", nombre: p.nombre, precio: p.precioVenta ?? p.precioCompra })}
                              className="flex flex-col items-start p-2 rounded-lg border border-violet-200 bg-violet-50 hover:border-violet-400 transition-all text-left"
                            >
                              <div className="flex items-center gap-1 w-full">
                                <Sparkles className="h-2.5 w-2.5 text-violet-500 flex-shrink-0" />
                                <span className="font-medium text-xs truncate text-violet-800">{p.nombre}</span>
                              </div>
                              <div className="flex items-center justify-between w-full mt-0.5">
                                <span className="text-emerald-600 font-semibold text-xs">{fmtMXN(p.precioVenta ?? p.precioCompra)}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                        <Separator className="mb-2" />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-1.5">
                      {productosFiltrados.map(p => (
                        <button key={p.id}
                          onClick={() => addToCart({ id: p.id, tipo: "producto", nombre: p.nombre, precio: p.precioVenta ?? p.precioCompra })}
                          className="flex flex-col items-start p-2 rounded-lg border bg-background hover:border-emerald-300 hover:bg-emerald-50 transition-all text-left"
                        >
                          <span className="font-medium text-xs truncate w-full">{p.nombre}</span>
                          <div className="flex items-center justify-between w-full mt-0.5">
                            <span className="text-emerald-600 font-semibold text-xs">{fmtMXN(p.precioVenta ?? p.precioCompra)}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>

            {/* ═══ COL 2: Carrito + Descuento + Propina ════════════════ */}
            <div className="border-r flex flex-col overflow-hidden">
              {/* Carrito */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                  <ShoppingCart className="h-3.5 w-3.5" /> Carrito
                  {cart.length > 0 && <Badge className="text-[10px] h-4 px-1.5">{cart.length}</Badge>}
                </p>

                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                    <ShoppingCart className="h-8 w-8 mb-2 opacity-20" />
                    <p className="text-xs">Agrega servicios o productos</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {cart.map(item => (
                      <div key={`${item.tipo}-${item.id}`} className="flex items-center gap-1.5 p-2 rounded-lg bg-muted/40 border text-xs">
                        <div className={cn("p-0.5 rounded flex-shrink-0", item.tipo === "servicio" ? "text-violet-500" : "text-emerald-500")}>
                          {item.tipo === "servicio" ? <Scissors className="h-3 w-3" /> : <Package className="h-3 w-3" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.nombre}</p>
                          <p className="text-[10px] text-muted-foreground">{fmtMXN(item.precio)}</p>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => changeQty(item.id, item.tipo, -1)}><Minus className="h-2.5 w-2.5" /></Button>
                          <span className="w-5 text-center font-semibold">{item.cantidad}</span>
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => changeQty(item.id, item.tipo, 1)}><Plus className="h-2.5 w-2.5" /></Button>
                        </div>
                        <span className="font-semibold w-14 text-right">{fmtMXN(item.precio * item.cantidad)}</span>
                        <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive" onClick={() => removeItem(item.id, item.tipo)}>
                          <X className="h-2.5 w-2.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Resumen parcial */}
                {cart.length > 0 && (
                  <div className="border-t pt-2 space-y-0.5 text-xs text-muted-foreground">
                    <div className="flex justify-between"><span>Subtotal</span><span className="font-medium text-foreground">{fmtMXN(subtotal)}</span></div>
                  </div>
                )}
              </div>

              {/* Descuento */}
              <div className="border-t p-3 space-y-2">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground flex items-center gap-1">
                  <BadgePercent className="h-3 w-3" /> Descuento
                </p>
                {descuentoAplicado ? (
                  <div className="flex items-center justify-between bg-violet-50 border border-violet-200 rounded-lg px-2.5 py-1.5">
                    <div className="text-xs text-violet-800 flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">{descuentoAplicado.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                      <span className="text-xs font-bold text-violet-700">−{fmtMXN(descuentoAplicado.monto)}</span>
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={limpiarDescuento}><X className="h-3 w-3" /></Button>
                    </div>
                  </div>
                ) : (
                  <Tabs defaultValue="cupon">
                    <TabsList className="h-6 text-[10px] w-full">
                      <TabsTrigger value="cupon"  className="flex-1 text-[10px] h-5"><Tag className="h-2.5 w-2.5 mr-1" />Cupón</TabsTrigger>
                      <TabsTrigger value="gc"     className="flex-1 text-[10px] h-5"><Gift className="h-2.5 w-2.5 mr-1" />GC</TabsTrigger>
                      <TabsTrigger value="manual" className="flex-1 text-[10px] h-5"><BadgePercent className="h-2.5 w-2.5 mr-1" />Manual</TabsTrigger>
                      <TabsTrigger value="vip"    className="flex-1 text-[10px] h-5"><Crown className="h-2.5 w-2.5 mr-1" />VIP</TabsTrigger>
                    </TabsList>

                    <TabsContent value="cupon" className="mt-1.5">
                      <div className="flex gap-1">
                        <Input placeholder="Código cupón" value={codigoCupon} onChange={e => setCodigoCupon(e.target.value.toUpperCase())} onKeyDown={e => e.key === "Enter" && handleAplicarCupon()} className="h-7 text-xs uppercase" />
                        <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={handleAplicarCupon} disabled={isValidandoCupon || !codigoCupon}>
                          {isValidandoCupon ? <Loader2 className="h-3 w-3 animate-spin" /> : "OK"}
                        </Button>
                      </div>
                    </TabsContent>

                    <TabsContent value="gc" className="mt-1.5">
                      <div className="flex gap-1">
                        <Input placeholder="Código gift card" value={codigoGC} onChange={e => setCodigoGC(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAplicarGC()} className="h-7 text-xs" />
                        <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={handleAplicarGC} disabled={isValidandoGC || !codigoGC}>
                          {isValidandoGC ? <Loader2 className="h-3 w-3 animate-spin" /> : "OK"}
                        </Button>
                      </div>
                    </TabsContent>

                    <TabsContent value="manual" className="mt-1.5">
                      <div className="flex gap-1 items-center">
                        <div className="flex rounded border overflow-hidden flex-shrink-0">
                          <button type="button" onClick={() => setDescManualTipo("pct")} className={cn("px-1.5 py-1 text-[10px] font-medium", descManualTipo === "pct" ? "bg-primary text-primary-foreground" : "bg-background")}>%</button>
                          <button type="button" onClick={() => setDescManualTipo("monto")} className={cn("px-1.5 py-1 text-[10px] font-medium", descManualTipo === "monto" ? "bg-primary text-primary-foreground" : "bg-background")}>$</button>
                        </div>
                        <Input type="number" min="0" step="any" value={descManualVal} onChange={e => setDescManualVal(e.target.value)} className="h-7 text-xs flex-1" placeholder={descManualTipo === "pct" ? "15" : "200"} />
                        <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={handleAplicarManual} disabled={!descManualVal}>OK</Button>
                      </div>
                    </TabsContent>

                    {/* ── VIP Pass ── */}
                    <TabsContent value="vip" className="mt-1.5 space-y-1.5">
                      {!vipPassId ? (
                        <div className="flex gap-1">
                          <Input
                            placeholder="Código VIP Pass…"
                            value={vipPassInput}
                            onChange={e => setVipPassInput(e.target.value.toUpperCase())}
                            onKeyDown={e => e.key === "Enter" && handleBuscarVipPass()}
                            className="h-7 text-xs uppercase"
                          />
                          <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={handleBuscarVipPass} disabled={vipPassBuscando || !vipPassInput}>
                            {vipPassBuscando ? <Loader2 className="h-3 w-3 animate-spin" /> : "Buscar"}
                          </Button>
                        </div>
                      ) : (
                        <>
                          {/* Código encontrado + saldo */}
                          <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded px-2 py-1">
                            <div className="flex items-center gap-1.5">
                              <Crown className="h-3 w-3 text-amber-600 flex-shrink-0" />
                              <span className="text-[10px] text-amber-800 font-semibold">{vipPassCodigo}</span>
                              <span className="text-[10px] text-amber-600">· saldo: {fmtMXN(vipPassSaldo)}</span>
                            </div>
                            <Button variant="ghost" size="icon" className="h-4 w-4"
                              onClick={() => { setVipPassId(""); setVipPassCodigo(""); setVipPassSaldo(0); setVipPassInput("") }}>
                              <X className="h-2.5 w-2.5" />
                            </Button>
                          </div>

                          {/* Precio total del carrito (solo lectura) */}
                          <div className="flex items-center justify-between bg-muted/40 rounded px-2 py-1 text-[10px]">
                            <span className="text-muted-foreground">Precio completo (comisión)</span>
                            <span className="font-bold text-foreground">{fmtMXN(subtotal)}</span>
                          </div>

                          {/* Campo único: diferencia = descuento del VIP Pass */}
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-0.5">Diferencia (descuento VIP) $</p>
                            <div className="flex gap-1">
                              <div className="relative flex-1">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">$</span>
                                <Input
                                  type="number" min="0" step="any"
                                  value={vipPassDiferencia}
                                  onChange={e => setVipPassDiferencia(e.target.value)}
                                  placeholder="ej. 70"
                                  className="h-7 text-xs pl-5"
                                  onKeyDown={e => e.key === "Enter" && handleAplicarVipPass()}
                                />
                              </div>
                              <Button size="sm" className="h-7 px-2 text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1"
                                onClick={handleAplicarVipPass} disabled={!vipPassDiferencia}>
                                <Crown className="h-3 w-3" /> Aplicar
                              </Button>
                            </div>
                          </div>

                          {/* Preview en tiempo real */}
                          {vipPassDiferencia && parseFloat(vipPassDiferencia) > 0 && parseFloat(vipPassDiferencia) < subtotal && (
                            <div className="text-[10px] bg-violet-50 border border-violet-200 rounded px-2 py-1 space-y-0.5">
                              <div className="flex justify-between text-violet-700">
                                <span>Descuento VIP Pass</span>
                                <span className="font-bold">− {fmtMXN(parseFloat(vipPassDiferencia))}</span>
                              </div>
                              <div className="flex justify-between text-emerald-700">
                                <span>Cobro al VIP Pass</span>
                                <span className="font-bold">{fmtMXN(subtotal - parseFloat(vipPassDiferencia))}</span>
                              </div>
                              <div className="flex justify-between text-amber-700">
                                <span>Comisión sobre</span>
                                <span className="font-bold">{fmtMXN(subtotal)}</span>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </TabsContent>
                  </Tabs>
                )}
              </div>

              {/* Propina */}
              <div className="border-t p-3 space-y-1.5">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground flex items-center gap-1">
                  <Star className="h-3 w-3" /> Propina
                </p>
                <div className="flex gap-1">
                  {[10, 15, 20].map(pct => {
                    const val = String(Math.round(subtotal * pct / 100))
                    return (
                      <button key={pct} type="button"
                        onClick={() => setPropina(p => p === val ? "" : val)}
                        className={cn("flex-1 text-xs py-1 rounded border transition-all font-medium",
                          propina === val ? "bg-amber-500 text-white border-amber-500" : "bg-background hover:border-amber-300 text-muted-foreground"
                        )}>
                        {pct}%
                      </button>
                    )
                  })}
                  <div className="relative flex-1">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">$</span>
                    <Input type="number" min="0" step="any" value={propina} onChange={e => setPropina(e.target.value)} placeholder="Otro" className="h-7 text-xs pl-4" />
                  </div>
                </div>
              </div>
            </div>

            {/* ═══ COL 3: Panel cliente + Pago ══════════════════════════ */}
            <div className="flex flex-col overflow-hidden bg-muted/10">
              {/* Panel de cliente */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3 border-b">
                {!clienteId ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <User className="h-8 w-8 mb-2 opacity-20" />
                    <p className="text-xs text-center">Selecciona un cliente para ver su historial</p>
                  </div>
                ) : isLoadingPanel ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    {/* Info cliente */}
                    <div className="bg-background rounded-lg p-2.5 border">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                          <User className="h-4 w-4 text-violet-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{clienteSeleccionado?.nombre} {clienteSeleccionado?.apellido}</p>
                          <p className="text-[10px] text-muted-foreground">{clienteSeleccionado?.telefono}</p>
                        </div>
                      </div>
                    </div>

                    {/* Alertas */}
                    {saldoPendiente > 0 && (
                      <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-2.5 py-2">
                        <TrendingDown className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" />
                        <div>
                          <p className="text-[10px] font-semibold text-orange-700">Saldo pendiente</p>
                          <p className="text-xs font-bold text-orange-600">{fmtMXN(saldoPendiente)}</p>
                        </div>
                      </div>
                    )}

                    {gcActiva && (
                      <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg px-2.5 py-2">
                        <Gift className="h-3.5 w-3.5 text-purple-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-semibold text-purple-700">Gift Card activa</p>
                          <p className="text-xs font-bold text-purple-600">{fmtMXN(gcActiva.saldoActual)} · {gcActiva.codigo}</p>
                        </div>
                        <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] border-purple-300 text-purple-700" onClick={handleUsarGCActiva}>
                          Usar
                        </Button>
                      </div>
                    )}

                    {/* Historial */}
                    {historial.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase text-muted-foreground flex items-center gap-1 mb-1.5">
                          <History className="h-3 w-3" /> Últimas visitas
                        </p>
                        <div className="space-y-1">
                          {historial.map(h => (
                            <div key={h.id} className="flex items-start justify-between px-2 py-1.5 rounded bg-background border text-[10px]">
                              <div>
                                <p className="font-medium truncate max-w-[120px]">{h.servicios.join(", ")}</p>
                                <p className="text-muted-foreground flex items-center gap-0.5">
                                  <Clock className="h-2.5 w-2.5" /> {fmtFecha(h.fecha)}
                                </p>
                              </div>
                              <span className="font-semibold text-emerald-600">{fmtMXN(h.monto)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Pago multi-método */}
              <div className="p-3 space-y-2">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground flex items-center gap-1">
                  <Wallet className="h-3 w-3" /> Método de Pago
                </p>

                {/* Efectivo */}
                <div className="flex items-center gap-1.5">
                  <div className={cn("p-1 rounded", efNum > 0 ? "text-emerald-600" : "text-muted-foreground")}>
                    <Banknote className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-xs w-20 flex-shrink-0">Efectivo</span>
                  <div className="relative flex-1">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">$</span>
                    <Input type="number" min="0" step="any" value={pagoEfectivo} onChange={e => setPagoEfectivo(e.target.value)} placeholder="0" className={cn("h-7 text-xs pl-5", errEfectivo && "border-red-400 focus-visible:ring-red-400")} />
                  </div>
                </div>
                {errEfectivo && (
                  <p className="text-[10px] text-red-600 font-medium ml-8">{errEfectivo}</p>
                )}

                {/* Tarjeta */}
                <div className="flex items-center gap-1.5">
                  <div className={cn("p-1 rounded", tarNum > 0 ? "text-blue-600" : "text-muted-foreground")}>
                    <CreditCard className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-xs w-20 flex-shrink-0">Tarjeta</span>
                  <div className="relative flex-1">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">$</span>
                    <Input type="number" min="0" step="any" value={pagoTarjeta} onChange={e => setPagoTarjeta(e.target.value)} placeholder="0" className={cn("h-7 text-xs pl-5", (errTarjeta || errMixto) && "border-red-400 focus-visible:ring-red-400")} />
                  </div>
                </div>
                {errTarjeta && (
                  <p className="text-[10px] text-red-600 font-medium ml-8">{errTarjeta}</p>
                )}
                {errMixto && !errTarjeta && (
                  <p className="text-[10px] text-red-600 font-medium ml-8">{errMixto}</p>
                )}

                {/* Transferencia + referencia */}
                <div className="flex items-center gap-1.5">
                  <div className={cn("p-1 rounded", trfNum > 0 ? "text-indigo-600" : "text-muted-foreground")}>
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-xs w-20 flex-shrink-0">Transf.</span>
                  <div className="relative flex-1">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">$</span>
                    <Input type="number" min="0" step="any" value={pagoTransferencia} onChange={e => setPagoTransferencia(e.target.value)} placeholder="0" className="h-7 text-xs pl-5" />
                  </div>
                </div>
                {trfNum > 0 && (
                  <Input placeholder="Referencia de transferencia *" value={referencia} onChange={e => setReferencia(e.target.value)} className="h-7 text-xs ml-8" />
                )}

                {/* Gift Card como método de pago */}
                <div className="flex items-center gap-1.5">
                  <div className={cn("p-1 rounded", gcNum > 0 ? "text-purple-600" : "text-muted-foreground")}>
                    <Gift className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-xs w-20 flex-shrink-0">Gift Card</span>
                  <div className="relative flex-1">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">$</span>
                    <Input type="number" min="0" step="any" value={pagoGiftCard} onChange={e => setPagoGiftCard(e.target.value)} placeholder="0" className="h-7 text-xs pl-5" disabled={!gcPagoId} />
                  </div>
                </div>
                {!gcPagoId && (
                  <div className="flex gap-1 ml-8">
                    <Input placeholder="Código GC" value={gcPagoCodigo} onChange={e => setGcPagoCodigo(e.target.value)} onKeyDown={e => e.key === "Enter" && handleBuscarGCPago()} className="h-6 text-[10px] flex-1" />
                    <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={handleBuscarGCPago} disabled={gcPagoBuscando || !gcPagoCodigo}>
                      {gcPagoBuscando ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : "Buscar"}
                    </Button>
                  </div>
                )}
                {gcPagoId && (
                  <div className="flex items-center justify-between ml-8 bg-purple-50 border border-purple-200 rounded px-2 py-1">
                    <span className="text-[10px] text-purple-700">{gcPagoCodigo} · saldo: {fmtMXN(gcPagoSaldo)}</span>
                    <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => { setGcPagoId(""); setGcPagoCodigo(""); setGcPagoSaldo(0); setPagoGiftCard("") }}>
                      <X className="h-2.5 w-2.5" />
                    </Button>
                  </div>
                )}

                {/* VIP Pass como método de pago — aparece cuando se aplicó en la sección de descuentos */}
                {vipPassId && (
                  <>
                    <div className="flex items-center gap-1.5">
                      <div className={cn("p-1 rounded", vipNum > 0 ? "text-amber-600" : "text-muted-foreground")}>
                        <Crown className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-xs w-20 flex-shrink-0 font-medium text-amber-700">VIP Pass</span>
                      <div className="relative flex-1">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">$</span>
                        <Input
                          type="number" min="0" step="any"
                          value={pagoVipPass}
                          onChange={e => setPagoVipPass(e.target.value)}
                          placeholder="0"
                          className="h-7 text-xs pl-5"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between ml-8 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                      <div className="text-[10px] text-amber-800">
                        <span className="font-semibold">{vipPassCodigo}</span>
                        <span className="ml-1 text-amber-600">· saldo: {fmtMXN(vipPassSaldo)}</span>
                        {vipNum > 0 && vipPassSaldo >= vipNum && (
                          <span className="ml-1 text-emerald-600">→ queda: {fmtMXN(vipPassSaldo - vipNum)}</span>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" className="h-4 w-4"
                        onClick={limpiarDescuento}>
                        <X className="h-2.5 w-2.5" />
                      </Button>
                    </div>
                  </>
                )}
              </div>

              {/* Totales */}
              <div className="border-t p-3 space-y-1.5 bg-background">
                <div className="space-y-0.5 text-xs">
                  <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{fmtMXN(subtotal)}</span></div>
                  {descuento > 0 && <div className="flex justify-between text-violet-600"><span>Descuento</span><span>−{fmtMXN(descuento)}</span></div>}
                  {propinaNum > 0 && <div className="flex justify-between text-amber-600"><span>Propina</span><span>+{fmtMXN(propinaNum)}</span></div>}
                  {hayMultiMetodo && <div className="flex justify-between text-blue-600 font-medium"><span>Total pagado</span><span>{fmtMXN(totalPagado)}</span></div>}
                  {efNum > 0 && <div className="flex justify-between text-emerald-600"><span>Cambio</span><span>{fmtMXN(cambio)}</span></div>}
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-base">
                  <span>Total</span>
                  <span className="text-emerald-700">{fmtMXN(total)}</span>
                </div>
                {faltante > 0.01 && (
                  <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded px-2 py-1">
                    <AlertTriangle className="h-3 w-3 text-red-500 flex-shrink-0" />
                    <span className="text-[10px] text-red-700">Falta asignar: {fmtMXN(faltante)}</span>
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" className="h-9 text-sm" onClick={() => onOpenChange(false)} disabled={isCobrandо}>
                    Cancelar
                  </Button>
                  <Button
                    variant="outline"
                    className="h-9 text-sm border-pink-300 text-pink-700 hover:bg-pink-50 gap-1.5"
                    onClick={handleCortesia}
                    disabled={isCobrandо || cart.length === 0 || !clienteId || !sucursalId}
                    title="Registrar como cortesía (sin cobro)"
                  >
                    <Heart className="h-4 w-4" />
                    Cortesía
                  </Button>
                  <Button
                    className="flex-1 h-9 text-sm bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                    onClick={handleCobrar}
                    disabled={isCobrandо || cart.length === 0 || faltante > 0.01 || hayErrorMontos}
                  >
                    {isCobrandо ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {isCobrandо ? "Registrando…" : "Cobrar"}
                  </Button>
                </div>
              </div>
            </div>

          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
