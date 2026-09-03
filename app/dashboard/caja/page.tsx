"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Plus, Minus, X, Search, Banknote, CreditCard, ArrowLeftRight,
  CheckCircle2, Loader2, ShoppingCart, User, Tag, Gift, Scissors,
  Package, BadgePercent, Receipt, Clock, Star, AlertTriangle,
  Sparkles, Wallet, History, TrendingDown, ChevronRight,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { searchClientes, type Cliente } from "@/lib/data/clientes"
import { getServiciosActivosFromDB, type Servicio } from "@/lib/data/servicios"
import { getProductosInventarioFromDB, type ProductoInventario } from "@/lib/data/inventario"
import {
  registrarPago, validarCuponByCode, validarGiftCard,
  getHistorialClienteFromDB, getGiftCardActivaClienteFromDB,
  getSaldoPendienteClienteFromDB,
  type HistorialCliente, type GiftCardValidada,
} from "@/lib/data/pagos"
import { getSucursalesActivasFromDB, type Sucursal } from "@/lib/data/sucursales"

// ─── Tipos ────────────────────────────────────────────────────────────────

interface CartItem {
  id: string
  tipo: "servicio" | "producto"
  nombre: string
  precio: number
  cantidad: number
  categoriaServicio?: string
}

interface DescuentoAplicado {
  tipo: "cupon" | "gift_card" | "manual_pct" | "manual_monto"
  codigo?: string
  gcId?: string
  label: string
  monto: number
}

// ─── Sugerencias de productos ─────────────────────────────────────────────

const SUGERENCIAS: Record<string, string[]> = {
  masaje:    ["aceite", "crema", "aromaterapia", "esencial"],
  facial:    ["suero", "crema", "mascarilla", "hidrat"],
  manicure:  ["esmalte", "aceite cuticulas", "crema manos", "acetona"],
  pedicure:  ["esmalte", "crema pies", "lixa", "sales"],
  depilacion:["pos", "calmante", "aloe", "aceite rojo"],
}

function getCategoria(nombre: string) {
  const n = nombre.toLowerCase()
  if (n.includes("masaje") || n.includes("relajante") || n.includes("corporal")) return "masaje"
  if (n.includes("facial") || n.includes("hidrat")) return "facial"
  if (n.includes("manicure") || n.includes("mani")) return "manicure"
  if (n.includes("pedicure") || n.includes("pedi")) return "pedicure"
  if (n.includes("depil") || n.includes("cera") || n.includes("wax")) return "depilacion"
  return "default"
}

function esSugerido(nombreProducto: string, cats: string[]) {
  return cats.some(cat => (SUGERENCIAS[cat] || []).some(kw => nombreProducto.toLowerCase().includes(kw)))
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const fmtMXN = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n)

const fmtFecha = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" })

// ═══════════════════════════════════════════════════════════════════════════

