"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, Package, ShieldAlert, Check, X, Pencil } from "lucide-react"
import { getCurrentUser, effectivePrimarySucursalId, usuarioPuedeVerStockSucursal } from "@/lib/auth"
import { getSucursalByIdFromDB } from "@/lib/data/sucursales"
import { getStockPorSucursal, actualizarCampoStockSucursal, type ProductoInventario } from "@/lib/data/inventario"

type CampoEditable = "actual" | "minimo"

function fmtMXN(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n)
}

function getEstadoStock(p: ProductoInventario): "sin-stock" | "bajo" | "normal" {
  if (p.stockActual <= 0) return "sin-stock"
  if (p.stockActual <= p.stockMinimo) return "bajo"
  return "normal"
}

function EstadoBadge({ producto }: { producto: ProductoInventario }) {
  const estado = getEstadoStock(producto)
  if (estado === "sin-stock") {
    return <Badge variant="destructive">Sin stock</Badge>
  }
  if (estado === "bajo") {
    return (
      <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">
        Stock bajo
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
      OK
    </Badge>
  )
}

export default function InventarioSucursalPage() {
  const [autorizado, setAutorizado] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [sucursalId, setSucursalId] = useState<string | null>(null)
  const [sucursalNombre, setSucursalNombre] = useState("")
  const [productos, setProductos] = useState<ProductoInventario[]>([])

  const [editing, setEditing] = useState<{ id: string; campo: CampoEditable } | null>(null)
  const [editValue, setEditValue] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  async function cargarDatos(sId: string) {
    setIsLoading(true)
    try {
      const [sucursal, data] = await Promise.all([
        getSucursalByIdFromDB(sId),
        getStockPorSucursal(sId),
      ])
      setSucursalNombre(sucursal?.nombre ?? "")
      setProductos(data)
    } catch (err) {
      console.error("Error cargando stock por sucursal:", err)
      toast.error("Error cargando el inventario de la sucursal")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    async function init() {
      const user = getCurrentUser()
      const permitido = usuarioPuedeVerStockSucursal(user)
      setAutorizado(permitido)

      if (!permitido) {
        setIsLoading(false)
        return
      }

      const sId = effectivePrimarySucursalId(user)
      if (!sId) {
        setIsLoading(false)
        return
      }
      setSucursalId(sId)
      await cargarDatos(sId)
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function iniciarEdicion(producto: ProductoInventario, campo: CampoEditable) {
    setEditing({ id: producto.id, campo })
    setEditValue(String(campo === "actual" ? producto.stockActual : producto.stockMinimo))
  }

  function cancelarEdicion() {
    setEditing(null)
    setEditValue("")
  }

  async function guardarEdicion(producto: ProductoInventario) {
    if (!editing || !sucursalId) return
    const valorNumerico = Math.max(0, Math.trunc(Number(editValue)))
    if (Number.isNaN(valorNumerico)) {
      toast.error("Ingresa un número válido")
      return
    }

    setIsSaving(true)
    try {
      const { stockActual, stockMinimo } = await actualizarCampoStockSucursal(
        producto.id,
        sucursalId,
        editing.campo,
        valorNumerico,
      )
      setProductos((prev) =>
        prev.map((p) => (p.id === producto.id ? { ...p, stockActual, stockMinimo } : p)),
      )
      toast.success("Stock actualizado")
    } catch (err) {
      console.error("Error actualizando stock:", err)
      toast.error("No se pudo actualizar el stock")
    } finally {
      setIsSaving(false)
      setEditing(null)
      setEditValue("")
    }
  }

  function CeldaStockEditable({ producto, campo }: { producto: ProductoInventario; campo: CampoEditable }) {
    const valorActual = campo === "actual" ? producto.stockActual : producto.stockMinimo
    const estaEditando = editing?.id === producto.id && editing.campo === campo

    if (estaEditando) {
      return (
        <div className="flex items-center gap-1">
          <Input
            type="number"
            min="0"
            value={editValue}
            autoFocus
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") guardarEdicion(producto)
              if (e.key === "Escape") cancelarEdicion()
            }}
            className="h-8 w-20 text-sm"
            disabled={isSaving}
          />
          <button
            type="button"
            onClick={() => guardarEdicion(producto)}
            disabled={isSaving}
            className="p-1 rounded text-emerald-600 hover:bg-emerald-50"
            title="Guardar"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={cancelarEdicion}
            disabled={isSaving}
            className="p-1 rounded text-muted-foreground hover:bg-muted"
            title="Cancelar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )
    }

    return (
      <button
        type="button"
        onClick={() => iniciarEdicion(producto, campo)}
        className="group flex items-center gap-1.5 font-medium hover:text-violet-700"
        title="Editar"
      >
        {valorActual}
        <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60" />
      </button>
    )
  }

  function TablaProductos({ lista }: { lista: ProductoInventario[] }) {
    if (lista.length === 0) {
      return <p className="text-sm text-muted-foreground py-6 text-center">Sin productos en esta sección.</p>
    }
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead>Stock actual</TableHead>
              <TableHead>Stock mínimo</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lista.map((producto) => (
              <TableRow key={producto.id}>
                <TableCell className="font-medium">{producto.nombre}</TableCell>
                <TableCell className="text-muted-foreground">
                  {fmtMXN(producto.precioVenta ?? producto.precioCompra ?? 0)}
                </TableCell>
                <TableCell>
                  <CeldaStockEditable producto={producto} campo="actual" />
                </TableCell>
                <TableCell>
                  <CeldaStockEditable producto={producto} campo="minimo" />
                </TableCell>
                <TableCell>
                  <EstadoBadge producto={producto} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!autorizado) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-center max-w-sm">
          <ShieldAlert className="h-10 w-10 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Página no disponible</h2>
          <p className="text-sm text-muted-foreground">
            Necesitas tener una sucursal asignada para ver el stock de tu sucursal.
          </p>
        </div>
      </div>
    )
  }

  const productosEnVenta = productos.filter((p) => p.disponibleVenta === true)
  const otrosProductos = productos.filter((p) => p.disponibleVenta !== true)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Stock por Sucursal</h1>
        <p className="text-muted-foreground">
          {sucursalNombre ? `Inventario de ${sucursalNombre}` : "Control de stock de tu sucursal"}
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-4 w-4 text-emerald-600" />
              Productos en venta
            </CardTitle>
            <CardDescription>Productos disponibles para venta al público en esta sucursal.</CardDescription>
          </CardHeader>
          <CardContent>
            <TablaProductos lista={productosEnVenta} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              Otros productos
            </CardTitle>
            <CardDescription>Insumos y demás productos que no están disponibles para venta.</CardDescription>
          </CardHeader>
          <CardContent>
            <TablaProductos lista={otrosProductos} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
