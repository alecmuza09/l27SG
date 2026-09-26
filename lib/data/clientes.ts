import { supabase } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'

type ClienteRow = Database['public']['Tables']['clientes']['Row']
type ClienteInsert = Database['public']['Tables']['clientes']['Insert']

export interface Cliente {
  id: string
  nombre: string
  apellido: string
  email: string
  telefono: string
  fechaNacimiento?: string
  genero?: "masculino" | "femenino" | "otro"
  direccion?: string
  ciudad?: string
  notas?: string
  fechaRegistro: string
  ultimaVisita: string | null
  totalVisitas: number
  totalGastado: number
  puntosFidelidad: number
  preferencias?: string[]
  alergias?: string[]
  sucursalPreferida?: string
  estado: "activo" | "inactivo" | "vip"
  embajadora: boolean
  esVetado: boolean
  esProblematico: boolean
  esDescuento: boolean
}

// Función helper para transformar datos de la BD al formato de la interfaz
function transformCliente(cliente: ClienteRow): Cliente {
  return {
    id: cliente.id,
    nombre: cliente.nombre,
    apellido: cliente.apellido,
    email: cliente.email || '',
    telefono: cliente.telefono,
    fechaNacimiento: cliente.fecha_nacimiento || undefined,
    genero: cliente.genero || undefined,
    direccion: cliente.direccion || undefined,
    ciudad: cliente.ciudad || undefined,
    notas: cliente.notas || undefined,
    fechaRegistro: cliente.fecha_registro || new Date().toISOString().split('T')[0],
    ultimaVisita: cliente.ultima_visita || null,
    totalVisitas: cliente.total_visitas ?? 0,
    totalGastado: Number(cliente.total_gastado) || 0,
    puntosFidelidad: cliente.puntos_fidelidad ?? 0,
    preferencias: cliente.preferencias && cliente.preferencias.length > 0 ? cliente.preferencias : undefined,
    alergias: cliente.alergias && cliente.alergias.length > 0 ? cliente.alergias : undefined,
    sucursalPreferida: cliente.sucursal_preferida || undefined,
    estado: cliente.estado || 'activo',
    embajadora: cliente.embajadora ?? false,
    esVetado: (cliente as any).es_vetado ?? false,
    esProblematico: (cliente as any).es_problematico ?? false,
    esDescuento: (cliente as any).es_descuento ?? false,
  }
}

/** Mayúsculas completas al dar de alta (solo inserciones vía createCliente). */
function normalizarNombreClienteNuevo(valor: string): string {
  return valor.trim().toLocaleUpperCase('es')
}

function normalizarBusqueda(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
}

export type FiltrosListadoClientes = {
  soloEmbajadoras?: boolean
  soloVetadas?: boolean
  soloProblematicas?: boolean
  soloDescuento?: boolean
  sinVisitas?: boolean
  conVisitas?: boolean
  sinVisitaReciente?: boolean
}

function fechaIsoHaceDias(dias: number): string {
  const d = new Date()
  d.setDate(d.getDate() - dias)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function aplicarFiltrosListadoClientes<T extends { eq: (...args: any[]) => T; gt: (...args: any[]) => T; or: (...args: any[]) => T }>(
  query: T,
  filtros: FiltrosListadoClientes,
): T {
  let q = query
  if (filtros.soloEmbajadoras) q = q.eq('embajadora', true)
  if (filtros.soloVetadas) q = q.eq('es_vetado', true)
  if (filtros.soloProblematicas) q = q.eq('es_problematico', true)
  if (filtros.soloDescuento) q = q.eq('es_descuento', true)
  if (filtros.sinVisitas) q = q.eq('total_visitas', 0)
  if (filtros.conVisitas) q = q.gt('total_visitas', 0)
  if (filtros.sinVisitaReciente) {
    const limite = fechaIsoHaceDias(60)
    q = q.or(`ultima_visita.is.null,ultima_visita.lt.${limite}`)
  }
  return q
}

function filtrarFilasListadoClientes(rows: any[], filtros: FiltrosListadoClientes): any[] {
  let out = rows
  if (filtros.soloEmbajadoras) out = out.filter(row => row.embajadora === true)
  if (filtros.soloVetadas) out = out.filter(row => row.es_vetado === true)
  if (filtros.soloProblematicas) out = out.filter(row => row.es_problematico === true)
  if (filtros.soloDescuento) out = out.filter(row => row.es_descuento === true)
  if (filtros.sinVisitas) out = out.filter(row => (row.total_visitas ?? 0) === 0)
  if (filtros.conVisitas) out = out.filter(row => (row.total_visitas ?? 0) > 0)
  if (filtros.sinVisitaReciente) {
    const limiteMs = new Date(fechaIsoHaceDias(60) + 'T12:00:00').getTime()
    out = out.filter(row => {
      if (!row.ultima_visita) return true
      return new Date(String(row.ultima_visita) + 'T12:00:00').getTime() < limiteMs
    })
  }
  return out
}

// Obtener clientes con paginación
export async function getClientesPaginated(
  page: number = 1,
  pageSize: number = 50,
  filtros: FiltrosListadoClientes = {},
): Promise<{ clientes: Cliente[]; total: number; totalPages: number }> {
  try {
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    // Obtener el total de clientes (aplicando los filtros de clasificación en la BD)
    let countQuery = supabase
      .from('clientes')
      .select('*', { count: 'exact', head: true })

    countQuery = aplicarFiltrosListadoClientes(countQuery, filtros)

    const { count, error: countError } = await countQuery

    if (countError) {
      console.error('Error obteniendo conteo de clientes:', countError)
      return { clientes: [], total: 0, totalPages: 0 }
    }

    const total = count || 0
    const totalPages = Math.ceil(total / pageSize)

    // Obtener los clientes de la página actual con sus citas
    let dataQuery = supabase
      .from('clientes')
      .select(`
        *,
        citas!left(fecha, estado)
      `)

    dataQuery = aplicarFiltrosListadoClientes(dataQuery, filtros)

    const { data, error } = await dataQuery
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      console.error('Error obteniendo clientes:', error)
      return { clientes: [], total, totalPages }
    }

    return {
      clientes: (data as any[]).map((row) => ({
        ...transformCliente(row),
        ultimaVisita: (row.citas as any[])
          ?.filter((c) => c.estado === 'completada')
          ?.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())[0]
          ?.fecha ?? null,
      })),
      total,
      totalPages,
    }
  } catch (error) {
    console.error('Error inesperado obteniendo clientes:', error)
    return { clientes: [], total: 0, totalPages: 0 }
  }
}

