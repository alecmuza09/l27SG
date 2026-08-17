// Verificación de citas pendientes futuras de un empleado, usada antes de
// eliminar, desactivar o vencer el contrato de una empleada.

import { supabase } from '@/lib/supabase/client'

export interface CitaPendienteResumen {
  id: string
  fecha: string
  horaInicio: string
  clienteNombre: string
  servicioNombre: string
}

function normalizarHora(hora: string | null | undefined): string {
  if (!hora) return ''
  if (hora.includes(':') && hora.split(':').length === 3) {
    return hora.substring(0, 5)
  }
  return hora
}

function hoyMonterrey(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Monterrey' })
}

/**
 * Obtiene las citas con estado "pendiente" de un empleado, a partir de hoy
 * (inclusive), ordenadas por fecha y hora. Se usa para advertir antes de
 * eliminar, desactivar, o vencer el contrato de una empleada.
 */
export async function getCitasPendientesFuturasByEmpleado(
  empleadoId: string,
): Promise<CitaPendienteResumen[]> {
  try {
    const hoy = hoyMonterrey()
    const { data, error } = await supabase
      .from('citas')
      .select(
        `
        id,
        fecha,
        hora_inicio,
        cliente:clientes(nombre, apellido),
        servicio:servicios(nombre)
      `,
      )
      .eq('empleado_id', empleadoId)
      .eq('estado', 'pendiente')
      .gte('fecha', hoy)
      .order('fecha', { ascending: true })
      .order('hora_inicio', { ascending: true })

    if (error) {
      console.error('Error obteniendo citas pendientes del empleado:', error)
      return []
    }
    if (!data) return []

    return data.map((c: any) => ({
      id: c.id,
      fecha: c.fecha,
      horaInicio: normalizarHora(c.hora_inicio),
      clienteNombre: c.cliente ? `${c.cliente.nombre} ${c.cliente.apellido}` : 'Cliente desconocido',
      servicioNombre: c.servicio?.nombre || 'Servicio desconocido',
    }))
  } catch (error) {
    console.error('Error inesperado obteniendo citas pendientes del empleado:', error)
    return []
  }
}

/** Una fecha está "vencida o próxima a vencer" si es hoy, ya pasó, o es dentro de los próximos `diasUmbral` días. */
export function esFechaVencidaOProxima(fecha: string | null | undefined, diasUmbral = 7): boolean {
  if (!fecha) return false
  const hoy = new Date(hoyMonterrey() + 'T00:00:00')
  const objetivo = new Date(fecha + 'T00:00:00')
  const diffDias = Math.ceil((objetivo.getTime() - hoy.getTime()) / 86400000)
  return diffDias <= diasUmbral
}
