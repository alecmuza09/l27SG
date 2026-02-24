"use client"

import { useState, useEffect } from "react"
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
  Loader2,
  ArrowDownCircle,
  ArrowUpCircle,
  XCircle,
  Sparkles,
} from "lucide-react"
import { toast } from "sonner"
import { getClientes, type Cliente } from "@/lib/data/clientes"
import {
  getGiftCardsFromDB,
  getGiftCardTransaccionesFromDB,
  generarCodigoGiftCard,
  crearGiftCard,
  activarGiftCard,
  canjearGiftCard,
  recargarGiftCard,
  cancelarGiftCard,
} from "@/lib/data/gift-cards"
import type { GiftCard, GiftCardTransaccion } from "@/lib/types/gift-cards"
import { getSucursalesActivasFromDB, type Sucursal } from "@/lib/data/sucursales"

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

// ═══════════════════════════════════════════════════════════════════════════
// Página
// ═══════════════════════════════════════════════════════════════════════════

export default function GiftCardsPage() {
  // ── Datos ──────────────────────────────────────────────────────────────
  const [giftCards, setGiftCards]     = useState<GiftCard[]>([])
  const [clientes, setClientes]       = useState<Cliente[]>([])
  const [sucursales, setSucursales]   = useState<Sucursal[]>([])
  const [transacciones, setTransacciones] = useState<GiftCardTransaccion[]>([])
  const [isLoading, setIsLoading]     = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ── Búsqueda / filtros ─────────────────────────────────────────────────
  const [searchTerm, setSearchTerm]   = useState("")
  const [filterEstado, setFilterEstado] = useState<string>("todos")

  // ── Modales ────────────────────────────────────────────────────────────
  const [isCreateOpen,   setIsCreateOpen]   = useState(false)
  const [isViewOpen,     setIsViewOpen]     = useState(false)
  const [isActivateOpen, setIsActivateOpen] = useState(false)
  const [isRedeemOpen,   setIsRedeemOpen]   = useState(false)
  const [isRechargeOpen, setIsRechargeOpen] = useState(false)
  const [isCancelOpen,   setIsCancelOpen]   = useState(false)
  const [selectedCard,   setSelectedCard]   = useState<GiftCard | null>(null)

  // ── Formulario Crear ───────────────────────────────────────────────────
  const [newMonto,       setNewMonto]      = useState("")
  const [newExpiracion,  setNewExpiracion] = useState("")
  const [newClienteId,   setNewClienteId]  = useState("sin-cliente")
  const [newSucursalId,  setNewSucursalId] = useState("")

  // ── Formulario Canjear ─────────────────────────────────────────────────
  const [redeemMonto, setRedeemMonto] = useState("")
  const [redeemNotas, setRedeemNotas] = useState("")

  // ── Formulario Recargar ────────────────────────────────────────────────
  const [rechargeMonto, setRechargeMonto] = useState("")
  const [rechargeNotas, setRechargeNotas] = useState("")

  // ── Cargar datos ───────────────────────────────────────────────────────
  const reload = async () => {
    const data = await getGiftCardsFromDB()
    setGiftCards(data)
  }

  useEffect(() => {
    async function loadAll() {
      setIsLoading(true)
      try {
        const [gcs, cls, sucs] = await Promise.all([
          getGiftCardsFromDB(),
          getClientes(),
          getSucursalesActivasFromDB(),
        ])
        setGiftCards(gcs)
        setClientes(cls)
        setSucursales(sucs)
      } catch (err) {
        console.error("Error cargando datos:", err)
        toast.error("Error al cargar los datos")
      } finally {
        setIsLoading(false)
      }
    }
    loadAll()
  }, [])

  // ── Filtrado ───────────────────────────────────────────────────────────
  const filtered = giftCards.filter((c) => {
    const matchSearch =
      c.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.clienteNombre ?? "").toLowerCase().includes(searchTerm.toLowerCase())
    const matchEstado = filterEstado === "todos" || c.estado === filterEstado
    return matchSearch && matchEstado
  })

  // ── KPIs ───────────────────────────────────────────────────────────────
  const totalEmitidas  = giftCards.length
  const totalActivas   = giftCards.filter((c) => c.estado === "activa").length
  const totalPendientes = giftCards.filter((c) => c.estado === "pendiente").length
  const saldoTotal     = giftCards
    .filter((c) => c.estado === "activa")
    .reduce((s, c) => s + c.saldoActual, 0)

  // ─────────────────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!newMonto || !newSucursalId) return
    setIsSubmitting(true)
    const res = await crearGiftCard({
      montoInicial: parseFloat(newMonto),
      sucursalId: newSucursalId,
      clienteId: newClienteId === "sin-cliente" ? null : newClienteId,
      fechaVencimiento: newExpiracion || null,
    })
    setIsSubmitting(false)
    if (!res.success) {
      toast.error(`Error al crear: ${res.error}`)
      return
    }
    toast.success(`Gift card creada: ${res.gc?.codigo}`)
    setNewMonto(""); setNewExpiracion(""); setNewClienteId("sin-cliente"); setNewSucursalId("")
    setIsCreateOpen(false)
    await reload()
  }

  const handleActivar = async () => {
    if (!selectedCard) return
    setIsSubmitting(true)
    const res = await activarGiftCard(selectedCard.id)
    setIsSubmitting(false)
    if (!res.success) { toast.error(`Error: ${res.error}`); return }
    toast.success(`Gift card ${selectedCard.codigo} activada`)
    setIsActivateOpen(false); setSelectedCard(null)
    await reload()
  }

  const handleCanjear = async () => {
    if (!selectedCard || !redeemMonto) return
    const monto = parseFloat(redeemMonto)
    if (monto <= 0 || monto > selectedCard.saldoActual) return
    setIsSubmitting(true)
    const res = await canjearGiftCard(selectedCard.id, monto, redeemNotas || undefined)
    setIsSubmitting(false)
    if (!res.success) { toast.error(`Error: ${res.error}`); return }
    toast.success(`Canjeados ${fmtMXN(monto)}. Saldo restante: ${fmtMXN(res.saldoNuevo ?? 0)}`)
    setRedeemMonto(""); setRedeemNotas(""); setIsRedeemOpen(false); setSelectedCard(null)
    await reload()
  }

  const handleRecargar = async () => {
    if (!selectedCard || !rechargeMonto) return
    const monto = parseFloat(rechargeMonto)
    if (monto <= 0) return
    setIsSubmitting(true)
    const res = await recargarGiftCard(selectedCard.id, monto, rechargeNotas || undefined)
    setIsSubmitting(false)
    if (!res.success) { toast.error(`Error: ${res.error}`); return }
    toast.success(`Recargados ${fmtMXN(monto)}. Nuevo saldo: ${fmtMXN(res.saldoNuevo ?? 0)}`)
    setRechargeMonto(""); setRechargeNotas(""); setIsRechargeOpen(false); setSelectedCard(null)
    await reload()
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

      {/* KPIs */}
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
            <p className="text-xs text-muted-foreground">por activar</p>
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
            <Select value={filterEstado} onValueChange={setFilterEstado}>
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

                          {card.estado === "pendiente" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => { setSelectedCard(card); setIsActivateOpen(true) }}
                                className="text-green-700 focus:text-green-700 focus:bg-green-50"
                              >
                                <Sparkles className="mr-2 h-4 w-4" />
                                Activar
                              </DropdownMenuItem>
                            </>
                          )}

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
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════════════════
          DIALOGS
      ══════════════════════════════════════════════════════ */}

      {/* Crear */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Gift Card</DialogTitle>
            <DialogDescription>Se generará un código único automáticamente</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
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
                  className="pl-7"
                />
              </div>
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
            <div className="grid gap-2">
              <Label>Cliente (Opcional)</Label>
              <Select value={newClienteId} onValueChange={setNewClienteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sin-cliente">Sin asignar</SelectItem>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nombre} {c.apellido}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Fecha de Expiración (Opcional)</Label>
              <Input
                type="date"
                value={newExpiracion}
                onChange={(e) => setNewExpiracion(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={isSubmitting || !newMonto || !newSucursalId}>
              {isSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creando...</> : "Crear Gift Card"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Activar */}
      <Dialog open={isActivateOpen} onOpenChange={setIsActivateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Activar Gift Card</DialogTitle>
            <DialogDescription>
              ¿Confirmas la activación de <strong>{selectedCard?.codigo}</strong>?
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Una vez activada, la tarjeta tendrá un saldo disponible de{" "}
            <strong>{selectedCard && fmtMXN(selectedCard.saldoActual)}</strong> que el cliente podrá utilizar para pagar servicios.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsActivateOpen(false)} disabled={isSubmitting}>Cancelar</Button>
            <Button onClick={handleActivar} disabled={isSubmitting} className="bg-green-600 hover:bg-green-700">
              {isSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Activando...</> : <><Sparkles className="h-4 w-4 mr-2" />Activar</>}
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

      {/* Ver Detalles */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Gift className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="font-mono text-lg">{selectedCard?.codigo}</DialogTitle>
                {selectedCard && (
                  <Badge className={`${estadoConfig[selectedCard.estado].className} border text-xs mt-1`}>
                    {estadoConfig[selectedCard.estado].label}
                  </Badge>
                )}
              </div>
            </div>
          </DialogHeader>

          {selectedCard && (
            <ScrollArea className="flex-1">
              <div className="px-6 py-5 space-y-6">
                {/* Saldo destacado */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/40 rounded-xl">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">Saldo Actual</p>
                    <p className="text-2xl font-bold text-emerald-600">{fmtMXN(selectedCard.saldoActual)}</p>
                  </div>
                  <div className="text-center border-l">
                    <p className="text-xs text-muted-foreground mb-1">Saldo Inicial</p>
                    <p className="text-2xl font-bold">{fmtMXN(selectedCard.saldoInicial)}</p>
                  </div>
                </div>

                {/* Detalles */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    { label: "Cliente",       value: selectedCard.clienteNombre || "Sin asignar" },
                    { label: "Sucursal",      value: selectedCard.sucursalNombre },
                    { label: "Emisor",        value: selectedCard.empleadoEmisorNombre || "—" },
                    { label: "Fecha Emisión", value: fmtDate(selectedCard.fechaEmision) },
                    { label: "Activación",    value: fmtDate(selectedCard.fechaActivacion) },
                    { label: "Expiración",    value: fmtDate(selectedCard.fechaExpiracion) },
                  ].map(({ label, value }) => (
                    <div key={label} className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="font-medium">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Historial de transacciones */}
                <div>
                  <h4 className="font-semibold text-sm mb-3">Historial de Movimientos</h4>
                  {transacciones.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg">
                      Sin movimientos registrados
                    </p>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Monto</TableHead>
                            <TableHead>Saldo resultante</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {transacciones.map((t) => {
                            const cfg = tipoTransaccionConfig[t.tipo] ?? { label: t.tipo, signo: "·", color: "" }
                            return (
                              <TableRow key={t.id}>
                                <TableCell className="text-sm">{fmtDate(t.fecha)}</TableCell>
                                <TableCell>
                                  <span className="text-sm">{cfg.label}</span>
                                  {t.notas && <p className="text-xs text-muted-foreground">{t.notas}</p>}
                                </TableCell>
                                <TableCell className={`text-sm font-semibold ${cfg.color}`}>
                                  {cfg.signo !== "—" ? `${cfg.signo}${fmtMXN(t.monto)}` : "—"}
                                </TableCell>
                                <TableCell className="text-sm font-medium">{fmtMXN(t.saldoNuevo)}</TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          )}

          <DialogFooter className="px-6 py-4 border-t flex-shrink-0">
            <Button variant="outline" onClick={() => setIsViewOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
