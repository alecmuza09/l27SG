"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import {
  Plus,
  Minus,
  Tag,
  Gift,
  Percent,
  CreditCard,
  Banknote,
  Building,
  X,
  CheckCircle,
  AlertCircle,
  Shield,
} from "lucide-react"
import { getPromociones, isPromocionVigente, generarCodigoAutorizacion } from "@/lib/data/promociones"
import { getGiftCards, saveGiftCards, addTransaccion } from "@/lib/data/gift-cards"
import type { Promocion } from "@/lib/types/promociones"
import type { GiftCard } from "@/lib/types/gift-cards"

interface Servicio {
  id: string
  nombre: string
  precio: number
  cantidad: number
}

interface AjusteAplicado {
  id: string
  tipo: "promocion" | "descuento_manual" | "cortesia" | "garantia" | "gift_card"
  nombre: string
  valor: number
  esPorcentaje: boolean
  montoDescuento: number
  color: string
  codigoAutorizacion?: string
}

interface CajaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clienteNombre: string
  clienteId: string
  serviciosIniciales?: Servicio[]
  onPagoCompletado?: (total: number, ajustes: AjusteAplicado[]) => void
}

const ajusteColors = {
  promocion: { bg: "bg-green-100", text: "text-green-800", border: "border-green-300" },
  descuento_manual: { bg: "bg-orange-100", text: "text-orange-800", border: "border-orange-300" },
  cortesia: { bg: "bg-blue-100", text: "text-blue-800", border: "border-blue-300" },
  garantia: { bg: "bg-red-100", text: "text-red-800", border: "border-red-300" },
  gift_card: { bg: "bg-purple-100", text: "text-purple-800", border: "border-purple-300" },
}

