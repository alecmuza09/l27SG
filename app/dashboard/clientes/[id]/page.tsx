"use client"

import { use, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Calendar,
  DollarSign,
  Award,
  Edit,
  Trash2,
  Gift,
  AlertCircle,
  Heart,
  Loader2,
} from "lucide-react"
import { getClienteById, type Cliente } from "@/lib/data/clientes"
import Link from "next/link"
import { Separator } from "@/components/ui/separator"

export default function ClienteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadCliente() {
      try {
        setIsLoading(true)
        setError(null)
        const clienteData = await getClienteById(id)
        if (!clienteData) {
          setError('Cliente no encontrado')
        } else {
          setCliente(clienteData)
        }
      } catch (err) {
        console.error('Error cargando cliente:', err)
        setError('Error al cargar el cliente')
      } finally {
        setIsLoading(false)
      }
    }

    loadCliente()
  }, [id])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Cargando cliente...</p>
        </div>
      </div>
    )
  }

  if (error || !cliente) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Cliente no encontrado</CardTitle>
            <CardDescription>{error || 'El cliente que buscas no existe'}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/dashboard/clientes">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver a Clientes
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const historialCitas = [
    {
      id: "1",
      fecha: "2024-01-10",
      servicio: "Masaje Relajante",
      empleado: "María González",
      duracion: "60 min",
      costo: 850,
      estado: "completada",
    },
    {
      id: "2",
      fecha: "2023-12-20",
      servicio: "Facial Hidratante",
      empleado: "Laura Martínez",
      duracion: "45 min",
      costo: 650,
      estado: "completada",
    },
    {
      id: "3",
      fecha: "2023-12-05",
      servicio: "Aromaterapia",
      empleado: "María González",
      duracion: "90 min",
      costo: 1200,
      estado: "completada",
    },
    {
      id: "4",
      fecha: "2023-11-18",
      servicio: "Masaje Relajante",
      empleado: "Carmen López",
      duracion: "60 min",
      costo: 850,
      estado: "completada",
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/clientes">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {cliente.nombre} {cliente.apellido}
            </h1>
            <p className="text-muted-foreground">Perfil del cliente</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Edit className="mr-2 h-4 w-4" />
            Editar
          </Button>
          <Button variant="outline">
            <Trash2 className="mr-2 h-4 w-4" />
            Eliminar
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Información Personal</CardTitle>
              <Badge variant={cliente.estado === "vip" ? "default" : "secondary"}>{cliente.estado.toUpperCase()}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-center">
              <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-3xl font-bold text-primary">
                  {cliente.nombre.charAt(0)}
                  {cliente.apellido.charAt(0)}
                </span>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              {cliente.email && (
                <div className="flex items-start gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="text-sm font-medium">{cliente.email}</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Teléfono</p>
                  <p className="text-sm font-medium">{cliente.telefono}</p>
                </div>
              </div>

              {cliente.direccion && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Dirección</p>
                    <p className="text-sm font-medium">{cliente.direccion}</p>
                    {cliente.ciudad && <p className="text-xs text-muted-foreground">{cliente.ciudad}</p>}
                  </div>
                </div>
              )}

              {cliente.fechaNacimiento && (
                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Fecha de Nacimiento</p>
                    <p className="text-sm font-medium">
                      {new Date(cliente.fechaNacimiento).toLocaleDateString("es-MX", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Fecha de Registro</p>
              <p className="text-sm font-medium">
                {new Date(cliente.fechaRegistro).toLocaleDateString("es-MX", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>

            {cliente.notas && (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Notas</p>
                  <p className="text-sm">{cliente.notas}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="md:col-span-2 space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Total Visitas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{cliente.totalVisitas}</div>
                {cliente.ultimaVisita && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Última: {new Date(cliente.ultimaVisita).toLocaleDateString("es-MX")}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Total Gastado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${cliente.totalGastado.toLocaleString()}</div>
                {cliente.totalVisitas > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Promedio: ${Math.round(cliente.totalGastado / cliente.totalVisitas).toLocaleString()}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  Puntos Fidelidad
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{cliente.puntosFidelidad}</div>
                <Button variant="link" className="h-auto p-0 text-xs mt-1">
                  <Gift className="h-3 w-3 mr-1" />
                  Canjear puntos
                </Button>
              </CardContent>
            </Card>
          </div>

          {cliente.preferencias && cliente.preferencias.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Heart className="h-4 w-4" />
                  Preferencias
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {cliente.preferencias.map((pref, i) => (
                    <Badge key={i} variant="secondary">
                      {pref}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {cliente.alergias && cliente.alergias.length > 0 && (
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-orange-900">
                  <AlertCircle className="h-4 w-4" />
                  Alergias
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {cliente.alergias.map((alergia, i) => (
                    <Badge key={i} variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">
                      {alergia}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Historial de Citas</CardTitle>
              <CardDescription>Últimas visitas del cliente</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {historialCitas.map((cita) => (
                  <div key={cita.id} className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium">{cita.servicio}</p>
                        <Badge variant="outline">{cita.estado}</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(cita.fecha).toLocaleDateString("es-MX")}
                        </span>
                        <span>{cita.empleado}</span>
                        <span>{cita.duracion}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">${cita.costo}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
