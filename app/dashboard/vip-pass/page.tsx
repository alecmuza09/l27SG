"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Crown,
  Loader2,
  Plus,
  Pencil,
  Search,
  AlertTriangle,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getCurrentUser, isGlobalAdministrator, refreshSession } from "@/lib/auth"
import { getSucursalesActivasFromDB, type Sucursal } from "@/lib/data/sucursales"
import { consultarVentasVipLovable } from "@/app/actions/vip-pass-lovable-sales"
import {
  actualizarVipPassCampana,
  actualizarVipPassPrecio,
  crearVipPassCampana,
  crearVipPassPrecio,
  enriquecerInventarioConVentasLovable,
  formatearFolioVip,
  getInventarioVipPassCampana,
  getVipPassCampanaActiva,
  getVipPassCampanas,
  getVipPassPrecios,
} from "@/lib/data/vip-pass"
import type {
  VipPassCampana,
  VipPassEtiquetaPrecio,
  VipPassFolioEstado,
  VipPassInventarioResumen,
  VipPassPrecio,
} from "@/lib/types/vip-pass"

const ESTADO_LABEL: Record<VipPassFolioEstado, string> = {
  disponible: "Disponible",
  vendido: "Entregado",
  entregado: "Entregado",
  vendido_en_linea: "Vendido en línea",
  anulado: "Anulado",
}

const emptyCampanaForm = () => ({
  nombre: "",
  vigenciaHasta: "",
  usosIncluidos: "10",
  folioPrefijo: "",
  lineaDesde: "",
  lineaHasta: "",
  fisicoDesde: "",
  fisicoHasta: "",
  sucursalVentaId: "",
  activa: true,
})

const emptyPrecioForm = () => ({
  servicio: "",
  etiqueta: "regular" as VipPassEtiquetaPrecio,
  precio: "",
  vigenteDesde: "",
  vigenteHasta: "",
  activo: true,
})

