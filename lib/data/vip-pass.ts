import { supabase } from "@/lib/supabase/client"
import { registrarPagoEmisionGiftCard } from "@/lib/data/pagos"
import type {
  VipPassCampana,
  VipPassCanal,
  VipPassEtiquetaPrecio,
  VipPassFolioEstado,
  VipPassInventarioFolio,
  VipPassInventarioResumen,
  VipPassPrecio,
} from "@/lib/types/vip-pass"

export {
  esRegistroVipPass,
  usosRestantesVipPass,
  usosHechosVipPass,
} from "@/lib/data/gift-cards"

const fechaLocal = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function formatearFolioVip(prefijo: string, numero: number): string {
  return `${prefijo.trim()}${numero}`
}

export function parseNumeroFolioVip(
  codigo: string,
  prefijo: string,
): number | null {
  const c = codigo.trim()
  const p = prefijo.trim()
  if (!c || !p) return null
  const re = new RegExp(`^${escapeRegExp(p)}(\\d+)$`, "i")
  const m = c.match(re)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) ? n : null
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function canalFolioVip(
  numero: number,
  campana: Pick<VipPassCampana, "lineaDesde" | "lineaHasta" | "fisicoDesde" | "fisicoHasta">,
): VipPassCanal | null {
  if (numero >= campana.lineaDesde && numero <= campana.lineaHasta) return "linea"
  if (numero >= campana.fisicoDesde && numero <= campana.fisicoHasta) return "fisico"
  return null
}

/** VIP por type Lovable o por prefijo+número dentro de los rangos de la campaña activa. */
export function esFolioVipPassDetectado(opts: {
  codigo: string
  lovableType?: string | null
  campana?: Pick<
    VipPassCampana,
    "folioPrefijo" | "lineaDesde" | "lineaHasta" | "fisicoDesde" | "fisicoHasta"
  > | null
}): boolean {
  if (String(opts.lovableType ?? "").toLowerCase() === "vip_pass") return true
  if (!opts.campana) return false
  const num = parseNumeroFolioVip(opts.codigo, opts.campana.folioPrefijo)
  if (num == null) return false
  return canalFolioVip(num, opts.campana) != null
}

export const MSG_FOLIO_ES_VIP_PASS =
  "Este folio es una VIP Pass, regístralo con 'Registrar VIP Pass'" as const

function mapCampana(row: any): VipPassCampana {
  return {
    id: row.id,
    nombre: row.nombre,
    vigenciaHasta: String(row.vigencia_hasta).slice(0, 10),
    usosIncluidos: Number(row.usos_incluidos) || 10,
    folioPrefijo: String(row.folio_prefijo ?? "VIP"),
    lineaDesde: Number(row.linea_desde),
    lineaHasta: Number(row.linea_hasta),
    fisicoDesde: Number(row.fisico_desde),
    fisicoHasta: Number(row.fisico_hasta),
    sucursalVentaId: row.sucursal_venta_id || null,
    sucursalVentaNombre: row.sucursal?.nombre ?? null,
    activa: Boolean(row.activa),
    createdAt: row.created_at ?? null,
  }
}

function mapPrecio(row: any): VipPassPrecio {
  return {
    id: row.id,
    campanaId: row.campana_id,
    servicio: String(row.servicio ?? ""),
    etiqueta: (row.etiqueta === "buen_fin" ? "buen_fin" : "regular") as VipPassEtiquetaPrecio,
    precio: Number(row.precio) || 0,
    vigenteDesde: row.vigente_desde ? String(row.vigente_desde).slice(0, 10) : null,
    vigenteHasta: row.vigente_hasta ? String(row.vigente_hasta).slice(0, 10) : null,
    activo: Boolean(row.activo),
  }
}

function precioVigenteHoy(precio: VipPassPrecio, hoy: string): boolean {
  if (!precio.activo) return false
  if (precio.vigenteDesde && hoy < precio.vigenteDesde) return false
  if (precio.vigenteHasta && hoy > precio.vigenteHasta) return false
  return true
}

