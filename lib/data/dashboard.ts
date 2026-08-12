// Dashboard data from Supabase

import { supabase } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'
import { getSucursalesActivasFromDB } from './sucursales'
import { getEmpleadosFromDB } from './empleados'

type CitaRow = Database['public']['Tables']['citas']['Row']

/** Formato YYYY-MM-DD en zona local (igual que Reportes → localFmt). */
function localFmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Días laborales de un empleado en un período según su diasTrabajo (0=Dom … 6=Sáb). */
function contarDiasLaboralesEmpleado(
  desde: string,
  hasta: string,
  diasTrabajo: number[],
): number {
  if (!diasTrabajo || diasTrabajo.length === 0) {
    diasTrabajo = [1, 2, 3, 4, 5, 6]
  }
  const ini = new Date(desde + 'T12:00:00')
  const fin = new Date(hasta + 'T12:00:00')
  let dias = 0
  const cur = new Date(ini)
  while (cur <= fin) {
    if (diasTrabajo.includes(cur.getDay())) dias++
    cur.setDate(cur.getDate() + 1)
  }
  return Math.max(dias, 1)
}

/** Rango «Este Mes» y mes anterior (alineado con Reportes → calcularPeriodo / calcularPeriodoAnterior). */
function rangosMesReportes(): {
  fechaDesde: string
  fechaHasta: string
  mesAnteriorDesde: string
  mesAnteriorHasta: string
} {
  const hoy = new Date()
  const fechaDesde = localFmt(new Date(hoy.getFullYear(), hoy.getMonth(), 1))
  const fechaHasta = localFmt(hoy)
  const mesAnteriorFin = new Date(hoy.getFullYear(), hoy.getMonth(), 0)
  const mesAnteriorInicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
  return {
    fechaDesde,
    fechaHasta,
    mesAnteriorDesde: localFmt(mesAnteriorInicio),
    mesAnteriorHasta: localFmt(mesAnteriorFin),
  }
}

/** Ingresos por sucursal = Σ pagos completados (incl. ventas gift card), igual que getPagosFromDB + calcStats en Reportes. */
async function getIngresosPagosSucursal(
  sucursalId: string,
  fechaDesde: string,
  fechaHasta: string,
): Promise<number> {
  const { data, error } = await supabase
    .from('pagos')
    .select('monto')
    .eq('sucursal_id', sucursalId)
    .eq('estado', 'completado')
    .gte('fecha', fechaDesde)
    .lte('fecha', fechaHasta)

  if (error) {
    console.error('Error obteniendo ingresos de pagos:', error)
    return 0
  }
  return (data ?? []).reduce((sum, p) => sum + (Number(p.monto) || 0), 0)
}

export interface ProductividadSucursal {
  sucursalId: string
  nombre: string
  ingresos: number
  citas: number
  ocupacion: number
  clientesAtendidos: number
  promedioTicket: number
  tendencia: number
}

export interface ProductividadEmpleado {
  empleadoId: string
  nombre: string
  apellido: string
  sucursalId: string
  sucursalNombre: string
  citas: number
  ingresos: number
  ocupacion: number
  promedioTicket: number
  rating: number
  serviciosCompletados: number
}

export interface DashboardStats {
  citasHoy: number
  clientesActivos: number
  ingresosHoy: number
  ocupacion: number
}

export interface EstadoCitas {
  completadas: number
  enProgreso: number
  pendientes: number
  canceladas: number
}

export interface ProximaCita {
  id: string
  time: string
  client: string
  service: string
  staff: string
  status: string
}

export interface ServicioPopular {
  name: string
  count: number
  percentage: number
  revenue: number
}

