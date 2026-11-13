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

export type VipPassFolioEstado = "disponible" | "vendido" | "anulado"
export type VipPassCanal = "linea" | "fisico"

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
  totalVendidos: number
  totalAnulados: number
  totalHuecos: number
}