/** Precio a cobrar hoy para un servicio: Buen Fin vigente gana sobre regular. */
export function resolverPrecioVigenteServicio(
  precios: VipPassPrecio[],
  servicio: string,
  hoy = fechaLocal(),
): VipPassPrecio | null {
  const delServicio = precios.filter(
    (p) => p.servicio === servicio && precioVigenteHoy(p, hoy),
  )
  if (delServicio.length === 0) return null
  const buenFin = delServicio.find((p) => p.etiqueta === "buen_fin")
  if (buenFin) return buenFin
  return delServicio.find((p) => p.etiqueta === "regular") ?? delServicio[0] ?? null
}

export async function getVipPassCampanas(): Promise<VipPassCampana[]> {
  const { data, error } = await (supabase as any)
    .from("vip_pass_campanas")
    .select("*, sucursal:sucursales(nombre)")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error listando campañas VIP Pass:", error)
    return []
  }
  return (data ?? []).map(mapCampana)
}

export async function getVipPassCampanaActiva(): Promise<VipPassCampana | null> {
  const { data, error } = await (supabase as any)
    .from("vip_pass_campanas")
    .select("*, sucursal:sucursales(nombre)")
    .eq("activa", true)
    .order("created_at", { ascending: false })
    .limit(1)

  if (error) {
    console.error("Error obteniendo campaña VIP activa:", error)
    return null
  }
  const row = Array.isArray(data) ? data[0] : data
  return row ? mapCampana(row) : null
}

export async function getVipPassCampanaById(id: string): Promise<VipPassCampana | null> {
  const { data, error } = await (supabase as any)
    .from("vip_pass_campanas")
    .select("*, sucursal:sucursales(nombre)")
    .eq("id", id)
    .maybeSingle()
  if (error || !data) return null
  return mapCampana(data)
}

export type VipPassCampanaInput = {
  nombre: string
  vigenciaHasta: string
  usosIncluidos: number
  folioPrefijo: string
  lineaDesde: number
  lineaHasta: number
  fisicoDesde: number
  fisicoHasta: number
  sucursalVentaId?: string | null
  activa?: boolean
}

function validarRangosCampana(input: VipPassCampanaInput): string | null {
  if (!input.nombre.trim()) return "El nombre es obligatorio"
  if (!input.folioPrefijo.trim()) return "El prefijo de folio es obligatorio"
  if (!input.vigenciaHasta) return "La vigencia es obligatoria"
  if (input.usosIncluidos <= 0) return "Los usos incluidos deben ser mayores a 0"
  if (input.lineaDesde > input.lineaHasta) return "Rango en línea inválido"
  if (input.fisicoDesde > input.fisicoHasta) return "Rango físico inválido"
  return null
}

async function desactivarOtrasCampanas(exceptoId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from("vip_pass_campanas")
    .update({ activa: false })
    .eq("activa", true)
    .neq("id", exceptoId)
  if (error) console.error("Error desactivando otras campañas VIP:", error)
}

export async function crearVipPassCampana(
  input: VipPassCampanaInput,
): Promise<{ success: boolean; campana?: VipPassCampana; error?: string }> {
  const err = validarRangosCampana(input)
  if (err) return { success: false, error: err }

  const activar = input.activa !== false

  const { data, error } = await (supabase as any)
    .from("vip_pass_campanas")
    .insert({
      nombre: input.nombre.trim(),
      vigencia_hasta: input.vigenciaHasta,
      usos_incluidos: input.usosIncluidos,
      folio_prefijo: input.folioPrefijo.trim(),
      linea_desde: input.lineaDesde,
      linea_hasta: input.lineaHasta,
      fisico_desde: input.fisicoDesde,
      fisico_hasta: input.fisicoHasta,
      sucursal_venta_id: input.sucursalVentaId || null,
      activa: activar,
    })
    .select("*, sucursal:sucursales(nombre)")
    .single()

  if (error || !data) return { success: false, error: error?.message || "Error creando campaña" }
  if (activar) await desactivarOtrasCampanas(data.id as string)
  return { success: true, campana: mapCampana(data) }
}

