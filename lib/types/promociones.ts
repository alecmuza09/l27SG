export interface Promocion {
  id: string
  nombre: string
  descripcion: string
  tipo: "porcentaje" | "monto_fijo" | "paquete"
  valor: number
  fechaInicio: string
  fechaFin: string
  serviciosAplicables: string[] // IDs de servicios
  sucursalesAplicables: string[] // IDs de sucursales
  activa: boolean
  usosMaximos: number | null
  usosActuales: number
  codigoPromo: string | null
}

export interface Descuento {
  id: string
  tipo: "promocion" | "descuento_manual" | "cortesia" | "garantia"
  promocionId: string | null
  nombre: string
  valor: number
  esPorcentaje: boolean
  montoAjuste: number
  motivo: string
  autorizadoPorId: string | null
  autorizadoPorNombre: string | null
  codigoAutorizacion: string | null
}

export interface Garantia {
  id: string
  ventaOriginalId: string
  clienteId: string
  clienteNombre: string
  servicioId: string
  servicioNombre: string
  motivo: string
  estado: "pendiente" | "aprobada" | "rechazada" | "completada"
  fechaSolicitud: string
  fechaResolucion: string | null
  autorizadoPorId: string | null
  autorizadoPorNombre: string | null
}

export type TipoAjuste = "promocion" | "descuento_manual" | "cortesia" | "garantia"

export const tipoAjusteColors: Record<TipoAjuste, { bg: string; text: string; label: string }> = {
  promocion: { bg: "bg-green-100", text: "text-green-800", label: "Promoción" },
  descuento_manual: { bg: "bg-orange-100", text: "text-orange-800", label: "Descuento" },
  cortesia: { bg: "bg-blue-100", text: "text-blue-800", label: "Cortesía" },
  garantia: { bg: "bg-red-100", text: "text-red-800", label: "Garantía" },
}
