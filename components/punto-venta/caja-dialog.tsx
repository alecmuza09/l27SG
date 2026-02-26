"use client"

import React, { useState, useEffect, useCallback } from "react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Plus, Minus, X, Search, Banknote, CreditCard, ArrowLeftRight,
  SplitSquareHorizontal, CheckCircle2, Loader2, ShoppingCart, User,
  Tag, Gift, Scissors, Package, BadgePercent, Receipt,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { getClientes, type Cliente } from "@/lib/data/clientes"
import { getServiciosActivosFromDB, type Servicio } from "@/lib/data/servicios"
import { getProductosInventarioFromDB, type ProductoInventario } from "@/lib/data/inventario"
import { registrarPago, validarCuponByCode, validarGiftCard } from "@/lib/data/pagos"
import { getSucursalesActivasFromDB, type Sucursal } from "@/lib/data/sucursales"

// ─── Tipos ────────────────────────────────────────────────────────────────

type MetodoPago = "efectivo" | "tarjeta" | "transferencia" | "mixto"

interface CartItem {
  id: string
  tipo: "servicio" | "producto"
  nombre: string
  precio: number
  cantidad: number
}

interface DescuentoAplicado {
  tipo: "cupon" | "gift_card" | "manual_pct" | "manual_monto"
  codigo?: string
  label: string
  monto: number
}

interface CajaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clienteNombre?: string
  clienteId?: string
  onPagoCompletado?: (total: number) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const fmtMXN = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n)