export async function actualizarVipPassCampana(
  id: string,
  input: VipPassCampanaInput,
): Promise<{ success: boolean; campana?: VipPassCampana; error?: string }> {
  const err = validarRangosCampana(input)
  if (err) return { success: false, error: err }

  const activar = Boolean(input.activa)

  const { data, error } = await (supabase as any)
    .from("vip_pass_campanas")
    .update({
      nombre: input.nombre.trim(),
      vigencia_hasta: input.vigenciaHasta,
      usos_incluidos: input.usosIncluidos,
      folio_prefijo: input.folioPrefijo.trim(),
      linea_desde: input.lineaDesde,
      linea_hasta: input.lineaHasta,
      fisico_desde: input.fisicoDesde,
      fisico_hasta: input.fisicoHasta,
      sucursal_venta_id: input.sucursalVentaId || null,
      activa: activar,
    })
    .eq("id", id)
    .select("*, sucursal:sucursales(nombre)")
    .single()

  if (error || !data) return { success: false, error: error?.message || "Error actualizando campaña" }
  if (activar) await desactivarOtrasCampanas(id)
  return { success: true, campana: mapCampana(data) }
}

/** "Comprada por: nombre · teléfono · correo" (omite vacíos). */
export function formatoNotasCompradoraVip(opts: {
  nombre?: string | null
  telefono?: string | null
  email?: string | null
}): string | null {
  const parts = [opts.nombre, opts.telefono, opts.email]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
  if (parts.length === 0) return null
  return `Comprada por: ${parts.join(" · ")}`
}

export function mergeNotasGiftCard(
  existentes: string | null | undefined,
  nuevas: string | null | undefined,
): string | null {
  const next = (nuevas ?? "").trim()
  const prev = (existentes ?? "").trim()
  if (!next) return prev || null
  if (!prev) return next
  if (prev.includes(next)) return prev
  return `${prev}\n${next}`
}

export async function getVipPassPrecios(campanaId: string): Promise<VipPassPrecio[]> {
  const { data, error } = await (supabase as any)
    .from("vip_pass_precios")
    .select("*")
    .eq("campana_id", campanaId)
    .order("servicio", { ascending: true })
    .order("etiqueta", { ascending: true })

  if (error) {
    console.error("Error listando precios VIP:", error)
    return []
  }
  return (data ?? []).map(mapPrecio)
}

export type VipPassPrecioInput = {
  campanaId: string
  servicio: string
  etiqueta: VipPassEtiquetaPrecio
  precio: number
  vigenteDesde?: string | null
  vigenteHasta?: string | null
  activo?: boolean
}

export async function crearVipPassPrecio(
  input: VipPassPrecioInput,
): Promise<{ success: boolean; precio?: VipPassPrecio; error?: string }> {
  if (!input.servicio.trim()) return { success: false, error: "El servicio es obligatorio" }
  if (!(input.precio > 0)) return { success: false, error: "El precio debe ser mayor a 0" }

  const { data, error } = await (supabase as any)
    .from("vip_pass_precios")
    .insert({
      campana_id: input.campanaId,
      servicio: input.servicio.trim(),
      etiqueta: input.etiqueta,
      precio: input.precio,
      vigente_desde: input.vigenteDesde || null,
      vigente_hasta: input.vigenteHasta || null,
      activo: input.activo !== false,
    })
    .select("*")
    .single()

  if (error || !data) return { success: false, error: error?.message || "Error creando precio" }
  return { success: true, precio: mapPrecio(data) }
}

export async function actualizarVipPassPrecio(
  id: string,
  input: Omit<VipPassPrecioInput, "campanaId"> & { campanaId?: string },
): Promise<{ success: boolean; precio?: VipPassPrecio; error?: string }> {
  if (!input.servicio.trim()) return { success: false, error: "El servicio es obligatorio" }
  if (!(input.precio > 0)) return { success: false, error: "El precio debe ser mayor a 0" }

  const { data, error } = await (supabase as any)
    .from("vip_pass_precios")
    .update({
      servicio: input.servicio.trim(),
      etiqueta: input.etiqueta,
      precio: input.precio,
      vigente_desde: input.vigenteDesde || null,
      vigente_hasta: input.vigenteHasta || null,
      activo: input.activo !== false,
    })
    .eq("id", id)
    .select("*")
    .single()

  if (error || !data) return { success: false, error: error?.message || "Error actualizando precio" }
  return { success: true, precio: mapPrecio(data) }
}

