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

export default function InventarioPage() {
  const [inventario, setInventario] = useState<ProductoInventario[]>([])
  const [productosBajoStock, setProductosBajoStock] = useState<ProductoInventario[]>([])
  const [productosProximosVencer, setProductosProximosVencer] = useState<ProductoInventario[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isMovimientoDialogOpen, setIsMovimientoDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadInventario() {
      try {
        setIsLoading(true)
        const [productosData, bajoStockData, proximosVencerData] = await Promise.all([
          getProductosInventarioFromDB(),
          getProductosBajoStockFromDB(),
          getProductosProximosVencerFromDB()
        ])
        setInventario(productosData)
        setProductosBajoStock(bajoStockData)
        setProductosProximosVencer(proximosVencerData)
      } catch (err) {
        console.error('Error cargando inventario:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadInventario()
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
            <DialogTrigger asChild>
              <Button variant="outline">
                <ArrowUpDown className="mr-2 h-4 w-4" />
                Movimiento
              </Button>
            </DialogTrigger>
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
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Producto
              </Button>
            </DialogTrigger>
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
                        <SelectItem value="productos">Productos</SelectItem>
                        <SelectItem value="insumos">Insumos</SelectItem>
                        <SelectItem value="equipamiento">Equipamiento</SelectItem>
                        <SelectItem value="limpieza">Limpieza</SelectItem>
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
            <div className="text-2xl font-bold text-orange-600">{stats.bajoStock}</div>
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

      {(productosBajoStock.length > 0 || productosProximosVencer.length > 0) && (
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
      )}

      <Tabs defaultValue="todos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="productos">Productos</TabsTrigger>
          <TabsTrigger value="insumos">Insumos</TabsTrigger>
          <TabsTrigger value="equipamiento">Equipamiento</TabsTrigger>
          <TabsTrigger value="limpieza">Limpieza</TabsTrigger>
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
                      <TableHead>Categoría</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Precio Compra</TableHead>
                      <TableHead>Proveedor</TableHead>
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
                            <div>
                              <p className="font-medium">{producto.nombre}</p>
                              <p className="text-xs text-muted-foreground">SKU: {producto.sku}</p>
                            </div>
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
                          <TableCell>
                            <span className="font-medium">${producto.precioCompra}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{producto.proveedor}</span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={status === "bajo" ? "destructive" : status === "alto" ? "default" : "secondary"}
                            >
                              {status === "bajo" ? "Bajo Stock" : status === "alto" ? "Stock Alto" : "Normal"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="icon">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
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

        {["productos", "insumos", "equipamiento", "limpieza"].map((categoria) => (
          <TabsContent key={categoria} value={categoria}>
            <Card>
              <CardHeader>
                <CardTitle className="capitalize">{categoria}</CardTitle>
                <CardDescription>Productos de la categoría {categoria}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead>Precio</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inventario
                        .filter((p) => p.categoria === categoria)
                        .map((producto) => {
                          const status = getStockStatus(producto)
                          return (
                            <TableRow key={producto.id}>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{producto.nombre}</p>
                                  <p className="text-xs text-muted-foreground">{producto.descripcion}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="font-medium">
                                  {producto.stockActual} {producto.unidadMedida}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className="font-medium">${producto.precioCompra}</span>
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
