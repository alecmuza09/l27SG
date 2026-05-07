"use server"

import { supabaseAdmin } from "@/lib/supabase/server"

export interface EmpleadaNomina {
  empleadaId: string
  nombre: string
  apellido: string
  servicios: number
  ingresos: number
  porcentajeComision: number
  comision: number
}

export interface SucursalNomina {
  sucursalId: string
  sucursalNombre: string
  empleadas: EmpleadaNomina[]
  totalServicios: number
  totalIngresos: number
  totalComision: number
}

export interface NominasResult {
  sucursales: SucursalNomina[]
  totalServicios: number
  totalIngresos: number
  totalComision: number
  fechaInicio: string
  fechaFin: string
}

export async function getNominasAction(
  fechaInicio: string,
  fechaFin: string
): Promise<{ data?: NominasResult; error?: string }> {
  try {
    // Traer todas las citas completadas en el rango con empleada y sucursal
    const { data: citas, error } = await supabaseAdmin
      .from("citas")
      .select(`
        id,
        precio,
        sucursal_id,
        empleado:empleados(id, nombre, apellido, comision),
        sucursal:sucursales(id, nombre)
      `)
      .eq("estado", "completada")
      .gte("fecha", fechaInicio)
      .lte("fecha", fechaFin)
      .order("sucursal_id")

    if (error) return { error: error.message }

    // Agrupar por sucursal → empleada
    const mapaS = new Map<string, {
      sucursalId: string
      sucursalNombre: string
      empleadas: Map<string, {
        empleadaId: string
        nombre: string
        apellido: string
        porcentajeComision: number
        servicios: number
        ingresos: number
      }>
    }>()

    for (const cita of citas ?? []) {
      const suc = cita.sucursal as any
      const emp = cita.empleado as any
      if (!suc || !emp) continue

      const sucId = suc.id as string
      const sucNombre = suc.nombre as string
      const empId = emp.id as string

      if (!mapaS.has(sucId)) {
        mapaS.set(sucId, {
          sucursalId: sucId,
          sucursalNombre: sucNombre,
          empleadas: new Map(),
        })
      }

      const sucEntry = mapaS.get(sucId)!

      if (!sucEntry.empleadas.has(empId)) {
        sucEntry.empleadas.set(empId, {
          empleadaId: empId,
          nombre: emp.nombre as string,
          apellido: emp.apellido as string,
          porcentajeComision: Number(emp.comision ?? 0),
          servicios: 0,
          ingresos: 0,
        })
      }

      const empEntry = sucEntry.empleadas.get(empId)!
      empEntry.servicios += 1
      empEntry.ingresos += Number(cita.precio ?? 0)
    }

    // Convertir a arrays y calcular comisiones
    let totalServicios = 0
    let totalIngresos = 0
    let totalComision = 0

    const sucursales: SucursalNomina[] = Array.from(mapaS.values())
      .sort((a, b) => a.sucursalNombre.localeCompare(b.sucursalNombre))
      .map((suc) => {
        const empleadas: EmpleadaNomina[] = Array.from(suc.empleadas.values())
          .sort((a, b) => `${a.nombre} ${a.apellido}`.localeCompare(`${b.nombre} ${b.apellido}`))
          .map((e) => ({
            empleadaId: e.empleadaId,
            nombre: e.nombre,
            apellido: e.apellido,
            servicios: e.servicios,
            ingresos: e.ingresos,
            porcentajeComision: e.porcentajeComision,
            comision: Math.round(e.ingresos * (e.porcentajeComision / 100) * 100) / 100,
          }))

        const totalSuc: Pick<SucursalNomina, "totalServicios" | "totalIngresos" | "totalComision"> = {
          totalServicios: empleadas.reduce((s, e) => s + e.servicios, 0),
          totalIngresos:  empleadas.reduce((s, e) => s + e.ingresos, 0),
          totalComision:  empleadas.reduce((s, e) => s + e.comision, 0),
        }

        totalServicios += totalSuc.totalServicios
        totalIngresos  += totalSuc.totalIngresos
        totalComision  += totalSuc.totalComision

        return {
          sucursalId: suc.sucursalId,
          sucursalNombre: suc.sucursalNombre,
          empleadas,
          ...totalSuc,
        }
      })

    return {
      data: {
        sucursales,
        totalServicios,
        totalIngresos,
        totalComision,
        fechaInicio,
        fechaFin,
      },
    }
  } catch (err: any) {
    return { error: err.message ?? "Error desconocido" }
  }
}