/** Códigos VIP ya registrados (case-insensitive) para un rango de campaña. */
async function getGiftCardsEnRangoCampana(
  campana: VipPassCampana,
): Promise<Map<string, any>> {
  const map = new Map<string, any>()
  const PAGE = 1000
  let offset = 0

  for (;;) {
    const { data, error } = await (supabase as any)
      .from("gift_cards")
      .select(
        "id, codigo, estado, cliente_id, vip_servicio, origen, vip_campana_id, tipo, cliente:clientes(nombre, apellido)",
      )
      .eq("tipo", "vip_pass")
      .order("codigo", { ascending: true })
      .range(offset, offset + PAGE - 1)

    if (error) {
      console.error("Error inventario VIP:", error)
      break
    }
    if (!data?.length) break

    for (const row of data) {
      const num = parseNumeroFolioVip(String(row.codigo ?? ""), campana.folioPrefijo)
      if (num == null) continue
      const canal = canalFolioVip(num, campana)
      if (!canal) continue
      if (row.vip_campana_id && row.vip_campana_id !== campana.id) continue
      map.set(String(row.codigo).toUpperCase(), row)
    }

    if (data.length < PAGE) break
    offset += PAGE
  }

  return map
}

export function siguienteFolioLibreEnRango(
  desde: number,
  hasta: number,
  ocupados: Set<number>,
): number | null {
  for (let n = desde; n <= hasta; n++) {
    if (!ocupados.has(n)) return n
  }
  return null
}

/** Detecta si el número elegido salta el siguiente libre (hueco intencional). */
export function folioSaltaOrden(elegido: number, siguienteLibre: number | null): boolean {
  if (siguienteLibre == null) return false
  return elegido > siguienteLibre
}

export async function getInventarioVipPassCampana(
  campanaId: string,
): Promise<VipPassInventarioResumen | null> {
  const campana = await getVipPassCampanaById(campanaId)
  if (!campana) return null

  const cards = await getGiftCardsEnRangoCampana(campana)
  const byNumero = new Map<number, any>()
  for (const row of cards.values()) {
    const num = parseNumeroFolioVip(String(row.codigo ?? ""), campana.folioPrefijo)
    if (num != null) byNumero.set(num, row)
  }

  const ocupadosLinea = new Set<number>()
  const ocupadosFisico = new Set<number>()
  for (const n of byNumero.keys()) {
    const canal = canalFolioVip(n, campana)
    if (canal === "linea") ocupadosLinea.add(n)
    if (canal === "fisico") ocupadosFisico.add(n)
  }

  const siguienteLibreLinea = siguienteFolioLibreEnRango(
    campana.lineaDesde,
    campana.lineaHasta,
    ocupadosLinea,
  )
  const siguienteLibreFisico = siguienteFolioLibreEnRango(
    campana.fisicoDesde,
    campana.fisicoHasta,
    ocupadosFisico,
  )

  const folios: VipPassInventarioFolio[] = []
  const pushRango = (desde: number, hasta: number, canal: VipPassCanal) => {
    const vendidosOrdenados = [...byNumero.keys()]
      .filter((n) => n >= desde && n <= hasta)
      .sort((a, b) => a - b)

    for (let n = desde; n <= hasta; n++) {
      const row = byNumero.get(n)
      let estado: VipPassFolioEstado = "disponible"
      let clienta: string | null = null
      let servicio: string | null = null
      let giftCardId: string | null = null

      if (row) {
        giftCardId = row.id
        servicio = row.vip_servicio || null
        clienta = row.cliente
          ? `${row.cliente.nombre ?? ""} ${row.cliente.apellido ?? ""}`.trim() || null
          : null
        estado = row.estado === "cancelada" ? "anulado" : "vendido"
      }

      const esHueco =
        !row &&
        vendidosOrdenados.length > 0 &&
        n > vendidosOrdenados[0] &&
        n < vendidosOrdenados[vendidosOrdenados.length - 1] &&
        vendidosOrdenados.some((v) => v < n) &&
        vendidosOrdenados.some((v) => v > n)

      folios.push({
        numero: n,
        folio: formatearFolioVip(campana.folioPrefijo, n),
        estado,
        canal,
        clienta,
        servicio,
        giftCardId,
        esHueco: Boolean(esHueco),
      })
    }
  }

  pushRango(campana.lineaDesde, campana.lineaHasta, "linea")
  pushRango(campana.fisicoDesde, campana.fisicoHasta, "fisico")

  return {
    campana,
    siguienteLibreLinea,
    siguienteLibreFisico,
    folios,
    totalDisponibles: folios.filter((f) => f.estado === "disponible").length,
    totalVendidos: folios.filter((f) => f.estado === "vendido").length,
    totalAnulados: folios.filter((f) => f.estado === "anulado").length,
    totalHuecos: folios.filter((f) => f.esHueco).length,
  }
}

