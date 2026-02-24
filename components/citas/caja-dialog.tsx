"use client"

import React, { useState, useEffect, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Banknote,
  CreditCard,
  ArrowLeftRight,
  SplitSquareHorizontal,
  Tag,
  Gift,
  Percent,
  X,
  CheckCircle2,
  Loader2,
  BadgePercent,
  Receipt,
  User,
  Scissors,
  Clock,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  validarCuponByCode,
  validarGiftCard,
  registrarPago,
  type PromocionValidada,
  type GiftCardValidada,
} from "@/lib/data/pagos"
import type { Cita } from "@/lib/data/citas"

// ─── Tipos internos ────────────────────────────────────────────────────────

type MetodoPago = "efectivo" | "tarjeta" | "transferencia" | "mixto"

type DescuentoTipo = "cupon" | "gift_card" | "manual_porcentaje" | "manual_monto" | null

interface DescuentoAplicado {
  tipo: DescuentoTipo
  codigo?: string
  label: string
  monto: number
  promoId?: string
}

// ─── Props ─────────────────────────────────────────────────────────────────

interface CajaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cita: Cita | null
  onPagoCobrado: () => void
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const formatMXN = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n)

// ═══════════════════════════════════════════════════════════════════════════
// Componente principal
// ═══════════════════════════════════════════════════════════════════════════

