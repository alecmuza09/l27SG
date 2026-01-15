"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { Switch } from "@/components/ui/switch"
import {
  Plus,
  Search,
  MoreHorizontal,
  Tag,
  Percent,
  DollarSign,
  Package,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
} from "lucide-react"
import { getSucursalesActivasFromDB, type Sucursal } from "@/lib/data/sucursales"
import {
  getPromocionesFromDB,
  getGarantias,
  saveGarantias,
  isPromocionVigente,
  type Promocion,
} from "@/lib/data/promociones"
import type { Promocion, Garantia } from "@/lib/types/promociones"

const tipoPromocionLabels: Record<Promocion["tipo"], string> = {
  porcentaje: "Porcentaje",
  monto_fijo: "Monto Fijo",
  paquete: "Paquete",
}

const tipoPromocionIcons: Record<Promocion["tipo"], typeof Percent> = {
  porcentaje: Percent,
  monto_fijo: DollarSign,
  paquete: Package,
}

const estadoGarantiaColors: Record<Garantia["estado"], string> = {
  pendiente: "bg-yellow-100 text-yellow-800",
  aprobada: "bg-green-100 text-green-800",
  rechazada: "bg-red-100 text-red-800",
  completada: "bg-blue-100 text-blue-800",
}

export default function PromocionesPage() {
  const [promociones, setPromociones] = useState<Promocion[]>([])
  const [garantias, setGarantias] = useState<Garantia[]>([])
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [filterTipo, setFilterTipo] = useState<string>("todos")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedPromo, setSelectedPromo] = useState<Promocion | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Form states
  const [formNombre, setFormNombre] = useState("")
  const [formDescripcion, setFormDescripcion] = useState("")
  const [formTipo, setFormTipo] = useState<Promocion["tipo"]>("porcentaje")
  const [formValor, setFormValor] = useState("")
  const [formFechaInicio, setFormFechaInicio] = useState("")
  const [formFechaFin, setFormFechaFin] = useState("")
  const [formCodigoPromo, setFormCodigoPromo] = useState("")
  const [formUsosMaximos, setFormUsosMaximos] = useState("")
  const [formActiva, setFormActiva] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true)
        const [promocionesData, sucursalesData] = await Promise.all([
          getPromocionesFromDB(),
          getSucursalesActivasFromDB()
        ])
        setPromociones(promocionesData)
        setGarantias(getGarantias()) // Garantías aún usan localStorage
        setSucursales(sucursalesData)
      } catch (err) {
        console.error('Error cargando promociones:', err)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [])

  const filteredPromociones = promociones.filter((promo) => {
    const matchesSearch =
      promo.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      promo.descripcion.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesTipo = filterTipo === "todos" || promo.tipo === filterTipo
    return matchesSearch && matchesTipo
  })

  // Estadísticas
  const totalPromociones = promociones.length
  const promocionesActivas = promociones.filter((p) => isPromocionVigente(p)).length
  const totalUsos = promociones.reduce((sum, p) => sum + p.usosActuales, 0)
  const garantiasPendientes = garantias.filter((g) => g.estado === "pendiente").length

  const resetForm = () => {
    setFormNombre("")
    setFormDescripcion("")
    setFormTipo("porcentaje")
    setFormValor("")
    setFormFechaInicio("")
    setFormFechaFin("")
    setFormCodigoPromo("")
    setFormUsosMaximos("")
    setFormActiva(true)
  }

  const handleCreatePromo = async () => {
    if (!formNombre || !formValor || !formFechaInicio || !formFechaFin) return

    // TODO: Implementar creación de promoción en Supabase
    // Por ahora recargamos desde BD
    const updatedPromociones = await getPromocionesFromDB()
    setPromociones(updatedPromociones)
    
    resetForm()
    setIsCreateDialogOpen(false)
  }

  const handleEditPromo = (promo: Promocion) => {
    setSelectedPromo(promo)
    setFormNombre(promo.nombre)
    setFormDescripcion(promo.descripcion)
    setFormTipo(promo.tipo)
    setFormValor(promo.valor.toString())
    setFormFechaInicio(promo.fechaInicio)
    setFormFechaFin(promo.fechaFin)
    setFormCodigoPromo(promo.codigoPromo || "")
    setFormUsosMaximos(promo.usosMaximos?.toString() || "")
    setFormActiva(promo.activa)
    setIsEditDialogOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!selectedPromo || !formNombre || !formValor) return

    // TODO: Implementar actualización de promoción en Supabase
    // Por ahora recargamos desde BD
    const updatedPromociones = await getPromocionesFromDB()
    setPromociones(updatedPromociones)
    
    resetForm()
    setSelectedPromo(null)
    setIsEditDialogOpen(false)
  }

  const handleDeletePromo = async (promoId: string) => {
    // TODO: Implementar eliminación de promoción en Supabase
    // Por ahora recargamos desde BD
    const updatedPromociones = await getPromocionesFromDB()
    setPromociones(updatedPromociones)
  }

  const handleToggleActiva = async (promoId: string) => {
    // TODO: Implementar toggle de activa en Supabase
    // Por ahora recargamos desde BD
    const updatedPromociones = await getPromocionesFromDB()
    setPromociones(updatedPromociones)
  }

  const handleGarantiaAction = (garantiaId: string, action: "aprobada" | "rechazada" | "completada") => {
    const updated = garantias.map((g) =>
      g.id === garantiaId
        ? {
            ...g,
            estado: action,
            fechaResolucion: new Date().toISOString(),
            autorizadoPorId: "e-1",
            autorizadoPorNombre: "Admin Luna27",
          }
        : g,
    )
    setGarantias(updated)
    saveGarantias(updated)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount)
  }

  const formatDate = (dateString: string) => {
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
          <p className="text-muted-foreground">Cargando promociones...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Promociones y Descuentos</h1>
          <p className="text-muted-foreground">Gestiona promociones, cortesías y garantías</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Promoción
        </Button>
      </div>

      {/* Estadísticas */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Promociones</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPromociones}</div>
            <p className="text-xs text-muted-foreground">configuradas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vigentes</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{promocionesActivas}</div>
            <p className="text-xs text-muted-foreground">activas ahora</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usos Totales</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsos}</div>
            <p className="text-xs text-muted-foreground">aplicaciones</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Garantías Pendientes</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{garantiasPendientes}</div>
            <p className="text-xs text-muted-foreground">por revisar</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="promociones" className="space-y-4">
        <TabsList>
          <TabsTrigger value="promociones">Promociones</TabsTrigger>
          <TabsTrigger value="garantias">
            Garantías
            {garantiasPendientes > 0 && (
              <Badge variant="destructive" className="ml-2">
                {garantiasPendientes}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="promociones">
          <Card>
            <CardHeader>
              <CardTitle>Lista de Promociones</CardTitle>
              <CardDescription>Administra descuentos y ofertas especiales</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar promoción..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={filterTipo} onValueChange={setFilterTipo}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filtrar por tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los tipos</SelectItem>
                    <SelectItem value="porcentaje">Porcentaje</SelectItem>
                    <SelectItem value="monto_fijo">Monto Fijo</SelectItem>
                    <SelectItem value="paquete">Paquete</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Vigencia</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Usos</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPromociones.map((promo) => {
                    const Icon = tipoPromocionIcons[promo.tipo]
                    const vigente = isPromocionVigente(promo)
                    return (
                      <TableRow key={promo.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{promo.nombre}</p>
                            <p className="text-xs text-muted-foreground">{promo.descripcion}</p>
                            {promo.codigoPromo && (
                              <Badge variant="outline" className="mt-1">
                                {promo.codigoPromo}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            {tipoPromocionLabels[promo.tipo]}
                          </div>
                        </TableCell>
                        <TableCell>
                          {promo.tipo === "porcentaje" ? `${promo.valor}%` : formatCurrency(promo.valor)}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{formatDate(promo.fechaInicio)}</p>
                            <p className="text-muted-foreground">a {formatDate(promo.fechaFin)}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {vigente ? (
                            <Badge className="bg-green-100 text-green-800">Vigente</Badge>
                          ) : promo.activa ? (
                            <Badge className="bg-gray-100 text-gray-800">Inactiva</Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800">Desactivada</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {promo.usosActuales}
                          {promo.usosMaximos && ` / ${promo.usosMaximos}`}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditPromo(promo)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggleActiva(promo.id)}>
                                {promo.activa ? (
                                  <>
                                    <XCircle className="mr-2 h-4 w-4" />
                                    Desactivar
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Activar
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDeletePromo(promo.id)} className="text-red-600">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="garantias">
          <Card>
            <CardHeader>
              <CardTitle>Solicitudes de Garantía</CardTitle>
              <CardDescription>Gestiona las garantías de servicios</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Servicio</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Fecha Solicitud</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {garantias.map((garantia) => (
                    <TableRow key={garantia.id}>
                      <TableCell className="font-medium">{garantia.clienteNombre}</TableCell>
                      <TableCell>{garantia.servicioNombre}</TableCell>
                      <TableCell>
                        <p className="max-w-[200px] truncate">{garantia.motivo}</p>
                      </TableCell>
                      <TableCell>{formatDate(garantia.fechaSolicitud)}</TableCell>
                      <TableCell>
                        <Badge className={estadoGarantiaColors[garantia.estado]}>
                          {garantia.estado.charAt(0).toUpperCase() + garantia.estado.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {garantia.estado === "pendiente" && (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600 bg-transparent"
                              onClick={() => handleGarantiaAction(garantia.id, "aprobada")}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 bg-transparent"
                              onClick={() => handleGarantiaAction(garantia.id, "rechazada")}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                        {garantia.estado === "aprobada" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleGarantiaAction(garantia.id, "completada")}
                          >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Completar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog: Crear/Editar Promoción */}
      <Dialog
        open={isCreateDialogOpen || isEditDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateDialogOpen(false)
            setIsEditDialogOpen(false)
            setSelectedPromo(null)
            resetForm()
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isEditDialogOpen ? "Editar Promoción" : "Nueva Promoción"}</DialogTitle>
            <DialogDescription>
              {isEditDialogOpen ? "Modifica los detalles de la promoción" : "Crea una nueva promoción o descuento"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input
                id="nombre"
                value={formNombre}
                onChange={(e) => setFormNombre(e.target.value)}
                placeholder="Ej: Paquete Relax"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <Textarea
                id="descripcion"
                value={formDescripcion}
                onChange={(e) => setFormDescripcion(e.target.value)}
                placeholder="Descripción de la promoción..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="tipo">Tipo *</Label>
                <Select value={formTipo} onValueChange={(v) => setFormTipo(v as Promocion["tipo"])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="porcentaje">Porcentaje</SelectItem>
                    <SelectItem value="monto_fijo">Monto Fijo</SelectItem>
                    <SelectItem value="paquete">Paquete</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="valor">{formTipo === "porcentaje" ? "Porcentaje *" : "Monto *"}</Label>
                <Input
                  id="valor"
                  type="number"
                  value={formValor}
                  onChange={(e) => setFormValor(e.target.value)}
                  placeholder={formTipo === "porcentaje" ? "15" : "200"}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="fechaInicio">Fecha Inicio *</Label>
                <Input
                  id="fechaInicio"
                  type="date"
                  value={formFechaInicio}
                  onChange={(e) => setFormFechaInicio(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="fechaFin">Fecha Fin *</Label>
                <Input
                  id="fechaFin"
                  type="date"
                  value={formFechaFin}
                  onChange={(e) => setFormFechaFin(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="codigoPromo">Código Promo</Label>
                <Input
                  id="codigoPromo"
                  value={formCodigoPromo}
                  onChange={(e) => setFormCodigoPromo(e.target.value.toUpperCase())}
                  placeholder="DESCUENTO20"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="usosMaximos">Usos Máximos</Label>
                <Input
                  id="usosMaximos"
                  type="number"
                  value={formUsosMaximos}
                  onChange={(e) => setFormUsosMaximos(e.target.value)}
                  placeholder="Sin límite"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch id="activa" checked={formActiva} onCheckedChange={setFormActiva} />
              <Label htmlFor="activa">Promoción Activa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false)
                setIsEditDialogOpen(false)
                resetForm()
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={isEditDialogOpen ? handleSaveEdit : handleCreatePromo}
              disabled={!formNombre || !formValor || !formFechaInicio || !formFechaFin}
            >
              {isEditDialogOpen ? "Guardar Cambios" : "Crear Promoción"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