export async function giftCardExisteCodigoInsensitive(codigo: string): Promise<boolean> {
  const { data, error } = await (supabase as any)
    .from("gift_cards")
    .select("id")
    .ilike("codigo", codigo.trim())
    .limit(1)
  if (error) {
    console.error("Error comprobando código VIP:", error)
    return false
  }
  return Array.isArray(data) && data.length > 0
}

export type CrearVipPassParams = {
  codigo: string
  clienteId: string
  servicio: string
  monto: number
  metodoPago?: string | null
  origen: "sucursal" | "en_linea"
  campana: VipPassCampana
  empleadoEmisorId?: string | null
  /** Si ya existe la GC sin clienta, solo asigna (no duplica). */
  asignarClientaSolo?: boolean
  giftCardIdExistente?: string | null
  fechaVencimiento?: string | null
  vipUsosTotal?: number | null
  /** Línea: "Comprada por: …" a fusionar en gift_cards.notas sin borrar lo previo. */
  notasCompradora?: string | null
}

export async function crearOAsignarVipPass(
  params: CrearVipPassParams,
): Promise<{ success: boolean; giftCardId?: string; codigo?: string; error?: string; advertenciaPago?: string }> {
  try {
    const codigo = params.codigo.trim()
    if (!codigo) return { success: false, error: "Folio obligatorio" }
    if (!params.clienteId) return { success: false, error: "La clienta es obligatoria" }
    if (!params.campana.sucursalVentaId) {
      return { success: false, error: "La campaña no tiene sucursal de venta configurada" }
    }

    if (params.asignarClientaSolo && params.giftCardIdExistente) {
      const { data: actual, error: fetchErr } = await (supabase as any)
        .from("gift_cards")
        .select("vip_usos_total, fecha_vencimiento, notas")
        .eq("id", params.giftCardIdExistente)
        .maybeSingle()
      if (fetchErr) return { success: false, error: fetchErr.message }

      const usosFallback = params.vipUsosTotal ?? params.campana.usosIncluidos ?? 10
      const patch: Record<string, unknown> = {
        cliente_id: params.clienteId,
        tipo: "vip_pass",
        vip_servicio: params.servicio || null,
        vip_campana_id: params.campana.id,
        updated_at: new Date().toISOString(),
      }
      if (actual?.vip_usos_total == null) {
        patch.vip_usos_total = usosFallback
      }
      if (!actual?.fecha_vencimiento) {
        patch.fecha_vencimiento = params.campana.vigenciaHasta
      }
      const notasMerged = mergeNotasGiftCard(actual?.notas, params.notasCompradora)
      if (notasMerged) patch.notas = notasMerged

      const { error } = await (supabase as any)
        .from("gift_cards")
        .update(patch)
        .eq("id", params.giftCardIdExistente)
      if (error) return { success: false, error: error.message }
      return { success: true, giftCardId: params.giftCardIdExistente, codigo }
    }

    const existe = await giftCardExisteCodigoInsensitive(codigo)
    if (existe) return { success: false, error: "Este folio ya está registrado" }

    const hoy = fechaLocal()
    const monto = Number(params.monto) || 0
    if (monto <= 0) return { success: false, error: "El monto debe ser mayor a 0" }

    const usosTotal = params.vipUsosTotal ?? params.campana.usosIncluidos ?? 10
    const fechaVenc =
      params.fechaVencimiento || params.campana.vigenciaHasta || null

    const insertPayload: Record<string, unknown> = {
      codigo,
      monto_inicial: monto,
      saldo_actual: monto,
      estado: "activa",
      sucursal_id: params.campana.sucursalVentaId,
      cliente_id: params.clienteId,
      empleado_emisor_id: params.empleadoEmisorId || null,
      fecha_emision: hoy,
      fecha_activacion: hoy,
      fecha_vencimiento: fechaVenc,
      origen: params.origen,
      tipo: "vip_pass",
      vip_servicio: params.servicio,
      vip_campana_id: params.campana.id,
      vip_usos_total: usosTotal,
    }
    if (params.metodoPago) insertPayload.metodo_pago = params.metodoPago
    if (params.notasCompradora?.trim()) insertPayload.notas = params.notasCompradora.trim()

    const { data: gcData, error: gcError } = await (supabase as any)
      .from("gift_cards")
      .insert(insertPayload)
      .select("id, codigo")
      .single()

    if (gcError || !gcData) {
      const dup =
        gcError &&
        typeof gcError === "object" &&
        (gcError as { code?: string }).code === "23505"
      if (dup) return { success: false, error: "Este folio ya está registrado" }
      return { success: false, error: gcError?.message || "Error creando VIP Pass" }
    }

    const esLinea = params.origen === "en_linea"
    const notasEmision = esLinea
      ? `VIP Pass · Tienda en línea · ${params.servicio} · ${gcData.codigo}${params.metodoPago ? ` · Pago: ${params.metodoPago}` : ""}`
      : params.metodoPago
        ? `VIP Pass · ${params.servicio} · Pago: ${params.metodoPago}`
        : `VIP Pass · ${params.servicio}`

    const pagoRes = await registrarPagoEmisionGiftCard({
      giftCardId: gcData.id,
      codigo: gcData.codigo,
      monto,
      sucursalId: params.campana.sucursalVentaId,
      clienteId: params.clienteId,
      empleadoId: params.empleadoEmisorId ?? null,
      metodoPagoRaw: params.metodoPago ?? null,
      fecha: hoy,
      descripcionServicio: params.servicio,
      ventaTiendaEnLinea: esLinea,
    })

    if (!pagoRes.success && !pagoRes.skipped) {
      console.error("[crearOAsignarVipPass] Cobro no registrado:", pagoRes.error)
    }

    await (supabase as any).from("gift_card_transacciones").insert({
      gift_card_id: gcData.id,
      tipo: "emision",
      monto,
      saldo_anterior: 0,
      saldo_nuevo: monto,
      venta_id: pagoRes.pagoId ?? null,
      empleado_id: params.empleadoEmisorId || null,
      fecha: hoy,
      notas: notasEmision,
    })

    const advertenciaPago =
      !pagoRes.success && !pagoRes.skipped
        ? (pagoRes.error ?? "No se registró el cobro en caja")
        : undefined

    return {
      success: true,
      giftCardId: gcData.id,
      codigo: gcData.codigo,
      ...(advertenciaPago ? { advertenciaPago } : {}),
    }
  } catch (err: any) {
    return { success: false, error: err?.message || "Error inesperado" }
  }
}

/** Servicios distintos con precio vigente hoy (para el selector de registro físico). */
export function serviciosConPrecioVigente(precios: VipPassPrecio[], hoy = fechaLocal()): {
  servicio: string
  precio: VipPassPrecio
}[] {
  const servicios = [...new Set(precios.map((p) => p.servicio))]
  const out: { servicio: string; precio: VipPassPrecio }[] = []
  for (const s of servicios) {
    const precio = resolverPrecioVigenteServicio(precios, s, hoy)
    if (precio) out.push({ servicio: s, precio })
  }
  return out.sort((a, b) => a.servicio.localeCompare(b.servicio, "es"))
}
