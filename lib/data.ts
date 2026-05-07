// Re-export data with alternative names for compatibility
import { MOCK_EMPLEADOS, type Empleado } from "@/lib/data/empleados"
import { MOCK_SUCURSALES, type Sucursal } from "@/lib/data/sucursales"
import type { Cliente } from "@/lib/data/clientes"
import { MOCK_SERVICIOS, type Servicio } from "@/lib/data/servicios"

// Export with alternative names used by new modules
export const empleadosData = MOCK_EMPLEADOS
export const sucursalesData = MOCK_SUCURSALES
export const serviciosData = MOCK_SERVICIOS

// Re-export types
export type { Empleado, Sucursal, Cliente, Servicio }

// Re-export original names for backwards compatibility
export { MOCK_EMPLEADOS, MOCK_SUCURSALES, MOCK_SERVICIOS }