// Obtener todos los clientes (mantener para compatibilidad, pero con advertencia)
export async function getClientes(): Promise<Cliente[]> {
  console.warn('getClientes() está limitado a 1,000 registros. Usa getClientesPaginated() para obtener todos los clientes.')
  try {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000) // Límite explícito de Supabase

    if (error) {
      console.error('Error obteniendo clientes:', error)
      return []
    }

    return data.map(transformCliente)
  } catch (error) {
    console.error('Error inesperado obteniendo clientes:', error)
    return []
  }
}

// Obtener un cliente por ID
export async function getClienteById(id: string): Promise<Cliente | null> {
  try {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error obteniendo cliente:', error)
      return null
    }

    return transformCliente(data)
  } catch (error) {
    console.error('Error inesperado obteniendo cliente:', error)
    return null
  }
}

async function searchClientesDirecto(termino: string, limit: number): Promise<ClienteRow[]> {
  const sanitized = termino.replace(/[,()]/g, '').slice(0, 80)
  const digits = sanitized.replace(/\D/g, '')
  const orParts = [
    `nombre.ilike.%${sanitized}%`,
    `apellido.ilike.%${sanitized}%`,
    `email.ilike.%${sanitized}%`,
    `telefono.ilike.%${sanitized}%`,
  ]
  if (digits.length >= 4 && digits !== sanitized) {
    orParts.push(`telefono.ilike.%${digits}%`)
  }

  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .or(orParts.join(','))
    .limit(limit)

  if (error) {
    console.error('Error en búsqueda directa de clientes:', error)
    return []
  }
  return data ?? []
}

// Buscar clientes por query en toda la base de datos (nombre, apellido, email, teléfono).
// Los clientes son globales: no se filtra por sucursal.
export async function searchClientes(
  query: string,
  limit: number = 500,
  _soloActivos: boolean = false
): Promise<Cliente[]> {
  try {
    if (!query || query.trim() === '') {
      return []
    }

    const termino = query.trim()
    const { data, error } = await supabase
      .rpc('buscar_clientes', { termino })
      .limit(limit)

    if (!error && (data?.length ?? 0) > 0) {
      return data.map(transformCliente)
    }

    if (error) {
      console.error('Error buscando clientes:', error)
    }

    // Fallback: búsqueda directa en toda la tabla (sin sucursal) por si el RPC
    // falla o no indexa bien teléfonos.
    return (await searchClientesDirecto(termino, limit)).map(transformCliente)
  } catch (error) {
    console.error('Error inesperado buscando clientes:', error)
    return []
  }
}

// Buscar clientes con paginación
export async function searchClientesPaginated(
  query: string,
  page: number = 1,
  pageSize: number = 50,
  filtros: FiltrosListadoClientes = {},
): Promise<{ clientes: Cliente[]; total: number; totalPages: number }> {
  try {
    if (!query || query.trim() === '') {
      return { clientes: [], total: 0, totalPages: 0 }
    }

    const { data: allData, error } = await supabase
      .rpc('buscar_clientes', { termino: query.trim() })

    if (error) {
      console.error('Error buscando clientes:', error)
      return { clientes: [], total: 0, totalPages: 0 }
    }

    // La búsqueda usa un RPC que no admite filtros adicionales;
    // los filtros se aplican sobre el resultado ya obtenido de la BD.
    let filteredData = filtrarFilasListadoClientes(allData ?? [], filtros)

    const total = filteredData.length
    const totalPages = Math.ceil(total / pageSize)
    const from = (page - 1) * pageSize
    const paginatedData = filteredData.slice(from, from + pageSize)

    return {
      clientes: paginatedData.map((row: any) => ({
        ...transformCliente(row),
        ultimaVisita: null,
      })),
      total,
      totalPages,
    }
  } catch (error) {
    console.error('Error inesperado buscando clientes:', error)
    return { clientes: [], total: 0, totalPages: 0 }
  }
}

const CLIENTES_STATS_VACIO = {
  total: 0,
  activos: 0,
  activosInicioPeriodo: 0,
  vip: 0,
  inactivos: 0,
  nuevos: 0,
  vigentes: 0,
  conVisitas: 0,
  embajadoras: 0,
} as const