// Obtener estadísticas del dashboard
export async function getDashboardStats(sucursalId?: string): Promise<DashboardStats> {
  try {
    const hoy = localFmt(new Date())
    
    // Citas de hoy
    let citasQuery = supabase
      .from('citas')
      .select('*', { count: 'exact', head: true })
      .eq('fecha', hoy)
    
    if (sucursalId && sucursalId !== 'all') {
      citasQuery = citasQuery.eq('sucursal_id', sucursalId)
    }
    
    const { count: citasCount } = await citasQuery
    
    // Ingresos de hoy: Σ monto de pagos completados (sin propina)
    let ingresosQuery = supabase
      .from('pagos')
      .select('monto')
      .eq('fecha', hoy)
      .eq('estado', 'completado')
    
    if (sucursalId && sucursalId !== 'all') {
      ingresosQuery = ingresosQuery.eq('sucursal_id', sucursalId)
    }
    
    const { data: ingresosData } = await ingresosQuery
    const ingresosHoy = (ingresosData ?? []).reduce((sum, p) => sum + (Number(p.monto) || 0), 0)
    
    // Clientes activos
    const { count: clientesCount } = await supabase
      .from('clientes')
      .select('*', { count: 'exact', head: true })
      .eq('estado', 'activo')
    
    // Calcular ocupación (citas completadas hoy / capacidad estimada)
    const { data: empleados } = await supabase
      .from('empleados')
      .select('id')
      .eq('activo', true)
    
    const numEmpleados = empleados?.length || 1
    const capacidadDiaria = numEmpleados * 8 // 8 horas por empleado
    const ocupacion = capacidadDiaria > 0 
      ? Math.min(100, Math.round((citasCount || 0) / capacidadDiaria * 100))
      : 0
    
    return {
      citasHoy: citasCount || 0,
      clientesActivos: clientesCount || 0,
      ingresosHoy,
      ocupacion
    }
  } catch (error) {
    console.error('Error obteniendo estadísticas del dashboard:', error)
    return { citasHoy: 0, clientesActivos: 0, ingresosHoy: 0, ocupacion: 0 }
  }
}

// Obtener estado de citas
export async function getEstadoCitas(sucursalId?: string): Promise<EstadoCitas> {
  try {
    const hoy = new Date().toISOString().split('T')[0]
    
    let citasQuery = supabase
      .from('citas')
      .select('estado')
      .eq('fecha', hoy)
    
    if (sucursalId && sucursalId !== 'all') {
      citasQuery = citasQuery.eq('sucursal_id', sucursalId)
    }
    
    const { data: citas } = await citasQuery
    
    if (!citas) return { completadas: 0, enProgreso: 0, pendientes: 0, canceladas: 0 }
    
    return {
      completadas: citas.filter((c: Pick<CitaRow, 'estado'>) => c.estado === 'completada').length,
      enProgreso: citas.filter((c: Pick<CitaRow, 'estado'>) => c.estado === 'en-progreso').length,
      pendientes: citas.filter((c: Pick<CitaRow, 'estado'>) => c.estado === 'pendiente' || c.estado === 'confirmada').length,
      canceladas: citas.filter((c: Pick<CitaRow, 'estado'>) => c.estado === 'cancelada' || c.estado === 'no-asistio').length,
    }
  } catch (error) {
    console.error('Error obteniendo estado de citas:', error)
    return { completadas: 0, enProgreso: 0, pendientes: 0, canceladas: 0 }
  }
}

// Obtener próximas citas
export async function getProximasCitas(limit: number = 4, sucursalId?: string): Promise<ProximaCita[]> {
  try {
    const hoy = new Date().toISOString().split('T')[0]
    
    let citasQuery = supabase
      .from('citas')
      .select(`
        *,
        cliente:clientes(nombre, apellido),
        servicio:servicios(nombre),
        empleado:empleados(nombre, apellido)
      `)
      .gte('fecha', hoy)
      .in('estado', ['pendiente', 'confirmada'])
      .order('fecha', { ascending: true })
      .order('hora_inicio', { ascending: true })
      .limit(limit)
    
    if (sucursalId && sucursalId !== 'all') {
      citasQuery = citasQuery.eq('sucursal_id', sucursalId)
    }
    
    const { data: citas } = await citasQuery
    
    if (!citas) return []
    
    return citas.map((cita: any) => {
      const hora = cita.hora_inicio?.substring(0, 5) || ''
      return {
        id: cita.id,
        time: hora,
        client: `${cita.cliente?.nombre || ''} ${cita.cliente?.apellido || ''}`.trim(),
        service: cita.servicio?.nombre || 'Servicio desconocido',
        staff: `${cita.empleado?.nombre || ''} ${cita.empleado?.apellido || ''}`.trim() || 'Empleado desconocido',
        status: cita.estado === 'confirmada' ? 'confirmed' : 'pending'
      }
    })
  } catch (error) {
    console.error('Error obteniendo próximas citas:', error)
    return []
  }
}

