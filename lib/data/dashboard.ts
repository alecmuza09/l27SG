// Dashboard productivity data

import { MOCK_SUCURSALES } from "./sucursales"
import { MOCK_EMPLEADOS } from "./empleados"
import { MOCK_CITAS } from "./citas"
import { MOCK_PAGOS } from "./pagos"

export interface ProductividadSucursal {
  sucursalId: string
  nombre: string
  ingresos: number
  citas: number
  ocupacion: number
  clientesAtendidos: number
  promedioTicket: number
  tendencia: number // porcentaje de cambio vs período anterior
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

// Calcular productividad por sucursal
export function getProductividadSucursales(): ProductividadSucursal[] {
  const sucursales = MOCK_SUCURSALES.filter((s) => s.activa)
  
  // Generar datos más realistas basados en el índice de la sucursal para variación
  return sucursales.map((sucursal, index) => {
    const citasSucursal = MOCK_CITAS.filter((c) => c.sucursalId === sucursal.id)
    const pagosSucursal = MOCK_PAGOS.filter((p) => p.sucursalId === sucursal.id && p.estado === "completado")
    
    // Base de ingresos y citas de datos reales, con variación por sucursal
    const baseIngresos = pagosSucursal.reduce((sum, p) => sum + p.monto, 0)
    const baseCitas = citasSucursal.length
    
    // Multiplicador basado en el índice para crear variación entre sucursales
    // Las primeras sucursales tienen más datos, así que usamos un factor de escala
    const factorEscala = 1 + (index * 0.3) + Math.sin(index) * 0.2
    const ingresos = Math.round(baseIngresos * factorEscala || (15000 + index * 2000 + Math.random() * 5000))
    const citas = Math.round(baseCitas * factorEscala || (20 + index * 5 + Math.random() * 15))
    
    const clientesAtendidos = new Set(citasSucursal.map((c) => c.clienteId)).size || Math.round(citas * 0.8)
    const promedioTicket = citas > 0 ? ingresos / citas : 600 + Math.random() * 400
    
    // Calcular ocupación (citas completadas / capacidad estimada)
    const empleadosSucursal = MOCK_EMPLEADOS.filter((e) => e.sucursalId === sucursal.id && e.activo)
    const numEmpleados = empleadosSucursal.length || 3 + Math.floor(index / 2)
    const capacidadDiaria = numEmpleados * 8
    const ocupacion = capacidadDiaria > 0 
      ? Math.min(100, Math.round((citas / capacidadDiaria) * 100))
      : Math.round(60 + index * 3 + Math.random() * 20)
    
    // Tendencia simulada con más variación
    const tendencia = (Math.random() * 30 - 10) + (index % 3 - 1) * 5 // -10% a +20% con variación
    
    return {
      sucursalId: sucursal.id,
      nombre: sucursal.nombre,
      ingresos,
      citas,
      ocupacion,
      clientesAtendidos,
      promedioTicket: Math.round(promedioTicket),
      tendencia: Math.round(tendencia * 10) / 10,
    }
  })
}

// Calcular top 10 empleados por productividad
export function getTopEmpleados(limit: number = 10): ProductividadEmpleado[] {
  const empleados = MOCK_EMPLEADOS.filter((e) => e.activo)
  
  // Si hay menos empleados que el límite, generar datos adicionales simulados
  const empleadosConDatos = empleados.map((empleado, index) => {
    const citasEmpleado = MOCK_CITAS.filter((c) => c.empleadoId === empleado.id)
    const pagosEmpleado = MOCK_PAGOS.filter(
      (p) => p.empleadoId === empleado.id && p.estado === "completado"
    )
    
    const baseIngresos = pagosEmpleado.reduce((sum, p) => sum + p.monto, 0)
    const baseCitas = citasEmpleado.length
    
    // Generar datos más variados para crear un ranking interesante
    const factorProductividad = 0.8 + (index * 0.15) + Math.random() * 0.3
    const ingresos = Math.round(baseIngresos * factorProductividad || (8000 + index * 1000 + Math.random() * 5000))
    const citas = Math.round(baseCitas * factorProductividad || (15 + index * 3 + Math.random() * 10))
    const serviciosCompletados = Math.round(citas * 0.85)
    const promedioTicket = citas > 0 ? ingresos / citas : 500 + Math.random() * 300
    
    // Calcular ocupación basada en horas trabajadas
    const horasTrabajadas = 8
    const horasOcupadas = citasEmpleado.reduce((sum, c) => sum + c.duracion / 60, 0) || (citas * 1.2)
    const ocupacion = horasTrabajadas > 0 
      ? Math.min(100, Math.round((horasOcupadas / horasTrabajadas) * 100))
      : Math.round(65 + index * 5 + Math.random() * 15)
    
    // Rating simulado con variación
    const rating = 4.2 + (index * 0.05) + Math.random() * 0.6 // 4.2 a 4.8+ con variación
    
    const sucursal = MOCK_SUCURSALES.find((s) => s.id === empleado.sucursalId)
    
    return {
      empleadoId: empleado.id,
      nombre: empleado.nombre,
      apellido: empleado.apellido,
      sucursalId: empleado.sucursalId,
      sucursalNombre: sucursal?.nombre || "N/A",
      citas,
      ingresos,
      ocupacion,
      promedioTicket: Math.round(promedioTicket),
      rating: Math.round(rating * 10) / 10,
      serviciosCompletados,
    }
  })
  
  // Si necesitamos más empleados para el top 10, generar empleados simulados
  if (empleadosConDatos.length < limit) {
    const empleadosFaltantes = limit - empleadosConDatos.length
    const nombres = ["Carmen", "Patricia", "Sofía", "Elena", "Isabel", "Lucía", "Valeria", "Daniela", "Fernanda", "Alejandra"]
    const apellidos = ["López", "Hernández", "García", "Martínez", "Sánchez", "Torres", "Ramírez", "Flores", "Morales", "Castro"]
    
    for (let i = 0; i < empleadosFaltantes; i++) {
      const idx = empleadosConDatos.length + i
      const sucursal = MOCK_SUCURSALES[i % MOCK_SUCURSALES.length]
      const ingresos = 12000 - (i * 800) + Math.random() * 2000
      const citas = 20 - (i * 2) + Math.random() * 5
      
      empleadosConDatos.push({
        empleadoId: `sim-${idx}`,
        nombre: nombres[i % nombres.length],
        apellido: apellidos[i % apellidos.length],
        sucursalId: sucursal.id,
        sucursalNombre: sucursal.nombre,
        citas: Math.round(citas),
        ingresos: Math.round(ingresos),
        ocupacion: Math.round(70 + i * 2 + Math.random() * 10),
        promedioTicket: Math.round(ingresos / citas),
        rating: Math.round((4.5 + i * 0.03 + Math.random() * 0.3) * 10) / 10,
        serviciosCompletados: Math.round(citas * 0.9),
      })
    }
  }
  
  // Ordenar por ingresos y tomar top N
  return empleadosConDatos
    .sort((a, b) => b.ingresos - a.ingresos)
    .slice(0, limit)
}

// Datos para gráficos de tendencia (últimos 7 días)
export function getTendenciaProductividad() {
  const dias = 7
  const data = []
  
  for (let i = dias - 1; i >= 0; i--) {
    const fecha = new Date()
    fecha.setDate(fecha.getDate() - i)
    const fechaStr = fecha.toISOString().split("T")[0]
    
    const citasDia = MOCK_CITAS.filter((c) => c.fecha === fechaStr)
    const pagosDia = MOCK_PAGOS.filter((p) => p.fecha === fechaStr && p.estado === "completado")
    
    const ingresos = pagosDia.reduce((sum, p) => sum + p.monto, 0)
    const citas = citasDia.length
    
    data.push({
      fecha: fechaStr,
      dia: fecha.toLocaleDateString("es-MX", { weekday: "short" }),
      ingresos,
      citas,
    })
  }
  
  return data
}

