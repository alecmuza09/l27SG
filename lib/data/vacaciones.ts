import type { Vacacion, SaldoVacaciones, PeriodoBloqueado } from "@/lib/types/vacaciones"
import { supabase } from '@/lib/supabase/client'
import { getEmpleadosFromDB } from './empleados'

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

// Datos mock de saldo de vacaciones (para compatibilidad con localStorage)
async function getSaldoVacacionesDataInitial(): Promise<SaldoVacaciones[]> {
  const empleados = await getEmpleadosFromDB()
  return empleados.map((emp, index) => ({
    id: `saldo-${emp.id}`,
    empleadoId: emp.id,
    empleadoNombre: emp.nombre,
    anio: new Date().getFullYear(),
    diasCorrespondientes: 12, // Valor por defecto
    diasTomados: 0,
    diasDisponibles: 12,
    fechaActualizacion: new Date().toISOString(),
  }))
}

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

export async function getSaldosVacaciones(): Promise<SaldoVacaciones[]> {
  // Intentar desde BD primero, luego localStorage como fallback
  try {
    const saldosBD = await getSaldosVacacionesFromDB()
    if (saldosBD.length > 0) return saldosBD
  } catch (err) {
    console.error('Error obteniendo saldos desde BD, usando localStorage:', err)
  }
  
  // Fallback a localStorage
  if (typeof window === "undefined") {
    const initialData = await getSaldoVacacionesDataInitial()
    return initialData
  }
  const stored = localStorage.getItem(SALDOS_KEY)
  if (stored) return JSON.parse(stored)
  const initialData = await getSaldoVacacionesDataInitial()
  localStorage.setItem(SALDOS_KEY, JSON.stringify(initialData))
  return initialData
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

// Obtener vacaciones desde Supabase
export async function getVacacionesFromDB(sucursalId?: string): Promise<Vacacion[]> {
  try {
    let query = supabase
      .from('vacaciones')
      .select(`
        *,
        empleado:empleados(nombre, apellido),
        sucursal:sucursales(nombre),
        aprobador:empleados!vacaciones_aprobado_por_id_fkey(nombre, apellido)
      `)
      .order('fecha_solicitud', { ascending: false })
    
    if (sucursalId) {
      query = query.eq('sucursal_id', sucursalId)
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('Error obteniendo vacaciones:', error)
      return []
    }
    
    if (!data) return []
    
    return data.map((v: any) => ({
      id: v.id,
      empleadoId: v.empleado_id,
      empleadoNombre: v.empleado ? `${v.empleado.nombre} ${v.empleado.apellido}` : '',
      sucursalId: v.sucursal_id,
      sucursalNombre: v.sucursal?.nombre || '',
      fechaInicio: v.fecha_inicio,
      fechaFin: v.fecha_fin,
      diasSolicitados: v.dias_solicitados || 0,
      estado: v.estado,
      motivoRechazo: v.motivo_rechazo || null,
      aprobadoPorId: v.aprobado_por_id || null,
      aprobadoPorNombre: v.aprobador ? `${v.aprobador.nombre} ${v.aprobador.apellido}` : null,
      fechaSolicitud: v.fecha_solicitud || v.created_at,
      fechaResolucion: v.fecha_resolucion || null,
      notas: v.notas || null,
    }))
  } catch (error) {
    console.error('Error inesperado obteniendo vacaciones:', error)
    return []
  }
}

// Obtener saldos de vacaciones desde Supabase
export async function getSaldosVacacionesFromDB(): Promise<SaldoVacaciones[]> {
  try {
    const { data, error } = await supabase
      .from('saldo_vacaciones')
      .select(`
        *,
        empleado:empleados(nombre, apellido)
      `)
      .eq('anio', new Date().getFullYear())
      .order('empleado_id')
    
    if (error) {
      console.error('Error obteniendo saldos de vacaciones:', error)
      return []
    }
    
    if (!data) return []
    
    return data.map((s: any) => ({
      id: s.id,
      empleadoId: s.empleado_id,
      empleadoNombre: s.empleado ? `${s.empleado.nombre} ${s.empleado.apellido}` : '',
      anio: s.anio,
      diasCorrespondientes: s.dias_correspondientes || 0,
      diasTomados: s.dias_tomados || 0,
      diasDisponibles: s.dias_disponibles || 0,
      fechaActualizacion: s.fecha_actualizacion || s.updated_at || new Date().toISOString(),
    }))
  } catch (error) {
    console.error('Error inesperado obteniendo saldos:', error)
    return []
  }
}

// Obtener periodos bloqueados desde Supabase
export async function getPeriodosBloqueadosFromDB(): Promise<PeriodoBloqueado[]> {
  try {
    const { data, error } = await supabase
      .from('periodos_bloqueados')
      .select(`
        *,
        sucursal:sucursales(nombre),
        creador:empleados!periodos_bloqueados_creado_por_id_fkey(nombre, apellido)
      `)
      .order('fecha_inicio', { ascending: false })
    
    if (error) {
      console.error('Error obteniendo periodos bloqueados:', error)
      return []
    }
    
    if (!data) return []
    
    return data.map((p: any) => ({
      id: p.id,
      sucursalId: p.sucursal_id || 'all',
      sucursalNombre: p.sucursal?.nombre || 'Todas las Sucursales',
      fechaInicio: p.fecha_inicio,
      fechaFin: p.fecha_fin,
      motivo: p.motivo || '',
      creadoPorId: p.creado_por_id || '',
      creadoPorNombre: p.creador ? `${p.creador.nombre} ${p.creador.apellido}` : 'Admin',
    }))
  } catch (error) {
    console.error('Error inesperado obteniendo periodos bloqueados:', error)
    return []
  }
}
