export type VipPassEtiquetaPrecio = "regular" | "buen_fin"

export interface VipPassCampana {
  id: string
  nombre: string
  vigenciaHasta: string
  usosIncluidos: number
  folioPrefijo: string
  lineaDesde: number
  lineaHasta: number
  fisicoDesde: number
  fisicoHasta: number
  sucursalVentaId: string | null
  sucursalVentaNombre?: string | null
  activa: boolean
  createdAt?: string | null
}

export interface VipPassPrecio {
  id: string
  campanaId: string
  servicio: string
  etiqueta: VipPassEtiquetaPrecio
  precio: number
  vigenteDesde: string | null
  vigenteHasta: string | null
  activo: boolean
}

export type VipPassFolioEstado =
  | "disponible"
  | "vendido"
  | "entregado"
  | "vendido_en_linea"
  | "anulado"
export type VipPassCanal = "linea" | "fisico"

/** Item de GET /api/public/vip-sales (sin voided_at). */
export type LovableVipSaleItem = {
  folio: string
  status: "paid" | "voided"
  customer_name: string
  package_name: string
  amount: number
  purchased_at: string
}

export interface VipPassInventarioFolio {
  numero: number
  folio: string
  estado: VipPassFolioEstado
  canal: VipPassCanal
  clienta: string | null
  servicio: string | null
  giftCardId: string | null
  esHueco: boolean
}

export interface VipPassInventarioResumen {
  campana: VipPassCampana
  siguienteLibreLinea: number | null
  siguienteLibreFisico: number | null
  folios: VipPassInventarioFolio[]
  totalDisponibles: number
  /** @deprecated Preferir totalEntregados; se mantiene por compatibilidad. */
  totalVendidos: number
  totalEntregados: number
  totalVendidosEnLinea: number
  totalAnulados: number
  totalHuecos: number
  /** false si falló o expiró la consulta a luna27.mx */
  lovableConsultaOk: boolean
}