export default function VipPassAdminPage() {
  const router = useRouter()
  const [authOk, setAuthOk] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [campanas, setCampanas] = useState<VipPassCampana[]>([])
  const [campanaActiva, setCampanaActiva] = useState<VipPassCampana | null>(null)
  const [precios, setPrecios] = useState<VipPassPrecio[]>([])
  const [inventario, setInventario] = useState<VipPassInventarioResumen | null>(null)
  const [inventarioLoading, setInventarioLoading] = useState(false)
  const [inventarioFiltro, setInventarioFiltro] = useState<
    "todos" | "disponible" | "vendido_en_linea" | "entregado" | "anulado" | "huecos"
  >("todos")
  const [inventarioCanal, setInventarioCanal] = useState<"todos" | "linea" | "fisico">("todos")
  const [inventarioSearch, setInventarioSearch] = useState("")
  const [preciosCampanaId, setPreciosCampanaId] = useState<string>("")

  const [campanaDialogOpen, setCampanaDialogOpen] = useState(false)
  const [editingCampana, setEditingCampana] = useState<VipPassCampana | null>(null)
  const [campanaForm, setCampanaForm] = useState(emptyCampanaForm)
  const [savingCampana, setSavingCampana] = useState(false)

  const [precioDialogOpen, setPrecioDialogOpen] = useState(false)
  const [editingPrecio, setEditingPrecio] = useState<VipPassPrecio | null>(null)
  const [precioForm, setPrecioForm] = useState(emptyPrecioForm)
  const [savingPrecio, setSavingPrecio] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [cams, activa, sucs] = await Promise.all([
        getVipPassCampanas(),
        getVipPassCampanaActiva(),
        getSucursalesActivasFromDB(),
      ])
      setCampanas(cams)
      setCampanaActiva(activa)
      setSucursales(sucs)
      const precioCampana = preciosCampanaId || activa?.id || cams[0]?.id || ""
      if (precioCampana) {
        setPreciosCampanaId(precioCampana)
        setPrecios(await getVipPassPrecios(precioCampana))
      } else {
        setPrecios([])
      }
    } finally {
      setLoading(false)
    }
  }, [preciosCampanaId])

  const loadInventario = useCallback(async (campanaId: string) => {
    setInventarioLoading(true)
    try {
      const inv = await getInventarioVipPassCampana(campanaId)
      if (!inv) {
        setInventario(null)
        return
      }

      const fromFolio = formatearFolioVip(inv.campana.folioPrefijo, inv.campana.lineaDesde)
      const toFolio = formatearFolioVip(inv.campana.folioPrefijo, inv.campana.lineaHasta)
      const lovable = await consultarVentasVipLovable({ fromFolio, toFolio })

      setInventario(
        enriquecerInventarioConVentasLovable(
          inv,
          lovable.ok ? lovable.items : null,
        ),
      )
    } finally {
      setInventarioLoading(false)
    }
  }, [])

  useEffect(() => {
    async function init() {
      const user = (await refreshSession()) ?? getCurrentUser()
      if (!isGlobalAdministrator(user)) {
        router.replace("/dashboard/gift-cards")
        return
      }
      setAuthOk(true)
      await reload()
    }
    void init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  useEffect(() => {
    if (!campanaActiva?.id) {
      setInventario(null)
      return
    }
    void loadInventario(campanaActiva.id)
  }, [campanaActiva?.id, loadInventario])

  const openCreateCampana = () => {
    setEditingCampana(null)
    const aurora = sucursales.find((s) => /aurora/i.test(s.nombre))
    setCampanaForm({
      ...emptyCampanaForm(),
      sucursalVentaId: aurora?.id || campanaActiva?.sucursalVentaId || "",
    })
    setCampanaDialogOpen(true)
  }

  const openEditCampana = (c: VipPassCampana) => {
    setEditingCampana(c)
    setCampanaForm({
      nombre: c.nombre,
      vigenciaHasta: c.vigenciaHasta,
      usosIncluidos: String(c.usosIncluidos),
      folioPrefijo: c.folioPrefijo,
      lineaDesde: String(c.lineaDesde),
      lineaHasta: String(c.lineaHasta),
      fisicoDesde: String(c.fisicoDesde),
      fisicoHasta: String(c.fisicoHasta),
      sucursalVentaId: c.sucursalVentaId || "",
      activa: c.activa,
    })
    setCampanaDialogOpen(true)
  }

  const saveCampana = async () => {
    setSavingCampana(true)
    const payload = {
      nombre: campanaForm.nombre,
      vigenciaHasta: campanaForm.vigenciaHasta,
      usosIncluidos: Number(campanaForm.usosIncluidos) || 0,
      folioPrefijo: campanaForm.folioPrefijo,
      lineaDesde: Number(campanaForm.lineaDesde),
      lineaHasta: Number(campanaForm.lineaHasta),
      fisicoDesde: Number(campanaForm.fisicoDesde),
      fisicoHasta: Number(campanaForm.fisicoHasta),
      sucursalVentaId: campanaForm.sucursalVentaId || null,
      activa: campanaForm.activa,
    }
    const res = editingCampana
      ? await actualizarVipPassCampana(editingCampana.id, payload)
      : await crearVipPassCampana(payload)
    setSavingCampana(false)
    if (!res.success) {
      toast.error(res.error || "No se pudo guardar")
      return
    }
    toast.success(editingCampana ? "Campaña actualizada" : "Campaña creada")
    setCampanaDialogOpen(false)
    await reload()
  }

  const openCreatePrecio = () => {
    if (!preciosCampanaId) {
      toast.error("Selecciona una campaña")
      return
    }
    setEditingPrecio(null)
    setPrecioForm(emptyPrecioForm())
    setPrecioDialogOpen(true)
  }

  const openEditPrecio = (p: VipPassPrecio) => {
    setEditingPrecio(p)
    setPrecioForm({
      servicio: p.servicio,
      etiqueta: p.etiqueta,
      precio: String(p.precio),
      vigenteDesde: p.vigenteDesde || "",
      vigenteHasta: p.vigenteHasta || "",
      activo: p.activo,
    })
    setPrecioDialogOpen(true)
  }

  const savePrecio = async () => {
    if (!preciosCampanaId) return
    setSavingPrecio(true)
    const payload = {
      campanaId: preciosCampanaId,
      servicio: precioForm.servicio,
      etiqueta: precioForm.etiqueta,
      precio: Number(precioForm.precio),
      vigenteDesde: precioForm.vigenteDesde || null,
      vigenteHasta: precioForm.vigenteHasta || null,
      activo: precioForm.activo,
    }
    const res = editingPrecio
      ? await actualizarVipPassPrecio(editingPrecio.id, payload)
      : await crearVipPassPrecio(payload)
    setSavingPrecio(false)
    if (!res.success) {
      toast.error(res.error || "No se pudo guardar")
      return
    }
    toast.success(editingPrecio ? "Precio actualizado" : "Precio creado")
    setPrecioDialogOpen(false)
    setPrecios(await getVipPassPrecios(preciosCampanaId))
  }

  const onChangePreciosCampana = async (id: string) => {
    setPreciosCampanaId(id)
    setPrecios(await getVipPassPrecios(id))
  }

  const foliosFiltrados = useMemo(() => {
    if (!inventario) return []
    const q = inventarioSearch.trim().toLowerCase()
    return inventario.folios.filter((f) => {
      if (inventarioCanal !== "todos" && f.canal !== inventarioCanal) return false
      if (inventarioFiltro === "huecos" && !f.esHueco) return false
      if (inventarioFiltro !== "todos" && inventarioFiltro !== "huecos" && f.estado !== inventarioFiltro) return false
      if (!q) return true
      return (
        f.folio.toLowerCase().includes(q) ||
        (f.clienta || "").toLowerCase().includes(q) ||
        (f.servicio || "").toLowerCase().includes(q)
      )
    })
  }, [inventario, inventarioCanal, inventarioFiltro, inventarioSearch])

  if (!authOk || loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Crown className="h-7 w-7 text-amber-600" />
            VIP Pass
          </h1>
          <p className="text-muted-foreground">
            Campañas, precios de venta física e inventario de folios
          </p>
        </div>
      </div>

      {campanaActiva ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Campaña activa</CardTitle>
            <CardDescription>
              {campanaActiva.nombre} · prefijo {campanaActiva.folioPrefijo} · vigencia{" "}
              {campanaActiva.vigenciaHasta} · {campanaActiva.usosIncluidos} usos · sucursal{" "}
              {campanaActiva.sucursalVentaNombre || "—"}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground grid gap-1 sm:grid-cols-2">
            <p>
              Línea: {formatearFolioVip(campanaActiva.folioPrefijo, campanaActiva.lineaDesde)}–
              {formatearFolioVip(campanaActiva.folioPrefijo, campanaActiva.lineaHasta)}
            </p>
            <p>
              Físico: {formatearFolioVip(campanaActiva.folioPrefijo, campanaActiva.fisicoDesde)}–
              {formatearFolioVip(campanaActiva.folioPrefijo, campanaActiva.fisicoHasta)}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4 flex items-center gap-2 text-amber-900 text-sm">
            <AlertTriangle className="h-4 w-4" />
            No hay campaña activa. Crea o activa una para registrar VIP Pass.
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="campanas">
        <TabsList>
          <TabsTrigger value="campanas">Campañas</TabsTrigger>
          <TabsTrigger value="precios">Precios físicos</TabsTrigger>
          <TabsTrigger value="inventario">Inventario</TabsTrigger>
        </TabsList>

        <TabsContent value="campanas" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openCreateCampana}>
              <Plus className="h-4 w-4 mr-2" /> Nueva campaña
            </Button>
          </div>
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Prefijo</TableHead>
                    <TableHead>Vigencia</TableHead>
                    <TableHead>Usos</TableHead>
                    <TableHead>Línea</TableHead>
                    <TableHead>Físico</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campanas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        Sin campañas
                      </TableCell>
                    </TableRow>
                  ) : (
                    campanas.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.nombre}</TableCell>
                        <TableCell className="font-mono text-xs">{c.folioPrefijo}</TableCell>
                        <TableCell>{c.vigenciaHasta}</TableCell>
                        <TableCell>{c.usosIncluidos}</TableCell>
                        <TableCell className="text-xs tabular-nums">
                          {c.lineaDesde}–{c.lineaHasta}
                        </TableCell>
                        <TableCell className="text-xs tabular-nums">
                          {c.fisicoDesde}–{c.fisicoHasta}
                        </TableCell>
                        <TableCell>
                          <Badge variant={c.activa ? "default" : "secondary"}>
                            {c.activa ? "Activa" : "Inactiva"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => openEditCampana(c)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="precios" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Select value={preciosCampanaId} onValueChange={(v) => void onChangePreciosCampana(v)}>
              <SelectTrigger className="w-72">
                <SelectValue placeholder="Campaña" />
              </SelectTrigger>
              <SelectContent>
                {campanas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}{c.activa ? " (activa)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={openCreatePrecio} disabled={!preciosCampanaId}>
              <Plus className="h-4 w-4 mr-2" /> Nuevo precio
            </Button>
          </div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Precios venta física (La Aurora)</CardTitle>
              <CardDescription>
                La tienda en línea usa sus propios precios; esta tabla solo aplica al rango físico.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Servicio</TableHead>
                    <TableHead>Etiqueta</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead>Vigencia</TableHead>
                    <TableHead>Activo</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {precios.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Sin precios para esta campaña
                      </TableCell>
                    </TableRow>
                  ) : (
                    precios.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.servicio}</TableCell>
                        <TableCell>
                          <Badge variant={p.etiqueta === "buen_fin" ? "default" : "outline"}>
                            {p.etiqueta === "buen_fin" ? "Buen Fin" : "Regular"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(p.precio)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {p.vigenteDesde || p.vigenteHasta
                            ? `${p.vigenteDesde || "…"} → ${p.vigenteHasta || "…"}`
                            : "Sin límite"}
                        </TableCell>
                        <TableCell>{p.activo ? "Sí" : "No"}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => openEditPrecio(p)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventario" className="space-y-4">
          {!campanaActiva ? (
            <p className="text-sm text-muted-foreground">Activa una campaña para ver inventario.</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <Card>
                  <CardHeader className="pb-1 pt-3 px-4">
                    <CardDescription>Disponibles</CardDescription>
                    <CardTitle className="text-xl">{inventario?.totalDisponibles ?? "…"}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-1 pt-3 px-4">
                    <CardDescription>Vendidos en línea</CardDescription>
                    <CardTitle className="text-xl">{inventario?.totalVendidosEnLinea ?? "…"}</CardTitle>
                    <p className="text-[11px] text-muted-foreground">Sin entregar</p>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-1 pt-3 px-4">
                    <CardDescription>Entregados</CardDescription>
                    <CardTitle className="text-xl">{inventario?.totalEntregados ?? "…"}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-1 pt-3 px-4">
                    <CardDescription>Anulados</CardDescription>
                    <CardTitle className="text-xl">{inventario?.totalAnulados ?? "…"}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-1 pt-3 px-4">
                    <CardDescription>Huecos</CardDescription>
                    <CardTitle className="text-xl">{inventario?.totalHuecos ?? "…"}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-1 pt-3 px-4">
                    <CardDescription>Siguiente libre</CardDescription>
                    <CardTitle className="text-sm leading-snug">
                      Línea:{" "}
                      {inventario?.siguienteLibreLinea != null
                        ? formatearFolioVip(campanaActiva.folioPrefijo, inventario.siguienteLibreLinea)
                        : "—"}
                      <br />
                      Físico:{" "}
                      {inventario?.siguienteLibreFisico != null
                        ? formatearFolioVip(campanaActiva.folioPrefijo, inventario.siguienteLibreFisico)
                        : "—"}
                    </CardTitle>
                  </CardHeader>
                </Card>
              </div>

              {inventario && !inventario.lovableConsultaOk && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <p>No se pudo consultar luna27.mx; los vendidos en línea pueden no verse.</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-8 h-9"
                    placeholder="Buscar folio, clienta, compradora…"
                    value={inventarioSearch}
                    onChange={(e) => setInventarioSearch(e.target.value)}
                  />
                </div>
                <Select value={inventarioCanal} onValueChange={(v) => setInventarioCanal(v as typeof inventarioCanal)}>
                  <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos canales</SelectItem>
                    <SelectItem value="linea">Línea</SelectItem>
                    <SelectItem value="fisico">Físico</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={inventarioFiltro} onValueChange={(v) => setInventarioFiltro(v as typeof inventarioFiltro)}>
                  <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos estados</SelectItem>
                    <SelectItem value="disponible">Disponible</SelectItem>
                    <SelectItem value="vendido_en_linea">Vendido en línea</SelectItem>
                    <SelectItem value="entregado">Entregado</SelectItem>
                    <SelectItem value="anulado">Anulado</SelectItem>
                    <SelectItem value="huecos">Solo huecos</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9"
                  disabled={inventarioLoading}
                  onClick={() => campanaActiva && void loadInventario(campanaActiva.id)}
                >
                  {inventarioLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Actualizar"}
                </Button>
              </div>

              <Card>
                <CardContent className="pt-4">
                  {inventarioLoading && !inventario ? (
                    <div className="py-10 flex justify-center">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-[60vh]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Folio</TableHead>
                            <TableHead>Canal</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Clienta</TableHead>
                            <TableHead>Servicio</TableHead>
                            <TableHead>Nota</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {foliosFiltrados.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                Sin folios para los filtros
                              </TableCell>
                            </TableRow>
                          ) : (
                            foliosFiltrados.map((f) => (
                              <TableRow key={`${f.canal}-${f.numero}`} className={f.esHueco ? "bg-amber-50/60" : undefined}>
                                <TableCell className="font-mono text-xs">{f.folio}</TableCell>
                                <TableCell className="text-xs">{f.canal === "linea" ? "Línea" : "Físico"}</TableCell>
                                <TableCell>
                                  <Badge
                                    variant={
                                      f.estado === "disponible"
                                        ? "outline"
                                        : f.estado === "anulado"
                                          ? "destructive"
                                          : f.estado === "vendido_en_linea"
                                            ? "secondary"
                                            : "default"
                                    }
                                  >
                                    {ESTADO_LABEL[f.estado] ?? f.estado}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm">
                                  {f.estado === "vendido_en_linea" && f.clienta ? (
                                    <span className="text-muted-foreground">Compró: {f.clienta}</span>
                                  ) : (
                                    f.clienta || "—"
                                  )}
                                </TableCell>
                                <TableCell className="text-sm">{f.servicio || "—"}</TableCell>
                                <TableCell className="text-xs text-amber-700">
                                  {f.esHueco ? "Hueco entre vendidos" : ""}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog campaña */}
      <Dialog open={campanaDialogOpen} onOpenChange={setCampanaDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCampana ? "Editar campaña" : "Nueva campaña"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1">
              <Label>Nombre</Label>
              <Input value={campanaForm.nombre} onChange={(e) => setCampanaForm((f) => ({ ...f, nombre: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Prefijo folio</Label>
                <Input value={campanaForm.folioPrefijo} onChange={(e) => setCampanaForm((f) => ({ ...f, folioPrefijo: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Vigencia hasta</Label>
                <Input type="date" value={campanaForm.vigenciaHasta} onChange={(e) => setCampanaForm((f) => ({ ...f, vigenciaHasta: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Usos incluidos</Label>
              <Input type="number" min={1} value={campanaForm.usosIncluidos} onChange={(e) => setCampanaForm((f) => ({ ...f, usosIncluidos: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Línea desde</Label>
                <Input type="number" value={campanaForm.lineaDesde} onChange={(e) => setCampanaForm((f) => ({ ...f, lineaDesde: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Línea hasta</Label>
                <Input type="number" value={campanaForm.lineaHasta} onChange={(e) => setCampanaForm((f) => ({ ...f, lineaHasta: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Físico desde</Label>
                <Input type="number" value={campanaForm.fisicoDesde} onChange={(e) => setCampanaForm((f) => ({ ...f, fisicoDesde: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Físico hasta</Label>
                <Input type="number" value={campanaForm.fisicoHasta} onChange={(e) => setCampanaForm((f) => ({ ...f, fisicoHasta: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Sucursal de venta</Label>
              <Select
                value={campanaForm.sucursalVentaId || undefined}
                onValueChange={(v) => setCampanaForm((f) => ({ ...f, sucursalVentaId: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Sucursal" /></SelectTrigger>
                <SelectContent>
                  {sucursales.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Campaña activa</p>
                <p className="text-xs text-muted-foreground">Solo una puede estar activa a la vez</p>
              </div>
              <Switch checked={campanaForm.activa} onCheckedChange={(v) => setCampanaForm((f) => ({ ...f, activa: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCampanaDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => void saveCampana()} disabled={savingCampana}>
              {savingCampana ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog precio */}
      <Dialog open={precioDialogOpen} onOpenChange={setPrecioDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPrecio ? "Editar precio" : "Nuevo precio"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1">
              <Label>Servicio</Label>
              <Input value={precioForm.servicio} onChange={(e) => setPrecioForm((f) => ({ ...f, servicio: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Etiqueta</Label>
                <Select
                  value={precioForm.etiqueta}
                  onValueChange={(v) => setPrecioForm((f) => ({ ...f, etiqueta: v as VipPassEtiquetaPrecio }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular">Regular</SelectItem>
                    <SelectItem value="buen_fin">Buen Fin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Precio</Label>
                <Input type="number" min={0} step="0.01" value={precioForm.precio} onChange={(e) => setPrecioForm((f) => ({ ...f, precio: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Vigente desde</Label>
                <Input type="date" value={precioForm.vigenteDesde} onChange={(e) => setPrecioForm((f) => ({ ...f, vigenteDesde: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Vigente hasta</Label>
                <Input type="date" value={precioForm.vigenteHasta} onChange={(e) => setPrecioForm((f) => ({ ...f, vigenteHasta: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <p className="text-sm font-medium">Activo</p>
              <Switch checked={precioForm.activo} onCheckedChange={(v) => setPrecioForm((f) => ({ ...f, activo: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrecioDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => void savePrecio()} disabled={savingPrecio}>
              {savingPrecio ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
