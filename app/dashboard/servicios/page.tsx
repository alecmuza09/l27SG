"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, Clock, DollarSign, Edit, Trash2, Tag, Loader2, Power } from "lucide-react"
import { getServiciosFromDB, createServicio, updateServicio, deleteServicio, type Servicio } from "@/lib/data/servicios"
import { toast } from "sonner"
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
import { getCurrentUser } from "@/lib/auth"

export default function ServiciosPage() {
  const currentUser = getCurrentUser()
  const isAdmin = currentUser?.role === "admin"
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingServicio, setEditingServicio] = useState<Servicio | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newServicioCategoria, setNewServicioCategoria] = useState("")
  const [servicioToDelete, setServicioToDelete] = useState<Servicio | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [editCategoria, setEditCategoria] = useState("")
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<"todos" | "activos" | "inactivos">("todos")

  const sortByActivo = (lista: Servicio[]) =>
    [...lista].sort((a, b) => Number(b.activo) - Number(a.activo))

  const loadServicios = async () => {
    try {
      setIsLoading(true)
      const serviciosData = await getServiciosFromDB()
      setServicios(sortByActivo(serviciosData))
    } catch (err) {
      console.error('Error cargando servicios:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadServicios()
  }, [])

  const handleEdit = (servicio: Servicio) => {
    setEditingServicio(servicio)
    setEditCategoria(servicio.categoria)
    setIsEditDialogOpen(true)
  }

  const handleUpdateServicio = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingServicio) return

    setIsSubmitting(true)
    try {
      const form = e.target as HTMLFormElement
      const formData = new FormData(form)
      
      const result = await updateServicio(editingServicio.id, {
        nombre: formData.get('edit-nombre') as string,
        descripcion: formData.get('edit-descripcion') as string || undefined,
        duracion: Number(formData.get('edit-duracion')),
        precio: Number(formData.get('edit-precio')),
        categoria: editCategoria || (formData.get('edit-categoria') as string),
        color: formData.get('edit-color') as string || undefined,
      })

      if (result.success) {
        toast.success('Servicio actualizado exitosamente')
        setIsEditDialogOpen(false)
        setEditingServicio(null)
        await loadServicios()
      } else {
        toast.error(`Error al actualizar servicio: ${result.error}`)
      }
    } catch (err: any) {
      console.error('Error actualizando servicio:', err)
      toast.error('Error inesperado al actualizar el servicio')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreateServicio = async (e: React.FormEvent) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const nombre = (form.querySelector('#nombre') as HTMLInputElement)?.value?.trim()
    const descripcion = (form.querySelector('#descripcion') as HTMLTextAreaElement)?.value?.trim() || undefined
    const duracion = Number((form.querySelector('#duracion') as HTMLInputElement)?.value)
    const precio = Number((form.querySelector('#precio') as HTMLInputElement)?.value)
    const color = (form.querySelector('#color') as HTMLInputElement)?.value || undefined
    if (!nombre || !newServicioCategoria || duracion < 1 || precio < 0) {
      toast.error('Completa nombre, categoría, duración y precio')
      return
    }
    setIsSubmitting(true)
    try {
      const result = await createServicio({
        nombre,
        descripcion: descripcion || null,
        duracion,
        precio,
        categoria: newServicioCategoria,
        color: color || null,
        activo: true,
      })
      if (result.success) {
        toast.success('Servicio creado correctamente')
        setIsDialogOpen(false)
        setNewServicioCategoria('')
        form.reset()
        await loadServicios()
      } else {
        toast.error(result.error || 'Error al crear el servicio')
      }
    } catch (err: any) {
      console.error('Error creando servicio:', err)
      toast.error('Error inesperado al crear el servicio')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleActivo = async (servicio: Servicio) => {
    setTogglingId(servicio.id)
    try {
      const result = await updateServicio(servicio.id, { activo: !servicio.activo })
      if (result.success) {
        toast.success(
          !servicio.activo
            ? 'Servicio activado correctamente'
            : 'Servicio desactivado correctamente',
        )
        await loadServicios()
      } else {
        toast.error(result.error || 'Error al cambiar el estado del servicio')
      }
    } catch (err: any) {
      console.error('Error cambiando estado del servicio:', err)
      toast.error('Error inesperado al cambiar el estado del servicio')
    } finally {
      setTogglingId(null)
    }
  }

  const handleDeleteServicio = async () => {
    if (!servicioToDelete) return
    setIsDeleting(true)
    try {
      const result = await deleteServicio(servicioToDelete.id)
      if (result.success) {
        toast.success('Servicio eliminado')
        setServicioToDelete(null)
        await loadServicios()
      } else {
        toast.error(result.error || 'Error al eliminar el servicio')
      }
    } catch (err: any) {
      console.error('Error eliminando servicio:', err)
      toast.error('Error inesperado al eliminar')
    } finally {
      setIsDeleting(false)
    }
  }

  const filteredServicios = servicios
    .filter((s) =>
      statusFilter === "activos" ? s.activo : statusFilter === "inactivos" ? !s.activo : true,
    )
    .filter(
      (s) =>
        !searchQuery ||
        s.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.categoria.toLowerCase().includes(searchQuery.toLowerCase()),
    )

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
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open)
            if (!open) setNewServicioCategoria('')
          }}>
          {isAdmin && (
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Servicio
              </Button>
            </DialogTrigger>
          )}
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Nuevo Servicio</DialogTitle>
              <DialogDescription>Agrega un nuevo servicio al catálogo</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateServicio} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre del Servicio *</Label>
                <Input id="nombre" name="nombre" placeholder="Masaje Relajante" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="descripcion">Descripción</Label>
                <Textarea id="descripcion" name="descripcion" placeholder="Descripción detallada del servicio..." rows={3} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="categoria">Categoría *</Label>
                  <Select value={newServicioCategoria} onValueChange={setNewServicioCategoria} required>
                    <SelectTrigger id="categoria">
                      <SelectValue placeholder="Seleccionar categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Manicure">Manicure</SelectItem>
                      <SelectItem value="Pedicure">Pedicure</SelectItem>
                      <SelectItem value="Facial">Facial</SelectItem>
                      <SelectItem value="Corporal">Corporal</SelectItem>
                      <SelectItem value="Masaje">Masaje</SelectItem>
                      <SelectItem value="Otros">Otros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="color">Color (opcional)</Label>
                  <Input id="color" name="color" type="color" defaultValue="#8b7355" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="duracion">Duración (minutos) *</Label>
                  <Input id="duracion" name="duracion" type="number" min="1" step="1" placeholder="60" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="precio">Precio *</Label>
                  <Input id="precio" name="precio" type="number" min="0" step="any" placeholder="850" required />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    'Guardar Servicio'
                  )}
                </Button>
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
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar servicios..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={statusFilter === "todos" ? "default" : "outline"}
                className={statusFilter === "todos" ? "" : "bg-transparent"}
                onClick={() => setStatusFilter("todos")}
              >
                Todos
              </Button>
              <Button
                type="button"
                size="sm"
                variant={statusFilter === "activos" ? "default" : "outline"}
                className={statusFilter === "activos" ? "" : "bg-transparent"}
                onClick={() => setStatusFilter("activos")}
              >
                Activos
              </Button>
              <Button
                type="button"
                size="sm"
                variant={statusFilter === "inactivos" ? "default" : "outline"}
                className={statusFilter === "inactivos" ? "" : "bg-transparent"}
                onClick={() => setStatusFilter("inactivos")}
              >
                Inactivos
              </Button>
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
                  {isAdmin && (
                    <div className="flex gap-2 pt-2 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 bg-transparent"
                        onClick={() => handleEdit(servicio)}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 bg-transparent"
                        onClick={() => setServicioToDelete(servicio)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className={
                          servicio.activo
                            ? "flex-1 bg-transparent text-green-600 border-green-600 hover:bg-green-50 hover:text-green-700"
                            : "flex-1 bg-transparent text-muted-foreground"
                        }
                        disabled={togglingId === servicio.id}
                        onClick={() => handleToggleActivo(servicio)}
                      >
                        {togglingId === servicio.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Power className="mr-2 h-4 w-4" />
                        )}
                        {servicio.activo ? "Activo" : "Inactivo"}
                      </Button>
                    </div>
                  )}
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

      {/* Diálogo de edición */}
      {editingServicio && (
        <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
          setIsEditDialogOpen(open)
          if (!open) {
            setEditingServicio(null)
            setEditCategoria('')
          }
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Editar Servicio</DialogTitle>
              <DialogDescription>Modifica la información del servicio</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdateServicio} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-nombre">Nombre del Servicio *</Label>
                <Input 
                  id="edit-nombre" 
                  name="edit-nombre"
                  defaultValue={editingServicio.nombre} 
                  required 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-descripcion">Descripción</Label>
                <Textarea 
                  id="edit-descripcion" 
                  name="edit-descripcion"
                  defaultValue={editingServicio.descripcion} 
                  rows={3} 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-categoria">Categoría *</Label>
                  <Select name="edit-categoria" value={editCategoria} onValueChange={setEditCategoria}>
                    <SelectTrigger id="edit-categoria">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Manicure">Manicure</SelectItem>
                      <SelectItem value="Pedicure">Pedicure</SelectItem>
                      <SelectItem value="Facial">Facial</SelectItem>
                      <SelectItem value="Corporal">Corporal</SelectItem>
                      <SelectItem value="Masaje">Masaje</SelectItem>
                      <SelectItem value="Otros">Otros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-color">Color (opcional)</Label>
                  <Input 
                    id="edit-color" 
                    name="edit-color"
                    type="color" 
                    defaultValue={editingServicio.color || "#8b7355"} 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-duracion">Duración (minutos) *</Label>
                  <Input 
                    id="edit-duracion" 
                    name="edit-duracion"
                    type="number" 
                    min="1" 
                    step="1" 
                    defaultValue={editingServicio.duracion} 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-precio">Precio *</Label>
                  <Input 
                    id="edit-precio" 
                    name="edit-precio"
                    type="number" 
                    min="0" 
                    step="any" 
                    defaultValue={editingServicio.precio} 
                    required 
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsEditDialogOpen(false)
                    setEditingServicio(null)
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    'Guardar Cambios'
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={!!servicioToDelete} onOpenChange={(open) => !open && setServicioToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar servicio?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente &quot;{servicioToDelete?.nombre}&quot;. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDeleteServicio()
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                'Eliminar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  )
}
