"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Plus,
  Search,
  Package,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Edit,
  Trash2,
  ArrowUpDown,
  Calendar,
  Loader2,
} from "lucide-react"
import { 
  getProductosInventarioFromDB, 
  getProductosBajoStockFromDB, 
  getProductosProximosVencerFromDB,
  getStockPorSucursal,
  upsertStock,
  type ProductoInventario 
} from "@/lib/data/inventario"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase/client"

export default function InventarioPage() {
  const currentUser = getCurrentUser()
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin'
  const isBranchAdmin = currentUser?.role === 'branch-admin'
  const sucursalId = currentUser?.sucursalId ?? null
  const [inventario, setInventario] = useState<ProductoInventario[]>([])
  const [productosBajoStock, setProductosBajoStock] = useState<ProductoInventario[]>([])
  const [productosProximosVencer, setProductosProximosVencer] = useState<ProductoInventario[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [searchQueryCategoria, setSearchQueryCategoria] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isMovimientoDialogOpen, setIsMovimientoDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isEditStockOpen, setIsEditStockOpen] = useState(false)
  const [editStockActual, setEditStockActual] = useState(0)
  const [editStockMinimo, setEditStockMinimo] = useState(0)
  const [editPrecio, setEditPrecio] = useState(0)
  const [productoEditando, setProductoEditando] = useState<ProductoInventario | null>(null)
  const [editForm, setEditForm] = useState({
    nombre: '',
    descripcion: '',
    categoria: '' as ProductoInventario['categoria'],
    sku: '',
    stockActual: 0,
    stockMinimo: 0,
    unidadMedida: '',
  })

  async function loadInventario() {
    try {
      setIsLoading(true)
      if (isAdmin) {
        const [productosData, bajoStockData, proximosVencerData] = await Promise.all([
          getProductosInventarioFromDB(),
          getProductosBajoStockFromDB(),
          getProductosProximosVencerFromDB(),
        ])
        setInventario(productosData)
        setProductosBajoStock(bajoStockData)
        setProductosProximosVencer(proximosVencerData)
      } else if (sucursalId) {
        const productosData = await getStockPorSucursal(sucursalId)
        setInventario(productosData)
      }
    } catch (err) {
      console.error('Error cargando inventario:', err)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!productoEditando) return
    await supabase.from('inventario_productos').update({
      nombre: editForm.nombre,
      descripcion: editForm.descripcion,
      categoria: editForm.categoria,
      sku: editForm.sku,
      stock_actual: editForm.stockActual,
      stock_minimo: editForm.stockMinimo,
      unidad_medida: editForm.unidadMedida,
      precio_compra: editPrecio,
    }).eq('id', productoEditando.id)
    setInventario(prev => prev.map(p =>
      p.id === productoEditando.id
        ? {
            ...p,
            nombre: editForm.nombre,
            descripcion: editForm.descripcion,
            categoria: editForm.categoria,
            sku: editForm.sku,
            stockActual: editForm.stockActual,
            stockMinimo: editForm.stockMinimo,
            unidadMedida: editForm.unidadMedida,
            precioCompra: editPrecio,
          }
        : p
    ))
    setIsEditDialogOpen(false)
    setProductoEditando(null)
  }

  useEffect(() => {
    loadInventario()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filteredInventario = searchQuery
    ? inventario.filter(
        (p) =>
          p.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.categoria.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : inventario

  const stats = {
    totalProductos: inventario.length,
    bajoStock: productosBajoStock.length,
    proximosVencer: productosProximosVencer.length,
    valorTotal: inventario.reduce((acc, p) => acc + p.stockActual * p.precioCompra, 0),
  }

  const getStockStatus = (producto: (typeof inventario)[0]) => {
    if (producto.stockActual <= producto.stockMinimo) return "bajo"
    if (producto.stockActual >= producto.stockMaximo) return "alto"
    return "normal"
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Cargando inventario...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Inventario</h1>
          <p className="text-muted-foreground">Control de productos e insumos</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isMovimientoDialogOpen} onOpenChange={setIsMovimientoDialogOpen}>
            {isAdmin && (
              <DialogTrigger asChild>
                <Button variant="outline">
                  <ArrowUpDown className="mr-2 h-4 w-4" />
                  Movimiento
                </Button>
              </DialogTrigger>
            )}
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Registrar Movimiento</DialogTitle>
                <DialogDescription>Entrada, salida o ajuste de inventario</DialogDescription>
              </DialogHeader>
              <form className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tipoMovimiento">Tipo de Movimiento *</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entrada">Entrada (Compra)</SelectItem>
                      <SelectItem value="salida">Salida (Uso)</SelectItem>
                      <SelectItem value="ajuste">Ajuste de Inventario</SelectItem>
                      <SelectItem value="transferencia">Transferencia entre Sucursales</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="producto">Producto *</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar producto" />
                    </SelectTrigger>
                    <SelectContent>
                      {inventario.map((producto) => (
                        <SelectItem key={producto.id} value={producto.id}>
                          {producto.nombre} - Stock: {producto.stockActual}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cantidad">Cantidad *</Label>
                    <Input id="cantidad" type="number" min="1" placeholder="10" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="costo">Costo (opcional)</Label>
                    <Input id="costo" type="number" min="0" step="0.01" placeholder="0.00" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="motivo">Motivo *</Label>
                  <Textarea id="motivo" placeholder="Razón del movimiento..." rows={3} required />
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsMovimientoDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">Registrar Movimiento</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            {isAdmin && (
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo Producto
                </Button>
              </DialogTrigger>
            )}
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nuevo Producto</DialogTitle>
                <DialogDescription>Agrega un nuevo producto al inventario</DialogDescription>
              </DialogHeader>
              <form className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nombre">Nombre *</Label>
                    <Input id="nombre" placeholder="Aceite de Masaje" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sku">SKU *</Label>
                    <Input id="sku" placeholder="ACE-MAS-001" required />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="descripcion">Descripción</Label>
                  <Textarea id="descripcion" placeholder="Descripción del producto..." rows={2} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="categoria">Categoría *</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Tratamientos Spa">Tratamientos Spa</SelectItem>
                        <SelectItem value="Herramientas y Equipo">Herramientas y Equipo</SelectItem>
                        <SelectItem value="Acrílicos">Acrílicos</SelectItem>
                        <SelectItem value="Uñas y Aplicación">Uñas y Aplicación</SelectItem>
                        <SelectItem value="Insumos y Desechables">Insumos y Desechables</SelectItem>
                        <SelectItem value="Accesorios de Servicio">Accesorios de Servicio</SelectItem>
                        <SelectItem value="Retail y Consumo">Retail y Consumo</SelectItem>
                        <SelectItem value="Limpieza y Mantenimiento">Limpieza y Mantenimiento</SelectItem>
                        <SelectItem value="Papelería">Papelería</SelectItem>
                        <SelectItem value="Mobiliario y Equipo">Mobiliario y Equipo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unidadMedida">Unidad de Medida *</Label>
                    <Input id="unidadMedida" placeholder="botella 500ml" required />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="stockActual">Stock Actual *</Label>
                    <Input id="stockActual" type="number" min="0" placeholder="0" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stockMinimo">Stock Mínimo *</Label>
                    <Input id="stockMinimo" type="number" min="0" placeholder="10" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stockMaximo">Stock Máximo *</Label>
                    <Input id="stockMaximo" type="number" min="0" placeholder="50" required />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="precioCompra">Precio Compra *</Label>
                    <Input id="precioCompra" type="number" min="0" step="0.01" placeholder="0.00" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="precioVenta">Precio Venta</Label>
                    <Input id="precioVenta" type="number" min="0" step="0.01" placeholder="0.00" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="proveedor">Proveedor *</Label>
                    <Input id="proveedor" placeholder="Nombre del proveedor" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ubicacion">Ubicación</Label>
                    <Input id="ubicacion" placeholder="Almacén A - Estante 1" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fechaVencimiento">Fecha de Vencimiento</Label>
                  <Input id="fechaVencimiento" type="date" />
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">Guardar Producto</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Producto</DialogTitle>
            <DialogDescription>Modifica los datos del producto</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-nombre">Nombre *</Label>
                <Input
                  id="edit-nombre"
                  value={editForm.nombre}
                  onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-sku">SKU *</Label>
                <Input
                  id="edit-sku"
                  value={editForm.sku}
                  onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-descripcion">Descripción</Label>
              <Textarea
                id="edit-descripcion"
                value={editForm.descripcion}
                onChange={(e) => setEditForm({ ...editForm, descripcion: e.target.value })}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-categoria">Categoría *</Label>
                <Select
                  value={editForm.categoria}
                  onValueChange={(v) => setEditForm({ ...editForm, categoria: v as ProductoInventario['categoria'] })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Tratamientos Spa">Tratamientos Spa</SelectItem>
                    <SelectItem value="Herramientas y Equipo">Herramientas y Equipo</SelectItem>
                    <SelectItem value="Acrílicos">Acrílicos</SelectItem>
                    <SelectItem value="Uñas y Aplicación">Uñas y Aplicación</SelectItem>
                    <SelectItem value="Insumos y Desechables">Insumos y Desechables</SelectItem>
                    <SelectItem value="Accesorios de Servicio">Accesorios de Servicio</SelectItem>
                    <SelectItem value="Retail y Consumo">Retail y Consumo</SelectItem>
                    <SelectItem value="Limpieza y Mantenimiento">Limpieza y Mantenimiento</SelectItem>
                    <SelectItem value="Papelería">Papelería</SelectItem>
                    <SelectItem value="Mobiliario y Equipo">Mobiliario y Equipo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-unidadMedida">Unidad de Medida *</Label>
                <Input
                  id="edit-unidadMedida"
                  value={editForm.unidadMedida}
                  onChange={(e) => setEditForm({ ...editForm, unidadMedida: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-stockActual">Stock Actual *</Label>
                <Input
                  id="edit-stockActual"
                  type="number"
                  min="0"
                  value={editForm.stockActual}
                  onChange={(e) => setEditForm({ ...editForm, stockActual: Number(e.target.value) })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-stockMinimo">Stock Mínimo *</Label>
                <Input
                  id="edit-stockMinimo"
                  type="number"
                  min="0"
                  value={editForm.stockMinimo}
                  onChange={(e) => setEditForm({ ...editForm, stockMinimo: Number(e.target.value) })}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Precio de Compra</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={editPrecio}
                onChange={e => setEditPrecio(Number(e.target.value))}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Guardar Cambios</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditStockOpen} onOpenChange={setIsEditStockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Actualizar Stock</DialogTitle>
            <DialogDescription>{productoEditando?.nombre}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Stock Actual</Label>
              <Input
                type="number"
                min="0"
                value={editStockActual}
                onChange={(e) => setEditStockActual(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Stock Mínimo</Label>
              <Input
                type="number"
                min="0"
                value={editStockMinimo}
                onChange={(e) => setEditStockMinimo(Number(e.target.value))}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditStockOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={async () => {
                  if (!productoEditando || !sucursalId) return
                  await upsertStock(productoEditando.id, sucursalId, editStockActual, editStockMinimo)
                  setIsEditStockOpen(false)
                  await loadInventario()
                }}
              >
                Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4" />
              Total Productos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProductos}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Bajo Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">—</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Próximos a Vencer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.proximosVencer}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Valor Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.valorTotal.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* (productosBajoStock.length > 0 || productosProximosVencer.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {productosBajoStock.length > 0 && (
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-orange-900">
                  <AlertTriangle className="h-4 w-4" />
                  Alertas de Stock Bajo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {productosBajoStock.map((producto) => (
                    <div
                      key={producto.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-white border border-orange-200"
                    >
                      <div>
                        <p className="font-medium text-orange-900">{producto.nombre}</p>
                        <p className="text-xs text-orange-700">
                          Stock: {producto.stockActual} / Mínimo: {producto.stockMinimo}
                        </p>
                      </div>
                      <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">
                        Bajo
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {productosProximosVencer.length > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-red-900">
                  <Calendar className="h-4 w-4" />
                  Próximos a Vencer
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {productosProximosVencer.map((producto) => (
                    <div
                      key={producto.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-white border border-red-200"
                    >
                      <div>
                        <p className="font-medium text-red-900">{producto.nombre}</p>
                        <p className="text-xs text-red-700">
                          Vence:{" "}
                          {producto.fechaVencimiento && new Date(producto.fechaVencimiento).toLocaleDateString("es-MX")}
                        </p>
                      </div>
                      <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
                        Urgente
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) */}

      <Tabs defaultValue="todos" className="space-y-4" onValueChange={() => setSearchQueryCategoria("")}>
        <TabsList>
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="Tratamientos Spa">Tratamientos Spa</TabsTrigger>
          <TabsTrigger value="Herramientas y Equipo">Herramientas y Equipo</TabsTrigger>
          <TabsTrigger value="Acrílicos">Acrílicos</TabsTrigger>
          <TabsTrigger value="Uñas y Aplicación">Uñas y Aplicación</TabsTrigger>
          <TabsTrigger value="Insumos y Desechables">Insumos y Desechables</TabsTrigger>
          <TabsTrigger value="Accesorios de Servicio">Accesorios de Servicio</TabsTrigger>
          <TabsTrigger value="Retail y Consumo">Retail y Consumo</TabsTrigger>
          <TabsTrigger value="Limpieza y Mantenimiento">Limpieza y Mantenimiento</TabsTrigger>
          <TabsTrigger value="Papelería">Papelería</TabsTrigger>
          <TabsTrigger value="Mobiliario y Equipo">Mobiliario y Equipo</TabsTrigger>
        </TabsList>

        <TabsContent value="todos">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Inventario Completo</CardTitle>
                  <CardDescription>Todos los productos e insumos</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre, SKU o categoría..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Precio</TableHead>
                      <TableHead>Venta</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInventario.map((producto) => {
                      const status = getStockStatus(producto)
                      return (
                        <TableRow key={producto.id}>
                          <TableCell>
                            <p className="font-medium">{producto.nombre}</p>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm font-mono">
                            {producto.sku || '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {producto.categoria}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                {status === "bajo" && <TrendingDown className="h-4 w-4 text-orange-600" />}
                                {status === "alto" && <TrendingUp className="h-4 w-4 text-blue-600" />}
                                <span className="font-medium">{producto.stockActual}</span>
                                <span className="text-xs text-muted-foreground">{producto.unidadMedida}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Min: {producto.stockMinimo} / Max: {producto.stockMaximo}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            {producto.precioCompra > 0 ? `$${producto.precioCompra.toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : '—'}
                          </TableCell>
                          <TableCell>
                            {isAdmin && (
                              <button
                                title={producto.disponibleVenta ? "Quitar de ventas" : "Agregar a ventas"}
                                onClick={async () => {
                                  setInventario(prev => prev.map(p =>
                                    p.id === producto.id
                                      ? { ...p, disponibleVenta: !p.disponibleVenta }
                                      : p
                                  ))
                                  await supabase
                                    .from('inventario_productos')
                                    .update({ disponible_venta: !producto.disponibleVenta })
                                    .eq('id', producto.id)
                                }}
                                className={`w-10 h-6 rounded-full transition-colors duration-200 flex items-center px-1 ${
                                  producto.disponibleVenta
                                    ? 'bg-green-500 justify-end'
                                    : 'bg-gray-300 justify-start'
                                }`}
                              >
                                <span className="w-4 h-4 bg-white rounded-full shadow" />
                              </button>
                            )}
                            {!isAdmin && (
                              <span className={`text-xs font-medium ${producto.disponibleVenta ? 'text-green-600' : 'text-muted-foreground'}`}>
                                {producto.disponibleVenta ? '✓' : '—'}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={status === "bajo" ? "destructive" : status === "alto" ? "default" : "secondary"}
                            >
                              {status === "bajo" ? "Bajo Stock" : status === "alto" ? "Stock Alto" : "Normal"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {isAdmin && (
                              <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="icon" onClick={() => {
                                  setProductoEditando(producto)
                                  setEditForm({
                                    nombre: producto.nombre,
                                    descripcion: producto.descripcion,
                                    categoria: producto.categoria,
                                    sku: producto.sku,
                                    stockActual: producto.stockActual,
                                    stockMinimo: producto.stockMinimo,
                                    unidadMedida: producto.unidadMedida,
                                  })
                                  setEditPrecio(producto.precioCompra ?? 0)
                                  setIsEditDialogOpen(true)
                                }}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                            {isBranchAdmin && (
                              <Button variant="ghost" size="icon" title="Actualizar stock" onClick={() => {
                                setProductoEditando(producto)
                                setEditStockActual(producto.stockActual)
                                setEditStockMinimo(producto.stockMinimo)
                                setIsEditStockOpen(true)
                              }}>
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {[
          "Tratamientos Spa",
          "Herramientas y Equipo",
          "Acrílicos",
          "Uñas y Aplicación",
          "Insumos y Desechables",
          "Accesorios de Servicio",
          "Retail y Consumo",
          "Limpieza y Mantenimiento",
          "Papelería",
          "Mobiliario y Equipo",
        ].map((categoria) => (
          <TabsContent key={categoria} value={categoria}>
            <Card>
              <CardHeader>
                <CardTitle>{categoria}</CardTitle>
                <CardDescription>Productos de la categoría {categoria}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nombre, SKU o descripción..."
                      value={searchQueryCategoria}
                      onChange={(e) => setSearchQueryCategoria(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead>Precio</TableHead>
                        <TableHead>Venta</TableHead>
                        <TableHead>Estado</TableHead>
                        {(isAdmin || isBranchAdmin) && <TableHead className="text-right">Acciones</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inventario
                        .filter((p) => p.categoria === categoria)
                        .filter((p) =>
                          searchQueryCategoria === "" ||
                          p.nombre.toLowerCase().includes(searchQueryCategoria.toLowerCase()) ||
                          p.sku.toLowerCase().includes(searchQueryCategoria.toLowerCase()) ||
                          (p.descripcion && p.descripcion.toLowerCase().includes(searchQueryCategoria.toLowerCase()))
                        )
                        .map((producto) => {
                          const status = getStockStatus(producto)
                          return (
                            <TableRow key={producto.id}>
                              <TableCell>
                                <p className="font-medium">{producto.nombre}</p>
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm font-mono">
                                {producto.sku || '—'}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{producto.categoria}</Badge>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    {status === "bajo" && <TrendingDown className="h-4 w-4 text-orange-600" />}
                                    {status === "alto" && <TrendingUp className="h-4 w-4 text-blue-600" />}
                                    <span className="font-medium">{producto.stockActual}</span>
                                    <span className="text-xs text-muted-foreground">{producto.unidadMedida}</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    Min: {producto.stockMinimo} / Max: {producto.stockMaximo}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell className="font-medium">
                                {producto.precioCompra > 0 ? `$${producto.precioCompra.toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : '—'}
                              </TableCell>
                              <TableCell>
                                {isAdmin && (
                                  <button
                                    title={producto.disponibleVenta ? "Quitar de ventas" : "Agregar a ventas"}
                                    onClick={async () => {
                                      setInventario(prev => prev.map(p =>
                                        p.id === producto.id
                                          ? { ...p, disponibleVenta: !p.disponibleVenta }
                                          : p
                                      ))
                                      await supabase
                                        .from('inventario_productos')
                                        .update({ disponible_venta: !producto.disponibleVenta })
                                        .eq('id', producto.id)
                                    }}
                                    className={`w-10 h-6 rounded-full transition-colors duration-200 flex items-center px-1 ${
                                      producto.disponibleVenta
                                        ? 'bg-green-500 justify-end'
                                        : 'bg-gray-300 justify-start'
                                    }`}
                                  >
                                    <span className="w-4 h-4 bg-white rounded-full shadow" />
                                  </button>
                                )}
                                {!isAdmin && (
                                  <span className={`text-xs font-medium ${producto.disponibleVenta ? 'text-green-600' : 'text-muted-foreground'}`}>
                                    {producto.disponibleVenta ? '✓' : '—'}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    status === "bajo" ? "destructive" : status === "alto" ? "default" : "secondary"
                                  }
                                >
                                  {status === "bajo" ? "Bajo Stock" : status === "alto" ? "Stock Alto" : "Normal"}
                                </Badge>
                              </TableCell>
                              {(isAdmin || isBranchAdmin) && (
                                <TableCell className="text-right">
                                  {isAdmin && (
                                    <Button variant="ghost" size="icon" onClick={() => {
                                      setProductoEditando(producto)
                                      setEditForm({
                                        nombre: producto.nombre,
                                        descripcion: producto.descripcion,
                                        categoria: producto.categoria,
                                        sku: producto.sku,
                                        stockActual: producto.stockActual,
                                        stockMinimo: producto.stockMinimo,
                                        unidadMedida: producto.unidadMedida,
                                      })
                                      setEditPrecio(producto.precioCompra ?? 0)
                                      setIsEditDialogOpen(true)
                                    }}>
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {isBranchAdmin && (
                                    <Button variant="ghost" size="icon" title="Actualizar stock" onClick={() => {
                                      setProductoEditando(producto)
                                      setEditStockActual(producto.stockActual)
                                      setEditStockMinimo(producto.stockMinimo)
                                      setIsEditStockOpen(true)
                                    }}>
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  )}
                                </TableCell>
                              )}
                            </TableRow>
                          )
                        })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
