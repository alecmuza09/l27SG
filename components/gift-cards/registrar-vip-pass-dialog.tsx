"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Crown, Loader2, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  searchClientes,
  createCliente,
  findPosibleDuplicadoCliente,
  type Cliente,
} from "@/lib/data/clientes"
import {
  getGiftCardByCodigoFromDBConVariantes,
} from "@/lib/data/gift-cards"
import {
  fechaVencimientoDesdeExpiresAt,
  MSG_FOLIO_ANULADO_LOVABLE,
  verificarFolioEnLovable,
  type LovableGiftcardPayload,
} from "@/lib/data/gift-card-lovable-verify"
import {
  canalFolioVip,
  crearOAsignarVipPass,
  folioSaltaOrden,
  formatoNotasCompradoraVip,
  formatearFolioVip,
  getInventarioVipPassCampana,
  getVipPassCampanaActiva,
  getVipPassPrecios,
  parseNumeroFolioVip,
  serviciosConPrecioVigente,
} from "@/lib/data/vip-pass"
import type { VipPassCampana, VipPassPrecio } from "@/lib/types/vip-pass"
import type { User } from "@/lib/auth"
import { canRegistrarVipPass, isGlobalAdministrator } from "@/lib/auth"

function textoSugeridoBusquedaLovable(gc: LovableGiftcardPayload): string {
  const recipient = (gc.recipient_name || "").trim()
  if (recipient) return recipient
  return (gc.customer_name || "").trim()
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUser: User | null
  onRegistered: () => void | Promise<void>
  /** Folio precargado (p. ej. desde Consultar Gift Card). */
  initialFolio?: string | null
  /** Payload Lovable ya verificado (opcional; evita reconsultar). */
  initialLovable?: LovableGiftcardPayload | null
}