async function paginateClienteIds(
  table: "citas" | "pagos",
  sucursalId: string,
  idSet: Set<string>,
): Promise<void> {
  const PAGE = 1000
  let from = 0
  while (true) {
    let query =
      table === "citas"
        ? supabase.from("citas").select("cliente_id").eq("sucursal_id", sucursalId)
        : supabase
            .from("pagos")
            .select("cliente_id")
            .eq("sucursal_id", sucursalId)
            .eq("estado", "completado")

    const { data, error } = await query.range(from, from + PAGE - 1)
    if (error) {
      console.error(`Error listando clientes por ${table} en sucursal:`, error)
      break
    }
    const batch = data ?? []
    for (const r of batch) {
      const id = (r as { cliente_id: string }).cliente_id
      if (id) idSet.add(id)
    }
    if (batch.length < PAGE) break
    from += PAGE
  }
}

async function clienteIdsConActividadEnSucursal(sucursalId: string): Promise<string[]> {
  const idSet = new Set<string>()
  await Promise.all([
    paginateClienteIds("citas", sucursalId, idSet),
    paginateClienteIds("pagos", sucursalId, idSet),
  ])
  return [...idSet]
}

async function resolveScopeClienteIds(
  sucursalId?: string,
  sucursalIds?: string[],
): Promise<string[] | null> {
  const ids = sucursalIds?.filter(Boolean) ?? []
  if (ids.length > 0) {
    const idSet = new Set<string>()
    const porSucursal = await Promise.all(ids.map(id => clienteIdsConActividadEnSucursal(id)))
    for (const list of porSucursal) {
      for (const cid of list) idSet.add(cid)
    }
    return [...idSet]
  }
  if (sucursalId) return clienteIdsConActividadEnSucursal(sucursalId)
  return null
}

type VisitaAlCierreScope = {
  sucursalId?: string
  sucursalIds?: string[]
}

type CitaLite = {
  cliente_id: string
  fecha: string
  hora_inicio: string | null
  sucursal_id: string
}

const CITAS_LITE_PAGE = 1000

function buildCitasCompletadasLiteQuery(opts: {
  fechaHasta: string
  visitaScope?: VisitaAlCierreScope
  clienteIds?: string[]
}) {
  let query = supabase
    .from("citas")
    .select("cliente_id, fecha, hora_inicio, sucursal_id")
    .eq("estado", "completada")
    .lte("fecha", opts.fechaHasta)
    .not("cliente_id", "is", null)

  if (opts.visitaScope?.sucursalId) {
    query = query.eq("sucursal_id", opts.visitaScope.sucursalId)
  } else if (opts.visitaScope?.sucursalIds?.length) {
    query = query.in("sucursal_id", opts.visitaScope.sucursalIds)
  }

  if (opts.clienteIds?.length) {
    query = query.in("cliente_id", opts.clienteIds)
  }

  return query
}

/** Pagina citas completadas sin acumular todo en memoria ni pausas artificiales. */
async function streamCitasCompletadasLite(
  opts: {
    fechaHasta: string
    visitaScope?: VisitaAlCierreScope
    clienteIds?: string[]
  },
  onBatch: (rows: CitaLite[]) => void,
): Promise<void> {
  let from = 0
  while (true) {
    const { data, error } = await buildCitasCompletadasLiteQuery(opts)
      .order("fecha", { ascending: true })
      .order("cliente_id", { ascending: true })
      .range(from, from + CITAS_LITE_PAGE - 1)

    if (error) {
      console.error("Error obteniendo citas (lite):", error)
      break
    }
    const batch = (data ?? []) as CitaLite[]
    if (batch.length > 0) onBatch(batch)
    if (batch.length < CITAS_LITE_PAGE) break
    from += CITAS_LITE_PAGE
  }
}

async function fetchCitasCompletadasLite(opts: {
  fechaHasta: string
  visitaScope?: VisitaAlCierreScope
  clienteIds?: string[]
}): Promise<CitaLite[]> {
  const all: CitaLite[] = []
  await streamCitasCompletadasLite(opts, batch => {
    all.push(...batch)
  })
  return all
}

type MinVisitaLite = { fecha: string; hora: string | null; sucursal_id: string }

function updateMinVisitaLite(
  map: Map<string, MinVisitaLite>,
  clienteId: string,
  row: CitaLite,
): void {
  const visita = { fecha: row.fecha, hora: row.hora_inicio, sucursal_id: row.sucursal_id }
  const prev = map.get(clienteId)
  if (!prev || esVisitaAnterior(visita, prev)) {
    map.set(clienteId, visita)
  }
}

export type ClasificacionVisitasAlCierre = {
  alCierre: Set<string>
  antesPeriodo: Set<string>
  /** Primera visita en el alcance del stream (global o sucursal, según visitaScope). */
  primeraVisitaEnStream: Map<string, MinVisitaLite>
}

