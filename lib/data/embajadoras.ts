// Reporte de embajadoras: clientas marcadas como `embajadora` en `clientes`
// junto con sus visitas (pagos completados) en un período y sucursal(es) dados.

import { supabase } from '@/lib/supabase/client'
import { etiquetaMetodosPago, type Pago } from '@/lib/data/pagos'

export interface EmbajadoraCliente {
  id: string
  nombre: string
}

export interface EmbajadoraVisitaRow {
  citaId: string
  pagoId: string
  fecha: string
  hora: string
  sucursalId: string
  sucursalNombre: string
  servicio: string
  empleadoNombre: string
  monto: number
  metodoPago: string
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
 * Reporte de visitas y gasto de las embajadoras en un período, opcionalmente
 * filtrado por una o varias sucursales. Incluye a TODAS las embajadoras
 * (con ceros) aunque no tengan visitas en el período/sucursal seleccionados.
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

    for (const chunk of chunks) {
      let query = supabase
        .from('pagos')
        .select(`
          id, cita_id, cliente_id, sucursal_id,
          monto, metodo_pago, fecha, hora, servicios,
          descuento_tipo, monto_efectivo, monto_tarjeta, gift_card_codigo,
          empleado:empleados(nombre, apellido),
          sucursal:sucursales(nombre)
        `)
        .eq('estado', 'completado')
        .in('cliente_id', chunk)
        .gte('fecha', fechaDesde)
        .lte('fecha', fechaHasta)
        .order('fecha', { ascending: false })
        .order('hora', { ascending: false })

      if (sucursalIds && sucursalIds.length > 0) query = query.in('sucursal_id', sucursalIds)

      const { data, error } = await query
      if (error) {
        console.error('Error obteniendo visitas de embajadoras:', error)
        continue
      }

      for (const pago of (data ?? []) as any[]) {
        const fila = filas.get(pago.cliente_id)
        if (!fila) continue

        const sucursalNombre = pago.sucursal?.nombre ?? 'Sin sucursal'
        const empleadoNombre = pago.empleado
          ? `${pago.empleado.nombre} ${pago.empleado.apellido}`
          : 'Sin empleado'
        const servicios: string[] = Array.isArray(pago.servicios) ? pago.servicios : []
        const monto = Number(pago.monto) || 0

        const pagoParaEtiqueta: Pago = {
          id: pago.id,
          citaId: pago.cita_id || '',
          clienteId: pago.cliente_id,
          clienteNombre: fila.nombre,
          monto,
          metodoPago: pago.metodo_pago,
          estado: 'completado',
          fecha: pago.fecha,
          hora: pago.hora || '',
          sucursalId: pago.sucursal_id,
          empleadoId: null,
          empleadoNombre,
          servicios,
          descuentoTipo: pago.descuento_tipo || undefined,
          montoEfectivo: Number(pago.monto_efectivo) || 0,
          montoTarjeta: Number(pago.monto_tarjeta) || 0,
          giftCardCodigo: pago.gift_card_codigo || undefined,
        }

        fila.numVisitas += 1
        fila.serviciosRealizados += servicios.length
        fila.totalGastado += monto
        if (!fila.sucursales.includes(sucursalNombre)) fila.sucursales.push(sucursalNombre)
        if (!fila.ultimaVisita || pago.fecha > fila.ultimaVisita) fila.ultimaVisita = pago.fecha

        fila.visitas.push({
          citaId: pago.cita_id || '',
          pagoId: pago.id,
          fecha: pago.fecha,
          hora: pago.hora || '',
          sucursalId: pago.sucursal_id,
          sucursalNombre,
          servicio: servicios.length > 0 ? servicios.join(', ') : 'Sin servicio registrado',
          empleadoNombre,
          monto,
          metodoPago: etiquetaMetodosPago(pagoParaEtiqueta),
        })
      }
    }

    return Array.from(filas.values()).sort((a, b) => b.totalGastado - a.totalGastado)
  } catch (error) {
    console.error('Error inesperado obteniendo reporte de embajadoras:', error)
    return []
  }
}
