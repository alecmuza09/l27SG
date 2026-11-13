export interface GiftCard {
  id: string
  codigo: string
  saldoInicial: number
  saldoActual: number
  estado: "pendiente" | "activa" | "agotada" | "cancelada" | "expirada"
  fechaEmision: string
  fechaActivacion: string | null
  fechaExpiracion: string | null
  clienteId: string | null
  clienteNombre: string | null
  sucursalId: string
  sucursalNombre: string
  empleadoEmisorId: string
  empleadoEmisorNombre: string
  /** Método de pago usado al comprar la gift card */
  metodoPago?: string | null
  /** gift_card | vip_pass */
  tipo?: string | null
  vipServicio?: string | null
  vipUsosTotal?: number | null
  vipCampanaId?: string | null
  origen?: string | null
}

export interface GiftCardTransaccion {
  id: string
  giftCardId: string
  tipo: "emision" | "activacion" | "canje" | "recarga" | "cancelacion" | "vip_pass" | "uso" | "compra" | "reembolso"
  monto: number
  saldoAnterior: number
  saldoNuevo: number
  ventaId: string | null
  empleadoId: string
  empleadoNombre: string
  fecha: string
  notas: string | null
}

export interface CreateGiftCardData {
  saldoInicial: number
  fechaExpiracion?: string | null
  clienteId?: string | null
  sucursalId: string
}
