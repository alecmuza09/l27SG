import type { GiftCard, GiftCardTransaccion } from "@/lib/types/gift-cards"

// Generador de código único para gift cards
export function generarCodigoGiftCard(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  const part1 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
  const part2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
  return `GC-${part1}-${part2}`
}

// Datos mock de gift cards
export const giftCardsData: GiftCard[] = [
  {
    id: "gc-1",
    codigo: "GC-LUNA-2701",
    saldoInicial: 1000,
    saldoActual: 750,
    estado: "activa",
    fechaEmision: "2024-10-15T10:00:00",
    fechaActivacion: "2024-10-15T10:05:00",
    fechaExpiracion: "2025-10-15",
    clienteId: "c-1",
    clienteNombre: "María García López",
    sucursalId: "1",
    sucursalNombre: "Luna27 Cumbres",
    empleadoEmisorId: "e-1",
    empleadoEmisorNombre: "Ana Martínez",
  },
  {
    id: "gc-2",
    codigo: "GC-RELA-5432",
    saldoInicial: 500,
    saldoActual: 500,
    estado: "pendiente",
    fechaEmision: "2024-10-28T14:30:00",
    fechaActivacion: null,
    fechaExpiracion: null,
    clienteId: null,
    clienteNombre: null,
    sucursalId: "2",
    sucursalNombre: "Luna27 San Pedro",
    empleadoEmisorId: "e-2",
    empleadoEmisorNombre: "Carlos Ruiz",
  },
  {
    id: "gc-3",
    codigo: "GC-SPA7-8899",
    saldoInicial: 2000,
    saldoActual: 0,
    estado: "agotada",
    fechaEmision: "2024-08-01T09:00:00",
    fechaActivacion: "2024-08-01T09:10:00",
    fechaExpiracion: "2025-08-01",
    clienteId: "c-2",
    clienteNombre: "Roberto Hernández",
    sucursalId: "1",
    sucursalNombre: "Luna27 Cumbres",
    empleadoEmisorId: "e-1",
    empleadoEmisorNombre: "Ana Martínez",
  },
  {
    id: "gc-4",
    codigo: "GC-BIEN-1234",
    saldoInicial: 1500,
    saldoActual: 1500,
    estado: "cancelada",
    fechaEmision: "2024-09-10T11:00:00",
    fechaActivacion: "2024-09-10T11:30:00",
    fechaExpiracion: null,
    clienteId: "c-3",
    clienteNombre: "Laura Sánchez",
    sucursalId: "3",
    sucursalNombre: "Luna27 Valle",
    empleadoEmisorId: "e-3",
    empleadoEmisorNombre: "Patricia López",
  },
]

// Datos mock de transacciones
export const giftCardTransaccionesData: GiftCardTransaccion[] = [
  {
    id: "gct-1",
    giftCardId: "gc-1",
    tipo: "emision",
    monto: 1000,
    saldoAnterior: 0,
    saldoNuevo: 1000,
    ventaId: null,
    empleadoId: "e-1",
    empleadoNombre: "Ana Martínez",
    fecha: "2024-10-15T10:00:00",
    notas: "Emisión de gift card",
  },
  {
    id: "gct-2",
    giftCardId: "gc-1",
    tipo: "activacion",
    monto: 0,
    saldoAnterior: 1000,
    saldoNuevo: 1000,
    ventaId: "v-101",
    empleadoId: "e-1",
    empleadoNombre: "Ana Martínez",
    fecha: "2024-10-15T10:05:00",
    notas: "Activación por venta",
  },
  {
    id: "gct-3",
    giftCardId: "gc-1",
    tipo: "canje",
    monto: 250,
    saldoAnterior: 1000,
    saldoNuevo: 750,
    ventaId: "v-150",
    empleadoId: "e-2",
    empleadoNombre: "Carlos Ruiz",
    fecha: "2024-10-20T16:45:00",
    notas: "Pago parcial en servicios",
  },
  {
    id: "gct-4",
    giftCardId: "gc-3",
    tipo: "emision",
    monto: 2000,
    saldoAnterior: 0,
    saldoNuevo: 2000,
    ventaId: null,
    empleadoId: "e-1",
    empleadoNombre: "Ana Martínez",
    fecha: "2024-08-01T09:00:00",
    notas: "Gift card premium",
  },
  {
    id: "gct-5",
    giftCardId: "gc-3",
    tipo: "canje",
    monto: 2000,
    saldoAnterior: 2000,
    saldoNuevo: 0,
    ventaId: "v-200",
    empleadoId: "e-1",
    empleadoNombre: "Ana Martínez",
    fecha: "2024-09-15T14:00:00",
    notas: "Canje total - Paquete Spa Completo",
  },
]

// Store local para persistencia
const STORAGE_KEY = "luna27_gift_cards"
const TRANSACTIONS_STORAGE_KEY = "luna27_gift_card_transactions"

export function getGiftCards(): GiftCard[] {
  if (typeof window === "undefined") return giftCardsData
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    return JSON.parse(stored)
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(giftCardsData))
  return giftCardsData
}

export function saveGiftCards(cards: GiftCard[]): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cards))
  }
}

export function getGiftCardTransacciones(giftCardId?: string): GiftCardTransaccion[] {
  if (typeof window === "undefined") return giftCardTransaccionesData
  const stored = localStorage.getItem(TRANSACTIONS_STORAGE_KEY)
  let transactions: GiftCardTransaccion[]
  if (stored) {
    transactions = JSON.parse(stored)
  } else {
    localStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify(giftCardTransaccionesData))
    transactions = giftCardTransaccionesData
  }
  if (giftCardId) {
    return transactions.filter((t) => t.giftCardId === giftCardId)
  }
  return transactions
}

export function saveGiftCardTransacciones(transactions: GiftCardTransaccion[]): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify(transactions))
  }
}

export function addTransaccion(transaccion: GiftCardTransaccion): void {
  const transactions = getGiftCardTransacciones()
  transactions.push(transaccion)
  saveGiftCardTransacciones(transactions)
}
