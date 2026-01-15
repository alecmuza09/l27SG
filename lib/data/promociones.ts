import type { Promocion, Garantia } from "@/lib/types/promociones"
import { supabase } from '@/lib/supabase/client'

// Datos mock de promociones (para compatibilidad con localStorage)
export const promocionesData: Promocion[] = [
  {
    id: "promo-1",
    nombre: "Paquete Relax Completo",
    descripcion: "15% de descuento en el paquete completo de spa",
    tipo: "porcentaje",
    valor: 15,
    fechaInicio: "2024-10-01",
    fechaFin: "2024-12-31",
    serviciosAplicables: ["s-1", "s-2", "s-3"],
    sucursalesAplicables: ["1", "2", "3", "4", "5"],
    activa: true,
    usosMaximos: null,
    usosActuales: 45,
    codigoPromo: null,
  },
  {
    id: "promo-2",
    nombre: "Día de la Madre",
    descripcion: "20% en todos los masajes",
    tipo: "porcentaje",
    valor: 20,
    fechaInicio: "2024-05-01",
    fechaFin: "2024-05-12",
    serviciosAplicables: ["s-1"],
    sucursalesAplicables: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"],
    activa: false,
    usosMaximos: 100,
    usosActuales: 87,
    codigoPromo: "MAMA2024",
  },
  {
    id: "promo-3",
    nombre: "Descuento Nuevo Cliente",
    descripcion: "$200 de descuento en primera visita",
    tipo: "monto_fijo",
    valor: 200,
    fechaInicio: "2024-01-01",
    fechaFin: "2024-12-31",
    serviciosAplicables: [],
    sucursalesAplicables: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"],
    activa: true,
    usosMaximos: null,
    usosActuales: 234,
    codigoPromo: "BIENVENIDO",
  },
  {
    id: "promo-4",
    nombre: "Paquete Spa VIP",
    descripcion: "Masaje + Facial + Manicure por precio especial",
    tipo: "paquete",
    valor: 1500,
    fechaInicio: "2024-10-15",
    fechaFin: "2024-11-30",
    serviciosAplicables: ["s-1", "s-2", "s-4"],
    sucursalesAplicables: ["1", "2"],
    activa: true,
    usosMaximos: 50,
    usosActuales: 12,
    codigoPromo: null,
  },
  {
    id: "promo-5",
    nombre: "Miércoles de Uñas",
    descripcion: "2x1 en servicios de uñas los miércoles",
    tipo: "porcentaje",
    valor: 50,
    fechaInicio: "2024-01-01",
    fechaFin: "2024-12-31",
    serviciosAplicables: ["s-4", "s-5"],
    sucursalesAplicables: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"],
    activa: true,
    usosMaximos: null,
    usosActuales: 156,
    codigoPromo: null,
  },
]

// Datos mock de garantías
export const garantiasData: Garantia[] = [
  {
    id: "gar-1",
    ventaOriginalId: "v-100",
    clienteId: "c-1",
    clienteNombre: "María García López",
    servicioId: "s-4",
    servicioNombre: "Manicure",
    motivo: "El esmalte se desprendió a los 2 días",
    estado: "aprobada",
    fechaSolicitud: "2024-10-25T10:00:00",
    fechaResolucion: "2024-10-25T14:00:00",
    autorizadoPorId: "e-1",
    autorizadoPorNombre: "Ana Martínez",
  },
  {
    id: "gar-2",
    ventaOriginalId: "v-150",
    clienteId: "c-2",
    clienteNombre: "Roberto Hernández",
    servicioId: "s-2",
    servicioNombre: "Facial Hidratante",
    motivo: "Reacción alérgica a los productos",
    estado: "pendiente",
    fechaSolicitud: "2024-10-28T16:30:00",
    fechaResolucion: null,
    autorizadoPorId: null,
    autorizadoPorNombre: null,
  },
  {
    id: "gar-3",
    ventaOriginalId: "v-120",
    clienteId: "c-3",
    clienteNombre: "Laura Sánchez",
    servicioId: "s-6",
    servicioNombre: "Corte de Cabello",
    motivo: "No quedó como se solicitó",
    estado: "completada",
    fechaSolicitud: "2024-10-20T11:00:00",
    fechaResolucion: "2024-10-22T15:00:00",
    autorizadoPorId: "e-2",
    autorizadoPorNombre: "Carlos Ruiz",
  },
]

// Storage
const PROMOCIONES_KEY = "luna27_promociones"
const GARANTIAS_KEY = "luna27_garantias"

export function getPromociones(): Promocion[] {
  if (typeof window === "undefined") return promocionesData
  const stored = localStorage.getItem(PROMOCIONES_KEY)
  if (stored) return JSON.parse(stored)
  localStorage.setItem(PROMOCIONES_KEY, JSON.stringify(promocionesData))
  return promocionesData
}

export function savePromociones(promos: Promocion[]): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(PROMOCIONES_KEY, JSON.stringify(promos))
  }
}

export function getGarantias(): Garantia[] {
  if (typeof window === "undefined") return garantiasData
  const stored = localStorage.getItem(GARANTIAS_KEY)
  if (stored) return JSON.parse(stored)
  localStorage.setItem(GARANTIAS_KEY, JSON.stringify(garantiasData))
  return garantiasData
}

export function saveGarantias(garantias: Garantia[]): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(GARANTIAS_KEY, JSON.stringify(garantias))
  }
}

// Verificar si una promoción está vigente
export function isPromocionVigente(promo: Promocion): boolean {
  if (!promo.activa) return false
  const now = new Date()
  const inicio = new Date(promo.fechaInicio)
  const fin = new Date(promo.fechaFin)
  return now >= inicio && now <= fin
}

// Generar código de autorización para descuentos manuales
export function generarCodigoAutorizacion(): string {
  return Math.floor(1000 + Math.random() * 9000).toString()
}

// Obtener promociones desde Supabase
export async function getPromocionesFromDB(): Promise<Promocion[]> {
  try {
    const { data, error } = await supabase
      .from('promociones')
      .select('*')
      .order('fecha_inicio', { ascending: false })
    
    if (error) {
      console.error('Error obteniendo promociones:', error)
      return []
    }
    
    if (!data) return []
    
    return data.map((p: any) => ({
      id: p.id,
      nombre: p.nombre,
      descripcion: p.descripcion || '',
      tipo: p.tipo,
      valor: Number(p.valor) || 0,
      fechaInicio: p.fecha_inicio,
      fechaFin: p.fecha_fin,
      serviciosAplicables: p.servicios_aplicables || [],
      sucursalesAplicables: p.sucursales_aplicables || [],
      activa: p.activa ?? true,
      usosMaximos: p.usos_maximos || null,
      usosActuales: p.usos_actuales || 0,
      codigoPromo: p.codigo_promo || null,
    }))
  } catch (error) {
    console.error('Error inesperado obteniendo promociones:', error)
    return []
  }
}
