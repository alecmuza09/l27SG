import type { Vacacion, SaldoVacaciones, PeriodoBloqueado } from "@/lib/types/vacaciones"
import { supabase } from '@/lib/supabase/client'
import { AREA_OFICINA, OFICINA_FILTER_VALUE, getEmpleadosFromDB, isEmpleadoOficina } from './empleados'

export type VacacionesOficinaOpciones = {
  /** Incluye registros del personal de oficina. Por defecto se excluyen. */
  incluirOficina?: boolean
}

function mapVacacionRow(row: any): Vacacion {
  const area = row.empleado?.area ?? null
  const esOficina = isEmpleadoOficina({ area })
  return {
    id: row.id,
    empleadoId: row.empleado_id,
    empleadoNombre: row.empleado ? `${row.empleado.nombre} ${row.empleado.apellido}` : '',
    empleadoPuesto: row.empleado?.puesto ?? null,
    empleadoArea: area,
    sucursalId: esOficina ? OFICINA_FILTER_VALUE : (row.empleado?.sucursal?.id || row.empleado?.sucursal_id || ''),
    sucursalNombre: esOficina ? 'Oficina' : (row.empleado?.sucursal?.nombre || ''),
    fechaInicio: row.fecha_inicio,
    fechaFin: row.fecha_fin,
    diasSolicitados: row.dias_solicitados || 0,
    estado: row.estado,
    motivoRechazo: row.motivo_rechazo ?? null,
    aprobadoPorId: row.aprobado_por_id ?? null,
    aprobadoPorNombre: row.aprobado_por_nombre ?? row.aprobador?.nombre ?? null,
    registradoPorId: row.registrado_por_id ?? null,
    registradoPorNombre: row.registrado_por_nombre ?? null,
    resueltoEn: row.resuelto_en ?? null,
    creadoEn: row.created_at ?? null,
    fechaSolicitud: row.fecha_solicitud || row.created_at,
    fechaResolucion: row.fecha_resolucion ?? null,
    notas: row.notas || null,
  }
}

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

