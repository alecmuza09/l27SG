// Dashboard data from Supabase

import { supabase } from '@/lib/supabase/client'
import { getSucursalesActivasFromDB } from './sucursales'
import { getEmpleadosFromDB } from './empleados'

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
    const hoy = new Date().toISOString().split('T')[0]
    
    // Citas de hoy
    let citasQuery = supabase
      .from('citas')
      .select('*', { count: 'exact', head: true })
      .eq('fecha', hoy)
    
    if (sucursalId && sucursalId !== 'all') {
      citasQuery = citasQuery.eq('sucursal_id', sucursalId)
    }
    
    const { count: citasCount } = await citasQuery
    
    // Ingresos de hoy (de citas completadas y pagadas)
    let ingresosQuery = supabase
      .from('citas')
      .select('precio')
      .eq('fecha', hoy)
      .eq('estado', 'completada')
      .eq('pagado', true)
    
    if (sucursalId && sucursalId !== 'all') {
      ingresosQuery = ingresosQuery.eq('sucursal_id', sucursalId)
    }
    
    const { data: ingresosData } = await ingresosQuery
    const ingresosHoy = ingresosData?.reduce((sum, c) => sum + Number(c.precio || 0), 0) || 0
    
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
      completadas: citas.filter(c => c.estado === 'completada').length,
      enProgreso: citas.filter(c => c.estado === 'en-progreso').length,
      pendientes: citas.filter(c => c.estado === 'pendiente' || c.estado === 'confirmada').length,
      canceladas: citas.filter(c => c.estado === 'cancelada' || c.estado === 'no-asistio').length,
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
export async function getServiciosPopulares(limit: number = 4, sucursalId?: string): Promise<ServicioPopular[]> {
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

// Obtener resumen por sucursal
export async function getResumenSucursales(sucursalId?: string): Promise<Array<{ nombre: string; ingresos: number; citas: number; tendencia: string }>> {
  try {
    const sucursales = await getSucursalesActivasFromDB()
    
    if (sucursalId && sucursalId !== 'all') {
      const sucursal = sucursales.find(s => s.id === sucursalId)
      if (!sucursal) return []
      
      const hoy = new Date()
      const mesActual = hoy.toISOString().slice(0, 7)
      const mesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1).toISOString().slice(0, 7)
      
      // Citas y ingresos del mes actual
      const { data: citasMesActual } = await supabase
        .from('citas')
        .select('precio')
        .eq('sucursal_id', sucursalId)
        .eq('estado', 'completada')
        .gte('fecha', `${mesActual}-01`)
      
      const { count: citasCountActual } = await supabase
        .from('citas')
        .select('*', { count: 'exact', head: true })
        .eq('sucursal_id', sucursalId)
        .eq('estado', 'completada')
        .gte('fecha', `${mesActual}-01`)
      
      // Citas y ingresos del mes anterior
      const { data: citasMesAnterior } = await supabase
        .from('citas')
        .select('precio')
        .eq('sucursal_id', sucursalId)
        .eq('estado', 'completada')
        .gte('fecha', `${mesAnterior}-01`)
        .lt('fecha', `${mesActual}-01`)
      
      const ingresosActual = citasMesActual?.reduce((sum, c) => sum + Number(c.precio || 0), 0) || 0
      const ingresosAnterior = citasMesAnterior?.reduce((sum, c) => sum + Number(c.precio || 0), 0) || 0
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
        const hoy = new Date()
        const mesActual = hoy.toISOString().slice(0, 7)
        const mesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1).toISOString().slice(0, 7)
        
        const { data: citasMesActual } = await supabase
          .from('citas')
          .select('precio')
          .eq('sucursal_id', sucursal.id)
          .eq('estado', 'completada')
          .gte('fecha', `${mesActual}-01`)
        
        const { count: citasCountActual } = await supabase
          .from('citas')
          .select('*', { count: 'exact', head: true })
          .eq('sucursal_id', sucursal.id)
          .eq('estado', 'completada')
          .gte('fecha', `${mesActual}-01`)
        
        const { data: citasMesAnterior } = await supabase
          .from('citas')
          .select('precio')
          .eq('sucursal_id', sucursal.id)
          .eq('estado', 'completada')
          .gte('fecha', `${mesAnterior}-01`)
          .lt('fecha', `${mesActual}-01`)
        
        const ingresosActual = citasMesActual?.reduce((sum, c) => sum + Number(c.precio || 0), 0) || 0
        const ingresosAnterior = citasMesAnterior?.reduce((sum, c) => sum + Number(c.precio || 0), 0) || 0
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
export async function getProductividadSucursalesFromDB(): Promise<ProductividadSucursal[]> {
  try {
    const sucursales = await getSucursalesActivasFromDB()
    const hoy = new Date()
    const mesActual = hoy.toISOString().slice(0, 7)
    const mesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1).toISOString().slice(0, 7)
    
    const productividad = await Promise.all(
      sucursales.map(async (sucursal) => {
        // Citas del mes actual
        const { data: citasMes, count: citasCount } = await supabase
          .from('citas')
          .select('precio, cliente_id', { count: 'exact' })
          .eq('sucursal_id', sucursal.id)
          .eq('estado', 'completada')
          .gte('fecha', `${mesActual}-01`)
        
        // Citas del mes anterior
        const { data: citasMesAnterior } = await supabase
          .from('citas')
          .select('precio')
          .eq('sucursal_id', sucursal.id)
          .eq('estado', 'completada')
          .gte('fecha', `${mesAnterior}-01`)
          .lt('fecha', `${mesActual}-01`)
        
        const ingresos = citasMes?.reduce((sum, c) => sum + Number(c.precio || 0), 0) || 0
        const ingresosAnterior = citasMesAnterior?.reduce((sum, c) => sum + Number(c.precio || 0), 0) || 0
        const citas = citasCount || 0
        
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
export async function getTopEmpleadosFromDB(limit: number = 10): Promise<ProductividadEmpleado[]> {
  try {
    const empleados = await getEmpleadosFromDB()
    const hoy = new Date()
    const mesActual = hoy.toISOString().slice(0, 7)
    
    const productividad = await Promise.all(
      empleados.map(async (empleado) => {
        // Citas del empleado en el mes actual
        const { data: citasMes, count: citasCount } = await supabase
          .from('citas')
          .select('precio, duracion')
          .eq('empleado_id', empleado.id)
          .eq('estado', 'completada')
          .gte('fecha', `${mesActual}-01`)
        
        const ingresos = citasMes?.reduce((sum, c) => sum + Number(c.precio || 0), 0) || 0
        const citas = citasCount || 0
        const serviciosCompletados = citas
        const promedioTicket = citas > 0 ? Math.round(ingresos / citas) : 0
        
        // Calcular ocupación (horas trabajadas vs horas ocupadas)
        const horasOcupadas = citasMes?.reduce((sum, c) => sum + (Number(c.duracion || 0) / 60), 0) || 0
        const horasTrabajadas = 8 * 30 // 8 horas/día * 30 días del mes
        const ocupacion = horasTrabajadas > 0
          ? Math.min(100, Math.round((horasOcupadas / horasTrabajadas) * 100))
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
