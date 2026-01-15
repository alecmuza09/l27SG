"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, Clock, DollarSign, Edit, Trash2, Tag, Loader2 } from "lucide-react"
import { getServiciosActivosFromDB, type Servicio } from "@/lib/data/servicios"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function ServiciosPage() {
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadServicios() {
      try {
        setIsLoading(true)
        const serviciosData = await getServiciosActivosFromDB()
        setServicios(serviciosData)
      } catch (err) {
        console.error('Error cargando servicios:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadServicios()
  }, [])

  const filteredServicios = searchQuery
    ? servicios.filter(
        (s) =>
          s.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.categoria.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : servicios

  const categorias = Array.from(new Set(servicios.map((s) => s.categoria)))

  const stats = {
    total: servicios.length,
    activos: servicios.filter((s) => s.activo).length,
    precioPromedio: servicios.length > 0 ? Math.round(servicios.reduce((acc, s) => acc + s.precio, 0) / servicios.length) : 0,
    duracionPromedio: servicios.length > 0 ? Math.round(servicios.reduce((acc, s) => acc + s.duracion, 0) / servicios.length) : 0,
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Cargando servicios...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Servicios</h1>
          <p className="text-muted-foreground">Gestiona el catálogo de servicios</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Servicio
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Nuevo Servicio</DialogTitle>
              <DialogDescription>Agrega un nuevo servicio al catálogo</DialogDescription>
            </DialogHeader>
            <form className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre del Servicio *</Label>
                <Input id="nombre" placeholder="Masaje Relajante" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="descripcion">Descripción</Label>
                <Textarea id="descripcion" placeholder="Descripción detallada del servicio..." rows={3} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="categoria">Categoría *</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="masajes">Masajes</SelectItem>
                      <SelectItem value="faciales">Faciales</SelectItem>
                      <SelectItem value="estetica">Estética</SelectItem>
                      <SelectItem value="tratamientos">Tratamientos</SelectItem>
                      <SelectItem value="otros">Otros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="color">Color (opcional)</Label>
                  <Input id="color" type="color" defaultValue="#8b7355" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="duracion">Duración (minutos) *</Label>
                  <Input id="duracion" type="number" min="15" step="15" placeholder="60" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="precio">Precio *</Label>
                  <Input id="precio" type="number" min="0" step="50" placeholder="850" required />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Guardar Servicio</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Servicios</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activos}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Precio Promedio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.precioPromedio}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Duración Promedio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.duracionPromedio} min</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Catálogo de Servicios</CardTitle>
          <CardDescription>Gestiona los servicios disponibles</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar servicios..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredServicios.map((servicio) => (
              <Card key={servicio.id} className="relative overflow-hidden">
                <div
                  className="absolute top-0 left-0 w-1 h-full"
                  style={{ backgroundColor: servicio.color || "#8b7355" }}
                />
                <CardHeader className="pl-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{servicio.nombre}</CardTitle>
                      <CardDescription className="mt-1">{servicio.descripcion}</CardDescription>
                    </div>
                    <Badge variant={servicio.activo ? "default" : "secondary"}>
                      {servicio.activo ? "Activo" : "Inactivo"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pl-6 space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{servicio.categoria}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{servicio.duracion} minutos</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-lg">${servicio.precio}</span>
                  </div>
                  <div className="flex gap-2 pt-2 border-t">
                    <Button variant="outline" size="sm" className="flex-1 bg-transparent">
                      <Edit className="mr-2 h-4 w-4" />
                      Editar
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 bg-transparent">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Eliminar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Servicios por Categoría</CardTitle>
          <CardDescription>Distribución de servicios</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {categorias.map((categoria) => {
              const serviciosCategoria = servicios.filter((s) => s.categoria === categoria)
              const totalIngresos = serviciosCategoria.reduce((acc, s) => acc + s.precio, 0)
              const percentage = (serviciosCategoria.length / servicios.length) * 100

              return (
                <div key={categoria} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium capitalize">{categoria}</span>
                    <div className="flex gap-4 text-muted-foreground">
                      <span>{serviciosCategoria.length} servicios</span>
                      <span className="font-semibold text-foreground">${totalIngresos.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