export function CajaDialog({
  open,
  onOpenChange,
  clienteNombre,
  clienteId,
  serviciosIniciales = [],
  onPagoCompletado,
}: CajaDialogProps) {
  const [servicios, setServicios] = useState<Servicio[]>(serviciosIniciales)
  const [ajustes, setAjustes] = useState<AjusteAplicado[]>([])
  const [promociones, setPromociones] = useState<Promocion[]>([])
  const [giftCards, setGiftCards] = useState<GiftCard[]>([])
  const [metodoPago, setMetodoPago] = useState<string>("efectivo")

  // Estados para agregar ajustes
  const [showAjusteMenu, setShowAjusteMenu] = useState(false)
  const [ajusteTipo, setAjusteTipo] = useState<string>("")
  const [descuentoManualValor, setDescuentoManualValor] = useState("")
  const [descuentoManualEsPorcentaje, setDescuentoManualEsPorcentaje] = useState(true)
  const [descuentoManualMotivo, setDescuentoManualMotivo] = useState("")
  const [codigoAutorizacion, setCodigoAutorizacion] = useState("")
  const [codigoRequerido, setCodigoRequerido] = useState("")
  const [cortesiaMotivo, setCortesiaMotivo] = useState("")
  const [garantiaMotivo, setGarantiaMotivo] = useState("")
  const [giftCardCodigo, setGiftCardCodigo] = useState("")
  const [giftCardMonto, setGiftCardMonto] = useState("")
  const [giftCardSeleccionada, setGiftCardSeleccionada] = useState<GiftCard | null>(null)
  const [selectedPromoId, setSelectedPromoId] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (open) {
      setPromociones(getPromociones().filter(isPromocionVigente))
      setGiftCards(getGiftCards().filter((gc) => gc.estado === "activa" && gc.saldoActual > 0))
      setServicios(
        serviciosIniciales.length > 0
          ? serviciosIniciales
          : [
              { id: "s-1", nombre: "Masaje Relajante", precio: 800, cantidad: 1 },
              { id: "s-2", nombre: "Facial Hidratante", precio: 600, cantidad: 1 },
            ],
      )
    }
  }, [open, serviciosIniciales])

  // Calculos
  const subtotal = servicios.reduce((sum, s) => sum + s.precio * s.cantidad, 0)
  const totalDescuentos = ajustes.reduce((sum, a) => sum + a.montoDescuento, 0)
  const total = Math.max(0, subtotal - totalDescuentos)
  const tieneAjustes = ajustes.length > 0

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount)
  }

  const handleAgregarPromocion = () => {
    const promo = promociones.find((p) => p.id === selectedPromoId)
    if (!promo) return

    const montoDescuento = promo.tipo === "porcentaje" ? (subtotal * promo.valor) / 100 : promo.valor

    const nuevoAjuste: AjusteAplicado = {
      id: `ajuste-${Date.now()}`,
      tipo: "promocion",
      nombre: promo.nombre,
      valor: promo.valor,
      esPorcentaje: promo.tipo === "porcentaje",
      montoDescuento,
      color: "green",
    }

    setAjustes([...ajustes, nuevoAjuste])
    setSelectedPromoId("")
    setShowAjusteMenu(false)
  }

  const handleAgregarDescuentoManual = () => {
    if (!descuentoManualValor || !codigoAutorizacion) {
      setError("Ingresa el valor y código de autorización")
      return
    }

    if (codigoAutorizacion !== codigoRequerido) {
      setError("Código de autorización incorrecto")
      return
    }

    const valor = Number.parseFloat(descuentoManualValor)
    const montoDescuento = descuentoManualEsPorcentaje ? (subtotal * valor) / 100 : valor

    const nuevoAjuste: AjusteAplicado = {
      id: `ajuste-${Date.now()}`,
      tipo: "descuento_manual",
      nombre: descuentoManualMotivo || "Descuento manual",
      valor,
      esPorcentaje: descuentoManualEsPorcentaje,
      montoDescuento,
      color: "orange",
      codigoAutorizacion,
    }

    setAjustes([...ajustes, nuevoAjuste])
    setDescuentoManualValor("")
    setDescuentoManualMotivo("")
    setCodigoAutorizacion("")
    setShowAjusteMenu(false)
    setError("")
  }

  const handleAgregarCortesia = () => {
    if (!cortesiaMotivo) {
      setError("Ingresa el motivo de la cortesía")
      return
    }

    // Cortesía = 100% de descuento
    const nuevoAjuste: AjusteAplicado = {
      id: `ajuste-${Date.now()}`,
      tipo: "cortesia",
      nombre: cortesiaMotivo,
      valor: 100,
      esPorcentaje: true,
      montoDescuento: subtotal,
      color: "blue",
    }

    setAjustes([...ajustes, nuevoAjuste])
    setCortesiaMotivo("")
    setShowAjusteMenu(false)
    setError("")
  }

  const handleAgregarGarantia = () => {
    if (!garantiaMotivo) {
      setError("Ingresa el motivo de la garantía")
      return
    }

    const nuevoAjuste: AjusteAplicado = {
      id: `ajuste-${Date.now()}`,
      tipo: "garantia",
      nombre: garantiaMotivo,
      valor: 100,
      esPorcentaje: true,
      montoDescuento: subtotal,
      color: "red",
    }

    setAjustes([...ajustes, nuevoAjuste])
    setGarantiaMotivo("")
    setShowAjusteMenu(false)
    setError("")
  }

  const handleBuscarGiftCard = () => {
    const card = giftCards.find((gc) => gc.codigo.toLowerCase() === giftCardCodigo.toLowerCase())
    if (card) {
      setGiftCardSeleccionada(card)
      setGiftCardMonto(Math.min(card.saldoActual, subtotal - totalDescuentos).toString())
      setError("")
    } else {
      setError("Gift card no encontrada o sin saldo")
      setGiftCardSeleccionada(null)
    }
  }

  const handleAplicarGiftCard = () => {
    if (!giftCardSeleccionada || !giftCardMonto) return

    const monto = Number.parseFloat(giftCardMonto)
    if (monto > giftCardSeleccionada.saldoActual) {
      setError("Monto excede el saldo disponible")
      return
    }

    const nuevoAjuste: AjusteAplicado = {
      id: `ajuste-${Date.now()}`,
      tipo: "gift_card",
      nombre: `Gift Card ${giftCardSeleccionada.codigo}`,
      valor: monto,
      esPorcentaje: false,
      montoDescuento: monto,
      color: "purple",
    }

    // Actualizar saldo de gift card
    const allCards = getGiftCards()
    const updatedCards = allCards.map((gc) =>
      gc.id === giftCardSeleccionada.id
        ? {
            ...gc,
            saldoActual: gc.saldoActual - monto,
            estado: gc.saldoActual - monto === 0 ? ("agotada" as const) : gc.estado,
          }
        : gc,
    )
    saveGiftCards(updatedCards)

    // Registrar transacción
    addTransaccion({
      id: `gct-${Date.now()}`,
      giftCardId: giftCardSeleccionada.id,
      tipo: "canje",
      monto,
      saldoAnterior: giftCardSeleccionada.saldoActual,
      saldoNuevo: giftCardSeleccionada.saldoActual - monto,
      ventaId: null,
      empleadoId: "e-1",
      empleadoNombre: "Admin Luna27",
      fecha: new Date().toISOString(),
      notas: `Pago en caja - ${clienteNombre}`,
    })

    setAjustes([...ajustes, nuevoAjuste])
    setGiftCardCodigo("")
    setGiftCardMonto("")
    setGiftCardSeleccionada(null)
    setShowAjusteMenu(false)
    setError("")
  }

  const handleRemoverAjuste = (ajusteId: string) => {
    setAjustes(ajustes.filter((a) => a.id !== ajusteId))
  }

  const handleProcesarPago = () => {
    onPagoCompletado?.(total, ajustes)
    onOpenChange(false)
  }

  const iniciarDescuentoManual = () => {
    const codigo = generarCodigoAutorizacion()
    setCodigoRequerido(codigo)
    setAjusteTipo("descuento_manual")
    // En producción, este código se enviaría al gerente
    alert(`Código de autorización (simular envío al gerente): ${codigo}`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Punto de Venta</DialogTitle>
          <DialogDescription>Cliente: {clienteNombre}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-6 pr-4">
            {/* Servicios */}
            <div>
              <h3 className="font-semibold mb-3">Servicios</h3>
              <div className="space-y-2">
                {servicios.map((servicio) => (
                  <div key={servicio.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex-1">
                      <p className="font-medium">{servicio.nombre}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(servicio.precio)} x {servicio.cantidad}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 bg-transparent"
                        onClick={() =>
                          setServicios(
                            servicios.map((s) =>
                              s.id === servicio.id && s.cantidad > 1 ? { ...s, cantidad: s.cantidad - 1 } : s,
                            ),
                          )
                        }
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-8 text-center">{servicio.cantidad}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 bg-transparent"
                        onClick={() =>
                          setServicios(
                            servicios.map((s) => (s.id === servicio.id ? { ...s, cantidad: s.cantidad + 1 } : s)),
                          )
                        }
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <p className="font-semibold w-24 text-right">
                        {formatCurrency(servicio.precio * servicio.cantidad)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Ajustes Aplicados */}
            {ajustes.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Ajustes Aplicados</h3>
                <div className="space-y-2">
                  {ajustes.map((ajuste) => {
                    const colors = ajusteColors[ajuste.tipo]
                    return (
                      <div
                        key={ajuste.id}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg border",
                          colors.bg,
                          colors.border,
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {ajuste.tipo === "promocion" && <Tag className="h-4 w-4" />}
                          {ajuste.tipo === "descuento_manual" && <Percent className="h-4 w-4" />}
                          {ajuste.tipo === "cortesia" && <Gift className="h-4 w-4" />}
                          {ajuste.tipo === "garantia" && <Shield className="h-4 w-4" />}
                          {ajuste.tipo === "gift_card" && <CreditCard className="h-4 w-4" />}
                          <div>
                            <p className={cn("font-medium", colors.text)}>{ajuste.nombre}</p>
                            <p className="text-xs text-muted-foreground">
                              {ajuste.esPorcentaje ? `${ajuste.valor}%` : formatCurrency(ajuste.valor)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn("font-semibold", colors.text)}>
                            -{formatCurrency(ajuste.montoDescuento)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleRemoverAjuste(ajuste.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Agregar Ajuste */}
            {!showAjusteMenu ? (
              <Button
                variant="outline"
                className="w-full bg-transparent"
                onClick={() => {
                  setShowAjusteMenu(true)
                  setAjusteTipo("")
                  setError("")
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Agregar Ajuste
              </Button>
            ) : (
              <div className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">Agregar Ajuste</h4>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setShowAjusteMenu(false)
                      setAjusteTipo("")
                      setError("")
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {!ajusteTipo && (
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className="justify-start bg-transparent"
                      onClick={() => setAjusteTipo("promocion")}
                    >
                      <Tag className="mr-2 h-4 w-4 text-green-600" />
                      Promoción
                    </Button>
                    <Button variant="outline" className="justify-start bg-transparent" onClick={iniciarDescuentoManual}>
                      <Percent className="mr-2 h-4 w-4 text-orange-600" />
                      Descuento Manual
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start bg-transparent"
                      onClick={() => setAjusteTipo("cortesia")}
                    >
                      <Gift className="mr-2 h-4 w-4 text-blue-600" />
                      Cortesía
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start bg-transparent"
                      onClick={() => setAjusteTipo("garantia")}
                    >
                      <Shield className="mr-2 h-4 w-4 text-red-600" />
                      Garantía
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start col-span-2 bg-transparent"
                      onClick={() => setAjusteTipo("gift_card")}
                    >
                      <CreditCard className="mr-2 h-4 w-4 text-purple-600" />
                      Gift Card
                    </Button>
                  </div>
                )}

                {/* Formulario de Promoción */}
                {ajusteTipo === "promocion" && (
                  <div className="space-y-3">
                    <Label>Seleccionar Promoción</Label>
                    <Select value={selectedPromoId} onValueChange={setSelectedPromoId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Elige una promoción" />
                      </SelectTrigger>
                      <SelectContent>
                        {promociones.map((promo) => (
                          <SelectItem key={promo.id} value={promo.id}>
                            {promo.nombre} (
                            {promo.tipo === "porcentaje" ? `${promo.valor}%` : formatCurrency(promo.valor)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button className="w-full" onClick={handleAgregarPromocion} disabled={!selectedPromoId}>
                      Aplicar Promoción
                    </Button>
                  </div>
                )}

                {/* Formulario de Descuento Manual */}
                {ajusteTipo === "descuento_manual" && (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label>Valor</Label>
                        <Input
                          type="number"
                          value={descuentoManualValor}
                          onChange={(e) => setDescuentoManualValor(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div className="w-32">
                        <Label>Tipo</Label>
                        <Select
                          value={descuentoManualEsPorcentaje ? "porcentaje" : "monto"}
                          onValueChange={(v) => setDescuentoManualEsPorcentaje(v === "porcentaje")}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="porcentaje">%</SelectItem>
                            <SelectItem value="monto">$</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>Motivo</Label>
                      <Input
                        value={descuentoManualMotivo}
                        onChange={(e) => setDescuentoManualMotivo(e.target.value)}
                        placeholder="Motivo del descuento..."
                      />
                    </div>
                    <div>
                      <Label>Código de Autorización (Gerente)</Label>
                      <Input
                        value={codigoAutorizacion}
                        onChange={(e) => setCodigoAutorizacion(e.target.value)}
                        placeholder="Ingresa el código de 4 dígitos"
                        maxLength={4}
                      />
                    </div>
                    <Button className="w-full" onClick={handleAgregarDescuentoManual}>
                      Aplicar Descuento
                    </Button>
                  </div>
                )}

                {/* Formulario de Cortesía */}
                {ajusteTipo === "cortesia" && (
                  <div className="space-y-3">
                    <div>
                      <Label>Motivo de la Cortesía</Label>
                      <Textarea
                        value={cortesiaMotivo}
                        onChange={(e) => setCortesiaMotivo(e.target.value)}
                        placeholder="Cliente frecuente, compensación, etc..."
                      />
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                      <AlertCircle className="inline h-4 w-4 mr-1" />
                      La cortesía aplica el 100% de descuento
                    </div>
                    <Button className="w-full" onClick={handleAgregarCortesia}>
                      Aplicar Cortesía
                    </Button>
                  </div>
                )}

                {/* Formulario de Garantía */}
                {ajusteTipo === "garantia" && (
                  <div className="space-y-3">
                    <div>
                      <Label>Motivo de la Garantía</Label>
                      <Textarea
                        value={garantiaMotivo}
                        onChange={(e) => setGarantiaMotivo(e.target.value)}
                        placeholder="Describe el problema con el servicio original..."
                      />
                    </div>
                    <div className="p-3 bg-red-50 rounded-lg text-sm text-red-800">
                      <AlertCircle className="inline h-4 w-4 mr-1" />
                      La garantía cubre el 100% del servicio
                    </div>
                    <Button className="w-full" onClick={handleAgregarGarantia}>
                      Aplicar Garantía
                    </Button>
                  </div>
                )}

                {/* Formulario de Gift Card */}
                {ajusteTipo === "gift_card" && (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label>Código de Gift Card</Label>
                        <Input
                          value={giftCardCodigo}
                          onChange={(e) => setGiftCardCodigo(e.target.value.toUpperCase())}
                          placeholder="GC-XXXX-XXXX"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button variant="outline" onClick={handleBuscarGiftCard}>
                          Buscar
                        </Button>
                      </div>
                    </div>
                    {giftCardSeleccionada && (
                      <>
                        <div className="p-3 bg-purple-50 rounded-lg">
                          <p className="font-medium text-purple-800">
                            Saldo disponible: {formatCurrency(giftCardSeleccionada.saldoActual)}
                          </p>
                        </div>
                        <div>
                          <Label>Monto a Aplicar</Label>
                          <Input
                            type="number"
                            value={giftCardMonto}
                            onChange={(e) => setGiftCardMonto(e.target.value)}
                            max={giftCardSeleccionada.saldoActual}
                          />
                        </div>
                        <Button className="w-full" onClick={handleAplicarGiftCard}>
                          Aplicar Gift Card
                        </Button>
                      </>
                    )}
                  </div>
                )}

                {error && (
                  <p className="text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                  </p>
                )}
              </div>
            )}

            <Separator />

            {/* Método de Pago */}
            <div>
              <h3 className="font-semibold mb-3">Método de Pago</h3>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={metodoPago === "efectivo" ? "default" : "outline"}
                  onClick={() => setMetodoPago("efectivo")}
                  className="justify-start"
                >
                  <Banknote className="mr-2 h-4 w-4" />
                  Efectivo
                </Button>
                <Button
                  variant={metodoPago === "tarjeta" ? "default" : "outline"}
                  onClick={() => setMetodoPago("tarjeta")}
                  className="justify-start"
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Tarjeta
                </Button>
                <Button
                  variant={metodoPago === "transferencia" ? "default" : "outline"}
                  onClick={() => setMetodoPago("transferencia")}
                  className="justify-start"
                >
                  <Building className="mr-2 h-4 w-4" />
                  Transferencia
                </Button>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Resumen y Total */}
        <div className="border-t pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          {totalDescuentos > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Descuentos</span>
              <span>-{formatCurrency(totalDescuentos)}</span>
            </div>
          )}
          <Separator />
          <div
            className={cn(
              "flex justify-between text-lg font-bold p-2 rounded-lg transition-colors",
              tieneAjustes ? "bg-amber-100 text-amber-800" : "bg-muted",
            )}
          >
            <span>TOTAL</span>
            <span>{formatCurrency(total)}</span>
          </div>
          {tieneAjustes && <p className="text-xs text-amber-600 text-center">* El total incluye ajustes aplicados</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleProcesarPago} className="min-w-32">
            <CheckCircle className="mr-2 h-4 w-4" />
            Cobrar {formatCurrency(total)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