export function RegistrarVipPassDialog({
  open,
  onOpenChange,
  currentUser,
  onRegistered,
  initialFolio = null,
  initialLovable = null,
}: Props) {
  const isAdmin = isGlobalAdministrator(currentUser)
  const [loadingCtx, setLoadingCtx] = useState(false)
  const [campana, setCampana] = useState<VipPassCampana | null>(null)
  const [precios, setPrecios] = useState<VipPassPrecio[]>([])
  const [siguienteFisico, setSiguienteFisico] = useState<number | null>(null)

  const [folio, setFolio] = useState("")
  const [folioStatus, setFolioStatus] = useState<
    null | "checking" | "ok_fisico" | "ok_linea" | "voided" | "expired" | "exists" | "asignar" | "error"
  >(null)
  const [folioMsg, setFolioMsg] = useState("")
  const [lovableGc, setLovableGc] = useState<LovableGiftcardPayload | null>(null)
  const [existingGcId, setExistingGcId] = useState<string | null>(null)
  const [saltaOrden, setSaltaOrden] = useState(false)
  const [confirmSaltoOpen, setConfirmSaltoOpen] = useState(false)

  const [servicio, setServicio] = useState("")
  const [monto, setMonto] = useState("")
  const [metodoPago, setMetodoPago] = useState("efectivo")
  const [metodoPagoOtro, setMetodoPagoOtro] = useState("")
  const [origen, setOrigen] = useState<"sucursal" | "en_linea">("sucursal")

  const [clienteMode, setClienteMode] = useState<"existing" | "new">("existing")
  const [clienteSearch, setClienteSearch] = useState("")
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null)
  const [nuevoCliente, setNuevoCliente] = useState({
    nombre: "", apellido: "", telefono: "", email: "",
  })
  const [titularConfirmada, setTitularConfirmada] = useState(false)
  /** Coincidencia al intentar crear nueva clienta (no crear hasta elegir o forzar). */
  const [duplicadoDetectado, setDuplicadoDetectado] = useState<{
    cliente: Cliente
    motivo: "telefono_correo" | "nombre"
  } | null>(null)
  const [forzarCrearNueva, setForzarCrearNueva] = useState(false)
  const [saving, setSaving] = useState(false)

  const serviciosOpts = useMemo(() => serviciosConPrecioVigente(precios), [precios])

  /** Sugerencia de folio físico: solo vacío o rango físico; ocultar en tienda en línea. */
  const mostrarSugerenciaFolioFisico = useMemo(() => {
    if (siguienteFisico == null || !campana) return false
    const raw = folio.trim()
    if (!raw) return true
    if (lovableGc || origen === "en_linea") return false
    const num = parseNumeroFolioVip(raw, campana.folioPrefijo)
    if (num == null) return false
    return canalFolioVip(num, campana) === "fisico"
  }, [siguienteFisico, campana, folio, lovableGc, origen])

  const reset = useCallback(() => {
    setFolio("")
    setFolioStatus(null)
    setFolioMsg("")
    setLovableGc(null)
    setExistingGcId(null)
    setSaltaOrden(false)
    setServicio("")
    setMonto("")
    setMetodoPago("efectivo")
    setMetodoPagoOtro("")
    setOrigen("sucursal")
    setClienteMode("existing")
    setClienteSearch("")
    setClientes([])
    setSelectedCliente(null)
    setTitularConfirmada(false)
    setDuplicadoDetectado(null)
    setForzarCrearNueva(false)
    setNuevoCliente({ nombre: "", apellido: "", telefono: "", email: "" })
  }, [])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    async function load() {
      setLoadingCtx(true)
      reset()
      const activa = await getVipPassCampanaActiva()
      if (cancelled) return
      setCampana(activa)
      if (activa) {
        const [precs, inv] = await Promise.all([
          getVipPassPrecios(activa.id),
          getInventarioVipPassCampana(activa.id),
        ])
        if (cancelled) return
        setPrecios(precs)
        setSiguienteFisico(inv?.siguienteLibreFisico ?? null)

        const folioIni = (initialFolio ?? "").trim()
        if (folioIni) {
          const num = parseNumeroFolioVip(folioIni, activa.folioPrefijo)
          const codigoNorm =
            num != null ? formatearFolioVip(activa.folioPrefijo, num) : folioIni
          setFolio(codigoNorm)

          if (initialLovable) {
            const gc = initialLovable
            setLovableGc(gc)
            setOrigen("en_linea")
            setServicio(gc.package_name || "")
            setMonto(String(gc.amount || ""))
            setSelectedCliente(null)
            setTitularConfirmada(false)
            setDuplicadoDetectado(null)
            setForzarCrearNueva(false)
            setClienteMode("existing")
            setClientes([])
            setNuevoCliente({ nombre: "", apellido: "", telefono: "", email: "" })
            setClienteSearch(textoSugeridoBusquedaLovable(gc))
            setFolioStatus("ok_linea")
            setFolioMsg(
              "Folio VIP Pass en línea precargado — elige o crea la titular en la ficha",
            )
          }
        } else if (inv?.siguienteLibreFisico != null) {
          setFolio(formatearFolioVip(activa.folioPrefijo, inv.siguienteLibreFisico))
        }
      } else if ((initialFolio ?? "").trim()) {
        setFolio(initialFolio!.trim())
      }
      setLoadingCtx(false)
    }
    void load()
    return () => { cancelled = true }
    // Solo al abrir / cambiar precarga
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reset, initialFolio, initialLovable])

  useEffect(() => {
    if (!clienteSearch.trim() || clienteSearch.trim().length < 2) {
      setClientes([])
      return
    }
    const t = setTimeout(() => {
      void searchClientes(clienteSearch.trim()).then(setClientes)
    }, 250)
    return () => clearTimeout(t)
  }, [clienteSearch])

  /** Solo texto de búsqueda sugerido; nunca selecciona titular. */
  const sugerirTextoBusquedaDesdeLovable = (gc: LovableGiftcardPayload) => {
    setSelectedCliente(null)
    setTitularConfirmada(false)
    setDuplicadoDetectado(null)
    setForzarCrearNueva(false)
    setClienteMode("existing")
    setClientes([])
    setNuevoCliente({ nombre: "", apellido: "", telefono: "", email: "" })
    setClienteSearch(textoSugeridoBusquedaLovable(gc))
  }

  const usarClientaDuplicada = (c: Cliente) => {
    setSelectedCliente(c)
    setTitularConfirmada(true)
    setClienteMode("existing")
    setClienteSearch(`${c.nombre} ${c.apellido}`)
    setClientes([])
    setDuplicadoDetectado(null)
    setForzarCrearNueva(false)
    toast.success(`Titular: ${c.nombre} ${c.apellido}`)
  }

  const validarFolio = async () => {
    if (!campana) return
    const raw = folio.trim()
    if (!raw) {
      setFolioStatus(null)
      setFolioMsg("")
      return
    }

    setFolioStatus("checking")
    setFolioMsg("")
    setLovableGc(null)
    setExistingGcId(null)
    setSaltaOrden(false)
    setTitularConfirmada(false)
    setDuplicadoDetectado(null)
    setForzarCrearNueva(false)

    const num = parseNumeroFolioVip(raw, campana.folioPrefijo)
    if (num == null) {
      setFolioStatus("error")
      setFolioMsg(`El folio debe empezar con el prefijo ${campana.folioPrefijo} y un número`)
      return
    }

    const canal = canalFolioVip(num, campana)
    if (!canal) {
      setFolioStatus("error")
      setFolioMsg("Folio fuera de los rangos de la campaña activa")
      return
    }

    const codigoNorm = formatearFolioVip(campana.folioPrefijo, num)
    setFolio(codigoNorm)

    const existente = await getGiftCardByCodigoFromDBConVariantes(codigoNorm)
    if (existente) {
      if (!existente.clienteId) {
        setExistingGcId(existente.id)
        setFolioStatus("asignar")
        setFolioMsg("Folio ya en agenda sin clienta — confirma la titular")
        const esLineaExistente = existente.origen === "en_linea"
        setOrigen(esLineaExistente ? "en_linea" : "sucursal")
        if (existente.vipServicio) setServicio(existente.vipServicio)
        setMonto(String(existente.saldoInicial || existente.saldoActual || ""))
        if (esLineaExistente) {
          const lovableAsignar = await verificarFolioEnLovable(codigoNorm)
          if (lovableAsignar.outcome === "voided") {
            setFolioStatus("voided")
            setFolioMsg(MSG_FOLIO_ANULADO_LOVABLE)
            return
          }
          if (lovableAsignar.outcome === "found") {
            const typeNorm = String(lovableAsignar.giftcard.type || "").toLowerCase()
            if (!typeNorm || typeNorm === "vip_pass") {
              setLovableGc(lovableAsignar.giftcard)
              sugerirTextoBusquedaDesdeLovable(lovableAsignar.giftcard)
            }
          }
        }
        return
      }
      setFolioStatus("exists")
      setFolioMsg("Este folio ya está registrado con clienta")
      return
    }

    if (canal === "fisico") {
      const salto = folioSaltaOrden(num, siguienteFisico)
      setSaltaOrden(salto)
      // Consultar Lovable: not_found no es error en físico
      const lovable = await verificarFolioEnLovable(codigoNorm)
      if (lovable.outcome === "voided") {
        setFolioStatus("voided")
        setFolioMsg(MSG_FOLIO_ANULADO_LOVABLE)
        return
      }
      if (lovable.outcome === "expired") {
        setFolioStatus("expired")
        setFolioMsg("Folio expirado en tienda en línea")
        return
      }
      setOrigen("sucursal")
      setFolioStatus("ok_fisico")
      setFolioMsg(
        salto
          ? `Salta el siguiente libre (${siguienteFisico != null ? formatearFolioVip(campana.folioPrefijo, siguienteFisico) : "—"}). Solo admin puede confirmar.`
          : "Folio físico disponible",
      )
      return
    }

    // Canal línea
    const lovable = await verificarFolioEnLovable(codigoNorm)
    if (lovable.outcome === "voided") {
      setFolioStatus("voided")
      setFolioMsg(MSG_FOLIO_ANULADO_LOVABLE)
      return
    }
    if (lovable.outcome === "expired") {
      setFolioStatus("expired")
      setFolioMsg("Folio expirado")
      return
    }
    if (lovable.outcome === "fetch_failed") {
      setFolioStatus("error")
      setFolioMsg("No se pudo verificar el folio en tienda en línea")
      return
    }
    if (lovable.outcome === "not_found") {
      setFolioStatus("error")
      setFolioMsg("Folio de rango en línea no encontrado en luna27.mx")
      return
    }

    const gc = lovable.giftcard
    const typeNorm = String(gc.type || "").toLowerCase()
    if (typeNorm && typeNorm !== "vip_pass") {
      setFolioStatus("error")
      setFolioMsg("Este folio de la tienda en línea no es una VIP Pass")
      return
    }

    setLovableGc(gc)
    setOrigen("en_linea")
    setServicio(gc.package_name || "")
    setMonto(String(gc.amount || ""))
    sugerirTextoBusquedaDesdeLovable(gc)
    setFolioStatus("ok_linea")
    setFolioMsg("Folio VIP Pass en línea verificado — elige o crea la titular en la ficha")
  }

  const aplicarServicio = (serv: string) => {
    setServicio(serv)
    if (origen === "en_linea") return
    const opt = serviciosOpts.find((s) => s.servicio === serv)
    if (opt) setMonto(String(opt.precio.precio))
  }

  const resolverClienteId = async (): Promise<string | null> => {
    if (clienteMode === "existing") {
      if (!selectedCliente || !titularConfirmada) {
        toast.error("Busca y selecciona la titular en la ficha de clientas")
        return null
      }
      return selectedCliente.id
    }

    if (clienteMode !== "new") {
      toast.error("Elige 'Buscar clienta' o 'Nueva clienta'")
      return null
    }

    if (!nuevoCliente.nombre || !nuevoCliente.apellido || !nuevoCliente.telefono) {
      toast.error("Completa nombre, apellido y teléfono de la titular")
      return null
    }

    if (!forzarCrearNueva) {
      const dup = await findPosibleDuplicadoCliente({
        nombre: nuevoCliente.nombre,
        apellido: nuevoCliente.apellido,
        telefono: nuevoCliente.telefono,
        email: nuevoCliente.email,
      })
      if (dup) {
        setDuplicadoDetectado(dup)
        toast.error(
          `Ya existe una clienta con este ${dup.motivo === "nombre" ? "nombre" : "teléfono/correo"}: ${dup.cliente.nombre} ${dup.cliente.apellido}`,
        )
        return null
      }
    }

    const creado = await createCliente({
      nombre: nuevoCliente.nombre,
      apellido: nuevoCliente.apellido,
      telefono: nuevoCliente.telefono,
      email: nuevoCliente.email || undefined,
    })
    if (!creado.success || !creado.cliente) {
      toast.error(creado.error || "No se pudo crear la clienta")
      return null
    }
    setTitularConfirmada(true)
    setDuplicadoDetectado(null)
    setForzarCrearNueva(false)
    return creado.cliente.id
  }

  const ejecutarRegistro = async () => {
    if (!campana) return
    if (!canRegistrarVipPass(currentUser, campana.sucursalVentaId)) {
      toast.error("No tienes permiso para registrar VIP Pass. Solo admin o recepción de la sucursal de venta.")
      return
    }
    if (folioStatus === "voided") {
      toast.error(MSG_FOLIO_ANULADO_LOVABLE)
      return
    }
    if (folioStatus === "expired" || folioStatus === "exists" || folioStatus === "error") {
      toast.error(folioMsg || "Folio no válido")
      return
    }
    if (!["ok_fisico", "ok_linea", "asignar"].includes(folioStatus || "")) {
      toast.error("Valida el folio antes de guardar")
      return
    }
    if (saltaOrden && !isAdmin) {
      toast.error("Este folio salta el orden; solo un admin puede confirmarlo")
      return
    }
    if (!servicio.trim()) {
      toast.error("Selecciona el servicio")
      return
    }
    const montoNum = parseFloat(monto)
    if (!(montoNum > 0) && folioStatus !== "asignar") {
      toast.error("Monto inválido")
      return
    }

    if (origen === "sucursal" && folioStatus !== "asignar") {
      if (!metodoPago) {
        toast.error("Selecciona método de pago")
        return
      }
      if (metodoPago === "otro" && !metodoPagoOtro.trim()) {
        toast.error("Especifica el método de pago")
        return
      }
    }

    setSaving(true)
    const clienteId = await resolverClienteId()
    if (!clienteId) {
      setSaving(false)
      return
    }

    const metodoFinal =
      origen === "en_linea"
        ? "tienda_en_linea"
        : metodoPago === "otro"
          ? metodoPagoOtro.trim()
          : metodoPago

    const fechaVencLinea = lovableGc
      ? fechaVencimientoDesdeExpiresAt(lovableGc.expires_at)
      : null

    const notasCompradora =
      origen === "en_linea" && lovableGc
        ? formatoNotasCompradoraVip({
            nombre: lovableGc.customer_name,
            telefono: lovableGc.customer_phone,
            email: lovableGc.customer_email,
          })
        : null

    const res = await crearOAsignarVipPass({
      codigo: folio.trim(),
      clienteId,
      servicio: servicio.trim(),
      monto: montoNum || 0,
      metodoPago: metodoFinal,
      origen,
      campana,
      empleadoEmisorId: null,
      asignarClientaSolo: folioStatus === "asignar",
      giftCardIdExistente: existingGcId,
      fechaVencimiento: origen === "en_linea" ? fechaVencLinea : campana.vigenciaHasta,
      vipUsosTotal: campana.usosIncluidos || 10,
      notasCompradora,
    })

    setSaving(false)
    if (!res.success) {
      toast.error(res.error || "No se pudo registrar")
      return
    }
    toast.success(
      folioStatus === "asignar"
        ? `Clienta asignada al VIP Pass ${res.codigo}`
        : `VIP Pass ${res.codigo} registrado`,
    )
    if (res.advertenciaPago) toast.warning(res.advertenciaPago)
    onOpenChange(false)
    await onRegistered()
  }

  const handleGuardar = async () => {
    if (saltaOrden && isAdmin && folioStatus === "ok_fisico") {
      setConfirmSaltoOpen(true)
      return
    }
    await ejecutarRegistro()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-600" />
              Registrar VIP Pass
            </DialogTitle>
            <DialogDescription>
              {campana
                ? `${campana.nombre} · sucursal ${campana.sucursalVentaNombre || "La Aurora"}`
                : "Se requiere una campaña activa"}
            </DialogDescription>
          </DialogHeader>

          {loadingCtx ? (
            <div className="py-10 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : !campana ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No hay campaña VIP Pass activa. Un admin debe activarla en VIP Pass.
            </p>
          ) : !canRegistrarVipPass(currentUser, campana.sucursalVentaId) ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No tienes permiso para registrar VIP Pass. Pide a un admin o a recepción de La Aurora que la registre.
            </p>
          ) : (
            <div className="space-y-4 py-1">
              <div className="space-y-1.5">
                <Label>Folio</Label>
                <div className="flex gap-2">
                  <Input
                    className="font-mono"
                    value={folio}
                    onChange={(e) => {
                      setFolio(e.target.value)
                      setFolioStatus(null)
                    }}
                    placeholder={
                      siguienteFisico != null
                        ? formatearFolioVip(campana.folioPrefijo, siguienteFisico)
                        : `${campana.folioPrefijo}…`
                    }
                  />
                  <Button type="button" variant="outline" onClick={() => void validarFolio()} disabled={folioStatus === "checking"}>
                    {folioStatus === "checking" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Validar"}
                  </Button>
                </div>
                {mostrarSugerenciaFolioFisico && siguienteFisico != null && (
                  <p className="text-xs text-muted-foreground">
                    Siguiente folio físico libre:{" "}
                    <button
                      type="button"
                      className="font-mono underline"
                      onClick={() => {
                        setFolio(formatearFolioVip(campana.folioPrefijo, siguienteFisico))
                        setFolioStatus(null)
                      }}
                    >
                      {formatearFolioVip(campana.folioPrefijo, siguienteFisico)}
                    </button>
                  </p>
                )}
                {folioMsg && (
                  <p className={`text-xs flex items-start gap-1 ${
                    folioStatus === "voided" || folioStatus === "error" || folioStatus === "exists" || folioStatus === "expired"
                      ? "text-red-600"
                      : saltaOrden
                        ? "text-amber-700"
                        : "text-emerald-700"
                  }`}>
                    {(saltaOrden || folioStatus === "voided") && <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />}
                    {folioMsg}
                  </p>
                )}
              </div>

              {origen === "en_linea" && lovableGc && (
                <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1.5">
                  <p><span className="text-muted-foreground">Servicio:</span> {lovableGc.package_name}</p>
                  <p><span className="text-muted-foreground">Monto:</span> ${lovableGc.amount}</p>
                  <p className="text-xs font-semibold uppercase text-muted-foreground pt-1">Datos de la compra en línea (no se liga sola)</p>
                  <p>
                    Compró: {lovableGc.customer_name || "—"}
                    {lovableGc.customer_phone ? ` · ${lovableGc.customer_phone}` : ""}
                    {lovableGc.customer_email ? ` · ${lovableGc.customer_email}` : ""}
                  </p>
                  {lovableGc.recipient_name ? (
                    <p>Titular indicada al comprar: {lovableGc.recipient_name}</p>
                  ) : null}
                </div>
              )}

              {origen === "sucursal" && folioStatus !== "asignar" && (
                <div className="space-y-1.5">
                  <Label>Servicio</Label>
                  <Select value={servicio || undefined} onValueChange={aplicarServicio}>
                    <SelectTrigger>
                      <SelectValue placeholder={serviciosOpts.length ? "Selecciona servicio" : "Sin precios vigentes"} />
                    </SelectTrigger>
                    <SelectContent>
                      {serviciosOpts.map((s) => (
                        <SelectItem key={s.servicio} value={s.servicio}>
                          {s.servicio} · ${s.precio.precio}
                          {s.precio.etiqueta === "buen_fin" ? " (Buen Fin)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {(origen === "en_linea" || folioStatus === "asignar") && (
                <div className="space-y-1.5">
                  <Label>Servicio</Label>
                  <Input value={servicio} onChange={(e) => setServicio(e.target.value)} />
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Monto / precio</Label>
                <Input
                  type="number"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  disabled={origen === "en_linea" || folioStatus === "asignar"}
                />
                <p className="text-xs text-muted-foreground">
                  Vence: {origen === "en_linea" && lovableGc?.expires_at
                    ? (fechaVencimientoDesdeExpiresAt(lovableGc.expires_at) || campana.vigenciaHasta)
                    : campana.vigenciaHasta}
                  {" · "}
                  {campana.usosIncluidos} usos
                </p>
              </div>

              {origen === "sucursal" && folioStatus !== "asignar" && (
                <div className="space-y-1.5">
                  <Label>Método de pago</Label>
                  <Select value={metodoPago} onValueChange={setMetodoPago}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="efectivo">Efectivo</SelectItem>
                      <SelectItem value="tarjeta">Tarjeta</SelectItem>
                      <SelectItem value="transferencia">Transferencia</SelectItem>
                      <SelectItem value="otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                  {metodoPago === "otro" && (
                    <Input
                      className="mt-2"
                      placeholder="Especifica método"
                      value={metodoPagoOtro}
                      onChange={(e) => setMetodoPagoOtro(e.target.value)}
                    />
                  )}
                </div>
              )}

              <div className="space-y-2 border rounded-lg p-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Titular de la tarjeta (confirmación obligatoria)
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={clienteMode === "existing" ? "default" : "outline"}
                    onClick={() => {
                      setClienteMode("existing")
                      setDuplicadoDetectado(null)
                      setForzarCrearNueva(false)
                    }}
                  >
                    Buscar clienta
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={clienteMode === "new" ? "default" : "outline"}
                    onClick={() => {
                      setClienteMode("new")
                      setSelectedCliente(null)
                      setTitularConfirmada(false)
                      setDuplicadoDetectado(null)
                      setForzarCrearNueva(false)
                    }}
                  >
                    Nueva clienta
                  </Button>
                </div>
                {clienteMode === "existing" ? (
                  <div className="space-y-2">
                    <Input
                      placeholder="Buscar por nombre o teléfono…"
                      value={clienteSearch}
                      onChange={(e) => {
                        setClienteSearch(e.target.value)
                        setSelectedCliente(null)
                        setTitularConfirmada(false)
                      }}
                    />
                    {selectedCliente && titularConfirmada && (
                      <p className="text-sm font-medium">
                        Titular: {selectedCliente.nombre} {selectedCliente.apellido}
                        <span className="ml-2 text-xs text-emerald-700">confirmada</span>
                        <button
                          type="button"
                          className="ml-2 text-xs text-muted-foreground underline"
                          onClick={() => {
                            setSelectedCliente(null)
                            setTitularConfirmada(false)
                          }}
                        >
                          quitar
                        </button>
                      </p>
                    )}
                    {!selectedCliente && clientes.length > 0 && (
                      <div className="max-h-36 overflow-y-auto border rounded-md divide-y">
                        {clientes.slice(0, 8).map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                            onClick={() => {
                              setSelectedCliente(c)
                              setTitularConfirmada(true)
                              setClientes([])
                              setClienteSearch(`${c.nombre} ${c.apellido}`)
                            }}
                          >
                            {c.nombre} {c.apellido}
                            <span className="text-xs text-muted-foreground ml-2">{c.telefono}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Nombre"
                        value={nuevoCliente.nombre}
                        onChange={(e) => {
                          setNuevoCliente((n) => ({ ...n, nombre: e.target.value }))
                          setDuplicadoDetectado(null)
                          setForzarCrearNueva(false)
                        }}
                      />
                      <Input
                        placeholder="Apellido"
                        value={nuevoCliente.apellido}
                        onChange={(e) => {
                          setNuevoCliente((n) => ({ ...n, apellido: e.target.value }))
                          setDuplicadoDetectado(null)
                          setForzarCrearNueva(false)
                        }}
                      />
                      <Input
                        placeholder="Teléfono"
                        value={nuevoCliente.telefono}
                        onChange={(e) => {
                          setNuevoCliente((n) => ({ ...n, telefono: e.target.value }))
                          setDuplicadoDetectado(null)
                          setForzarCrearNueva(false)
                        }}
                      />
                      <Input
                        placeholder="Email (opcional)"
                        value={nuevoCliente.email}
                        onChange={(e) => {
                          setNuevoCliente((n) => ({ ...n, email: e.target.value }))
                          setDuplicadoDetectado(null)
                          setForzarCrearNueva(false)
                        }}
                      />
                    </div>
                    {duplicadoDetectado && (
                      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-2 text-sm">
                        <p className="text-amber-900">
                          Ya existe una clienta con este{" "}
                          {duplicadoDetectado.motivo === "nombre" ? "nombre" : "teléfono/correo"}:{" "}
                          <strong>
                            {duplicadoDetectado.cliente.nombre} {duplicadoDetectado.cliente.apellido}
                          </strong>
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => usarClientaDuplicada(duplicadoDetectado.cliente)}
                          >
                            Usar esta clienta
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setForzarCrearNueva(true)
                              setDuplicadoDetectado(null)
                              toast.message("Se creará una clienta nueva al guardar. Confirma que es otra persona.")
                            }}
                          >
                            Es otra persona, crear de todos modos
                          </Button>
                        </div>
                      </div>
                    )}
                    {forzarCrearNueva && !duplicadoDetectado && (
                      <p className="text-xs text-amber-800">
                        Alta forzada: se creará una ficha nueva aunque haya nombres similares.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button
              onClick={() => void handleGuardar()}
              disabled={saving || !campana || folioStatus === "voided" || folioStatus === "checking"}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {folioStatus === "asignar" ? "Asignar clienta" : "Registrar VIP Pass"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmSaltoOpen} onOpenChange={setConfirmSaltoOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Folio fuera de orden</AlertDialogTitle>
            <AlertDialogDescription>
              El folio {folio} salta el siguiente libre
              {siguienteFisico != null
                ? ` (${formatearFolioVip(campana?.folioPrefijo || "", siguienteFisico)})`
                : ""}
              . ¿Continuar de todos modos?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmSaltoOpen(false)
                void ejecutarRegistro()
              }}
            >
              Confirmar y registrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
