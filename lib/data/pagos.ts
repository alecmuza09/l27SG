// Mock data for payments

export interface Pago {
  id: string
  citaId: string
  clienteId: string
  clienteNombre: string
  monto: number
  metodoPago: "efectivo" | "tarjeta" | "transferencia" | "otro"
  estado: "pendiente" | "completado" | "reembolsado" | "cancelado"
  fecha: string
  hora: string
  sucursalId: string
  empleadoId: string
  empleadoNombre: string
  servicios: string[]
  notas?: string
  referencia?: string
}

export const MOCK_PAGOS: Pago[] = [
  {
    id: "1",
    citaId: "1",
    clienteId: "1",
    clienteNombre: "Ana García",
    monto: 850,
    metodoPago: "tarjeta",
    estado: "completado",
    fecha: "2024-01-18",
    hora: "11:00",
    sucursalId: "1",
    empleadoId: "1",
    empleadoNombre: "María González",
    servicios: ["Masaje Relajante"],
    referencia: "TXN-2024-001",
  },
  {
    id: "2",
    citaId: "2",
    clienteId: "2",
    clienteNombre: "Carlos López",
    monto: 650,
    metodoPago: "efectivo",
    estado: "completado",
    fecha: "2024-01-18",
    hora: "12:15",
    sucursalId: "1",
    empleadoId: "2",
    empleadoNombre: "Laura Martínez",
    servicios: ["Facial Hidratante"],
  },
  {
    id: "3",
    citaId: "3",
    clienteId: "3",
    clienteNombre: "Sofia Martínez",
    monto: 750,
    metodoPago: "tarjeta",
    estado: "pendiente",
    fecha: "2024-01-18",
    hora: "14:30",
    sucursalId: "1",
    empleadoId: "3",
    empleadoNombre: "Carmen López",
    servicios: ["Manicure & Pedicure"],
  },
  {
    id: "4",
    citaId: "4",
    clienteId: "4",
    clienteNombre: "Roberto Díaz",
    monto: 1200,
    metodoPago: "transferencia",
    estado: "completado",
    fecha: "2024-01-18",
    hora: "16:00",
    sucursalId: "1",
    empleadoId: "1",
    empleadoNombre: "María González",
    servicios: ["Tratamiento Corporal"],
    referencia: "TRANS-2024-045",
  },
  {
    id: "5",
    citaId: "5",
    clienteId: "5",
    clienteNombre: "Laura Hernández",
    monto: 850,
    metodoPago: "tarjeta",
    estado: "completado",
    fecha: "2024-01-17",
    hora: "17:00",
    sucursalId: "1",
    empleadoId: "2",
    empleadoNombre: "Laura Martínez",
    servicios: ["Masaje Relajante"],
    referencia: "TXN-2024-002",
  },
]

export function getPagosByFecha(fecha: string): Pago[] {
  return MOCK_PAGOS.filter((p) => p.fecha === fecha)
}

export function getPagosPendientes(): Pago[] {
  return MOCK_PAGOS.filter((p) => p.estado === "pendiente")
}
