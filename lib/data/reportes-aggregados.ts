import { supabase } from '@/lib/supabase/client'

export type ServicioPopularRpc = {
  name: string
  count: number
  revenue: number
  percentage: number
}

export async function getServiciosPopularesRpc(
  limit: number,
  fechaDesde: string,
  fechaHasta: string,
  sucursalId?: string,
): Promise<ServicioPopularRpc[] | null> {
  const { data, error } = await supabase.rpc('reporte_servicios_populares', {
    p_fecha_desde: fechaDesde,
    p_fecha_hasta: fechaHasta,
    p_sucursal_id: sucursalId ?? null,
    p_limite: limit,
  })
  if (error || !data) {
    if (error) console.warn('RPC reporte_servicios_populares:', error.message)
    return null
  }
  const rows = data as { nombre: string; cantidad: number; ingresos: number }[]
  const total = rows.reduce((s, r) => s + Number(r.cantidad || 0), 0)
  return rows.map(r => ({
    name: r.nombre,
    count: Number(r.cantidad) || 0,
    revenue: Number(r.ingresos) || 0,
    percentage: total > 0 ? Math.round((Number(r.cantidad) / total) * 100) : 0,
  }))
}

export async function getTopClientesPorGastoRpc(
  limit: number,
  fechaDesde: string,
  fechaHasta: string,
  sucursalId?: string,
): Promise<
  Array<{ clienteId: string; nombre: string; visitas: number; totalGastado: number; ultimaVisita: string }> | null
> {
  const { data, error } = await supabase.rpc('reporte_top_clientes_gasto', {
    p_fecha_desde: fechaDesde,
    p_fecha_hasta: fechaHasta,
    p_sucursal_id: sucursalId ?? null,
    p_limite: limit,
  })
  if (error || !data) {
    if (error) console.warn('RPC reporte_top_clientes_gasto:', error.message)
    return null
  }
  return (data as {
    cliente_id: string
    nombre: string
    visitas: number
    total_gastado: number
    ultima_visita: string
  }[]).map(r => ({
    clienteId: r.cliente_id,
    nombre: r.nombre?.trim() || 'Desconocido',
    visitas: Number(r.visitas) || 0,
    totalGastado: Number(r.total_gastado) || 0,
    ultimaVisita: r.ultima_visita ?? '',
  }))
}

export type ReporteClientesTabStatsRpc = {
  total: number
  activos: number
  activosInicioPeriodo: number
  vip: number
  inactivos: number
  nuevos: number
  vigentes: number
  conVisitas: number
  embajadoras: number
}

export async function getReporteClientesTabStatsRpc(
  fechaDesde: string,
  fechaHasta: string,
  params: { sucursalId?: string; sucursalIds?: string[] },
): Promise<ReporteClientesTabStatsRpc | null> {
  const ids = params.sucursalIds?.filter(Boolean) ?? []
  const { data, error } = await supabase.rpc('reporte_clientes_tab_stats', {
    p_fecha_desde: fechaDesde,
    p_fecha_hasta: fechaHasta,
    p_sucursal_id: params.sucursalId ?? null,
    p_sucursal_ids: ids.length > 0 ? ids : null,
  })
  if (error || !data) {
    if (error) console.warn('RPC reporte_clientes_tab_stats:', error.message)
    return null
  }
  const j = data as Record<string, number>
  return {
    total: Number(j.total) || 0,
    activos: Number(j.activos) || 0,
    activosInicioPeriodo: Number(j.activos_inicio_periodo) || 0,
    vip: Number(j.vip) || 0,
    inactivos: Number(j.inactivos) || 0,
    nuevos: 0,
    vigentes: Number(j.vigentes) || 0,
    conVisitas: Number(j.con_visitas) || 0,
    embajadoras: Number(j.embajadoras) || 0,
  }
}
