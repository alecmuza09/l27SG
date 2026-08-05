// Reporte de embajadoras: clientas marcadas como `embajadora` en `clientes`
// junto con sus citas COMPLETADAS (estado = 'completada') en un período y
// sucursal(es) dados. Citas canceladas, pendientes o no-asistio se excluyen
// de todos los totales.

import { supabase } from '@/lib/supabase/client'

export interface EmbajadoraCliente {
  id: string
  nombre: string
}

export interface EmbajadoraVisitaRow {
  citaId: string
  fecha: string
  hora: string
  sucursalId: string
  sucursalNombre: string
  servicio: string
  empleadoNombre: string
  monto: number
  metodoPago: string
  /** Monto realmente cobrado según `pagos` para esta cita (puede ser $0, ej. cortesías). */
  pagoMonto: number
}

export interface EmbajadoraReporteRow {
  clienteId: string
  nombre: string
  sucursales: string[]
  numVisitas: number
  serviciosRealizados: number
  totalGastado: number
  ultimaVisita: string | null
  visitas: EmbajadoraVisitaRow[]
}

const CHUNK_SIZE = 300

/** Único estado de `citas` que cuenta como completada para este reporte. */
const ESTADO_CITA_COMPLETADA = 'completada'

const METODO_PAGO_LABELS: Record<string, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
  otro: 'Otro',
}

function etiquetaMetodoPagoCita(metodo: string | null | undefined): string {
  if (!metodo) return '—'
  return METODO_PAGO_LABELS[metodo.toLowerCase()] ?? metodo
}

function normalizarHora(hora: string | null | undefined): string {
  if (!hora) return ''
  if (hora.includes(':') && hora.split(':').length === 3) return hora.substring(0, 5)
  return hora
}

/** Todas las clientas marcadas como embajadora (para selector y filas base del reporte). */
export async function getEmbajadorasFromDB(): Promise<EmbajadoraCliente[]> {
  try {
    const { data, error } = await supabase
      .from('clientes')
      .select('id, nombre, apellido')
      .eq('embajadora', true)
      .order('nombre')

    if (error) {
      console.error('Error obteniendo embajadoras:', error)
      return []
    }
    if (!data) return []

    return data.map((c: any) => ({ id: c.id, nombre: `${c.nombre} ${c.apellido}` }))
  } catch (error) {
    console.error('Error inesperado obteniendo embajadoras:', error)
    return []
  }
}

/**
 * Reporte de citas COMPLETADAS y valor de servicios de las embajadoras en un
 * período, opcionalmente filtrado por una o varias sucursales. Incluye a
 * TODAS las embajadoras (con ceros) aunque no tengan citas completadas en el
 * período/sucursal seleccionados. Citas canceladas, pendientes, en progreso
 * o no-asistio quedan excluidas de todos los totales.
 */