/** Una pasada sobre citas ≤ fechaHasta; sets + mínimos por cliente sin cargar todo en RAM. */
async function clasificarClientesConVisitaAlCierre(
  fechaHasta: string,
  fechaDesde: string | undefined,
  visitaScope?: VisitaAlCierreScope,
): Promise<ClasificacionVisitasAlCierre> {
  const alCierre = new Set<string>()
  const antesPeriodo = new Set<string>()
  const primeraVisitaEnStream = new Map<string, MinVisitaLite>()

  await streamCitasCompletadasLite({ fechaHasta, visitaScope }, batch => {
    for (const row of batch) {
      alCierre.add(row.cliente_id)
      if (fechaDesde && row.fecha < fechaDesde) {
        antesPeriodo.add(row.cliente_id)
      }
      updateMinVisitaLite(primeraVisitaEnStream, row.cliente_id, row)
    }
  })

  return { alCierre, antesPeriodo, primeraVisitaEnStream }
}

async function contarActivosInactivosAlCierre(
  fechaHasta: string,
  scopeClienteIds: string[] | null,
  visitaScope?: VisitaAlCierreScope,
  fechaDesde?: string,
  clasificacionPre?: Pick<ClasificacionVisitasAlCierre, "alCierre" | "antesPeriodo">,
): Promise<{
  total: number
  activos: number
  activosInicioPeriodo: number
  inactivos: number
  vip: number
  vigentes: number
  conVisitas: number
  embajadoras: number
  nuevos: number
}> {
  let conVisitaAlCierre = new Set<string>()
  let conVisitaAntesPeriodo = new Set<string>()
  try {
    if (clasificacionPre) {
      conVisitaAlCierre = clasificacionPre.alCierre
      conVisitaAntesPeriodo = clasificacionPre.antesPeriodo
    } else {
      const clasificados = await clasificarClientesConVisitaAlCierre(
        fechaHasta,
        fechaDesde,
        visitaScope,
      )
      conVisitaAlCierre = clasificados.alCierre
      conVisitaAntesPeriodo = clasificados.antesPeriodo
    }
  } catch (err) {
    console.error("Error clasificando visitas al cierre:", err)
  }

  if (scopeClienteIds !== null && scopeClienteIds.length === 0) {
    return { ...CLIENTES_STATS_VACIO }
  }

  let total = 0
  let activos = 0
  let activosInicioPeriodo = 0
  let inactivos = 0
  let vip = 0
  let vigentes = 0
  let embajadoras = 0
  const hoy = new Date()
  const hace30Dias = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000)
  const fechaLimite = hace30Dias.toISOString().split("T")[0]
  let nuevos = 0

  const procesarFilas = (
    rows: { id: string; estado: string | null; fecha_registro: string | null; embajadora: boolean | null }[],
  ) => {
    for (const row of rows) {
      total++
      const tieneVisita = conVisitaAlCierre.has(row.id)
      if (tieneVisita) activos++
      else inactivos++
      if (conVisitaAntesPeriodo.has(row.id)) activosInicioPeriodo++
      if (row.estado === "vip") vip++
      if (row.estado === "activo" || row.estado === "vip") vigentes++
      if (row.embajadora === true) embajadoras++
      if (row.fecha_registro && row.fecha_registro >= fechaLimite) nuevos++
    }
  }

  if (scopeClienteIds === null) {
    const PAGE = 1000
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, estado, fecha_registro, embajadora")
        .lte("fecha_registro", fechaHasta)
        .order("fecha_registro", { ascending: true })
        .range(from, from + PAGE - 1)

      if (error) {
        console.error("Error contando clientes al cierre:", error)
        break
      }
      const batch = (data ?? []) as {
        id: string
        estado: string | null
        fecha_registro: string | null
        embajadora: boolean | null
      }[]
      procesarFilas(batch)
      if (batch.length < PAGE) break
      from += PAGE
    }
  } else {
    const chunks: string[][] = []
    for (let i = 0; i < scopeClienteIds.length; i += 400) {
      chunks.push(scopeClienteIds.slice(i, i + 400))
    }
    for (const chunk of chunks) {
      const { data: rows } = await supabase
        .from("clientes")
        .select("id, estado, fecha_registro, embajadora")
        .in("id", chunk)
        .lte("fecha_registro", fechaHasta)

      procesarFilas(
        (rows ?? []) as {
          id: string
          estado: string | null
          fecha_registro: string | null
          embajadora: boolean | null
        }[],
      )
    }
  }

  return {
    total,
    activos,
    activosInicioPeriodo,
    inactivos,
    vip,
    vigentes,
    conVisitas: activos,
    embajadoras,
    nuevos,
  }
}

export type GetClientesStatsOpts = {
  fechaDesde?: string
  /** Cierre del período (visitas con fecha ≤ fechaHasta) */
  fechaHasta?: string
}