export default function CajaPage() {
  const router = useRouter()

  // ── Datos maestros ─────────────────────────────────────────────────────
  const [servicios, setServicios]  = useState<Servicio[]>([])
  const [productos, setProductos]  = useState<ProductoInventario[]>([])
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [isLoading, setIsLoading]  = useState(true)

  // ── Cliente ────────────────────────────────────────────────────────────
  const [clienteId, setClienteId]         = useState("")
  const [clienteSearch, setClienteSearch] = useState("")
  const [showDropdown, setShowDropdown]   = useState(false)
  const [clientesBusqueda, setClientesBusqueda] = useState<Cliente[]>([])
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null)
  const [buscandoClientes, setBuscandoClientes] = useState(false)
  const clienteRef = useRef<HTMLDivElement>(null)

  // ── Panel cliente ──────────────────────────────────────────────────────
  const [historial, setHistorial]           = useState<HistorialCliente[]>([])
  const [gcActiva, setGcActiva]             = useState<GiftCardValidada | null>(null)
  const [saldoPendiente, setSaldoPendiente] = useState(0)
  const [loadingPanel, setLoadingPanel]     = useState(false)

  // ── Sucursal ───────────────────────────────────────────────────────────
  const [sucursalId, setSucursalId] = useState("")

  // ── Carrito ────────────────────────────────────────────────────────────
  const [cart, setCart]                     = useState<CartItem[]>([])
  const [searchServicio, setSearchServicio] = useState("")
  const [searchProducto, setSearchProducto] = useState("")

  // ── Descuento ──────────────────────────────────────────────────────────
  const [codigoCupon, setCodigoCupon]         = useState("")
  const [codigoGC, setCodigoGC]               = useState("")
  const [descManualVal, setDescManualVal]     = useState("")
  const [descManualTipo, setDescManualTipo]   = useState<"pct" | "monto">("pct")
  const [descuentoAplicado, setDescuentoAplicado] = useState<DescuentoAplicado | null>(null)
  const [validandoCupon, setValidandoCupon]   = useState(false)
  const [validandoGC, setValidandoGC]         = useState(false)

  // ── Propina ────────────────────────────────────────────────────────────
  const [propina, setPropina] = useState("")

  // ── Pago multi-método ──────────────────────────────────────────────────
  const [pagoEfectivo, setPagoEfectivo]         = useState("")
  const [pagoTarjeta, setPagoTarjeta]           = useState("")
  const [pagoTransferencia, setPagoTransferencia] = useState("")
  const [pagoGiftCard, setPagoGiftCard]         = useState("")
  const [gcPagoId, setGcPagoId]                 = useState("")
  const [gcPagoCodigo, setGcPagoCodigo]         = useState("")
  const [gcPagoSaldo, setGcPagoSaldo]           = useState(0)
  const [gcBuscando, setGcBuscando]             = useState(false)
  const [referencia, setReferencia]             = useState("")
  const [notas, setNotas]                       = useState("")
  const [cobrando, setCobrando]                 = useState(false)

  // ── Cargar datos iniciales ─────────────────────────────────────────────
  useEffect(() => {
    setIsLoading(true)
    Promise.all([
      getServiciosActivosFromDB(),
      getProductosInventarioFromDB(),
      getSucursalesActivasFromDB(),
    ])
      .then(([svcs, prods, sucs]) => {
        setServicios(svcs)
        setProductos(prods.filter(p => (p.precioVenta ?? 0) > 0 && p.stockActual > 0))
        setSucursales(sucs)
        if (sucs.length === 1) setSucursalId(sucs[0].id)
      })
      .catch(() => toast.error("Error cargando datos"))
      .finally(() => setIsLoading(false))
  }, [])

  // ── Cerrar dropdown al click fuera ─────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (clienteRef.current && !clienteRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // ── Cargar panel al seleccionar cliente ────────────────────────────────
  useEffect(() => {
    if (!clienteId) { setHistorial([]); setGcActiva(null); setSaldoPendiente(0); return }
    setLoadingPanel(true)
    Promise.all([
      getHistorialClienteFromDB(clienteId, 4),
      getGiftCardActivaClienteFromDB(clienteId),
      getSaldoPendienteClienteFromDB(clienteId),
    ])
      .then(([h, gc, saldo]) => { setHistorial(h); setGcActiva(gc); setSaldoPendiente(saldo) })
      .finally(() => setLoadingPanel(false))
  }, [clienteId])

  // ── Búsqueda de clientes en toda la BD (sin filtro de sucursal) ────────
  useEffect(() => {
    if (clienteId || clienteSearch.trim().length < 2) {
      if (clienteSearch.trim().length < 2) setClientesBusqueda([])
      setBuscandoClientes(false)
      return
    }
    const termino = clienteSearch.trim()
    const timer = setTimeout(async () => {
      setBuscandoClientes(true)
      try {
        setClientesBusqueda(await searchClientes(termino, 25))
      } catch {
        setClientesBusqueda([])
      } finally {
        setBuscandoClientes(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [clienteSearch, clienteId])

  // ── Cálculos ──────────────────────────────────────────────────────────
  const subtotal      = cart.reduce((s, i) => s + i.precio * i.cantidad, 0)
  const descuento     = descuentoAplicado?.monto ?? 0
  const propinaNum    = parseFloat(propina) || 0
  const totalBase     = Math.max(0, subtotal - descuento)
  const total         = totalBase + propinaNum

  const efNum  = parseFloat(pagoEfectivo)      || 0
  const tarNum = parseFloat(pagoTarjeta)       || 0
  const trfNum = parseFloat(pagoTransferencia) || 0
  const gcNum  = parseFloat(pagoGiftCard)      || 0
  const totalPagado = efNum + tarNum + trfNum + gcNum
  const cambio      = Math.max(0, efNum - (total - tarNum - trfNum - gcNum))
  const faltante    = Math.max(0, total - totalPagado)

  // ── Categorías en carrito para sugerencias ────────────────────────────
  const categoriasCarrito = [...new Set(
    cart.filter(i => i.tipo === "servicio").map(i => i.categoriaServicio || "default")
  )]

  // ── Carrito helpers ────────────────────────────────────────────────────
  const addToCart = (item: Omit<CartItem, "cantidad">) =>
    setCart(prev => {
      const ex = prev.find(c => c.id === item.id && c.tipo === item.tipo)
      if (ex) return prev.map(c => c.id === item.id && c.tipo === item.tipo ? { ...c, cantidad: c.cantidad + 1 } : c)
      return [...prev, { ...item, cantidad: 1 }]
    })

  const changeQty = (id: string, tipo: CartItem["tipo"], delta: number) =>
    setCart(prev => prev.map(c =>
      c.id === id && c.tipo === tipo ? { ...c, cantidad: Math.max(1, c.cantidad + delta) } : c
    ))

  const removeItem = (id: string, tipo: CartItem["tipo"]) =>
    setCart(prev => prev.filter(c => !(c.id === id && c.tipo === tipo)))

  const resetVenta = () => {
    setCart([]); setDescuentoAplicado(null)
    setCodigoCupon(""); setCodigoGC(""); setDescManualVal("")
    setPropina("")
    setPagoEfectivo(""); setPagoTarjeta(""); setPagoTransferencia(""); setPagoGiftCard("")
    setGcPagoId(""); setGcPagoCodigo(""); setGcPagoSaldo(0)
    setReferencia(""); setNotas("")
    setClienteId(""); setClienteSearch(""); setClienteSeleccionado(null); setClientesBusqueda([])
  }

  // ── Descuentos ────────────────────────────────────────────────────────
  const handleAplicarCupon = useCallback(async () => {
    if (!codigoCupon.trim()) return
    setValidandoCupon(true)
    const res = await validarCuponByCode(codigoCupon)
    setValidandoCupon(false)
    if (!res.valido || !res.promo) { toast.error(res.error || "Cupón inválido"); return }
    const monto = res.promo.tipo === "porcentaje" ? (subtotal * res.promo.valor) / 100 : Math.min(res.promo.valor, subtotal)
    setDescuentoAplicado({ tipo: "cupon", codigo: res.promo.codigo, label: `${res.promo.nombre} (${res.promo.tipo === "porcentaje" ? res.promo.valor + "%" : fmtMXN(res.promo.valor)})`, monto })
    toast.success(`Cupón aplicado: ${res.promo.nombre}`)
  }, [codigoCupon, subtotal])

  const handleAplicarGC = useCallback(async () => {
    if (!codigoGC.trim()) return
    setValidandoGC(true)
    const res = await validarGiftCard(codigoGC)
    setValidandoGC(false)
    if (!res.valida || !res.gc) { toast.error(res.error || "Gift card inválida"); return }
    const monto = Math.min(res.gc.saldoActual, totalBase)
    setDescuentoAplicado({ tipo: "gift_card", codigo: res.gc.codigo, gcId: res.gc.id, label: `Gift Card ${res.gc.codigo} (saldo: ${fmtMXN(res.gc.saldoActual)})`, monto })
    toast.success(`Gift card: ${fmtMXN(monto)} de descuento`)
  }, [codigoGC, totalBase])

  const handleAplicarManual = useCallback(() => {
    const val = parseFloat(descManualVal)
    if (!val || val <= 0) return
    const monto = descManualTipo === "pct" ? Math.min((subtotal * val) / 100, subtotal) : Math.min(val, subtotal)
    setDescuentoAplicado({ tipo: descManualTipo === "pct" ? "manual_pct" : "manual_monto", label: descManualTipo === "pct" ? `Descuento ${val}%` : `Descuento ${fmtMXN(val)}`, monto })
    toast.success("Descuento aplicado")
  }, [descManualVal, descManualTipo, subtotal])

  // ── Gift card como método de pago ─────────────────────────────────────
  const handleBuscarGCPago = async () => {
    if (!gcPagoCodigo.trim()) return
    setGcBuscando(true)
    const res = await validarGiftCard(gcPagoCodigo)
    setGcBuscando(false)
    if (!res.valida || !res.gc) { toast.error(res.error || "Gift card inválida"); return }
    setGcPagoId(res.gc.id)
    setGcPagoSaldo(res.gc.saldoActual)
    setPagoGiftCard(String(Math.min(res.gc.saldoActual, total)))
    toast.success(`Saldo disponible: ${fmtMXN(res.gc.saldoActual)}`)
  }

  const handleUsarGCActiva = () => {
    if (!gcActiva) return
    setGcPagoId(gcActiva.id)
    setGcPagoCodigo(gcActiva.codigo)
    setGcPagoSaldo(gcActiva.saldoActual)
    setPagoGiftCard(String(Math.min(gcActiva.saldoActual, total)))
  }

  // ── Cobrar ────────────────────────────────────────────────────────────
  const handleCobrar = async () => {
    if (cart.length === 0) { toast.error("Agrega al menos un servicio o producto"); return }
    if (!clienteId)        { toast.error("Selecciona un cliente"); return }
    if (!sucursalId)       { toast.error("Selecciona una sucursal"); return }
    if (faltante > 0.01)   { toast.error(`Faltan ${fmtMXN(faltante)} por asignar a un método de pago`); return }
    if (trfNum > 0 && !referencia.trim()) { toast.error("Ingresa la referencia de la transferencia"); return }

    setCobrando(true)

    const montos = [
      { metodo: "efectivo" as const, monto: efNum },
      { metodo: "tarjeta" as const, monto: tarNum },
      { metodo: "transferencia" as const, monto: trfNum },
    ]
    const mayor = montos.sort((a, b) => b.monto - a.monto)[0]
    const metodoPrincipal = mayor.monto > 0 ? mayor.metodo : "otro" as const
    const metodoPagoRegistro =
      efNum > 0.009 && tarNum > 0.009 ? "otro" : metodoPrincipal

    const res = await registrarPago({
      citaId: null,
      clienteId,
      empleadoId: "",
      sucursalId,
      servicioNombre: cart.map(i => `${i.nombre} x${i.cantidad}`).join(", "),
      subtotal,
      descuentoMonto: descuento,
      descuentoTipo:  descuentoAplicado?.tipo === "cupon" ? "cupon" : descuentoAplicado?.tipo === "gift_card" ? "gift_card" : descuentoAplicado ? "manual" : undefined,
      descuentoCodigo: descuentoAplicado?.codigo,
      propina: propinaNum,
      total,
      metodoPago: metodoPagoRegistro,
      montoEfectivo: efNum,
      montoTarjeta: tarNum,
      montoGiftCard: gcNum,
      giftCardId: gcNum > 0 ? gcPagoId : undefined,
      giftCardCodigo: gcNum > 0 ? gcPagoCodigo : undefined,
      referencia: referencia.trim() || undefined,
      notas: notas.trim() || undefined,
    })

    setCobrando(false)

    if (!res.success) { toast.error(`Error: ${res.error}`); return }

    toast.success("¡Venta registrada!", {
      description: `Total ${fmtMXN(total)}${cambio > 0 ? ` · Cambio: ${fmtMXN(cambio)}` : ""}`,
    })
    resetVenta()
  }

  // ── Filtros ────────────────────────────────────────────────────────────
  const serviciosFiltrados = servicios.filter(s =>
    s.nombre.toLowerCase().includes(searchServicio.toLowerCase())
  )
  const productosFiltrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(searchProducto.toLowerCase())
  )
  const productosSugeridos = productos
    .filter(p => esSugerido(p.nombre, categoriasCarrito) && !cart.find(c => c.id === p.id && c.tipo === "producto"))
    .slice(0, 4)

  // ════════════════════════════════════════════════════════════════════════
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b bg-gradient-to-r from-violet-50 to-indigo-50">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-violet-100">
            <Receipt className="h-5 w-5 text-violet-700" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-violet-900">Centro de Cobro</h1>
            <p className="text-xs text-muted-foreground">
              {new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {cart.length > 0 && (
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={resetVenta}>
              <X className="h-4 w-4 mr-1" /> Limpiar
            </Button>
          )}
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 px-6"
            disabled={cobrando || cart.length === 0 || faltante > 0.01}
            onClick={handleCobrar}
          >
            {cobrando
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Registrando…</>
              : <><CheckCircle2 className="h-4 w-4" /> Cobrar {total > 0 ? fmtMXN(total) : ""}</>}
          </Button>
        </div>
      </div>

      {/* ── Cuerpo principal (3 columnas) ────────────────────────────────── */}
      <div className="flex-1 overflow-hidden grid grid-cols-[1fr_340px_300px]">

        {/* ══ COL 1: Catálogo ══════════════════════════════════════════════ */}
        <div className="border-r flex flex-col overflow-hidden">
          {/* Sucursal + Cliente */}
          <div className="flex-shrink-0 p-3 border-b bg-muted/20 grid grid-cols-2 gap-3">
            {/* Sucursal */}
            <div>
              <Label className="text-[10px] font-semibold uppercase text-muted-foreground mb-1 block">Sucursal *</Label>
              <select
                value={sucursalId}
                onChange={e => setSucursalId(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Seleccionar…</option>
                {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>

            {/* Cliente con búsqueda */}
            <div ref={clienteRef} className="relative">
              <Label className="text-[10px] font-semibold uppercase text-muted-foreground mb-1 block">Cliente * — nombre o teléfono</Label>
              <div className="relative">
                <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={clienteSearch}
                  onChange={e => {
                    setClienteSearch(e.target.value)
                    setShowDropdown(true)
                    if (!e.target.value) {
                      setClienteId("")
                      setClienteSeleccionado(null)
                    }
                  }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Buscar cliente…"
                  className="pl-8 h-9"
                />
                {clienteId && (
                  <button className="absolute right-2.5 top-1/2 -translate-y-1/2" onClick={() => { setClienteId(""); setClienteSearch(""); setClienteSeleccionado(null) }}>
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
              </div>
              {showDropdown && clienteSearch.length >= 2 && !clienteId && (
                <div className="absolute z-50 top-full mt-1 left-0 right-0 rounded-lg border bg-popover shadow-lg max-h-52 overflow-y-auto">
                  {buscandoClientes ? (
                    <p className="p-3 text-sm text-muted-foreground text-center flex items-center justify-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando…
                    </p>
                  ) : clientesBusqueda.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground text-center">Sin resultados</p>
                  ) : clientesBusqueda.map(c => (
                    <button key={c.id} type="button"
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-accent text-left"
                      onClick={() => { setClienteId(c.id); setClienteSearch(`${c.nombre} ${c.apellido}`); setClienteSeleccionado(c); setShowDropdown(false) }}
                    >
                      <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{c.nombre} {c.apellido}</p>
                        <p className="text-xs text-muted-foreground">{c.telefono}</p>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tabs servicios/productos */}
          <Tabs defaultValue="servicios" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="flex-shrink-0 h-9 rounded-none border-b bg-background w-full justify-start px-4 gap-2">
              <TabsTrigger value="servicios" className="text-sm gap-1.5 h-7">
                <Scissors className="h-3.5 w-3.5" /> Servicios
              </TabsTrigger>
              <TabsTrigger value="productos" className="text-sm gap-1.5 h-7">
                <Package className="h-3.5 w-3.5" /> Productos
              </TabsTrigger>
            </TabsList>

            {/* Servicios */}
            <TabsContent value="servicios" className="flex-1 overflow-y-auto p-4 mt-0 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar servicio…" value={searchServicio} onChange={e => setSearchServicio(e.target.value)} className="pl-9" />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                {serviciosFiltrados.map(s => (
                  <button key={s.id}
                    onClick={() => addToCart({ id: s.id, tipo: "servicio", nombre: s.nombre, precio: s.precio, categoriaServicio: getCategoria(s.nombre) })}
                    className="flex flex-col items-start p-3 rounded-xl border bg-background hover:border-violet-300 hover:bg-violet-50 hover:shadow-sm transition-all text-left group"
                  >
                    <Scissors className="h-4 w-4 text-violet-400 mb-1.5 group-hover:text-violet-600" />
                    <span className="font-medium text-sm truncate w-full">{s.nombre}</span>
                    <span className="text-emerald-600 font-bold text-sm mt-0.5">{fmtMXN(s.precio)}</span>
                  </button>
                ))}
              </div>
            </TabsContent>

            {/* Productos */}
            <TabsContent value="productos" className="flex-1 overflow-y-auto p-4 mt-0 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar producto…" value={searchProducto} onChange={e => setSearchProducto(e.target.value)} className="pl-9" />
              </div>

              {productosSugeridos.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-violet-600 flex items-center gap-1.5 mb-2">
                    <Sparkles className="h-3.5 w-3.5" /> Recomendados para este servicio
                  </p>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
                    {productosSugeridos.map(p => (
                      <button key={p.id}
                        onClick={() => addToCart({ id: p.id, tipo: "producto", nombre: p.nombre, precio: p.precioVenta ?? p.precioCompra })}
                        className="flex flex-col items-start p-3 rounded-xl border-2 border-violet-200 bg-violet-50 hover:border-violet-400 transition-all text-left"
                      >
                        <div className="flex items-center gap-1 mb-1">
                          <Sparkles className="h-3 w-3 text-violet-500" />
                          <span className="text-[10px] font-semibold text-violet-600">Recomendado</span>
                        </div>
                        <span className="font-medium text-sm truncate w-full text-violet-900">{p.nombre}</span>
                        <div className="flex items-center justify-between w-full mt-0.5">
                          <span className="text-emerald-600 font-bold text-sm">{fmtMXN(p.precioVenta ?? p.precioCompra)}</span>
                          {p.stockActual <= (p.stockMinimo ?? 5) && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                        </div>
                      </button>
                    ))}
                  </div>
                  <Separator />
                </div>
              )}

              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                {productosFiltrados.map(p => (
                  <button key={p.id}
                    onClick={() => addToCart({ id: p.id, tipo: "producto", nombre: p.nombre, precio: p.precioVenta ?? p.precioCompra })}
                    className="flex flex-col items-start p-3 rounded-xl border bg-background hover:border-emerald-300 hover:bg-emerald-50 hover:shadow-sm transition-all text-left group"
                  >
                    <Package className="h-4 w-4 text-emerald-400 mb-1.5 group-hover:text-emerald-600" />
                    <span className="font-medium text-sm truncate w-full">{p.nombre}</span>
                    <div className="flex items-center justify-between w-full mt-0.5">
                      <span className="text-emerald-600 font-bold text-sm">{fmtMXN(p.precioVenta ?? p.precioCompra)}</span>
                      <span className={cn("text-[10px]", p.stockActual <= (p.stockMinimo ?? 5) ? "text-amber-600 font-semibold" : "text-muted-foreground")}>
                        {p.stockActual <= (p.stockMinimo ?? 5) ? "⚠ bajo" : `${p.stockActual} uds`}
                      </span>
                    </div>
                  </button>
                ))}
                {productosFiltrados.length === 0 && (
                  <p className="col-span-3 text-center text-sm text-muted-foreground py-8">
                    {productos.length === 0 ? "No hay productos con precio de venta" : "Sin resultados"}
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* ══ COL 2: Carrito + Descuento + Propina ════════════════════════ */}
        <div className="border-r flex flex-col overflow-hidden">
          {/* Carrito */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Carrito</span>
              {cart.length > 0 && <Badge className="text-xs h-5 px-2">{cart.length}</Badge>}
            </div>

            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <ShoppingCart className="h-12 w-12 mb-3 opacity-15" />
                <p className="text-sm">Selecciona servicios o productos</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map(item => (
                  <div key={`${item.tipo}-${item.id}`} className="flex items-center gap-2 p-3 rounded-xl bg-muted/40 border">
                    <div className={cn("p-1 rounded-lg flex-shrink-0", item.tipo === "servicio" ? "bg-violet-100 text-violet-600" : "bg-emerald-100 text-emerald-600")}>
                      {item.tipo === "servicio" ? <Scissors className="h-3.5 w-3.5" /> : <Package className="h-3.5 w-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.nombre}</p>
                      <p className="text-xs text-muted-foreground">{fmtMXN(item.precio)} c/u</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => changeQty(item.id, item.tipo, -1)}><Minus className="h-3 w-3" /></Button>
                      <span className="w-6 text-center text-sm font-bold">{item.cantidad}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => changeQty(item.id, item.tipo, 1)}><Plus className="h-3 w-3" /></Button>
                    </div>
                    <span className="text-sm font-bold w-16 text-right flex-shrink-0">{fmtMXN(item.precio * item.cantidad)}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeItem(item.id, item.tipo)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Descuento */}
          <div className="flex-shrink-0 border-t p-3 space-y-2 bg-muted/10">
            <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
              <BadgePercent className="h-3.5 w-3.5" /> Descuento
            </p>
            {descuentoAplicado ? (
              <div className="flex items-center justify-between bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">
                <div className="text-sm text-violet-800 flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{descuentoAplicado.label}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <span className="text-sm font-bold text-violet-700">−{fmtMXN(descuentoAplicado.monto)}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setDescuentoAplicado(null); setCodigoCupon(""); setCodigoGC(""); setDescManualVal("") }}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ) : (
              <Tabs defaultValue="cupon">
                <TabsList className="h-7 text-xs w-full">
                  <TabsTrigger value="cupon" className="flex-1 text-xs h-6 gap-1"><Tag className="h-3 w-3" />Cupón</TabsTrigger>
                  <TabsTrigger value="gc" className="flex-1 text-xs h-6 gap-1"><Gift className="h-3 w-3" />Gift Card</TabsTrigger>
                  <TabsTrigger value="manual" className="flex-1 text-xs h-6 gap-1"><BadgePercent className="h-3 w-3" />Manual</TabsTrigger>
                </TabsList>
                <TabsContent value="cupon" className="mt-1.5">
                  <div className="flex gap-2">
                    <Input placeholder="CÓDIGO CUPÓN" value={codigoCupon} onChange={e => setCodigoCupon(e.target.value.toUpperCase())} onKeyDown={e => e.key === "Enter" && handleAplicarCupon()} className="h-8 text-sm uppercase" />
                    <Button size="sm" variant="secondary" className="h-8 px-3" onClick={handleAplicarCupon} disabled={validandoCupon || !codigoCupon.trim()}>
                      {validandoCupon ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Aplicar"}
                    </Button>
                  </div>
                </TabsContent>
                <TabsContent value="gc" className="mt-1.5">
                  <div className="flex gap-2">
                    <Input placeholder="CÓDIGO GC" value={codigoGC} onChange={e => setCodigoGC(e.target.value.toUpperCase())} onKeyDown={e => e.key === "Enter" && handleAplicarGC()} className="h-8 text-sm uppercase" />
                    <Button size="sm" variant="secondary" className="h-8 px-3" onClick={handleAplicarGC} disabled={validandoGC || !codigoGC.trim()}>
                      {validandoGC ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Aplicar"}
                    </Button>
                  </div>
                </TabsContent>
                <TabsContent value="manual" className="mt-1.5">
                  <div className="flex gap-2 items-center">
                    <div className="flex rounded-md border overflow-hidden flex-shrink-0">
                      <button type="button" onClick={() => setDescManualTipo("pct")} className={cn("px-2 py-1 text-xs font-medium", descManualTipo === "pct" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted")}>%</button>
                      <button type="button" onClick={() => setDescManualTipo("monto")} className={cn("px-2 py-1 text-xs font-medium border-l", descManualTipo === "monto" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted")}>$</button>
                    </div>
                    <Input type="number" min="0" step="any" value={descManualVal} onChange={e => setDescManualVal(e.target.value)} placeholder={descManualTipo === "pct" ? "15" : "200"} className="h-8 text-sm flex-1" />
                    <Button size="sm" variant="secondary" className="h-8 px-3" onClick={handleAplicarManual} disabled={!descManualVal}>Aplicar</Button>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </div>

          {/* Propina */}
          <div className="flex-shrink-0 border-t p-3 space-y-2 bg-muted/10">
            <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5" /> Propina
            </p>
            <div className="flex gap-1.5">
              {[10, 15, 20].map(pct => {
                const val = String(Math.round(subtotal * pct / 100))
                return (
                  <button key={pct} type="button"
                    onClick={() => setPropina(p => p === val ? "" : val)}
                    className={cn("flex-1 text-sm py-1.5 rounded-lg border transition-all font-medium",
                      propina === val ? "bg-amber-400 text-white border-amber-400" : "bg-background hover:border-amber-300 text-muted-foreground"
                    )}>
                    {pct}%
                  </button>
                )
              })}
              <div className="relative flex-1">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                <Input type="number" min="0" step="any" value={propina} onChange={e => setPropina(e.target.value)} placeholder="Otro" className="h-9 text-sm pl-5" />
              </div>
            </div>
          </div>
        </div>

        {/* ══ COL 3: Panel cliente + Pago + Totales ═══════════════════════ */}
        <div className="flex flex-col overflow-hidden">
          {/* Panel cliente */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {!clienteId ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground text-center">
                <User className="h-10 w-10 mb-2 opacity-15" />
                <p className="text-sm">Selecciona un cliente para ver su historial y gift cards</p>
              </div>
            ) : loadingPanel ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Info */}
                <Card className="shadow-none">
                  <CardContent className="p-3 flex items-center gap-2">
                    <div className="h-9 w-9 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                      <User className="h-4.5 w-4.5 text-violet-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{clienteSeleccionado?.nombre} {clienteSeleccionado?.apellido}</p>
                      <p className="text-xs text-muted-foreground">{clienteSeleccionado?.telefono}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Saldo pendiente */}
                {saldoPendiente > 0 && (
                  <div className="flex items-center gap-2.5 bg-orange-50 border border-orange-200 rounded-lg p-2.5">
                    <TrendingDown className="h-4 w-4 text-orange-500 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-orange-700">Saldo pendiente de citas</p>
                      <p className="text-sm font-bold text-orange-600">{fmtMXN(saldoPendiente)}</p>
                    </div>
                  </div>
                )}

                {/* Gift card activa */}
                {gcActiva && (
                  <div className="flex items-center gap-2.5 bg-purple-50 border border-purple-200 rounded-lg p-2.5">
                    <Gift className="h-4 w-4 text-purple-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-purple-700">Gift Card activa</p>
                      <p className="text-sm font-bold text-purple-600">{fmtMXN(gcActiva.saldoActual)} · {gcActiva.codigo}</p>
                    </div>
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs border-purple-300 text-purple-700 flex-shrink-0" onClick={handleUsarGCActiva}>
                      Usar
                    </Button>
                  </div>
                )}

                {/* Historial */}
                {historial.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5 mb-2">
                      <History className="h-3.5 w-3.5" /> Últimas visitas
                    </p>
                    <div className="space-y-1.5">
                      {historial.map(h => (
                        <div key={h.id} className="flex items-start justify-between px-2.5 py-2 rounded-lg bg-muted/40 border text-sm">
                          <div className="min-w-0">
                            <p className="font-medium truncate max-w-[130px]">{h.servicios.join(", ")}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {fmtFecha(h.fecha)}
                            </p>
                          </div>
                          <span className="font-semibold text-emerald-600 flex-shrink-0 ml-2">{fmtMXN(h.monto)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Pago multi-método */}
          <div className="flex-shrink-0 border-t p-3 space-y-2 bg-muted/10">
            <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5" /> Método de Pago
            </p>

            {[
              { icono: <Banknote className="h-4 w-4" />, label: "Efectivo", val: pagoEfectivo, set: setPagoEfectivo, color: "text-emerald-600" },
              { icono: <CreditCard className="h-4 w-4" />, label: "Tarjeta", val: pagoTarjeta, set: setPagoTarjeta, color: "text-blue-600" },
              { icono: <ArrowLeftRight className="h-4 w-4" />, label: "Transf.", val: pagoTransferencia, set: setPagoTransferencia, color: "text-indigo-600" },
            ].map(m => (
              <div key={m.label} className="flex items-center gap-2">
                <div className={cn("flex-shrink-0 w-5", parseFloat(m.val) > 0 ? m.color : "text-muted-foreground")}>
                  {m.icono}
                </div>
                <span className="text-xs w-14 flex-shrink-0">{m.label}</span>
                <div className="relative flex-1">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                  <Input type="number" min="0" step="any" value={m.val} onChange={e => m.set(e.target.value)} placeholder="0" className="h-8 text-sm pl-5" />
                </div>
              </div>
            ))}

            {trfNum > 0 && (
              <Input placeholder="Referencia de transferencia *" value={referencia} onChange={e => setReferencia(e.target.value)} className="h-8 text-sm ml-7" />
            )}

            {/* Gift Card como pago */}
            <div className="flex items-center gap-2">
              <div className={cn("flex-shrink-0 w-5", gcNum > 0 ? "text-purple-600" : "text-muted-foreground")}>
                <Gift className="h-4 w-4" />
              </div>
              <span className="text-xs w-14 flex-shrink-0">GC</span>
              <div className="relative flex-1">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                <Input type="number" min="0" step="any" value={pagoGiftCard} onChange={e => setPagoGiftCard(e.target.value)} placeholder="0" className="h-8 text-sm pl-5" disabled={!gcPagoId} />
              </div>
            </div>
            {!gcPagoId ? (
              <div className="flex gap-2 ml-7">
                <Input placeholder="Código GC" value={gcPagoCodigo} onChange={e => setGcPagoCodigo(e.target.value.toUpperCase())} onKeyDown={e => e.key === "Enter" && handleBuscarGCPago()} className="h-7 text-xs uppercase flex-1" />
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={handleBuscarGCPago} disabled={gcBuscando || !gcPagoCodigo}>
                  {gcBuscando ? <Loader2 className="h-3 w-3 animate-spin" /> : "Buscar"}
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between ml-7 bg-purple-50 border border-purple-200 rounded-lg px-2.5 py-1.5">
                <span className="text-xs text-purple-700">{gcPagoCodigo} · saldo: {fmtMXN(gcPagoSaldo)}</span>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { setGcPagoId(""); setGcPagoCodigo(""); setGcPagoSaldo(0); setPagoGiftCard("") }}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>

          {/* Totales */}
          <div className="flex-shrink-0 border-t p-3 bg-background space-y-1.5">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{fmtMXN(subtotal)}</span></div>
              {descuento > 0 && <div className="flex justify-between text-violet-600"><span>Descuento</span><span>−{fmtMXN(descuento)}</span></div>}
              {propinaNum > 0 && <div className="flex justify-between text-amber-600"><span>Propina</span><span>+{fmtMXN(propinaNum)}</span></div>}
              {efNum > 0 && cambio > 0 && <div className="flex justify-between text-emerald-600"><span>Cambio</span><span>{fmtMXN(cambio)}</span></div>}
            </div>
            <Separator />
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span className="text-emerald-700">{fmtMXN(total)}</span>
            </div>
            {faltante > 0.01 && (
              <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5 text-xs text-red-700">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                Falta asignar: {fmtMXN(faltante)}
              </div>
            )}
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              disabled={cobrando || cart.length === 0 || faltante > 0.01}
              onClick={handleCobrar}
            >
              {cobrando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {cobrando ? "Registrando…" : `Cobrar ${total > 0 ? fmtMXN(total) : ""}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
