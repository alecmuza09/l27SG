"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, MapPin, Phone, Mail, Clock, Edit, Trash2 } from "lucide-react"
import { MOCK_SUCURSALES } from "@/lib/data/sucursales"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export default function SucursalesPage() {
  const [sucursales] = useState(MOCK_SUCURSALES)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Sucursales</h1>
          <p className="text-muted-foreground">Gestiona las ubicaciones de Luna27</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Sucursal
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Nueva Sucursal</DialogTitle>
              <DialogDescription>Agrega una nueva ubicación de Luna27</DialogDescription>
            </DialogHeader>
            <form className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre</Label>
                  <Input id="nombre" placeholder="Luna27 Centro" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ciudad">Ciudad</Label>
                  <Input id="ciudad" placeholder="Ciudad de México" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="direccion">Dirección</Label>
                <Textarea id="direccion" placeholder="Av. Principal 123, Centro" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="telefono">Teléfono</Label>
                  <Input id="telefono" placeholder="+52 55 1234 5678" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="centro@luna27.com" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="horario">Horario</Label>
                <Input id="horario" placeholder="Lun-Sab: 9:00 - 20:00" />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Guardar Sucursal</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {sucursales.map((sucursal) => (
          <Card key={sucursal.id} className="relative overflow-hidden">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-xl">{sucursal.nombre}</CardTitle>
                  <CardDescription>{sucursal.ciudad}</CardDescription>
                </div>
                <Badge variant={sucursal.activa ? "default" : "secondary"}>
                  {sucursal.activa ? "Activa" : "Inactiva"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">{sucursal.direccion}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">{sucursal.telefono}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">{sucursal.email}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">{sucursal.horario}</span>
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t">
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

      <Card>
        <CardHeader>
          <CardTitle>Estadísticas por Sucursal</CardTitle>
          <CardDescription>Comparativa de rendimiento entre ubicaciones</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sucursales.map((sucursal, i) => {
              const stats = [
                { value: Math.floor(Math.random() * 50) + 20, max: 70 },
                { value: Math.floor(Math.random() * 30000) + 10000, max: 40000 },
                { value: Math.floor(Math.random() * 30) + 60, max: 100 },
              ]
              return (
                <div key={sucursal.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{sucursal.nombre}</span>
                    <div className="flex gap-6 text-sm text-muted-foreground">
                      <span>{stats[0].value} citas</span>
                      <span>${stats[1].value.toLocaleString()}</span>
                      <span>{stats[2].value}% ocupación</span>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${(stats[2].value / stats[2].max) * 100}%` }}
                    />
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
