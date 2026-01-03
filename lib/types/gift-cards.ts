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
}

export interface GiftCardTransaccion {
  id: string
  giftCardId: string
  tipo: "emision" | "activacion" | "canje" | "recarga" | "cancelacion"
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