// Helper para generar datos iniciales de saldos (para compatibilidad con localStorage)
async function getSaldoVacacionesDataInitial(sucursalScope?: string | string[]): Promise<SaldoVacaciones[]> {
  try {
    const empleados = await getEmpleadosFromDB(
      Array.isArray(sucursalScope) ? undefined : sucursalScope,
    )
    return empleados.map((emp) => ({
      id: `saldo-${emp.id}-${new Date().getFullYear()}`,
      empleadoId: emp.id,
      empleadoNombre: emp.nombre,
      anio: new Date().getFullYear(),
      diasCorrespondientes: 12, // Valor por defecto
      diasTomados: 0,
      diasDisponibles: 12,
      fechaActualizacion: new Date().toISOString(),
    }))
  } catch (err) {
    console.error('Error generando datos iniciales de saldos:', err)
    return []
  }
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

export async function getSaldosVacaciones(sucursalScope?: string | string[]): Promise<SaldoVacaciones[]> {
  // Intentar desde BD primero, luego localStorage como fallback
  try {
    const saldosBD = await getSaldosVacacionesFromDB(sucursalScope)
    if (saldosBD.length > 0) return saldosBD
  } catch (err) {
    console.error('Error obteniendo saldos desde BD, usando localStorage:', err)
  }
  
  // Fallback a localStorage
  if (typeof window === "undefined") {
    const initialData = await getSaldoVacacionesDataInitial(sucursalScope)
    return initialData
  }
  const stored = localStorage.getItem(SALDOS_KEY)
  if (stored) return JSON.parse(stored)
  const initialData = await getSaldoVacacionesDataInitial(sucursalScope)
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

/** Totales de días tomados (solo aprobadas) agrupados por empleada. */
export function totalesDiasPorEmpleada(
  vacaciones: Vacacion[],
): { empleadoId: string; empleadoNombre: string; registros: number; dias: number }[] {
  const porEmpleada = new Map<
    string,
    { empleadoId: string; empleadoNombre: string; registros: number; dias: number }
  >()

  for (const vac of vacaciones) {
    if (vac.estado !== "aprobada") continue
    const actual = porEmpleada.get(vac.empleadoId)
    if (actual) {
      actual.registros += 1
      actual.dias += vac.diasSolicitados
    } else {
      porEmpleada.set(vac.empleadoId, {
        empleadoId: vac.empleadoId,
        empleadoNombre: vac.empleadoNombre,
        registros: 1,
        dias: vac.diasSolicitados,
      })
    }
  }

  return Array.from(porEmpleada.values()).sort((a, b) =>
    a.empleadoNombre.localeCompare(b.empleadoNombre, "es"),
  )
}

// Verificar si hay conflicto con vacaciones existentes
export async function verificarConflictoVacaciones(
  empleadoId: string,
  fechaInicio: string,
  fechaFin: string,
  vacacionId?: string,
  sucursalScope?: string | string[],
): Promise<Vacacion | null> {
  try {
    const vacaciones = await getVacacionesFromDB(sucursalScope)
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
  } catch (err) {
    console.error('Error verificando conflictos de vacaciones:', err)
    return null
  }
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

// Crear una vacación en Supabase
export async function createVacacionInDB(data: {
  empleadoId: string
  fechaInicio: string
  fechaFin: string
  diasSolicitados: number
  notas?: string
  /** Usuario que captura el registro (queda como "Registró" y "Aprobó", ya que se crea aprobada) */
  registradoPorId?: string | null
  registradoPorNombre?: string | null
}): Promise<Vacacion | null> {
  try {
    const ahora = new Date().toISOString()
    const { data: rawRow, error } = await (supabase as any)
      .from('vacaciones')
      .insert({
        empleado_id: data.empleadoId,
        fecha_inicio: data.fechaInicio,
        fecha_fin: data.fechaFin,
        dias_solicitados: data.diasSolicitados,
        estado: 'aprobada',
        notas: data.notas || null,
        fecha_solicitud: ahora,
        registrado_por_id: data.registradoPorId ?? null,
        registrado_por_nombre: data.registradoPorNombre ?? null,
        aprobado_por_id: data.registradoPorId ?? null,
        aprobado_por_nombre: data.registradoPorNombre ?? null,
        fecha_resolucion: ahora.slice(0, 10),
        resuelto_en: ahora,
      })
      .select(`
        *,
        empleado:empleados(nombre, apellido, area, puesto, sucursal:sucursales(id, nombre))
      `)
      .single()

    if (error) {
      console.error('Error creando vacación:', error)
      return null
    }

    return mapVacacionRow(rawRow)
  } catch (error) {
    console.error('Error inesperado creando vacación:', error)
    return null
  }
}

// Aprobar una solicitud pendiente (guarda quién y cuándo)
export async function aprobarVacacionInDB(
  id: string,
  actor: { id?: string | null; nombre?: string | null },
): Promise<boolean> {
  try {
    const ahora = new Date().toISOString()
    const { error } = await (supabase as any)
      .from('vacaciones')
      .update({
        estado: 'aprobada',
        motivo_rechazo: null,
        aprobado_por_id: actor.id ?? null,
        aprobado_por_nombre: actor.nombre ?? null,
        fecha_resolucion: ahora.slice(0, 10),
        resuelto_en: ahora,
      })
      .eq('id', id)
    if (error) {
      console.error('Error aprobando vacación:', error)
      return false
    }
    return true
  } catch (error) {
    console.error('Error inesperado aprobando vacación:', error)
    return false
  }
}

// Rechazar una solicitud (guarda quién, cuándo y el motivo)
export async function rechazarVacacionInDB(
  id: string,
  motivo: string,
  actor: { id?: string | null; nombre?: string | null },
): Promise<boolean> {
  try {
    const ahora = new Date().toISOString()
    const { error } = await (supabase as any)
      .from('vacaciones')
      .update({
        estado: 'rechazada',
        motivo_rechazo: motivo,
        aprobado_por_id: actor.id ?? null,
        aprobado_por_nombre: actor.nombre ?? null,
        fecha_resolucion: ahora.slice(0, 10),
        resuelto_en: ahora,
      })
      .eq('id', id)
    if (error) {
      console.error('Error rechazando vacación:', error)
      return false
    }
    return true
  } catch (error) {
    console.error('Error inesperado rechazando vacación:', error)
    return false
  }
}

// Actualizar fechas de una vacación en Supabase
export async function updateVacacionInDB(
  id: string,
  data: { fechaInicio: string; fechaFin: string; diasSolicitados: number; notas?: string }
): Promise<boolean> {
  try {
    const { error } = await (supabase as any)
      .from('vacaciones')
      .update({
        fecha_inicio: data.fechaInicio,
        fecha_fin: data.fechaFin,
        dias_solicitados: data.diasSolicitados,
        notas: data.notas ?? null,
      })
      .eq('id', id)

    if (error) {
      console.error('Error actualizando vacación:', error)
      return false
    }
    return true
  } catch (error) {
    console.error('Error inesperado actualizando vacación:', error)
    return false
  }
}

// Eliminar una vacación en Supabase
export async function deleteVacacionInDB(id: string): Promise<boolean> {
  try {
    const { error } = await (supabase as any)
      .from('vacaciones')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error eliminando vacación:', error)
      return false
    }
    return true
  } catch (error) {
    console.error('Error inesperado eliminando vacación:', error)
    return false
  }
}

// Obtener vacaciones desde Supabase
export async function getVacacionesFromDB(
  sucursalScope?: string | string[],
  opciones?: VacacionesOficinaOpciones,
): Promise<Vacacion[]> {
  try {
    // PostgREST devuelve máximo ~1000 filas por request: se pagina para no truncar el historial.
    const PAGE = 1000
    const data: any[] = []
    for (let offset = 0; ; offset += PAGE) {
      const { data: page, error } = await supabase
        .from('vacaciones')
        .select(`
          *,
          empleado:empleados(nombre, apellido, area, puesto, sucursal:sucursales(id, nombre)),
          aprobador:usuarios!vacaciones_aprobado_por_id_fkey(nombre)
        `)
        .order('fecha_solicitud', { ascending: false })
        .order('id', { ascending: true })
        .range(offset, offset + PAGE - 1)

      if (error) {
        console.error('Error obteniendo vacaciones:', error)
        return []
      }
      data.push(...(page ?? []))
      if (!page || page.length < PAGE) break
    }

    if (data.length === 0) return []

    let vacacionesFiltradas = data
    if (!opciones?.incluirOficina) {
      vacacionesFiltradas = vacacionesFiltradas.filter(
        (v: any) => (v.empleado?.area ?? '').toLowerCase() !== AREA_OFICINA,
      )
    }
    if (sucursalScope !== undefined) {
      const allow = Array.isArray(sucursalScope)
        ? new Set(sucursalScope)
        : null
      vacacionesFiltradas = vacacionesFiltradas.filter((v: any) => {
        // Personal de oficina no cuenta como personal de la sucursal técnica
        if ((v.empleado?.area ?? '').toLowerCase() === AREA_OFICINA) {
          return opciones?.incluirOficina === true
        }
        const sid = v.empleado?.sucursal?.id
        if (allow) return sid != null && allow.has(sid)
        return sid === sucursalScope
      })
    }
    
    return vacacionesFiltradas.map(mapVacacionRow)
  } catch (error) {
    console.error('Error inesperado obteniendo vacaciones:', error)
    return []
  }
}

// Obtener saldos de vacaciones desde Supabase
export async function getSaldosVacacionesFromDB(sucursalScope?: string | string[]): Promise<SaldoVacaciones[]> {
  try {
    const { data, error } = await supabase
      .from('saldo_vacaciones')
      .select(`
        *,
        empleado:empleados(nombre, apellido, sucursal_id, area)
      `)
      .eq('anio', new Date().getFullYear())
      .order('empleado_id')
    
    if (error) {
      console.error('Error obteniendo saldos de vacaciones:', error)
      return []
    }
    
    if (!data) return []

    let rows = data as any[]
    // Excluir personal de oficina de saldos (no es personal de sucursal)
    rows = rows.filter(
      (s) => (s.empleado?.area ?? "").toLowerCase() !== AREA_OFICINA,
    )
    if (sucursalScope !== undefined) {
      const allow = Array.isArray(sucursalScope) ? new Set(sucursalScope) : null
      rows = rows.filter((s) => {
        const sid = s.empleado?.sucursal_id
        if (allow) return sid != null && allow.has(sid)
        return sid === sucursalScope
      })
    }
    
    return rows.map((s: any) => ({
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
        creador:usuarios!periodos_bloqueados_creado_por_id_fkey(nombre)
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
      creadoPorNombre: p.creador?.nombre || 'Admin',
    }))
  } catch (error) {
    console.error('Error inesperado obteniendo periodos bloqueados:', error)
    return []
  }
}