export function CajaDialog({ open, onOpenChange, cita, onPagoCobrado }: CajaDialogProps) {
  // ── Descuentos ────────────────────────────────────────────────────────
  const [codigoCupon, setCodigoCupon] = useState("")
  const [codigoGiftCard, setCodigoGiftCard] = useState("")
  const [descuentoManualValor, setDescuentoManualValor] = useState("")
  const [descuentoManualTipo, setDescuentoManualTipo] = useState<"porcentaje" | "monto">("porcentaje")
  const [descuentoAplicado, setDescuentoAplicado] = useState<DescuentoAplicado | null>(null)
  const [isValidandoCupon, setIsValidandoCupon] = useState(false)
  const [isValidandoGC, setIsValidandoGC] = useState(false)
  const [gcValidada, setGcValidada] = useState<GiftCardValidada | null>(null)

  // ── Propina ───────────────────────────────────────────────────────────
  const [propinaInput, setPropinaInput] = useState("")

  // ── Método de pago ────────────────────────────────────────────────────
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("efectivo")
  const [montoRecibido, setMontoRecibido] = useState("")      // Efectivo recibido
  const [montoEfectivoMixto, setMontoEfectivoMixto] = useState("") // En modo mixto

  // ── Notas ─────────────────────────────────────────────────────────────
  const [notas, setNotas] = useState("")

  // ── Estado de carga ───────────────────────────────────────────────────
  const [isCobrando, setIsCobrando] = useState(false)

  // ── Limpiar al abrir ──────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setCodigoCupon("")
      setCodigoGiftCard("")
      setDescuentoManualValor("")
      setDescuentoManualTipo("porcentaje")
      setDescuentoAplicado(null)
      setIsValidandoCupon(false)
      setIsValidandoGC(false)
      setGcValidada(null)
      setPropinaInput("")
      setMetodoPago("efectivo")
      setMontoRecibido("")
      setMontoEfectivoMixto("")
      setNotas("")
    }
  }, [open])

  if (!cita) return null

  // ─── Cálculos ──────────────────────────────────────────────────────────

  const subtotal = cita.precio
  const descuento = descuentoAplicado?.monto ?? 0
  const propina = parseFloat(propinaInput) || 0
  const total = Math.max(0, subtotal - descuento) + propina

  const cambio =
    metodoPago === "efectivo"
      ? Math.max(0, (parseFloat(montoRecibido) || 0) - total)
      : 0

  const montoTarjetaMixto =
    metodoPago === "mixto"
      ? Math.max(0, total - (parseFloat(montoEfectivoMixto) || 0))
      : 0

  // ─── Aplicar cupón ─────────────────────────────────────────────────────

  const handleAplicarCupon = useCallback(async () => {
    if (!codigoCupon.trim()) return
    setIsValidandoCupon(true)
    const res = await validarCuponByCode(codigoCupon)
    setIsValidandoCupon(false)
    if (!res.valido || !res.promo) {
      toast.error(res.error || "Cupón inválido")
      return
    }
    const monto =
      res.promo.tipo === "porcentaje"
        ? (subtotal * res.promo.valor) / 100
        : Math.min(res.promo.valor, subtotal)
    setDescuentoAplicado({
      tipo: "cupon",
      codigo: res.promo.codigo,
      label: `${res.promo.nombre} (${res.promo.tipo === "porcentaje" ? res.promo.valor + "%" : formatMXN(res.promo.valor)})`,
      monto,
      promoId: res.promo.id,
    })
    toast.success(`Cupón aplicado: ${res.promo.nombre}`)
  }, [codigoCupon, subtotal])

  // ─── Aplicar gift card ─────────────────────────────────────────────────

  const handleAplicarGiftCard = useCallback(async () => {
    if (!codigoGiftCard.trim()) return
    setIsValidandoGC(true)
    const res = await validarGiftCard(codigoGiftCard)
    setIsValidandoGC(false)
    if (!res.valida || !res.gc) {
      toast.error(res.error || "Gift card inválida")
      return
    }
    setGcValidada(res.gc)
    const monto = Math.min(res.gc.saldoActual, subtotal)
    setDescuentoAplicado({
      tipo: "gift_card",
      codigo: res.gc.codigo,
      label: `Gift Card ${res.gc.codigo} (saldo: ${formatMXN(res.gc.saldoActual)})`,
      monto,
    })
    toast.success(`Gift card aplicada: ${formatMXN(monto)} de descuento`)
  }, [codigoGiftCard, subtotal])

  // ─── Aplicar descuento manual ──────────────────────────────────────────

  const handleAplicarManual = useCallback(() => {
    const val = parseFloat(descuentoManualValor)
    if (!val || val <= 0) return
    let monto: number
    let label: string
    if (descuentoManualTipo === "porcentaje") {
      monto = Math.min((subtotal * val) / 100, subtotal)
      label = `Descuento manual ${val}%`
    } else {
      monto = Math.min(val, subtotal)
      label = `Descuento manual ${formatMXN(val)}`
    }
    setDescuentoAplicado({
      tipo: descuentoManualTipo === "porcentaje" ? "manual_porcentaje" : "manual_monto",
      label,
      monto,
    })
    toast.success("Descuento aplicado")
  }, [descuentoManualValor, descuentoManualTipo, subtotal])

  // ─── Quitar descuento ──────────────────────────────────────────────────

  const handleQuitarDescuento = () => {
    setDescuentoAplicado(null)
    setGcValidada(null)
    setCodigoCupon("")
    setCodigoGiftCard("")
    setDescuentoManualValor("")
  }

  // ─── Cobrar ────────────────────────────────────────────────────────────

  const handleCobrar = async () => {
    if (metodoPago === "efectivo" && (parseFloat(montoRecibido) || 0) < total) {
      toast.error("El monto recibido es menor al total")
      return
    }
    if (metodoPago === "mixto") {
      const efectivoMixto = parseFloat(montoEfectivoMixto) || 0
      if (efectivoMixto > total) {
        toast.error("El monto en efectivo es mayor al total")
        return
      }
    }

    setIsCobrando(true)

    // Determinar tipo/código de descuento para persistir
    let descuentoTipoGuardar: string | undefined
    let descuentoCodigoGuardar: string | undefined
    if (descuentoAplicado) {
      if (descuentoAplicado.tipo === "cupon") {
        descuentoTipoGuardar = "cupon"
        descuentoCodigoGuardar = descuentoAplicado.codigo
      } else if (descuentoAplicado.tipo === "gift_card") {
        descuentoTipoGuardar = "gift_card"
        descuentoCodigoGuardar = descuentoAplicado.codigo
      } else {
        descuentoTipoGuardar = "manual"
      }
    }

    // Método de pago BD (sin "mixto")
    const metodoBD =
      metodoPago === "mixto" ? "otro" : metodoPago

    const result = await registrarPago({
      citaId: cita.id,
      clienteId: cita.clienteId,
      empleadoId: cita.empleadoId,
      sucursalId: cita.sucursalId,
      servicioNombre: cita.servicioNombre,
      subtotal,
      descuentoMonto: descuento,
      descuentoTipo: descuentoTipoGuardar,
      descuentoCodigo: descuentoCodigoGuardar,
      propina,
      total,
      metodoPago: metodoBD as any,
      montoEfectivo:
        metodoPago === "efectivo"
          ? total
          : metodoPago === "mixto"
          ? parseFloat(montoEfectivoMixto) || 0
          : 0,
      montoTarjeta:
        metodoPago === "tarjeta"
          ? total
          : metodoPago === "mixto"
          ? montoTarjetaMixto
          : 0,
      notas: notas || undefined,
    })

    setIsCobrando(false)

    if (!result.success) {
      toast.error(`Error al registrar el pago: ${result.error}`)
      return
    }

    toast.success("¡Pago registrado exitosamente!", {
      description: `Total cobrado: ${formatMXN(total)}`,
    })
    onPagoCobrado()
    onOpenChange(false)
  }

  // ─── UI ────────────────────────────────────────────────────────────────

  const metodosUI: { value: MetodoPago; label: string; icon: React.ReactNode }[] = [
    { value: "efectivo", label: "Efectivo", icon: <Banknote className="h-4 w-4" /> },
    { value: "tarjeta", label: "Tarjeta", icon: <CreditCard className="h-4 w-4" /> },
    { value: "transferencia", label: "Transferencia", icon: <ArrowLeftRight className="h-4 w-4" /> },
    { value: "mixto", label: "Mixto", icon: <SplitSquareHorizontal className="h-4 w-4" /> },
  ]

  const propinasRapidas = [
    { label: "10%", valor: subtotal * 0.1 },
    { label: "15%", valor: subtotal * 0.15 },
    { label: "20%", valor: subtotal * 0.2 },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* ── Header ── */}
        <DialogHeader className="px-6 pt-5 pb-3 flex-shrink-0 border-b bg-gradient-to-r from-emerald-50 to-teal-50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-100 rounded-lg">
              <Receipt className="h-5 w-5 text-emerald-700" />
            </div>
            <DialogTitle className="text-lg text-emerald-900">Cobro en Caja</DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {/* ── Resumen de cita ── */}
          <div className="px-6 py-4 bg-muted/30 border-b">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Resumen del servicio
            </p>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Cliente</p>
                  <p className="font-medium">{cita.clienteNombre}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Scissors className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Servicio</p>
                  <p className="font-medium">{cita.servicioNombre}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Empleada</p>
                  <p className="font-medium">{cita.empleadoNombre}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-5 space-y-6">
            {/* ══════════════════════════════════
                SECCIÓN 1 – Descuentos
            ══════════════════════════════════ */}
            <div className="space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2">
                <BadgePercent className="h-4 w-4 text-violet-500" />
                Descuentos
              </p>

              {/* Descuento ya aplicado */}
              {descuentoAplicado && (
                <div className="flex items-center justify-between bg-violet-50 border border-violet-200 rounded-lg px-3 py-2 text-sm">
                  <div className="flex items-center gap-2 text-violet-800">
                    <CheckCircle2 className="h-4 w-4 text-violet-600 shrink-0" />
                    <span>{descuentoAplicado.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-violet-700">−{formatMXN(descuentoAplicado.monto)}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={handleQuitarDescuento}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Si no hay descuento, mostrar opciones */}
              {!descuentoAplicado && (
                <Tabs defaultValue="cupon">
                  <TabsList className="grid grid-cols-3 h-8 text-xs">
                    <TabsTrigger value="cupon" className="gap-1 text-xs">
                      <Tag className="h-3 w-3" /> Cupón
                    </TabsTrigger>
                    <TabsTrigger value="gift_card" className="gap-1 text-xs">
                      <Gift className="h-3 w-3" /> Gift Card
                    </TabsTrigger>
                    <TabsTrigger value="manual" className="gap-1 text-xs">
                      <Percent className="h-3 w-3" /> Manual
                    </TabsTrigger>
                  </TabsList>

                  {/* ── Cupón ── */}
                  <TabsContent value="cupon" className="mt-2">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Código de cupón (ej. BIENVENIDO)"
                        value={codigoCupon}
                        onChange={(e) => setCodigoCupon(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === "Enter" && handleAplicarCupon()}
                        className="flex-1 uppercase text-sm"
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleAplicarCupon}
                        disabled={isValidandoCupon || !codigoCupon.trim()}
                      >
                        {isValidandoCupon ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Aplicar"}
                      </Button>
                    </div>
                  </TabsContent>

                  {/* ── Gift Card ── */}
                  <TabsContent value="gift_card" className="mt-2">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Código gift card (ej. GC-ABCD-1234)"
                        value={codigoGiftCard}
                        onChange={(e) => setCodigoGiftCard(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === "Enter" && handleAplicarGiftCard()}
                        className="flex-1 uppercase text-sm"
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleAplicarGiftCard}
                        disabled={isValidandoGC || !codigoGiftCard.trim()}
                      >
                        {isValidandoGC ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Aplicar"}
                      </Button>
                    </div>
                  </TabsContent>

                  {/* ── Manual ── */}
                  <TabsContent value="manual" className="mt-2">
                    <div className="flex gap-2 items-center">
                      <div className="flex rounded-md border overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setDescuentoManualTipo("porcentaje")}
                          className={cn(
                            "px-3 py-1.5 text-xs font-medium transition-colors",
                            descuentoManualTipo === "porcentaje"
                              ? "bg-primary text-primary-foreground"
                              : "bg-background hover:bg-muted"
                          )}
                        >
                          %
                        </button>
                        <button
                          type="button"
                          onClick={() => setDescuentoManualTipo("monto")}
                          className={cn(
                            "px-3 py-1.5 text-xs font-medium transition-colors",
                            descuentoManualTipo === "monto"
                              ? "bg-primary text-primary-foreground"
                              : "bg-background hover:bg-muted"
                          )}
                        >
                          $
                        </button>
                      </div>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        placeholder={descuentoManualTipo === "porcentaje" ? "Ej: 15" : "Ej: 150"}
                        value={descuentoManualValor}
                        onChange={(e) => setDescuentoManualValor(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAplicarManual()}
                        className="flex-1 text-sm"
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleAplicarManual}
                        disabled={!descuentoManualValor || parseFloat(descuentoManualValor) <= 0}
                      >
                        Aplicar
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              )}
            </div>

            <Separator />

            {/* ══════════════════════════════════
                SECCIÓN 2 – Propina
            ══════════════════════════════════ */}
            <div className="space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2">
                <span className="text-amber-500">✦</span>
                Propina (opcional)
              </p>
              <div className="flex items-center gap-2">
                {propinasRapidas.map((p) => (
                  <Button
                    key={p.label}
                    variant={propinaInput === String(Math.round(p.valor)) ? "default" : "outline"}
                    size="sm"
                    className="text-xs"
                    onClick={() =>
                      setPropinaInput(
                        propinaInput === String(Math.round(p.valor)) ? "" : String(Math.round(p.valor))
                      )
                    }
                  >
                    {p.label} ({formatMXN(p.valor)})
                  </Button>
                ))}
                <div className="flex-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Otra cantidad"
                    value={propinaInput}
                    onChange={(e) => setPropinaInput(e.target.value)}
                    className="pl-7 text-sm"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* ══════════════════════════════════
                SECCIÓN 3 – Método de pago
            ══════════════════════════════════ */}
            <div className="space-y-3">
              <p className="text-sm font-semibold">Método de Pago</p>
              <div className="grid grid-cols-4 gap-2">
                {metodosUI.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMetodoPago(m.value)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-xs font-medium transition-all",
                      metodoPago === m.value
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-border bg-background hover:border-muted-foreground/40 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {m.icon}
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Efectivo: campo de monto recibido */}
              {metodoPago === "efectivo" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Monto recibido</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        placeholder={String(Math.ceil(total))}
                        value={montoRecibido}
                        onChange={(e) => setMontoRecibido(e.target.value)}
                        className="pl-7 text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Cambio</Label>
                    <div
                      className={cn(
                        "h-9 flex items-center px-3 rounded-md border text-sm font-semibold",
                        cambio > 0 ? "bg-green-50 border-green-200 text-green-700" : "bg-muted text-muted-foreground"
                      )}
                    >
                      {formatMXN(cambio)}
                    </div>
                  </div>
                </div>
              )}

              {/* Mixto: efectivo + tarjeta */}
              {metodoPago === "mixto" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Monto en efectivo</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0.00"
                        value={montoEfectivoMixto}
                        onChange={(e) => setMontoEfectivoMixto(e.target.value)}
                        className="pl-7 text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Monto en tarjeta</Label>
                    <div className="h-9 flex items-center px-3 rounded-md border text-sm font-semibold bg-muted text-foreground">
                      {formatMXN(montoTarjetaMixto)}
                    </div>
                  </div>
                </div>
              )}

              {/* Transferencia: referencia */}
              {metodoPago === "transferencia" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Referencia / Folio (opcional)</Label>
                  <Input
                    placeholder="Ej. SPEI-20240201-001"
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    className="text-sm"
                  />
                </div>
              )}
            </div>

            {/* ── Notas (no transferencia) ── */}
            {metodoPago !== "transferencia" && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Notas del pago (opcional)</Label>
                <Textarea
                  placeholder="Observaciones adicionales..."
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  rows={2}
                  className="text-sm resize-none"
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Footer: resumen + botón cobrar ── */}
        <div className="flex-shrink-0 border-t bg-background">
          {/* Resumen de importes */}
          <div className="px-6 py-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatMXN(subtotal)}</span>
            </div>
            {descuento > 0 && (
              <div className="flex justify-between text-violet-600">
                <span>Descuento</span>
                <span>−{formatMXN(descuento)}</span>
              </div>
            )}
            {propina > 0 && (
              <div className="flex justify-between text-amber-600">
                <span>Propina</span>
                <span>+{formatMXN(propina)}</span>
              </div>
            )}
            <Separator className="my-1" />
            <div className="flex justify-between font-bold text-base">
              <span>Total</span>
              <span className="text-emerald-700 text-lg">{formatMXN(total)}</span>
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-3 px-6 pb-5">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={isCobrando}
            >
              Cancelar
            </Button>
            <Button
              className="flex-2 flex-grow-[2] bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              onClick={handleCobrar}
              disabled={isCobrando}
            >
              {isCobrando ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Registrando...</>
              ) : (
                <><CheckCircle2 className="h-4 w-4" /> Cobrar {formatMXN(total)}</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
