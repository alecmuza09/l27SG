// Tipos TypeScript generados para Supabase
// Estos tipos deben coincidir con la estructura de la base de datos

export type Database = {
  public: {
    Tables: {
      sucursales: {
        Row: {
          id: string
          nombre: string
          direccion: string
          telefono: string
          email: string
          horario: string | null
          ciudad: string | null
          pais: string | null
          activa: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nombre: string
          direccion: string
          telefono: string
          email: string
          horario?: string | null
          ciudad?: string | null
          pais?: string | null
          activa?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          direccion?: string
          telefono?: string
          email?: string
          horario?: string | null
          ciudad?: string | null
          pais?: string | null
          activa?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      empleados: {
        Row: {
          id: string
          nombre: string
          apellido: string
          email: string
          telefono: string
          rol: 'terapeuta' | 'esteticista' | 'recepcionista' | 'manager'
          sucursal_id: string
          especialidades: string[] | null
          horario_inicio: string
          horario_fin: string
          dias_trabajo: number[] | null
          comision: number
          foto: string | null
          activo: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nombre: string
          apellido: string
          email: string
          telefono: string
          rol: 'terapeuta' | 'esteticista' | 'recepcionista' | 'manager'
          sucursal_id: string
          especialidades?: string[] | null
          horario_inicio: string
          horario_fin: string
          dias_trabajo?: number[] | null
          comision?: number
          foto?: string | null
          activo?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          apellido?: string
          email?: string
          telefono?: string
          rol?: 'terapeuta' | 'esteticista' | 'recepcionista' | 'manager'
          sucursal_id?: string
          especialidades?: string[] | null
          horario_inicio?: string
          horario_fin?: string
          dias_trabajo?: number[] | null
          comision?: number
          foto?: string | null
          activo?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      clientes: {
        Row: {
          id: string
          nombre: string
          apellido: string
          email: string | null
          telefono: string
          fecha_nacimiento: string | null
          genero: 'masculino' | 'femenino' | 'otro' | null
          direccion: string | null
          ciudad: string | null
          notas: string | null
          fecha_registro: string
          ultima_visita: string | null
          total_visitas: number
          total_gastado: number
          puntos_fidelidad: number
          preferencias: string[] | null
          alergias: string[] | null
          sucursal_preferida: string | null
          estado: 'activo' | 'inactivo' | 'vip'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nombre: string
          apellido: string
          email?: string | null
          telefono: string
          fecha_nacimiento?: string | null
          genero?: 'masculino' | 'femenino' | 'otro' | null
          direccion?: string | null
          ciudad?: string | null
          notas?: string | null
          fecha_registro?: string
          ultima_visita?: string | null
          total_visitas?: number
          total_gastado?: number
          puntos_fidelidad?: number
          preferencias?: string[] | null
          alergias?: string[] | null
          sucursal_preferida?: string | null
          estado?: 'activo' | 'inactivo' | 'vip'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          apellido?: string
          email?: string | null
          telefono?: string
          fecha_nacimiento?: string | null
          genero?: 'masculino' | 'femenino' | 'otro' | null
          direccion?: string | null
          ciudad?: string | null
          notas?: string | null
          fecha_registro?: string
          ultima_visita?: string | null
          total_visitas?: number
          total_gastado?: number
          puntos_fidelidad?: number
          preferencias?: string[] | null
          alergias?: string[] | null
          sucursal_preferida?: string | null
          estado?: 'activo' | 'inactivo' | 'vip'
          created_at?: string
          updated_at?: string
        }
      }
      servicios: {
        Row: {
          id: string
          nombre: string
          descripcion: string | null
          duracion: number
          precio: number
          categoria: string
          color: string | null
          activo: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nombre: string
          descripcion?: string | null
          duracion: number
          precio: number
          categoria: string
          color?: string | null
          activo?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          descripcion?: string | null
          duracion?: number
          precio?: number
          categoria?: string
          color?: string | null
          activo?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      citas: {
        Row: {
          id: string
          cliente_id: string
          empleado_id: string
          servicio_id: string
          sucursal_id: string
          fecha: string
          hora_inicio: string
          hora_fin: string
          duracion: number
          precio: number
          estado: 'pendiente' | 'confirmada' | 'en-progreso' | 'completada' | 'cancelada' | 'no-asistio'
          notas: string | null
          metodo_pago: string | null
          pagado: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          cliente_id: string
          empleado_id: string
          servicio_id: string
          sucursal_id: string
          fecha: string
          hora_inicio: string
          hora_fin: string
          duracion: number
          precio: number
          estado?: 'pendiente' | 'confirmada' | 'en-progreso' | 'completada' | 'cancelada' | 'no-asistio'
          notas?: string | null
          metodo_pago?: string | null
          pagado?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          cliente_id?: string
          empleado_id?: string
          servicio_id?: string
          sucursal_id?: string
          fecha?: string
          hora_inicio?: string
          hora_fin?: string
          duracion?: number
          precio?: number
          estado?: 'pendiente' | 'confirmada' | 'en-progreso' | 'completada' | 'cancelada' | 'no-asistio'
          notas?: string | null
          metodo_pago?: string | null
          pagado?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      pagos: {
        Row: {
          id: string
          cita_id: string | null
          cliente_id: string
          empleado_id: string
          sucursal_id: string
          monto: number
          metodo_pago: 'efectivo' | 'tarjeta' | 'transferencia' | 'otro'
          estado: 'pendiente' | 'completado' | 'reembolsado' | 'cancelado'
          fecha: string
          hora: string
          servicios: string[] | null
          notas: string | null
          referencia: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          cita_id?: string | null
          cliente_id: string
          empleado_id: string
          sucursal_id: string
          monto: number
          metodo_pago: 'efectivo' | 'tarjeta' | 'transferencia' | 'otro'
          estado?: 'pendiente' | 'completado' | 'reembolsado' | 'cancelado'
          fecha?: string
          hora?: string
          servicios?: string[] | null
          notas?: string | null
          referencia?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          cita_id?: string | null
          cliente_id?: string
          empleado_id?: string
          sucursal_id?: string
          monto?: number
          metodo_pago?: 'efectivo' | 'tarjeta' | 'transferencia' | 'otro'
          estado?: 'pendiente' | 'completado' | 'reembolsado' | 'cancelado'
          fecha?: string
          hora?: string
          servicios?: string[] | null
          notas?: string | null
          referencia?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}