// ═══════════════════════════════════════════════════════════════════════════
export function CajaDialog({
  open, onOpenChange, clienteNombre: propClienteNombre = "", clienteId: propClienteId = "", onPagoCompletado,
}: CajaDialogProps) {

  // ── Datos del sistema ──────────────────────────────────────────────────
  const [clientes, setClientes]   = useState<Cliente[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [productos, setProductos] = useState<ProductoInventario[]>([])
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [isLoadingData, setIsLoadingData] = useState(false)

  // ── Cliente seleccionado ───────────────────────────────────────────────
  const [clienteId, setClienteId]     = useState(propClienteId)
  const [clienteSearch, setClienteSearch] = useState(propClienteNombre)
  const [clientePopover, setClientePopover] = useState(false)

  // ── Carrito ────────────────────────────────────────────────────────────
  const [cart, setCart] = useState<CartItem[]>([])
  const [searchServicio, setSearchServicio] = useState("")
  const [searchProducto, setSearchProducto] = useState("")

  // ── Descuento ──────────────────────────────────────────────────────────
  const [codigoCupon, setCodigoCupon]         = useState("")
  const [codigoGC, setCodigoGC]               = useState("")
  const [descManualVal, setDescManualVal]     = useState("")
  const [descManualTipo, setDescManualTipo]   = useState<"pct" | "monto">("pct")
  const [descuentoAplicado, setDescuentoAplicado] = useState<DescuentoAplicado | null>(null)
  const [isValidandoCupon, setIsValidandoCupon] = useState(false)
  const [isValidandoGC, setIsValidandoGC]     = useState(false)

  // ── Propina ────────────────────────────────────────────────────────────
  const [propina, setPropina] = useState("")

  // ── Sucursal ───────────────────────────────────────────────────────────
  const [sucursalId, setSucursalId] = useState("")

  // ── Pago ──────────────────────────────────────────────────────────────
  const [metodoPago, setMetodoPago]         = useState<MetodoPago>("efectivo")
  const [montoRecibido, setMontoRecibido]   = useState("")
  const [montoEfMixto, setMontoEfMixto]     = useState("")
  const [notasVenta, setNotasVenta]         = useState("")
  const [isCobrandо, setIsCobrando]         = useState(false)

  // ── Cargar datos al abrir ──────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    // Resetear todo
    setClienteId(propClienteId)
    setClienteSearch(propClienteNombre)
    setCart([])
    setDescuentoAplicado(null)
    setCodigoCupon(""); setCodigoGC(""); setDescManualVal("")
    setPropina(""); setMetodoPago("efectivo")
    setMontoRecibido(""); setMontoEfMixto(""); setNotasVenta("")
    setSucursalId("")

    // Cargar datos del sistema
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
        setProductos(prods.filter(p => (p.precioVenta ?? 0) > 0 && p.stockActual > 0))
        setSucursales(sucs)
        if (sucs.length === 1) setSucursalId(sucs[0].id)
      })
      .catch(() => toast.error("Error cargando datos"))
      .finally(() => setIsLoadingData(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // ── Cálculos ──────────────────────────────────────────────────────────
  const subtotal  = cart.reduce((s, i) => s + i.precio * i.cantidad, 0)
  const descuento = descuentoAplicado?.monto ?? 0
  const propinaNum = parseFloat(propina) || 0
  const total     = Math.max(0, subtotal - descuento) + propinaNum
  const cambio    = metodoPago === "efectivo" ? Math.max(0, (parseFloat(montoRecibido) || 0) - total) : 0
  const tarjetaMixto = metodoPago === "mixto" ? Math.max(0, total - (parseFloat(montoEfMixto) || 0)) : 0

  // ── Carrito helpers ────────────────────────────────────────────────────
  const addToCart = (item: Omit<CartItem, "cantidad">) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id && c.tipo === item.tipo)
      if (existing) return prev.map(c => c.id === item.id && c.tipo === item.tipo ? { ...c, cantidad: c.cantidad + 1 } : c)
      return [...prev, { ...item, cantidad: 1 }]
    })
  }
  const changeQty = (id: string, tipo: CartItem["tipo"], delta: number) =>
    setCart(prev => prev.map(c => c.id === id && c.tipo === tipo ? { ...c, cantidad: Math.max(1, c.cantidad + delta) } : c))
  const removeItem = (id: string, tipo: CartItem["tipo"]) =>
    setCart(prev => prev.filter(c => !(c.id === id && c.tipo === tipo)))

  // ── Descuentos ────────────────────────────────────────────────────────
  const handleAplicarCupon = useCallback(async () => {
    if (!codigoCupon.trim()) return
    setIsValidandoCupon(true)
    const res = await validarCuponByCode(codigoCupon)
    setIsValidandoCupon(false)
    if (!res.valido || !res.promo) { toast.error(res.error || "Cupón inválido"); return }
    const monto = res.promo.tipo === "porcentaje" ? (subtotal * res.promo.valor) / 100 : Math.min(res.promo.valor, subtotal)
    setDescuentoAplicado({ tipo: "cupon", codigo: res.promo.codigo, label: `${res.promo.nombre} (${res.promo.tipo === "porcentaje" ? res.promo.valor + "%" : fmtMXN(res.promo.valor)})`, monto })
    toast.success(`Cupón aplicado: ${res.promo.nombre}`)
  }, [codigoCupon, subtotal])

  const handleAplicarGC = useCallback(async () => {
    if (!codigoGC.trim()) return
    setIsValidandoGC(true)
    const res = await validarGiftCard(codigoGC)
    setIsValidandoGC(false)
    if (!res.valida || !res.gc) { toast.error(res.error || "Gift card inválida"); return }
    const monto = Math.min(res.gc.saldoActual, subtotal)
    setDescuentoAplicado({ tipo: "gift_card", codigo: res.gc.codigo, label: `Gift Card ${res.gc.codigo} (saldo: ${fmtMXN(res.gc.saldoActual)})`, monto })
    toast.success(`Gift card aplicada: ${fmtMXN(monto)} de descuento`)
  }, [codigoGC, subtotal])

  const handleAplicarManual = useCallback(() => {
    const val = parseFloat(descManualVal)
    if (!val || val <= 0) return
    const monto = descManualTipo === "pct" ? Math.min((subtotal * val) / 100, subtotal) : Math.min(val, subtotal)
    setDescuentoAplicado({ tipo: descManualTipo === "pct" ? "manual_pct" : "manual_monto", label: descManualTipo === "pct" ? `Descuento ${val}%` : `Descuento ${fmtMXN(val)}`, monto })
    toast.success("Descuento aplicado")
  }, [descManualVal, descManualTipo, subtotal])

  // ── Cobrar ────────────────────────────────────────────────────────────
  const handleCobrar = async () => {
    if (cart.length === 0) { toast.error("Agrega al menos un servicio o producto"); return }
    if (!clienteId)        { toast.error("Selecciona un cliente"); return }
    if (!sucursalId)       { toast.error("Selecciona una sucursal"); return }
    if (metodoPago === "efectivo" && (parseFloat(montoRecibido) || 0) < total) {
      toast.error("El monto recibido es menor al total"); return
    }

    setIsCobrando(true)

    let descTipo: string | undefined
    let descCodigo: string | undefined
    if (descuentoAplicado) {
      descTipo   = descuentoAplicado.tipo === "cupon" ? "cupon" : descuentoAplicado.tipo === "gift_card" ? "gift_card" : "manual"
      descCodigo = descuentoAplicado.codigo
    }

    const metodoBD = metodoPago === "mixto" ? "otro" : metodoPago
    const servicioNombre = cart.map(i => `${i.nombre} x${i.cantidad}`).join(", ")

    const res = await registrarPago({
      citaId: null,
      clienteId,
      empleadoId: "",   // no hay empleada específica en venta directa
      sucursalId,
      servicioNombre,
      subtotal,
      descuentoMonto: descuento,
      descuentoTipo:  descTipo,
      descuentoCodigo: descCodigo,
      propina: propinaNum,
      total,
      metodoPago: metodoBD as any,
      montoEfectivo: metodoPago === "efectivo" ? total : metodoPago === "mixto" ? parseFloat(montoEfMixto) || 0 : 0,
      montoTarjeta:  metodoPago === "tarjeta" ? total : metodoPago === "mixto" ? tarjetaMixto : 0,
      notas: notasVenta || undefined,
    })

    setIsCobrando(false)

    if (!res.success) { toast.error(`Error al registrar: ${res.error}`); return }

    toast.success("¡Venta registrada!", { description: `Total: ${fmtMXN(total)}` })
    onPagoCompletado?.(total)
    onOpenChange(false)
  }

  // ── Filtros de búsqueda ───────────────────────────────────────────────
  const serviciosFiltrados = servicios.filter(s =>
    s.nombre.toLowerCase().includes(searchServicio.toLowerCase()))
  const productosFiltrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(searchProducto.toLowerCase()))
  const clientesFiltrados  = clientes.filter(c =>
    `${c.nombre} ${c.apellido}`.toLowerCase().includes(clienteSearch.toLowerCase()))

  const clienteSeleccionado = clientes.find(c => c.id === clienteId)

  const metodos: { value: MetodoPago; label: string; icon: React.ReactNode }[] = [
    { value: "efectivo",      label: "Efectivo",      icon: <Banknote className="h-4 w-4" /> },
    { value: "tarjeta",       label: "Tarjeta",       icon: <CreditCard className="h-4 w-4" /> },
    { value: "transferencia", label: "Transferencia", icon: <ArrowLeftRight className="h-4 w-4" /> },
    { value: "mixto",         label: "Mixto",         icon: <SplitSquareHorizontal className="h-4 w-4" /> },
  ]

  // ── Guard igual que caja-dialog de citas (todos los hooks ya declarados) ──
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-3 flex-shrink-0 border-b bg-gradient-to-r from-violet-50 to-indigo-50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-violet-100 rounded-lg">
              <Receipt className="h-5 w-5 text-violet-700" />
            </div>
            <DialogTitle className="text-lg text-violet-900">Nueva Venta</DialogTitle>
          </div>
        </DialogHeader>

        {isLoadingData ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-[1fr_320px] min-h-0">

                {/* ════════ COLUMNA IZQUIERDA: Items ════════ */}
                <div className="border-r overflow-y-auto p-4 space-y-4">

                  {/* Cliente + Sucursal */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Cliente */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Cliente *</Label>
                      <Popover open={clientePopover} onOpenChange={setClientePopover}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" role="combobox" className="w-full justify-start font-normal text-sm h-9">
                            <User className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                            {clienteSeleccionado
                              ? `${clienteSeleccionado.nombre} ${clienteSeleccionado.apellido}`
                              : <span className="text-muted-foreground">Buscar cliente…</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-0" align="start">
                          <Command>
                            <CommandInput
                              placeholder="Nombre o teléfono…"
                              value={clienteSearch}
                              onValueChange={setClienteSearch}
                            />
                            <CommandList>
                              <CommandEmpty>Sin resultados</CommandEmpty>
                              <CommandGroup>
                                {clientesFiltrados.slice(0, 30).map(c => (
                                  <CommandItem
                                    key={c.id}
                                    value={c.id}
                                    onSelect={() => {
                                      setClienteId(c.id)
                                      setClienteSearch(`${c.nombre} ${c.apellido}`)
                                      setClientePopover(false)
                                    }}
                                  >
                                    <User className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                                    {c.nombre} {c.apellido}
                                    <span className="ml-auto text-xs text-muted-foreground">{c.telefono}</span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Sucursal */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Sucursal *</Label>
                      <select
                        value={sucursalId}
                        onChange={e => setSucursalId(e.target.value)}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">Seleccionar…</option>
                        {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Agregar items */}
                  <Tabs defaultValue="servicios">
                    <TabsList className="h-8 text-xs">
                      <TabsTrigger value="servicios" className="gap-1 text-xs">
                        <Scissors className="h-3.5 w-3.5" /> Servicios
                      </TabsTrigger>
                      <TabsTrigger value="productos" className="gap-1 text-xs">
                        <Package className="h-3.5 w-3.5" /> Productos
                      </TabsTrigger>
                    </TabsList>

                    {/* Servicios */}
                    <TabsContent value="servicios" className="mt-2">
                      <div className="relative mb-2">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          placeholder="Buscar servicio…"
                          value={searchServicio}
                          onChange={e => setSearchServicio(e.target.value)}
                          className="pl-8 h-8 text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 max-h-52 overflow-y-auto pr-1">
                        {serviciosFiltrados.map(s => (
                          <button
                            key={s.id}
                            onClick={() => addToCart({ id: s.id, tipo: "servicio", nombre: s.nombre, precio: s.precio })}
                            className="flex flex-col items-start p-2 rounded-lg border bg-background hover:bg-accent/60 transition-colors text-left text-sm"
                          >
                            <span className="font-medium truncate w-full text-xs">{s.nombre}</span>
                            <span className="text-emerald-600 font-semibold text-xs">{fmtMXN(s.precio)}</span>
                          </button>
                        ))}
                        {serviciosFiltrados.length === 0 && (
                          <p className="col-span-2 text-center text-xs text-muted-foreground py-4">Sin resultados</p>
                        )}
                      </div>
                    </TabsContent>

                    {/* Productos */}
                    <TabsContent value="productos" className="mt-2">
                      <div className="relative mb-2">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          placeholder="Buscar producto…"
                          value={searchProducto}
                          onChange={e => setSearchProducto(e.target.value)}
                          className="pl-8 h-8 text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 max-h-52 overflow-y-auto pr-1">
                        {productosFiltrados.map(p => (
                          <button
                            key={p.id}
                            onClick={() => addToCart({ id: p.id, tipo: "producto", nombre: p.nombre, precio: p.precioVenta ?? p.precioCompra })}
                            className="flex flex-col items-start p-2 rounded-lg border bg-background hover:bg-accent/60 transition-colors text-left"
                          >
                            <span className="font-medium truncate w-full text-xs">{p.nombre}</span>
                            <div className="flex items-center justify-between w-full mt-0.5">
                              <span className="text-emerald-600 font-semibold text-xs">{fmtMXN(p.precioVenta ?? p.precioCompra)}</span>
                              <span className="text-[10px] text-muted-foreground">Stock: {p.stockActual}</span>
                            </div>
                          </button>
                        ))}
                        {productosFiltrados.length === 0 && (
                          <p className="col-span-2 text-center text-xs text-muted-foreground py-4">
                            {productos.length === 0 ? "No hay productos con precio de venta registrado" : "Sin resultados"}
                          </p>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>

                  {/* Descuentos */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold flex items-center gap-1.5">
                      <BadgePercent className="h-3.5 w-3.5 text-violet-500" />
                      Descuento
                    </p>
                    {descuentoAplicado ? (
                      <div className="flex items-center justify-between bg-violet-50 border border-violet-200 rounded-lg px-3 py-2 text-sm">
                        <div className="flex items-center gap-2 text-violet-800 text-xs">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          {descuentoAplicado.label}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-violet-700">−{fmtMXN(descuentoAplicado.monto)}</span>
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { setDescuentoAplicado(null); setCodigoCupon(""); setCodigoGC(""); setDescManualVal("") }}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Tabs defaultValue="cupon">
                        <TabsList className="h-7 text-xs">
                          <TabsTrigger value="cupon" className="text-xs gap-1 h-6"><Tag className="h-3 w-3" />Cupón</TabsTrigger>
                          <TabsTrigger value="gc" className="text-xs gap-1 h-6"><Gift className="h-3 w-3" />Gift Card</TabsTrigger>
                          <TabsTrigger value="manual" className="text-xs gap-1 h-6"><BadgePercent className="h-3 w-3" />Manual</TabsTrigger>
                        </TabsList>
                        <TabsContent value="cupon" className="mt-1.5">
                          <div className="flex gap-1.5">
                            <Input placeholder="Código (ej. BIENVENIDO)" value={codigoCupon} onChange={e => setCodigoCupon(e.target.value.toUpperCase())} onKeyDown={e => e.key === "Enter" && handleAplicarCupon()} className="h-8 text-xs uppercase" />
                            <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={handleAplicarCupon} disabled={isValidandoCupon || !codigoCupon.trim()}>
                              {isValidandoCupon ? <Loader2 className="h-3 w-3 animate-spin" /> : "Aplicar"}
                            </Button>
                          </div>
                        </TabsContent>
                        <TabsContent value="gc" className="mt-1.5">
                          <div className="flex gap-1.5">
                            <Input placeholder="Código gift card" value={codigoGC} onChange={e => setCodigoGC(e.target.value.toUpperCase())} onKeyDown={e => e.key === "Enter" && handleAplicarGC()} className="h-8 text-xs uppercase" />
                            <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={handleAplicarGC} disabled={isValidandoGC || !codigoGC.trim()}>
                              {isValidandoGC ? <Loader2 className="h-3 w-3 animate-spin" /> : "Aplicar"}
                            </Button>
                          </div>
                        </TabsContent>
                        <TabsContent value="manual" className="mt-1.5">
                          <div className="flex gap-1.5 items-center">
                            <div className="flex rounded-md border overflow-hidden flex-shrink-0">
                              <button type="button" onClick={() => setDescManualTipo("pct")} className={cn("px-2 py-1 text-xs font-medium", descManualTipo === "pct" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted")}>%</button>
                              <button type="button" onClick={() => setDescManualTipo("monto")} className={cn("px-2 py-1 text-xs font-medium", descManualTipo === "monto" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted")}>$</button>
                            </div>
                            <Input type="number" min="0" step="any" placeholder={descManualTipo === "pct" ? "15" : "200"} value={descManualVal} onChange={e => setDescManualVal(e.target.value)} className="h-8 text-xs flex-1" />
                            <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={handleAplicarManual} disabled={!descManualVal || parseFloat(descManualVal) <= 0}>Aplicar</Button>
                          </div>
                        </TabsContent>
                      </Tabs>
                    )}
                  </div>
                </div>

                {/* ════════ COLUMNA DERECHA: Carrito + Pago ════════ */}
                <div className="flex flex-col overflow-hidden">
                  {/* Carrito */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    <p className="text-xs font-semibold flex items-center gap-1.5">
                      <ShoppingCart className="h-3.5 w-3.5 text-primary" />
                      Carrito ({cart.length} items)
                    </p>
                    {cart.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                        <ShoppingCart className="h-8 w-8 mb-2 opacity-30" />
                        <p className="text-xs">Agrega servicios o productos</p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {cart.map(item => (
                          <div key={`${item.tipo}-${item.id}`} className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 border">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{item.nombre}</p>
                              <p className="text-[10px] text-muted-foreground">{fmtMXN(item.precio)} c/u</p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => changeQty(item.id, item.tipo, -1)}>
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-5 text-center text-xs font-semibold">{item.cantidad}</span>
                              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => changeQty(item.id, item.tipo, 1)}>
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                            <div className="text-xs font-semibold w-14 text-right flex-shrink-0">{fmtMXN(item.precio * item.cantidad)}</div>
                            <Button variant="ghost" size="icon" className="h-5 w-5 flex-shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeItem(item.id, item.tipo)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Propina */}
                    <div className="space-y-1.5 pt-2">
                      <Label className="text-xs font-semibold">Propina (opcional)</Label>
                      <div className="flex gap-1.5">
                        {[10, 15, 20].map(pct => (
                          <Button key={pct} size="sm" variant={propina === String(Math.round(subtotal * pct / 100)) ? "default" : "outline"} className="text-xs h-7 px-2 flex-1"
                            onClick={() => setPropina(p => p === String(Math.round(subtotal * pct / 100)) ? "" : String(Math.round(subtotal * pct / 100)))}>
                            {pct}%
                          </Button>
                        ))}
                        <Input type="number" min="0" step="any" placeholder="Otro" value={propina} onChange={e => setPropina(e.target.value)} className="h-7 text-xs flex-1" />
                      </div>
                    </div>
                  </div>

                  {/* Método de pago */}
                  <div className="border-t p-3 space-y-2 bg-muted/20">
                    <p className="text-xs font-semibold">Método de Pago</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {metodos.map(m => (
                        <button key={m.value} type="button" onClick={() => setMetodoPago(m.value)}
                          className={cn("flex items-center gap-1.5 p-2 rounded-lg border text-xs font-medium transition-all", metodoPago === m.value ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-border bg-background hover:border-muted-foreground/40 text-muted-foreground")}>
                          {m.icon}{m.label}
                        </button>
                      ))}
                    </div>
                    {metodoPago === "efectivo" && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[10px]">Recibido</Label>
                          <div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                            <Input type="number" min="0" step="any" value={montoRecibido} onChange={e => setMontoRecibido(e.target.value)} className="pl-5 h-8 text-xs" />
                          </div>
                        </div>
                        <div>
                          <Label className="text-[10px]">Cambio</Label>
                          <div className={cn("h-8 flex items-center px-2 rounded-md border text-xs font-semibold", cambio > 0 ? "bg-green-50 border-green-200 text-green-700" : "bg-muted text-muted-foreground")}>
                            {fmtMXN(cambio)}
                          </div>
                        </div>
                      </div>
                    )}
                    {metodoPago === "mixto" && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[10px]">Efectivo</Label>
                          <div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                            <Input type="number" min="0" step="any" value={montoEfMixto} onChange={e => setMontoEfMixto(e.target.value)} className="pl-5 h-8 text-xs" />
                          </div>
                        </div>
                        <div>
                          <Label className="text-[10px]">Tarjeta</Label>
                          <div className="h-8 flex items-center px-2 rounded-md border text-xs font-semibold bg-muted">
                            {fmtMXN(tarjetaMixto)}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer: totales + cobrar */}
            <div className="border-t bg-background flex-shrink-0 px-6 py-3">
              <div className="flex items-end justify-between gap-6">
                <div className="space-y-0.5 text-sm min-w-[200px]">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span><span>{fmtMXN(subtotal)}</span>
                  </div>
                  {descuento > 0 && (
                    <div className="flex justify-between text-violet-600">
                      <span>Descuento</span><span>−{fmtMXN(descuento)}</span>
                    </div>
                  )}
                  {propinaNum > 0 && (
                    <div className="flex justify-between text-amber-600">
                      <span>Propina</span><span>+{fmtMXN(propinaNum)}</span>
                    </div>
                  )}
                  <Separator className="my-1" />
                  <div className="flex justify-between font-bold text-base">
                    <span>Total</span>
                    <span className="text-emerald-700 text-lg">{fmtMXN(total)}</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCobrandо}>Cancelar</Button>
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 px-6" onClick={handleCobrar} disabled={isCobrandо || cart.length === 0}>
                    {isCobrandо
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Registrando…</>
                      : <><CheckCircle2 className="h-4 w-4" /> Cobrar {fmtMXN(total)}</>}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