function fechaHastaPorDefecto(): string {
  const hoy = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`
}

// Obtener estadísticas de clientes
export async function getClientesStats(
  sucursalId?: string,
  sucursalIds?: string[],
  opts: GetClientesStatsOpts = {},
): Promise<{
  total: number
  /** Activos al cierre (reconciliado en reportes con inicio + nuevos del período) */
  activos: number
  /** Con visita en alcance antes de fechaDesde (inicio del filtro) */
  activosInicioPeriodo: number
  vip: number
  /** Registrados al cierre sin cita completada hasta esa fecha */
  inactivos: number
  nuevos: number
  vigentes: number
  conVisitas: number
  embajadoras: number
}> {
  try {
    const fechaHasta = opts.fechaHasta ?? fechaHastaPorDefecto()
    const fechaDesde = opts.fechaDesde

    const idsSucursales = sucursalIds?.filter(Boolean) ?? []
    const visitaScope: VisitaAlCierreScope | undefined =
      idsSucursales.length > 0
        ? { sucursalIds: idsSucursales }
        : sucursalId
          ? { sucursalId }
          : undefined

    const [scopeClienteIds, clasificacion] = await Promise.all([
      resolveScopeClienteIds(sucursalId, idsSucursales.length > 0 ? idsSucursales : undefined),
      clasificarClientesConVisitaAlCierre(fechaHasta, fechaDesde, visitaScope),
    ])

    return contarActivosInactivosAlCierre(
      fechaHasta,
      scopeClienteIds,
      visitaScope,
      fechaDesde,
      clasificacion,
    )
  } catch (error) {
    console.error("Error inesperado obteniendo estadísticas:", error)
    return { ...CLIENTES_STATS_VACIO }
  }
}

// Top clientes por gasto en un período
export async function getTopClientesPorGasto(
  limit: number = 10,
  fechaDesde?: string,
  fechaHasta?: string,
  sucursalId?: string,
): Promise<Array<{ clienteId: string; nombre: string; visitas: number; totalGastado: number; ultimaVisita: string }>> {
  try {
    let query = (supabase as any)
      .from('pagos')
      .select('cliente_id, monto, fecha, cliente:clientes(nombre, apellido)')
      .eq('estado', 'completado')

    if (sucursalId) query = query.eq('sucursal_id', sucursalId)
    if (fechaDesde)  query = query.gte('fecha', fechaDesde)
    if (fechaHasta)  query = query.lte('fecha', fechaHasta)

    const { data, error } = await query

    if (error || !data) return []

    const mapa = new Map<string, { nombre: string; visitas: number; totalGastado: number; ultimaVisita: string }>()

    for (const row of data as any[]) {
      if (!row.cliente_id) continue
      const nombre = row.cliente ? `${row.cliente.nombre} ${row.cliente.apellido}` : 'Desconocido'
      const prev = mapa.get(row.cliente_id)
      if (prev) {
        prev.visitas++
        prev.totalGastado += Number(row.monto) || 0
        if (row.fecha > prev.ultimaVisita) prev.ultimaVisita = row.fecha
      } else {
        mapa.set(row.cliente_id, {
          nombre,
          visitas: 1,
          totalGastado: Number(row.monto) || 0,
          ultimaVisita: row.fecha ?? '',
        })
      }
    }

    return Array.from(mapa.entries())
      .map(([clienteId, v]) => ({ clienteId, ...v }))
      .sort((a, b) => b.totalGastado - a.totalGastado)
      .slice(0, limit)
  } catch (err) {
    console.error('Error obteniendo top clientes por gasto:', err)
    return []
  }
}

export type ClienteNuevoMotivo = 'nuevo_en_sucursal' | 'primera_sucursal'

export type ClienteNuevoPeriodoRow = {
  clienteId: string
  nombre: string
  fechaPrimeraVisita: string
  servicios: string[]
  sucursalNombre: string
  /** Con filtro de sucursal: por qué entra en el conteo */
  motivo?: ClienteNuevoMotivo
}

type CitaPrimeraVisitaRow = {
  cliente_id: string
  fecha: string
  hora_inicio: string | null
  sucursal_id: string
  cliente: { nombre: string; apellido: string } | null
  sucursal: { nombre: string } | null
  servicio: { nombre: string } | null
}

function esVisitaAnterior(a: { fecha: string; hora: string | null }, b: { fecha: string; hora: string | null }): boolean {
  if (a.fecha !== b.fecha) return a.fecha < b.fecha
  return (a.hora ?? '') < (b.hora ?? '')
}

function citaEnScopeSucursal(
  sucursalId: string,
  scope: { sucursalId?: string; sucursalIds?: string[] },
): boolean {
  if (scope.sucursalId) return sucursalId === scope.sucursalId
  if (scope.sucursalIds?.length) return scope.sucursalIds.includes(sucursalId)
  return true
}

function tieneFiltroSucursal(scope: { sucursalId?: string; sucursalIds?: string[] }): boolean {
  return !!(scope.sucursalId || (scope.sucursalIds?.length ?? 0) > 0)
}

function fechaEnPeriodo(fecha: string, fechaDesde: string, fechaHasta: string): boolean {
  return fecha >= fechaDesde && fecha <= fechaHasta
}

function earliestVisita(
  rows: CitaPrimeraVisitaRow[],
): { fecha: string; hora: string | null; row: CitaPrimeraVisitaRow } | null {
  let best: { fecha: string; hora: string | null; row: CitaPrimeraVisitaRow } | null = null
  for (const row of rows) {
    const visita = { fecha: row.fecha, hora: row.hora_inicio }
    if (!best || esVisitaAnterior(visita, best)) {
      best = { ...visita, row }
    }
  }
  return best
}

function serviciosEnMismoDia(citasCliente: CitaPrimeraVisitaRow[], fecha: string): string[] {
  const serviciosSet = new Set<string>()
  for (const c of citasCliente) {
    if (c.fecha !== fecha) continue
    const nombreSvc = c.servicio?.nombre?.trim()
    if (nombreSvc) serviciosSet.add(nombreSvc)
  }
  return [...serviciosSet].sort((a, b) => a.localeCompare(b, 'es'))
}

async function fetchCitasDetalleParaNuevos(
  clienteIds: string[],
  fechaHasta: string,
): Promise<CitaPrimeraVisitaRow[]> {
  if (clienteIds.length === 0) return []
  const all: CitaPrimeraVisitaRow[] = []
  for (let i = 0; i < clienteIds.length; i += 150) {
    const chunk = clienteIds.slice(i, i + 150)
    const { data, error } = await supabase
      .from("citas")
      .select(
        "cliente_id, fecha, hora_inicio, sucursal_id, cliente:clientes(nombre, apellido), sucursal:sucursales(nombre), servicio:servicios(nombre)",
      )
      .eq("estado", "completada")
      .lte("fecha", fechaHasta)
      .in("cliente_id", chunk)
      .order("fecha", { ascending: true })

    if (error) {
      console.error("Error cargando citas detalle (nuevos):", error)
      continue
    }
    for (const row of data ?? []) {
      const r = row as {
        cliente_id: string
        fecha: string
        hora_inicio: string | null
        sucursal_id: string
        cliente: { nombre: string; apellido: string } | null
        sucursal: { nombre: string } | null
        servicio: { nombre: string } | null
      }
      all.push({
        cliente_id: r.cliente_id,
        fecha: r.fecha,
        hora_inicio: r.hora_inicio,
        sucursal_id: r.sucursal_id,
        cliente: r.cliente,
        sucursal: r.sucursal,
        servicio: r.servicio,
      })
    }
  }
  return all
}

function buildNuevosEnPeriodoFromCitas(
  citasRows: CitaPrimeraVisitaRow[],
  fechaDesde: string,
  fechaHasta: string,
  scope: { sucursalId?: string; sucursalIds?: string[] },
): {
  nuevos: number
  nuevosEnSucursal: number
  primeraVezEnSucursal: number
  detalle: ClienteNuevoPeriodoRow[]
} {
  if (citasRows.length === 0) {
    return { nuevos: 0, nuevosEnSucursal: 0, primeraVezEnSucursal: 0, detalle: [] }
  }

  const citasPorCliente = new Map<string, CitaPrimeraVisitaRow[]>()
  const metaCliente = new Map<string, { nombre: string }>()

  for (const row of citasRows) {
    const id = row.cliente_id
    const bucket = citasPorCliente.get(id)
    if (bucket) bucket.push(row)
    else citasPorCliente.set(id, [row])

    if (!metaCliente.has(id)) {
      const nombre = row.cliente
        ? `${row.cliente.nombre} ${row.cliente.apellido}`.trim()
        : "Desconocido"
      metaCliente.set(id, { nombre })
    }
  }

  const detalle: ClienteNuevoPeriodoRow[] = []
  const conFiltroSucursal = tieneFiltroSucursal(scope)

  for (const [clienteId, citasCliente] of citasPorCliente) {
    const primeraGlobal = earliestVisita(citasCliente)
    if (!primeraGlobal) continue

    if (!conFiltroSucursal) {
      if (!fechaEnPeriodo(primeraGlobal.fecha, fechaDesde, fechaHasta)) continue

      const citasPrimeraDia = citasCliente
        .filter(c => c.fecha === primeraGlobal.fecha)
        .sort((a, b) => (a.hora_inicio ?? "").localeCompare(b.hora_inicio ?? ""))
      const earliest = citasPrimeraDia[0]
      if (!earliest) continue

      detalle.push({
        clienteId,
        nombre: metaCliente.get(clienteId)?.nombre ?? "Desconocido",
        fechaPrimeraVisita: primeraGlobal.fecha,
        servicios: serviciosEnMismoDia(citasCliente, primeraGlobal.fecha),
        sucursalNombre: earliest.sucursal?.nombre ?? "—",
        motivo: "nuevo_en_sucursal",
      })
      continue
    }

    const citasEnScope = citasCliente.filter(c => citaEnScopeSucursal(c.sucursal_id, scope))
    const primeraEnSucursal = earliestVisita(citasEnScope)
    if (
      !primeraEnSucursal ||
      !fechaEnPeriodo(primeraEnSucursal.fecha, fechaDesde, fechaHasta)
    ) {
      continue
    }

    const esNuevoEnSucursal =
      fechaEnPeriodo(primeraGlobal.fecha, fechaDesde, fechaHasta) &&
      citaEnScopeSucursal(primeraGlobal.row.sucursal_id, scope) &&
      primeraGlobal.fecha === primeraEnSucursal.fecha &&
      primeraGlobal.row.sucursal_id === primeraEnSucursal.row.sucursal_id

    const motivo: ClienteNuevoMotivo = esNuevoEnSucursal ? "nuevo_en_sucursal" : "primera_sucursal"

    detalle.push({
      clienteId,
      nombre: metaCliente.get(clienteId)?.nombre ?? "Desconocido",
      fechaPrimeraVisita: primeraEnSucursal.fecha,
      servicios: serviciosEnMismoDia(
        citasEnScope.filter(c => c.sucursal_id === primeraEnSucursal.row.sucursal_id),
        primeraEnSucursal.fecha,
      ),
      sucursalNombre: primeraEnSucursal.row.sucursal?.nombre ?? "—",
      motivo,
    })
  }

  detalle.sort((a, b) => {
    if (a.fechaPrimeraVisita !== b.fechaPrimeraVisita) {
      return b.fechaPrimeraVisita.localeCompare(a.fechaPrimeraVisita)
    }
    return a.nombre.localeCompare(b.nombre, "es")
  })

  const nuevosEnSucursal = detalle.filter(d => d.motivo === "nuevo_en_sucursal").length
  const primeraVezEnSucursal = detalle.filter(d => d.motivo === "primera_sucursal").length

  return {
    nuevos: detalle.length,
    nuevosEnSucursal,
    primeraVezEnSucursal,
    detalle,
  }
}

async function loadCitasParaClientesNuevos(
  fechaDesde: string,
  fechaHasta: string,
  scope: { sucursalId?: string; sucursalIds?: string[] },
  primeraVisitaEnStream?: Map<string, MinVisitaLite>,
): Promise<CitaPrimeraVisitaRow[]> {
  const conFiltroSucursal = tieneFiltroSucursal(scope)
  const visitaScope: VisitaAlCierreScope | undefined = conFiltroSucursal
    ? scope.sucursalId
      ? { sucursalId: scope.sucursalId }
      : { sucursalIds: scope.sucursalIds }
    : undefined

  let candidateIds: string[]

  if (primeraVisitaEnStream) {
    candidateIds = []
    for (const [clienteId, minVisita] of primeraVisitaEnStream) {
      if (fechaEnPeriodo(minVisita.fecha, fechaDesde, fechaHasta)) {
        candidateIds.push(clienteId)
      }
    }
  } else if (conFiltroSucursal && visitaScope) {
    const minPorCliente = new Map<string, MinVisitaLite>()
    await streamCitasCompletadasLite({ fechaHasta, visitaScope }, batch => {
      for (const c of batch) updateMinVisitaLite(minPorCliente, c.cliente_id, c)
    })
    candidateIds = []
    for (const [clienteId, minVisita] of minPorCliente) {
      if (fechaEnPeriodo(minVisita.fecha, fechaDesde, fechaHasta)) {
        candidateIds.push(clienteId)
      }
    }
  } else {
    const minPorCliente = new Map<string, MinVisitaLite>()
    await streamCitasCompletadasLite({ fechaHasta }, batch => {
      for (const c of batch) updateMinVisitaLite(minPorCliente, c.cliente_id, c)
    })
    candidateIds = []
    for (const [clienteId, minVisita] of minPorCliente) {
      if (fechaEnPeriodo(minVisita.fecha, fechaDesde, fechaHasta)) {
        candidateIds.push(clienteId)
      }
    }
  }

  if (candidateIds.length === 0) return []
  return fetchCitasDetalleParaNuevos(candidateIds, fechaHasta)
}

/**
 * Sin filtro de sucursal: clientes cuya primera visita ever (cita completada en cualquier sucursal)
 * cae en el rango.
 *
 * Con filtro de sucursal: clientes cuya 1.ª cita completada en esa(s) sucursal(es)
 * cae en el rango (incluye quien ya visitaba otras sucursales). El detalle distingue
 * si además es su 1.ª visita ever en el sistema en el mismo período.
 */
export async function getClientesNuevosEnPeriodo(
  fechaDesde: string,
  fechaHasta: string,
  scope: { sucursalId?: string; sucursalIds?: string[] } = {},
): Promise<{
  nuevos: number
  nuevosEnSucursal: number
  primeraVezEnSucursal: number
  detalle: ClienteNuevoPeriodoRow[]
}> {
  try {
    const citasRows = await loadCitasParaClientesNuevos(fechaDesde, fechaHasta, scope)
    return buildNuevosEnPeriodoFromCitas(citasRows, fechaDesde, fechaHasta, scope)
  } catch (err) {
    console.error('Error obteniendo clientes nuevos en período:', err)
    return { nuevos: 0, nuevosEnSucursal: 0, primeraVezEnSucursal: 0, detalle: [] }
  }
}

/** Tab Clientes en Reportes: un barrido de citas para stats + detalle acotado para nuevos. */
export async function getReporteClientesTabBundle(
  fechaDesde: string,
  fechaHasta: string,
  params: { sucursalId?: string; sucursalIds?: string[] },
): Promise<{
  cliStats: Awaited<ReturnType<typeof getClientesStats>>
  nuevosPeriodo: Awaited<ReturnType<typeof getClientesNuevosEnPeriodo>>
}> {
  const idsSucursales = params.sucursalIds?.filter(Boolean) ?? []
  const visitaScope: VisitaAlCierreScope | undefined =
    idsSucursales.length > 0
      ? { sucursalIds: idsSucursales }
      : params.sucursalId
        ? { sucursalId: params.sucursalId }
        : undefined

  const [scopeClienteIds, clasificacion] = await Promise.all([
    resolveScopeClienteIds(params.sucursalId, idsSucursales.length > 0 ? idsSucursales : undefined),
    clasificarClientesConVisitaAlCierre(fechaHasta, fechaDesde, visitaScope),
  ])

  const cliStats = await contarActivosInactivosAlCierre(
    fechaHasta,
    scopeClienteIds,
    visitaScope,
    fechaDesde,
    clasificacion,
  )

  const scopeNuevos =
    idsSucursales.length > 0
      ? { sucursalIds: idsSucursales }
      : params.sucursalId
        ? { sucursalId: params.sucursalId }
        : {}

  const citasRows = await loadCitasParaClientesNuevos(
    fechaDesde,
    fechaHasta,
    scopeNuevos,
    clasificacion.primeraVisitaEnStream,
  )
  const nuevosPeriodo = buildNuevosEnPeriodoFromCitas(
    citasRows,
    fechaDesde,
    fechaHasta,
    scopeNuevos,
  )

  return { cliStats, nuevosPeriodo }
}

// Crear un nuevo cliente
export async function createCliente(clienteData: {
  nombre: string
  apellido: string
  telefono: string
  email?: string
  fechaNacimiento?: string
  genero?: 'masculino' | 'femenino' | 'otro'
  notas?: string
  sucursalPreferida?: string
}): Promise<{ success: boolean; cliente?: Cliente; error?: string }> {
  try {
    const nombre = normalizarNombreClienteNuevo(clienteData.nombre)
    const apellido = normalizarNombreClienteNuevo(clienteData.apellido)
    if (!nombre || !apellido) {
      return {
        success: false,
        error:
          'Debes ingresar el nombre y el apellido. Ambos campos son obligatorios.',
      }
    }

    const insertData: any = {
      nombre,
      apellido,
      telefono: clienteData.telefono,
      email: clienteData.email || null,
      fecha_nacimiento: clienteData.fechaNacimiento || null,
      genero: clienteData.genero || null,
      notas: clienteData.notas || null,
      sucursal_preferida: clienteData.sucursalPreferida || null,
      estado: 'activo',
    }

    const { data, error } = await supabase
      .from('clientes')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('Error creando cliente:', error)
      return { success: false, error: error.message }
    }

    if (!data) {
      return { success: false, error: 'No se recibieron datos del servidor' }
    }

    return { success: true, cliente: transformCliente(data as ClienteRow) }
  } catch (error: any) {
    console.error('Error inesperado creando cliente:', error)
    return { success: false, error: error.message || 'Error desconocido' }
  }
}

// Actualizar un cliente existente
export async function updateCliente(
  clienteId: string,
  clienteData: {
    nombre?: string
    apellido?: string
    telefono?: string
    email?: string
    fechaNacimiento?: string
    genero?: 'masculino' | 'femenino' | 'otro'
    direccion?: string
    ciudad?: string
    notas?: string
    sucursalPreferida?: string
    estado?: 'activo' | 'inactivo' | 'vip'
  }
): Promise<{ success: boolean; cliente?: Cliente; error?: string }> {
  try {
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (clienteData.nombre !== undefined) updateData.nombre = clienteData.nombre
    if (clienteData.apellido !== undefined) updateData.apellido = clienteData.apellido
    if (clienteData.telefono !== undefined) updateData.telefono = clienteData.telefono
    if (clienteData.email !== undefined) updateData.email = clienteData.email || null
    if (clienteData.fechaNacimiento !== undefined) updateData.fecha_nacimiento = clienteData.fechaNacimiento || null
    if (clienteData.genero !== undefined) updateData.genero = clienteData.genero || null
    if (clienteData.direccion !== undefined) updateData.direccion = clienteData.direccion || null
    if (clienteData.ciudad !== undefined) updateData.ciudad = clienteData.ciudad || null
    if (clienteData.notas !== undefined) updateData.notas = clienteData.notas || null
    if (clienteData.sucursalPreferida !== undefined) updateData.sucursal_preferida = clienteData.sucursalPreferida || null
    if (clienteData.estado !== undefined) updateData.estado = clienteData.estado

    const { data, error } = await supabase
      .from('clientes')
      .update(updateData)
      .eq('id', clienteId)
      .select()
      .single()

    if (error) {
      console.error('Error actualizando cliente:', error)
      return { success: false, error: error.message }
    }

    if (!data) {
      return { success: false, error: 'No se recibieron datos del servidor' }
    }

    return { success: true, cliente: transformCliente(data as ClienteRow) }
  } catch (error: any) {
    console.error('Error inesperado actualizando cliente:', error)
    return { success: false, error: error.message || 'Error desconocido' }
  }
}

// Alternar el estado de embajadora de un cliente
export async function updateClienteEmbajadora(
  clienteId: string,
  embajadora: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('clientes')
      .update({ embajadora })
      .eq('id', clienteId)

    if (error) {
      console.error('Error actualizando embajadora:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error inesperado actualizando embajadora:', error)
    return { success: false, error: error.message || 'Error desconocido' }
  }
}

// Alternar el estado de vetado de un cliente
export async function updateClienteVetado(
  clienteId: string,
  esVetado: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('clientes')
      .update({ es_vetado: esVetado })
      .eq('id', clienteId)

    if (error) {
      console.error('Error actualizando es_vetado:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error inesperado actualizando es_vetado:', error)
    return { success: false, error: error.message || 'Error desconocido' }
  }
}

// Alternar el estado de problemático de un cliente
export async function updateClienteProblematico(
  clienteId: string,
  esProblematico: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('clientes')
      .update({ es_problematico: esProblematico })
      .eq('id', clienteId)

    if (error) {
      console.error('Error actualizando es_problematico:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error inesperado actualizando es_problematico:', error)
    return { success: false, error: error.message || 'Error desconocido' }
  }
}

// Alternar el estado de descuento de un cliente
export async function updateClienteDescuento(
  clienteId: string,
  esDescuento: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('clientes')
      .update({ es_descuento: esDescuento })
      .eq('id', clienteId)

    if (error) {
      console.error('Error actualizando es_descuento:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error inesperado actualizando es_descuento:', error)
    return { success: false, error: error.message || 'Error desconocido' }
  }
}
