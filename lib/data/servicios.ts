// Mock data for services

export interface Servicio {
  id: string
  nombre: string
  descripcion: string
  duracion: number
  precio: number
  categoria: string
  activo: boolean
  color?: string
}

export const MOCK_SERVICIOS: Servicio[] = [
  {
    id: "1",
    nombre: "MANI CLÁSICO",
    descripcion: "Manicure clásico con esmaltado tradicional",
    duracion: 60,
    precio: 299,
    categoria: "Manicure",
    activo: true,
    color: "#d4a574",
  },
  {
    id: "2",
    nombre: "Mani Luna",
    descripcion: "Manicure premium con tratamiento especial Luna27",
    duracion: 90,
    precio: 420,
    categoria: "Manicure",
    activo: true,
    color: "#c9986a",
  },
  {
    id: "3",
    nombre: "MANI SPA",
    descripcion: "Manicure spa con exfoliación y masaje de manos",
    duracion: 75,
    precio: 349,
    categoria: "Manicure",
    activo: true,
    color: "#d4a574",
  },
  {
    id: "4",
    nombre: "Mani Vip 4 Lunas",
    descripcion: "Manicure VIP completo con tratamiento de lujo",
    duracion: 120,
    precio: 565,
    categoria: "Manicure",
    activo: true,
    color: "#b8895f",
  },
  {
    id: "5",
    nombre: "Pedi Clásico",
    descripcion: "Pedicure clásico con esmaltado tradicional",
    duracion: 60,
    precio: 420,
    categoria: "Pedicure",
    activo: true,
    color: "#a8956b",
  },
  {
    id: "6",
    nombre: "Pedi Luna",
    descripcion: "Pedicure premium con tratamiento especial Luna27",
    duracion: 90,
    precio: 599,
    categoria: "Pedicure",
    activo: true,
    color: "#9d8a60",
  },
  {
    id: "7",
    nombre: "Pedi Podológico",
    descripcion: "Pedicure podológico especializado para cuidado de pies",
    duracion: 120,
    precio: 679,
    categoria: "Pedicure",
    activo: true,
    color: "#8b7355",
  },
  {
    id: "8",
    nombre: "Pedi Spa",
    descripcion: "Pedicure spa con exfoliación y masaje de pies",
    duracion: 75,
    precio: 499,
    categoria: "Pedicure",
    activo: true,
    color: "#a8956b",
  },
  {
    id: "9",
    nombre: "Pedi Vip 4 Lunas",
    descripcion: "Pedicure VIP completo con tratamiento de lujo",
    duracion: 120,
    precio: 699,
    categoria: "Pedicure",
    activo: true,
    color: "#8b7355",
  },
]

export function getServicioById(id: string): Servicio | undefined {
  return MOCK_SERVICIOS.find((s) => s.id === id)
}

export function getServiciosActivos(): Servicio[] {
  return MOCK_SERVICIOS.filter((s) => s.activo)
}
