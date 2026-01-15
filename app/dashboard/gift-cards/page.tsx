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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
} from "lucide-react"
import { getClientes, type Cliente } from "@/lib/data/clientes"
import {
  getGiftCards,
  saveGiftCards,
  generarCodigoGiftCard,
  getGiftCardTransacciones,
  addTransaccion,
} from "@/lib/data/gift-cards"
import type { GiftCard, GiftCardTransaccion } from "@/lib/types/gift-cards"

const estadoColors: Record<GiftCard["estado"], string> = {
  pendiente: "bg-yellow-100 text-yellow-800",
  activa: "bg-green-100 text-green-800",
  agotada: "bg-gray-100 text-gray-800",
  cancelada: "bg-red-100 text-red-800",
  expirada: "bg-orange-100 text-orange-800",
}

const estadoLabels: Record<GiftCard["estado"], string> = {
  pendiente: "Pendiente",
  activa: "Activa",
  agotada: "Agotada",
  cancelada: "Cancelada",
  expirada: "Expirada",
}

import { getSucursalesActivasFromDB, type Sucursal } from "@/lib/data/sucursales"

export default function GiftCardsPage() {
  const [giftCards, setGiftCards] = useState<GiftCard[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [filterEstado, setFilterEstado] = useState<string>("todos")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [isActivateDialogOpen, setIsActivateDialogOpen] = useState(false)
  const [isRedeemDialogOpen, setIsRedeemDialogOpen] = useState(false)
  const [isRechargeDialogOpen, setIsRechargeDialogOpen] = useState(false)
  const [selectedCard, setSelectedCard] = useState<GiftCard | null>(null)
  const [transacciones, setTransacciones] = useState<GiftCardTransaccion[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Form states
  const [newCardAmount, setNewCardAmount] = useState("")
  const [newCardExpiration, setNewCardExpiration] = useState("")
  const [newCardClient, setNewCardClient] = useState("")
  const [newCardSucursal, setNewCardSucursal] = useState("")
  const [redeemAmount, setRedeemAmount] = useState("")
  const [redeemNotes, setRedeemNotes] = useState("")
  const [rechargeAmount, setRechargeAmount] = useState("")
  const [rechargeNotes, setRechargeNotes] = useState("")

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true)
        const [giftCardsData, clientesData, sucursalesData] = await Promise.all([
          getGiftCardsFromDB(),
          getClientes(),
          getSucursalesActivasFromDB()
        ])
        setGiftCards(giftCardsData)
        setClientes(clientesData)
        setSucursales(sucursalesData)
      } catch (err) {
        console.error('Error cargando datos:', err)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [])

  const filteredCards = giftCards.filter((card) => {
    const matchesSearch =
      card.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      card.clienteNombre?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesEstado = filterEstado === "todos" || card.estado === filterEstado
    return matchesSearch && matchesEstado
  })

  // Estadísticas
  const totalActivas = giftCards.filter((c) => c.estado === "activa").length
  const totalSaldo = giftCards.filter((c) => c.estado === "activa").reduce((sum, c) => sum + c.saldoActual, 0)
  const totalEmitidas = giftCards.length
  const totalPendientes = giftCards.filter((c) => c.estado === "pendiente").length

  const handleCreateCard = async () => {
    if (!newCardAmount || !newCardSucursal) return

    // TODO: Implementar creación de gift card en Supabase
    // Por ahora solo actualizamos el estado local
    const sucursal = sucursales.find((s) => s.id === newCardSucursal)
    const cliente = clientes.find((c) => c.id === newCardClient)

    const newCard: GiftCard = {
      id: `gc-${Date.now()}`,
      codigo: generarCodigoGiftCard(),
      saldoInicial: Number.parseFloat(newCardAmount),
      saldoActual: Number.parseFloat(newCardAmount),
      estado: "pendiente",
      fechaEmision: new Date().toISOString(),
      fechaActivacion: null,
      fechaExpiracion: newCardExpiration || null,
      clienteId: newCardClient || null,
      clienteNombre: cliente ? `${cliente.nombre} ${cliente.apellido}` : null,
      sucursalId: newCardSucursal,
      sucursalNombre: sucursal?.nombre || "",
      empleadoEmisorId: "",
      empleadoEmisorNombre: "",
    }

    // Recargar datos desde BD después de crear
    const updatedCards = await getGiftCardsFromDB()
    setGiftCards(updatedCards)

    // Reset form
    setNewCardAmount("")
    setNewCardExpiration("")
    setNewCardClient("")
    setNewCardSucursal("")
    setIsCreateDialogOpen(false)
  }

  const handleActivateCard = async () => {
    if (!selectedCard) return

    // TODO: Implementar activación de gift card en Supabase
    // Por ahora recargamos desde BD
    const updatedCards = await getGiftCardsFromDB()
    setGiftCards(updatedCards)

    setIsActivateDialogOpen(false)
    setSelectedCard(null)
  }

  const handleRedeemCard = async () => {
    if (!selectedCard || !redeemAmount) return

    const amount = Number.parseFloat(redeemAmount)
    if (amount > selectedCard.saldoActual) return

    // TODO: Implementar canje de gift card en Supabase
    // Por ahora recargamos desde BD
    const updatedCards = await getGiftCardsFromDB()
    setGiftCards(updatedCards)

    setRedeemAmount("")
    setRedeemNotes("")
    setIsRedeemDialogOpen(false)
    setSelectedCard(null)
  }

  const handleRechargeCard = async () => {
    if (!selectedCard || !rechargeAmount) return

    // TODO: Implementar recarga de gift card en Supabase
    // Por ahora recargamos desde BD
    const updatedCards = await getGiftCardsFromDB()
    setGiftCards(updatedCards)

    setRechargeAmount("")
    setRechargeNotes("")
    setIsRechargeDialogOpen(false)
    setSelectedCard(null)
  }

  const handleCancelCard = async (card: GiftCard) => {
    // TODO: Implementar cancelación de gift card en Supabase
    // Por ahora recargamos desde BD
    const updatedCards = await getGiftCardsFromDB()
    setGiftCards(updatedCards)
  }

  const handleViewCard = async (card: GiftCard) => {
    setSelectedCard(card)
    const transaccionesData = await getGiftCardTransaccionesFromDB(card.id)
    setTransacciones(transaccionesData)
    setIsViewDialogOpen(true)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-"
    return new Date(dateString).toLocaleDateString("es-MX", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gift Cards</h1>
          <p className="text-muted-foreground">Gestiona tarjetas de regalo para tus clientes</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Gift Card
        </Button>
      </div>

      {/* Estadísticas */}
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
            <div className="text-2xl font-bold">{formatCurrency(totalSaldo)}</div>
            <p className="text-xs text-muted-foreground">en tarjetas activas</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Gift Cards</CardTitle>
          <CardDescription>Administra todas las tarjetas de regalo</CardDescription>
        </CardHeader>
        <CardContent>
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
              {filteredCards.map((card) => (
                <TableRow key={card.id}>
                  <TableCell className="font-mono font-medium">{card.codigo}</TableCell>
                  <TableCell>{card.clienteNombre || "-"}</TableCell>
                  <TableCell>
                    <div>
                      <span className="font-medium">{formatCurrency(card.saldoActual)}</span>
                      {card.saldoActual !== card.saldoInicial && (
                        <span className="text-xs text-muted-foreground ml-1">
                          / {formatCurrency(card.saldoInicial)}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={estadoColors[card.estado]}>{estadoLabels[card.estado]}</Badge>
                  </TableCell>
                  <TableCell>{card.sucursalNombre}</TableCell>
                  <TableCell>{formatDate(card.fechaEmision)}</TableCell>
                  <TableCell>{formatDate(card.fechaExpiracion)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewCard(card)}>
                          <Eye className="mr-2 h-4 w-4" />
                          Ver Detalles
                        </DropdownMenuItem>
                        {card.estado === "pendiente" && (
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedCard(card)
                              setIsActivateDialogOpen(true)
                            }}
                          >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Activar
                          </DropdownMenuItem>
                        )}
                        {card.estado === "activa" && (
                          <>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedCard(card)
                                setIsRedeemDialogOpen(true)
                              }}
                            >
                              <DollarSign className="mr-2 h-4 w-4" />
                              Canjear
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedCard(card)
                                setIsRechargeDialogOpen(true)
                              }}
                            >
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Recargar
                            </DropdownMenuItem>
                          </>
                        )}
                        {(card.estado === "activa" || card.estado === "pendiente") && (
                          <DropdownMenuItem onClick={() => handleCancelCard(card)} className="text-red-600">
                            <Ban className="mr-2 h-4 w-4" />
                            Cancelar
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {filteredCards.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No se encontraron gift cards
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog: Crear Gift Card */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Gift Card</DialogTitle>
            <DialogDescription>Crea una nueva tarjeta de regalo</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="amount">Monto Inicial *</Label>
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                value={newCardAmount}
                onChange={(e) => setNewCardAmount(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sucursal">Sucursal *</Label>
              <Select value={newCardSucursal} onValueChange={setNewCardSucursal}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar sucursal" />
                </SelectTrigger>
                <SelectContent>
                  {sucursales.map((sucursal) => (
                    <SelectItem key={sucursal.id} value={sucursal.id}>
                      {sucursal.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="client">Cliente (Opcional)</Label>
              <Select value={newCardClient} onValueChange={setNewCardClient}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {clientes.map((cliente) => (
                    <SelectItem key={cliente.id} value={cliente.id}>
                      {cliente.nombre} {cliente.apellido}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="expiration">Fecha de Expiración (Opcional)</Label>
              <Input
                id="expiration"
                type="date"
                value={newCardExpiration}
                onChange={(e) => setNewCardExpiration(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateCard} disabled={!newCardAmount || !newCardSucursal}>
              Crear Gift Card
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Activar Gift Card */}
      <Dialog open={isActivateDialogOpen} onOpenChange={setIsActivateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Activar Gift Card</DialogTitle>
            <DialogDescription>¿Confirmas la activación de la tarjeta {selectedCard?.codigo}?</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Una vez activada, el cliente podrá usar el saldo de{" "}
              <strong>{selectedCard && formatCurrency(selectedCard.saldoActual)}</strong> para pagar servicios.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsActivateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleActivateCard}>Activar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Canjear */}
      <Dialog open={isRedeemDialogOpen} onOpenChange={setIsRedeemDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Canjear Gift Card</DialogTitle>
            <DialogDescription>
              Tarjeta: {selectedCard?.codigo} - Saldo disponible:{" "}
              {selectedCard && formatCurrency(selectedCard.saldoActual)}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="redeemAmount">Monto a Canjear *</Label>
              <Input
                id="redeemAmount"
                type="number"
                placeholder="0.00"
                max={selectedCard?.saldoActual}
                value={redeemAmount}
                onChange={(e) => setRedeemAmount(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="redeemNotes">Notas</Label>
              <Textarea
                id="redeemNotes"
                placeholder="Descripción del canje..."
                value={redeemNotes}
                onChange={(e) => setRedeemNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRedeemDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleRedeemCard}
              disabled={
                !redeemAmount ||
                Number.parseFloat(redeemAmount) <= 0 ||
                Number.parseFloat(redeemAmount) > (selectedCard?.saldoActual || 0)
              }
            >
              Canjear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Recargar */}
      <Dialog open={isRechargeDialogOpen} onOpenChange={setIsRechargeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recargar Gift Card</DialogTitle>
            <DialogDescription>
              Tarjeta: {selectedCard?.codigo} - Saldo actual: {selectedCard && formatCurrency(selectedCard.saldoActual)}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="rechargeAmount">Monto a Recargar *</Label>
              <Input
                id="rechargeAmount"
                type="number"
                placeholder="0.00"
                value={rechargeAmount}
                onChange={(e) => setRechargeAmount(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rechargeNotes">Notas</Label>
              <Textarea
                id="rechargeNotes"
                placeholder="Motivo de la recarga..."
                value={rechargeNotes}
                onChange={(e) => setRechargeNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRechargeDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleRechargeCard} disabled={!rechargeAmount || Number.parseFloat(rechargeAmount) <= 0}>
              Recargar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Ver Detalles */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalles de Gift Card</DialogTitle>
            <DialogDescription>Código: {selectedCard?.codigo}</DialogDescription>
          </DialogHeader>
          {selectedCard && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Estado</p>
                  <Badge className={estadoColors[selectedCard.estado]}>{estadoLabels[selectedCard.estado]}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Saldo Actual</p>
                  <p className="font-bold text-lg">{formatCurrency(selectedCard.saldoActual)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Saldo Inicial</p>
                  <p className="font-medium">{formatCurrency(selectedCard.saldoInicial)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cliente</p>
                  <p className="font-medium">{selectedCard.clienteNombre || "Sin asignar"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sucursal</p>
                  <p className="font-medium">{selectedCard.sucursalNombre}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Emisor</p>
                  <p className="font-medium">{selectedCard.empleadoEmisorNombre}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Fecha de Emisión</p>
                  <p className="font-medium">{formatDate(selectedCard.fechaEmision)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Fecha de Expiración</p>
                  <p className="font-medium">{formatDate(selectedCard.fechaExpiracion)}</p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Historial de Transacciones</h4>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Monto</TableHead>
                        <TableHead>Saldo</TableHead>
                        <TableHead>Empleado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transacciones.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell>{formatDate(t.fecha)}</TableCell>
                          <TableCell className="capitalize">{t.tipo}</TableCell>
                          <TableCell>
                            {t.tipo === "canje" ? "-" : "+"}
                            {formatCurrency(t.monto)}
                          </TableCell>
                          <TableCell>{formatCurrency(t.saldoNuevo)}</TableCell>
                          <TableCell>{t.empleadoNombre}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
