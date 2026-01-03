import type { Vacacion, SaldoVacaciones, PeriodoBloqueado } from "@/lib/types/vacaciones"
import { empleadosData } from "@/lib/data"

// Datos mock de vacaciones
export const vacacionesData: Vacacion[] = [
  {
    id: "vac-1",
    empleadoId: "e-1",
    empleadoNombre: "Ana Martínez",
    sucursalId: "1",
    sucursalNombre: "Luna27 Cumbres",
    fechaInicio: "2024-12-20",
    fechaFin: "2024-12-31",
    diasSolicitados: 10,
    estado: "aprobada",
    motivoRechazo: null,
    aprobadoPorId: "admin",
    aprobadoPorNombre: "Admin Luna27",
    fechaSolicitud: "2024-10-15T10:00:00",
    fechaResolucion: "2024-10-16T14:00:00",
    notas: "Vacaciones de fin de año",
  },
  {
    id: "vac-2",
    empleadoId: "e-2",
    empleadoNombre: "Carlos Ruiz",
    sucursalId: "2",
    sucursalNombre: "Luna27 San Pedro",
    fechaInicio: "2024-11-15",
    fechaFin: "2024-11-22",
    diasSolicitados: 6,
    estado: "pendiente",
    motivoRechazo: null,
    aprobadoPorId: null,
    aprobadoPorNombre: null,
    fechaSolicitud: "2024-10-28T09:30:00",
    fechaResolucion: null,
    notas: "Asuntos familiares",
  },
  {
    id: "vac-3",
    empleadoId: "e-3",
    empleadoNombre: "Patricia López",
    sucursalId: "3",
    sucursalNombre: "Luna27 Valle",
    fechaInicio: "2024-11-01",
    fechaFin: "2024-11-05",
    diasSolicitados: 4,
    estado: "rechazada",
    motivoRechazo: "Coincide con periodo de alta demanda",
    aprobadoPorId: "admin",
    aprobadoPorNombre: "Admin Luna27",
    fechaSolicitud: "2024-10-20T11:00:00",
    fechaResolucion: "2024-10-21T09:00:00",
    notas: null,
  },
  {
    id: "vac-4",
    empleadoId: "e-4",
    empleadoNombre: "Laura Sánchez",
    sucursalId: "1",
    sucursalNombre: "Luna27 Cumbres",
    fechaInicio: "2024-11-25",
    fechaFin: "2024-11-29",
    diasSolicitados: 5,
    estado: "pendiente",
    motivoRechazo: null,
    aprobadoPorId: null,
    aprobadoPorNombre: null,
    fechaSolicitud: "2024-10-29T14:00:00",
    fechaResolucion: null,
    notas: "Viaje programado",
  },
]

// Datos mock de saldo de vacaciones (manual)
export const saldoVacacionesData: SaldoVacaciones[] = empleadosData.map((emp, index) => ({
  id: `saldo-${emp.id}`,
  empleadoId: emp.id,
  empleadoNombre: emp.nombre,
  anio: 2024,
  diasCorrespondientes: 12 + index * 2, // Simulación manual
  diasTomados: index * 3,
  diasDisponibles: 12 + index * 2 - index * 3,
  fechaActualizacion: new Date().toISOString(),
}))

// Periodos bloqueados
export const periodosBloqueadosData: PeriodoBloqueado[] = [
  {
    id: "pb-1",
    sucursalId: "all",
    sucursalNombre: "Todas las Sucursales",
    fechaInicio: "2024-12-24",
    fechaFin: "2024-12-25",
    motivo: "Navidad - Cierre general",
    creadoPorId: "admin",
    creadoPorNombre: "Admin Luna27",
  },
  {
    id: "pb-2",
    sucursalId: "all",
    sucursalNombre: "Todas las Sucursales",
    fechaInicio: "2024-12-31",
    fechaFin: "2025-01-01",
    motivo: "Año Nuevo - Cierre general",
    creadoPorId: "admin",
    creadoPorNombre: "Admin Luna27",
  },
]

// Storage
const VACACIONES_KEY = "luna27_vacaciones"
const SALDOS_KEY = "luna27_saldos_vacaciones"
const PERIODOS_KEY = "luna27_periodos_bloqueados"

export function getVacaciones(): Vacacion[] {
  if (typeof window === "undefined") return vacacionesData
  const stored = localStorage.getItem(VACACIONES_KEY)
  if (stored) return JSON.parse(stored)
  localStorage.setItem(VACACIONES_KEY, JSON.stringify(vacacionesData))
  return vacacionesData
}

export function saveVacaciones(vacaciones: Vacacion[]): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(VACACIONES_KEY, JSON.stringify(vacaciones))
  }
}

export function getSaldosVacaciones(): SaldoVacaciones[] {
  if (typeof window === "undefined") return saldoVacacionesData
  const stored = localStorage.getItem(SALDOS_KEY)
  if (stored) return JSON.parse(stored)
  localStorage.setItem(SALDOS_KEY, JSON.stringify(saldoVacacionesData))
  return saldoVacacionesData
}

export function saveSaldosVacaciones(saldos: SaldoVacaciones[]): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(SALDOS_KEY, JSON.stringify(saldos))
  }
}

export function getPeriodosBloqueados(): PeriodoBloqueado[] {
  if (typeof window === "undefined") return periodosBloqueadosData
  const stored = localStorage.getItem(PERIODOS_KEY)
  if (stored) return JSON.parse(stored)
  localStorage.setItem(PERIODOS_KEY, JSON.stringify(periodosBloqueadosData))
  return periodosBloqueadosData
}

export function savePeriodosBloqueados(periodos: PeriodoBloqueado[]): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(PERIODOS_KEY, JSON.stringify(periodos))
  }
}

// Calcular días entre dos fechas
export function calcularDias(fechaInicio: string, fechaFin: string): number {
  const inicio = new Date(fechaInicio)
  const fin = new Date(fechaFin)
  const diff = fin.getTime() - inicio.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1
}

// Verificar si hay conflicto con vacaciones existentes
export function verificarConflictoVacaciones(
  empleadoId: string,
  fechaInicio: string,
  fechaFin: string,
  vacacionId?: string,
): Vacacion | null {
  const vacaciones = getVacaciones()
  const inicio = new Date(fechaInicio)
  const fin = new Date(fechaFin)

  for (const vac of vacaciones) {
    if (vac.id === vacacionId) continue // Ignorar la misma vacación al editar
    if (vac.empleadoId !== empleadoId) continue
    if (vac.estado === "rechazada" || vac.estado === "cancelada") continue

    const vacInicio = new Date(vac.fechaInicio)
    const vacFin = new Date(vac.fechaFin)

    // Verificar solapamiento
    if (inicio <= vacFin && fin >= vacInicio) {
      return vac
    }
  }

  return null
}

// Obtener vacaciones de un empleado para un rango de fechas
export function getVacacionesEnRango(fechaInicio: string, fechaFin: string, sucursalId?: string): Vacacion[] {
  const vacaciones = getVacaciones()
  const inicio = new Date(fechaInicio)
  const fin = new Date(fechaFin)

  return vacaciones.filter((vac) => {
    if (vac.estado !== "aprobada") return false
    if (sucursalId && vac.sucursalId !== sucursalId) return false

    const vacInicio = new Date(vac.fechaInicio)
    const vacFin = new Date(vac.fechaFin)

    return inicio <= vacFin && fin >= vacInicio
  })
}