export async function getReporteEmbajadorasFromDB(
  fechaDesde: string,
  fechaHasta: string,
  sucursalIds?: string[],
): Promise<EmbajadoraReporteRow[]> {
  try {
    const embajadoras = await getEmbajadorasFromDB()
    if (embajadoras.length === 0) return []

    const filas = new Map<string, EmbajadoraReporteRow>()
    for (const e of embajadoras) {
      filas.set(e.id, {
        clienteId: e.id,
        nombre: e.nombre,
        sucursales: [],
        numVisitas: 0,
        serviciosRealizados: 0,
        totalGastado: 0,
        ultimaVisita: null,
        visitas: [],
      })
    }

    const ids = embajadoras.map(e => e.id)
    const chunks: string[][] = []
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) chunks.push(ids.slice(i, i + CHUNK_SIZE))

    // "Nº visitas" = ocasiones distintas (fecha + sucursal) con al menos una cita
    // completada, para no inflar el conteo cuando una misma visita incluye
    // varios servicios (varias citas el mismo día en la misma sucursal).
    const visitasUnicasPorCliente = new Map<string, Set<string>>()

    for (const chunk of chunks) {
      let query = supabase
        .from('citas')
        .select(`
          id, cliente_id, sucursal_id, fecha, hora_inicio, precio, metodo_pago, estado,
          servicio:servicios(nombre),
          empleado:empleados(nombre, apellido),
          sucursal:sucursales(nombre)
        `)
        .eq('estado', ESTADO_CITA_COMPLETADA)
        .in('cliente_id', chunk)
        .gte('fecha', fechaDesde)
        .lte('fecha', fechaHasta)
        .order('fecha', { ascending: false })
        .order('hora_inicio', { ascending: false })

      if (sucursalIds && sucursalIds.length > 0) query = query.in('sucursal_id', sucursalIds)

      const { data, error } = await query
      if (error) {
        console.error('Error obteniendo citas completadas de embajadoras:', error)
        continue
      }

      for (const cita of (data ?? []) as any[]) {
        // Defensivo: nunca contar algo que no sea explícitamente 'completada'.
        if (cita.estado !== ESTADO_CITA_COMPLETADA) continue

        const fila = filas.get(cita.cliente_id)
        if (!fila) continue

        const sucursalNombre = cita.sucursal?.nombre ?? 'Sin sucursal'
        const empleadoNombre = cita.empleado
          ? `${cita.empleado.nombre} ${cita.empleado.apellido}`
          : 'Sin empleado'
        const servicioNombre = cita.servicio?.nombre || 'Servicio desconocido'
        const monto = Number(cita.precio) || 0

        const visitasSet = visitasUnicasPorCliente.get(cita.cliente_id) ?? new Set<string>()
        visitasSet.add(`${cita.fecha}|${cita.sucursal_id}`)
        visitasUnicasPorCliente.set(cita.cliente_id, visitasSet)

        fila.serviciosRealizados += 1
        fila.totalGastado += monto
        if (!fila.sucursales.includes(sucursalNombre)) fila.sucursales.push(sucursalNombre)
        if (!fila.ultimaVisita || cita.fecha > fila.ultimaVisita) fila.ultimaVisita = cita.fecha

        fila.visitas.push({
          citaId: cita.id,
          fecha: cita.fecha,
          hora: normalizarHora(cita.hora_inicio),
          sucursalId: cita.sucursal_id,
          sucursalNombre,
          servicio: servicioNombre,
          empleadoNombre,
          monto,
          metodoPago: etiquetaMetodoPagoCita(cita.metodo_pago),
          pagoMonto: 0,
        })
      }
    }

    for (const fila of filas.values()) {
      fila.numVisitas = visitasUnicasPorCliente.get(fila.clienteId)?.size ?? 0
      fila.visitas.sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora))
    }

    // Segunda pasada: monto realmente cobrado por cita según `pagos` (puede ser $0).
    const todasLasVisitas = Array.from(filas.values()).flatMap(f => f.visitas)
    if (todasLasVisitas.length > 0) {
      const montoPorCita = new Map<string, number>()
      const citaIds = todasLasVisitas.map(v => v.citaId)
      const citaChunks: string[][] = []
      for (let i = 0; i < citaIds.length; i += CHUNK_SIZE) citaChunks.push(citaIds.slice(i, i + CHUNK_SIZE))

      for (const citaChunk of citaChunks) {
        const { data: pagosData, error: pagosError } = await supabase
          .from('pagos')
          .select('cita_id, monto, estado')
          .in('cita_id', citaChunk)
          .eq('estado', 'completado')

        if (pagosError) {
          console.error('Error obteniendo pagos de citas de embajadoras:', pagosError)
          continue
        }

        for (const pago of (pagosData ?? []) as any[]) {
          if (!pago.cita_id) continue
          montoPorCita.set(pago.cita_id, (montoPorCita.get(pago.cita_id) ?? 0) + (Number(pago.monto) || 0))
        }
      }

      for (const v of todasLasVisitas) {
        v.pagoMonto = montoPorCita.get(v.citaId) ?? 0
      }
    }

    return Array.from(filas.values()).sort((a, b) => b.totalGastado - a.totalGastado)
  } catch (error) {
    console.error('Error inesperado obteniendo reporte de embajadoras:', error)
    return []
  }
}
