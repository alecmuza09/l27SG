export interface Vacacion {
  id: string
  empleadoId: string
  empleadoNombre: string
  sucursalId: string
  sucursalNombre: string
  fechaInicio: string
  fechaFin: string
  diasSolicitados: number
  estado: "pendiente" | "aprobada" | "rechazada" | "cancelada"
  motivoRechazo: string | null
  aprobadoPorId: string | null
  aprobadoPorNombre: string | null
  fechaSolicitud: string
  fechaResolucion: string | null
  notas: string | null
}

export interface SaldoVacaciones {
  id: string
  empleadoId: string
  empleadoNombre: string
  anio: number
  diasCorrespondientes: number
  diasTomados: number
  diasDisponibles: number
  fechaActualizacion: string
}

export interface PeriodoBloqueado {
  id: string
  sucursalId: string
  sucursalNombre: string
  fechaInicio: string
  fechaFin: string
  motivo: string
  creadoPorId: string
  creadoPorNombre: string
}
