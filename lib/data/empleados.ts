// Mock data for employees

export interface Empleado {
  id: string
  nombre: string
  apellido: string
  email: string
  telefono: string
  rol: "terapeuta" | "esteticista" | "recepcionista" | "manager"
  sucursalId: string
  especialidades: string[]
  horarioInicio: string
  horarioFin: string
  diasTrabajo: number[]
  activo: boolean
  comision: number
  foto?: string
}

export const MOCK_EMPLEADOS: Empleado[] = [
  {
    id: "1",
    nombre: "María",
    apellido: "González",
    email: "maria.gonzalez@luna27.com",
    telefono: "+52 55 1111 2222",
    rol: "terapeuta",
    sucursalId: "1",
    especialidades: ["Masaje Relajante", "Masaje Deportivo", "Aromaterapia"],
    horarioInicio: "09:00",
    horarioFin: "18:00",
    diasTrabajo: [1, 2, 3, 4, 5],
    activo: true,
    comision: 40,
  },
  {
    id: "2",
    nombre: "Ana",
    apellido: "Garza",
    email: "ana.garza@luna27.com",
    telefono: "+52 55 2222 3333",
    rol: "esteticista",
    sucursalId: "1",
    especialidades: ["Facial Hidratante", "Tratamiento Corporal"],
    horarioInicio: "10:00",
    horarioFin: "19:00",
    diasTrabajo: [1, 2, 3, 4, 5, 6],
    activo: true,
    comision: 35,
  },
  {
    id: "3",
    nombre: "Gaby",
    apellido: "Pérez",
    email: "gaby.perez@luna27.com",
    telefono: "+52 55 3333 4444",
    rol: "esteticista",
    sucursalId: "1",
    especialidades: ["Manicure & Pedicure", "Facial Hidratante"],
    horarioInicio: "09:00",
    horarioFin: "17:00",
    diasTrabajo: [1, 2, 3, 4, 5],
    activo: true,
    comision: 30,
  },
  {
    id: "4",
    nombre: "Andrea",
    apellido: "Rodríguez",
    email: "andrea.rodriguez@luna27.com",
    telefono: "+52 55 4444 5555",
    rol: "terapeuta",
    sucursalId: "1",
    especialidades: ["Masaje Relajante", "Aromaterapia", "Masaje con Piedras Calientes"],
    horarioInicio: "11:00",
    horarioFin: "20:00",
    diasTrabajo: [2, 3, 4, 5, 6],
    activo: true,
    comision: 40,
  },
  {
    id: "5",
    nombre: "Laura",
    apellido: "Martínez",
    email: "laura.martinez@luna27.com",
    telefono: "+52 55 5555 6666",
    rol: "terapeuta",
    sucursalId: "2",
    especialidades: ["Masaje Deportivo", "Reflexología"],
    horarioInicio: "09:00",
    horarioFin: "18:00",
    diasTrabajo: [1, 2, 3, 4, 5],
    activo: true,
    comision: 40,
  },
]

export function getEmpleadoById(id: string): Empleado | undefined {
  return MOCK_EMPLEADOS.find((e) => e.id === id)
}

export function getEmpleadosBySucursal(sucursalId: string): Empleado[] {
  return MOCK_EMPLEADOS.filter((e) => e.sucursalId === sucursalId && e.activo)
}