// Obtener servicios populares
export async function getServiciosPopulares(
  limit: number = 4,
  sucursalId?: string,
  fecha?: string,
  fechaDesde?: string,
  fechaHasta?: string,
): Promise<ServicioPopular[]> {
  try {
    let citasQuery = supabase
      .from('citas')
      .select(`
        servicio_id,
        precio,
        servicio:servicios(nombre)
      `)
      .eq('estado', 'completada')
      .not('servicio_id', 'is', null)
    
    if (sucursalId && sucursalId !== 'all') {
      citasQuery = citasQuery.eq('sucursal_id', sucursalId)
    }

    if (fecha)      { citasQuery = citasQuery.eq('fecha', fecha) }
    if (fechaDesde) { citasQuery = citasQuery.gte('fecha', fechaDesde) }
    if (fechaHasta) { citasQuery = citasQuery.lte('fecha', fechaHasta) }
    
    const { data: citas } = await citasQuery
    
    if (!citas || citas.length === 0) return []
    
    // Agrupar por servicio
    const serviciosMap = new Map<string, { count: number; revenue: number; name: string }>()
    
    citas.forEach((cita: any) => {
      const servicioId = cita.servicio_id
      const nombre = cita.servicio?.nombre || 'Servicio desconocido'
      const precio = Number(cita.precio || 0)
      
      if (serviciosMap.has(servicioId)) {
        const servicio = serviciosMap.get(servicioId)!
        servicio.count++
        servicio.revenue += precio
      } else {
        serviciosMap.set(servicioId, {
          count: 1,
          revenue: precio,
          name: nombre
        })
      }
    })
    
    const servicios = Array.from(serviciosMap.values())
      .map(s => ({
        name: s.name,
        count: s.count,
        revenue: s.revenue,
        percentage: 0 // Se calculará después
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
    
    // Calcular porcentajes
    const totalCitas = servicios.reduce((sum, s) => sum + s.count, 0)
    servicios.forEach(servicio => {
      servicio.percentage = totalCitas > 0 ? Math.round((servicio.count / totalCitas) * 100) : 0
    })
    
    return servicios
  } catch (error) {
    console.error('Error obteniendo servicios populares:', error)
    return []
  }
}

export interface ServicioPorEmpleado {
  nombre: string
  cantidad: number
  ingresos: number
}

// Obtener el desglose de servicios realizados por un empleado en un período (para reportes)
export async function getServiciosPorEmpleadoFromDB(
  empleadoId: string,
  fechaDesde: string,
  fechaHasta: string,
  sucursalIds?: string | string[],
): Promise<ServicioPorEmpleado[]> {
  try {
    let citasQuery = supabase
      .from('citas')
      .select(`
        precio,
        servicio:servicios(nombre)
      `)
      .eq('empleado_id', empleadoId)
      .eq('estado', 'completada')
      .not('servicio_id', 'is', null)
      .gte('fecha', fechaDesde)
      .lte('fecha', fechaHasta)

    if (Array.isArray(sucursalIds)) {
      if (sucursalIds.length > 0) citasQuery = citasQuery.in('sucursal_id', sucursalIds)
    } else if (sucursalIds) {
      citasQuery = citasQuery.eq('sucursal_id', sucursalIds)
    }

    const { data: citas, error } = await citasQuery

    if (error) {
      console.error('Error obteniendo servicios por empleado:', error)
      return []
    }

    if (!citas || citas.length === 0) return []

    const serviciosMap = new Map<string, { cantidad: number; ingresos: number }>()

    citas.forEach((cita: any) => {
      const nombre = cita.servicio?.nombre || 'Servicio desconocido'
      const precio = Number(cita.precio || 0)
      const prev = serviciosMap.get(nombre)
      if (prev) {
        prev.cantidad++
        prev.ingresos += precio
      } else {
        serviciosMap.set(nombre, { cantidad: 1, ingresos: precio })
      }
    })

    return Array.from(serviciosMap.entries())
      .map(([nombre, v]) => ({ nombre, cantidad: v.cantidad, ingresos: v.ingresos }))
      .sort((a, b) => b.cantidad - a.cantidad)
  } catch (error) {
    console.error('Error inesperado obteniendo servicios por empleado:', error)
    return []
  }
}

// Obtener resumen por sucursal
export async function getResumenSucursales(sucursalId?: string): Promise<Array<{ nombre: string; ingresos: number; citas: number; tendencia: string }>> {
  try {
    const sucursales = await getSucursalesActivasFromDB()
    
    if (sucursalId && sucursalId !== 'all') {
      const sucursal = sucursales.find(s => s.id === sucursalId)
      if (!sucursal) return []
      
      const { fechaDesde, fechaHasta, mesAnteriorDesde, mesAnteriorHasta } = rangosMesReportes()
      
      const [ingresosActual, ingresosAnterior] = await Promise.all([
        getIngresosPagosSucursal(sucursalId, fechaDesde, fechaHasta),
        getIngresosPagosSucursal(sucursalId, mesAnteriorDesde, mesAnteriorHasta),
      ])
      
      const { count: citasCountActual } = await supabase
        .from('citas')
        .select('*', { count: 'exact', head: true })
        .eq('sucursal_id', sucursalId)
        .eq('estado', 'completada')
        .gte('fecha', fechaDesde)
        .lte('fecha', fechaHasta)
      
      const citasActual = citasCountActual || 0
      
      const tendencia = ingresosAnterior > 0
        ? ((ingresosActual - ingresosAnterior) / ingresosAnterior * 100).toFixed(0)
        : '0'
      
      return [{
        nombre: sucursal.nombre.replace('Luna27 ', ''),
        ingresos: ingresosActual,
        citas: citasActual,
        tendencia: parseFloat(tendencia) >= 0 ? `+${tendencia}%` : `${tendencia}%`
      }]
    }
    
    // Todas las sucursales
    const resumen = await Promise.all(
      sucursales.slice(0, 4).map(async (sucursal) => {
        const { fechaDesde, fechaHasta, mesAnteriorDesde, mesAnteriorHasta } = rangosMesReportes()
        
        const [ingresosActual, ingresosAnterior] = await Promise.all([
          getIngresosPagosSucursal(sucursal.id, fechaDesde, fechaHasta),
          getIngresosPagosSucursal(sucursal.id, mesAnteriorDesde, mesAnteriorHasta),
        ])
        
        const { count: citasCountActual } = await supabase
          .from('citas')
          .select('*', { count: 'exact', head: true })
          .eq('sucursal_id', sucursal.id)
          .eq('estado', 'completada')
          .gte('fecha', fechaDesde)
          .lte('fecha', fechaHasta)
        
        const citasActual = citasCountActual || 0
        
        const tendencia = ingresosAnterior > 0
          ? ((ingresosActual - ingresosAnterior) / ingresosAnterior * 100).toFixed(0)
          : '0'
        
        return {
          nombre: sucursal.nombre.replace('Luna27 ', ''),
          ingresos: ingresosActual,
          citas: citasActual,
          tendencia: parseFloat(tendencia) >= 0 ? `+${tendencia}%` : `${tendencia}%`
        }
      })
    )
    
    return resumen
  } catch (error) {
    console.error('Error obteniendo resumen de sucursales:', error)
    return []
  }
}

// Obtener productividad por sucursal desde BD
export async function getProductividadSucursalesFromDB(sucursalId?: string): Promise<ProductividadSucursal[]> {
  try {
    const todasSucursales = await getSucursalesActivasFromDB()
    const sucursales = sucursalId
      ? todasSucursales.filter(s => s.id === sucursalId)
      : todasSucursales
    const { fechaDesde, fechaHasta, mesAnteriorDesde, mesAnteriorHasta } = rangosMesReportes()
    
    const productividad = await Promise.all(
      sucursales.map(async (sucursal) => {
        const [ingresos, ingresosAnterior, citasMesR] = await Promise.all([
          getIngresosPagosSucursal(sucursal.id, fechaDesde, fechaHasta),
          getIngresosPagosSucursal(sucursal.id, mesAnteriorDesde, mesAnteriorHasta),
          supabase
            .from('citas')
            .select('cliente_id', { count: 'exact' })
            .eq('sucursal_id', sucursal.id)
            .eq('estado', 'completada')
            .gte('fecha', fechaDesde)
            .lte('fecha', fechaHasta),
        ])
        
        const citasMes = citasMesR.data
        const citas = citasMesR.count || 0
        
        // Clientes únicos atendidos
        const clientesUnicos = new Set(citasMes?.map((c: any) => c.cliente_id) || []).size
        
        const promedioTicket = citas > 0 ? Math.round(ingresos / citas) : 0
        
        // Ocupación estimada (citas / capacidad)
        const { data: empleados } = await supabase
          .from('empleados')
          .select('id')
          .eq('sucursal_id', sucursal.id)
          .eq('activo', true)
        
        const numEmpleados = empleados?.length || 1
        const capacidadMensual = numEmpleados * 8 * 30 // 8 horas/día * 30 días
        const ocupacion = capacidadMensual > 0 
          ? Math.min(100, Math.round((citas / capacidadMensual) * 100))
          : 0
        
        // Tendencia
        const tendencia = ingresosAnterior > 0
          ? ((ingresos - ingresosAnterior) / ingresosAnterior * 100)
          : 0
        
        return {
          sucursalId: sucursal.id,
          nombre: sucursal.nombre,
          ingresos,
          citas,
          ocupacion,
          clientesAtendidos: clientesUnicos,
          promedioTicket,
          tendencia: Math.round(tendencia * 10) / 10,
        }
      })
    )
    
    return productividad
  } catch (error) {
    console.error('Error obteniendo productividad de sucursales:', error)
    return []
  }
}

// Obtener top empleados desde BD
export async function getTopEmpleadosFromDB(
  limit: number = 10,
  sucursalId?: string,
  fechaDesde?: string,
  fechaHasta?: string,
): Promise<ProductividadEmpleado[]> {
  try {
    const empleados = await getEmpleadosFromDB(sucursalId)
    const hoy = new Date()
    const mesActual = hoy.toISOString().slice(0, 7)
    const desde = fechaDesde ?? `${mesActual}-01`
    const hasta = fechaHasta ?? hoy.toISOString().split('T')[0]

    const productividad = await Promise.all(
      empleados.map(async (empleado) => {
        const { data: citasMes, count: citasCount } = await supabase
          .from('citas')
          .select('precio, duracion')
          .eq('empleado_id', empleado.id)
          .eq('estado', 'completada')
          .gte('fecha', desde)
          .lte('fecha', hasta)
        
        const ingresos = citasMes?.reduce((sum, c: Pick<CitaRow, 'precio' | 'cliente_id'>) => sum + Number(c.precio || 0), 0) || 0
        const citas = citasCount || 0
        const serviciosCompletados = citas
        const promedioTicket = citas > 0 ? Math.round(ingresos / citas) : 0
        
        const diasLaborales = contarDiasLaboralesEmpleado(desde, hasta, empleado.diasTrabajo)

        const [hIni, mIni] = (empleado.horarioInicio || '09:00').split(':').map(Number)
        const [hFin, mFin] = (empleado.horarioFin || '18:00').split(':').map(Number)
        const horasPorDia = Math.max(1, (hFin * 60 + mFin - hIni * 60 - mIni) / 60)
        const horasDisponibles = diasLaborales * horasPorDia

        const horasOcupadas = citasMes?.reduce(
          (sum, c: Pick<CitaRow, 'duracion'>) => sum + (Number(c.duracion || 0) / 60),
          0,
        ) || 0

        const horasOcupadasReal = horasOcupadas > 0
          ? horasOcupadas
          : citas * 1 // 1 hora por cita como fallback

        const ocupacion = horasDisponibles > 0
          ? Math.min(100, Math.round((horasOcupadasReal / horasDisponibles) * 100))
          : 0
        
        // Rating simulado (puede ser reemplazado por datos reales si existe tabla de ratings)
        const rating = 4.5
        
        // Obtener sucursal
        const sucursales = await getSucursalesActivasFromDB()
        const sucursal = sucursales.find(s => s.id === empleado.sucursalId)
        
        return {
          empleadoId: empleado.id,
          nombre: empleado.nombre,
          apellido: empleado.apellido,
          sucursalId: empleado.sucursalId,
          sucursalNombre: sucursal?.nombre || 'Sin sucursal',
          citas,
          ingresos,
          ocupacion,
          promedioTicket,
          rating,
          serviciosCompletados,
        }
      })
    )
    
    // Ordenar por ingresos y tomar top N
    return productividad
      .sort((a, b) => b.ingresos - a.ingresos)
      .slice(0, limit)
  } catch (error) {
    console.error('Error obteniendo top empleados:', error)
    return []
  }
}

// ── Resumen de citas por estado en un período ────────────────────────────────
export async function getCitasResumenPeriodo(
  fechaDesde: string,
  fechaHasta: string,
  sucursalId?: string,
): Promise<{ completadas: number; canceladas: number; pendientes: number; noShow: number; total: number; tasaCancelacion: number }> {
  try {
    const base = (supabase as any)
      .from('citas')
      .select('estado', { count: 'exact', head: false })
      .gte('fecha', fechaDesde)
      .lte('fecha', fechaHasta)

    const addSucursal = (q: any) => sucursalId ? q.eq('sucursal_id', sucursalId) : q

    const [completadasR, canceladasR, pendientesR, noShowR] = await Promise.all([
      addSucursal((supabase as any).from('citas').select('*', { count: 'exact', head: true }).eq('estado', 'completada').gte('fecha', fechaDesde).lte('fecha', fechaHasta)),
      addSucursal((supabase as any).from('citas').select('*', { count: 'exact', head: true }).eq('estado', 'cancelada').gte('fecha', fechaDesde).lte('fecha', fechaHasta)),
      addSucursal((supabase as any).from('citas').select('*', { count: 'exact', head: true }).eq('estado', 'pendiente').gte('fecha', fechaDesde).lte('fecha', fechaHasta)),
      addSucursal((supabase as any).from('citas').select('*', { count: 'exact', head: true }).eq('estado', 'no_show').gte('fecha', fechaDesde).lte('fecha', fechaHasta)),
    ])

    const completadas  = completadasR.count  || 0
    const canceladas   = canceladasR.count   || 0
    const pendientes   = pendientesR.count   || 0
    const noShow       = noShowR.count       || 0
    const total        = completadas + canceladas + pendientes + noShow
    const tasaCancelacion = total > 0 ? Math.round(((canceladas + noShow) / total) * 100) : 0

    return { completadas, canceladas, pendientes, noShow, total, tasaCancelacion }
  } catch (err) {
    console.error('Error obteniendo resumen de citas:', err)
    return { completadas: 0, canceladas: 0, pendientes: 0, noShow: 0, total: 0, tasaCancelacion: 0 }
  }
}

// ── Métricas por sucursal para comparativa admin ─────────────────────────────
export interface MetricaSucursal {
  sucursalId: string
  nombre: string
  ingresos: number
  totalCitas: number
  ticketPromedio: number
  topServicio: string
}

export async function getMetricasSucursales(
  fechaDesde: string,
  fechaHasta: string,
): Promise<MetricaSucursal[]> {
  try {
    const sucursales = await getSucursalesActivasFromDB()

    const resultados = await Promise.all(
      sucursales.map(async (s) => {
        const [ingresos, citasR, serviciosR] = await Promise.all([
          getIngresosPagosSucursal(s.id, fechaDesde, fechaHasta),
          (supabase as any)
            .from('citas')
            .select('*', { count: 'exact', head: true })
            .eq('sucursal_id', s.id)
            .eq('estado', 'completada')
            .gte('fecha', fechaDesde)
            .lte('fecha', fechaHasta),
          (supabase as any)
            .from('citas')
            .select('servicio:servicios(nombre)')
            .eq('sucursal_id', s.id)
            .eq('estado', 'completada')
            .gte('fecha', fechaDesde)
            .lte('fecha', fechaHasta)
            .not('servicio_id', 'is', null),
        ])

        const totalCitas    = citasR.count || 0
        const ticketPromedio = totalCitas > 0 ? Math.round(ingresos / totalCitas) : 0

        // Top servicio
        const svcMap = new Map<string, number>()
        ;(serviciosR.data as any[] ?? []).forEach((c: any) => {
          const n = c.servicio?.nombre ?? 'Desconocido'
          svcMap.set(n, (svcMap.get(n) ?? 0) + 1)
        })
        const topServicio = svcMap.size > 0
          ? [...svcMap.entries()].sort((a, b) => b[1] - a[1])[0][0]
          : '—'

        return { sucursalId: s.id, nombre: s.nombre, ingresos, totalCitas, ticketPromedio, topServicio }
      })
    )

    return resultados.sort((a, b) => b.ingresos - a.ingresos)
  } catch (err) {
    console.error('Error obteniendo métricas por sucursal:', err)
    return []
  }
}
