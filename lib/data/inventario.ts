// Inventory data from Supabase and mock data

import { supabase } from '@/lib/supabase/client'

export interface ProductoInventario {
  id: string
  nombre: string
  descripcion: string
  categoria: "productos" | "insumos" | "equipamiento" | "limpieza"
  sku: string
  stockActual: number
  stockMinimo: number
  stockMaximo: number
  unidadMedida: string
  precioCompra: number
  precioVenta?: number
  proveedor: string
  sucursalId: string
  ubicacion?: string
  fechaVencimiento?: string
  ultimaCompra?: string
  activo: boolean
}

export interface MovimientoInventario {
  id: string
  productoId: string
  productoNombre: string
  tipo: "entrada" | "salida" | "ajuste" | "transferencia"
  cantidad: number
  fecha: string
  usuario: string
  motivo: string
  sucursalOrigen?: string
  sucursalDestino?: string
  costo?: number
}

export const MOCK_INVENTARIO: ProductoInventario[] = [
  {
    id: "1",
    nombre: "Aceite de Masaje Lavanda",
    descripcion: "Aceite esencial de lavanda para masajes relajantes",
    categoria: "productos",
    sku: "ACE-LAV-500",
    stockActual: 5,
    stockMinimo: 10,
    stockMaximo: 50,
    unidadMedida: "botella 500ml",
    precioCompra: 250,
    precioVenta: 450,
    proveedor: "Aromas Naturales SA",
    sucursalId: "1",
    ubicacion: "Almacén A - Estante 2",
    fechaVencimiento: "2025-06-30",
    ultimaCompra: "2024-01-05",
    activo: true,
  },
  {
    id: "2",
    nombre: "Toallas Faciales",
    descripcion: "Toallas de algodón para tratamientos faciales",
    categoria: "insumos",
    sku: "TOA-FAC-100",
    stockActual: 15,
    stockMinimo: 20,
    stockMaximo: 100,
    unidadMedida: "paquete 10 unidades",
    precioCompra: 180,
    proveedor: "Textiles Premium",
    sucursalId: "1",
    ubicacion: "Almacén B - Estante 1",
    ultimaCompra: "2024-01-10",
    activo: true,
  },
  {
    id: "3",
    nombre: "Crema Hidratante Facial",
    descripcion: "Crema hidratante con ácido hialurónico",
    categoria: "productos",
    sku: "CRE-HID-250",
    stockActual: 8,
    stockMinimo: 15,
    stockMaximo: 60,
    unidadMedida: "frasco 250ml",
    precioCompra: 320,
    precioVenta: 580,
    proveedor: "Cosméticos Profesionales",
    sucursalId: "1",
    ubicacion: "Almacén A - Estante 3",
    fechaVencimiento: "2025-12-31",
    ultimaCompra: "2023-12-28",
    activo: true,
  },
  {
    id: "4",
    nombre: "Guantes Desechables",
    descripcion: "Guantes de nitrilo talla M",
    categoria: "insumos",
    sku: "GUA-NIT-M",
    stockActual: 45,
    stockMinimo: 30,
    stockMaximo: 150,
    unidadMedida: "caja 100 unidades",
    precioCompra: 120,
    proveedor: "Suministros Médicos",
    sucursalId: "1",
    ubicacion: "Almacén B - Estante 2",
    ultimaCompra: "2024-01-08",
    activo: true,
  },
  {
    id: "5",
    nombre: "Camilla de Masaje",
    descripcion: "Camilla profesional ajustable",
    categoria: "equipamiento",
    sku: "CAM-MAS-001",
    stockActual: 3,
    stockMinimo: 2,
    stockMaximo: 5,
    unidadMedida: "unidad",
    precioCompra: 8500,
    proveedor: "Equipos Spa Pro",
    sucursalId: "1",
    ubicacion: "Sala de Masajes",
    ultimaCompra: "2023-11-15",
    activo: true,
  },
  {
    id: "6",
    nombre: "Desinfectante Multiusos",
    descripcion: "Desinfectante para superficies",
    categoria: "limpieza",
    sku: "DES-MUL-1L",
    stockActual: 12,
    stockMinimo: 15,
    stockMaximo: 50,
    unidadMedida: "botella 1L",
    precioCompra: 85,
    proveedor: "Limpieza Total",
    sucursalId: "1",
    ubicacion: "Almacén C - Estante 1",
    ultimaCompra: "2024-01-12",
    activo: true,
  },
]

export const MOCK_MOVIMIENTOS: MovimientoInventario[] = [
  {
    id: "1",
    productoId: "1",
    productoNombre: "Aceite de Masaje Lavanda",
    tipo: "salida",
    cantidad: 2,
    fecha: "2024-01-15",
    usuario: "María González",
    motivo: "Uso en servicio",
  },
  {
    id: "2",
    productoId: "2",
    productoNombre: "Toallas Faciales",
    tipo: "entrada",
    cantidad: 10,
    fecha: "2024-01-10",
    usuario: "Admin Luna27",
    motivo: "Compra a proveedor",
    costo: 1800,
  },
  {
    id: "3",
    productoId: "3",
    productoNombre: "Crema Hidratante Facial",
    tipo: "salida",
    cantidad: 3,
    fecha: "2024-01-14",
    usuario: "Laura Martínez",
    motivo: "Uso en tratamiento facial",
  },
]

export function getProductoById(id: string): ProductoInventario | undefined {
  return MOCK_INVENTARIO.find((p) => p.id === id)
}

export function getProductosBajoStock(): ProductoInventario[] {
  return MOCK_INVENTARIO.filter((p) => p.stockActual < p.stockMinimo)
}

export function getProductosProximosVencer(): ProductoInventario[] {
  const hoy = new Date()
  const treintaDias = new Date(hoy.getTime() + 30 * 24 * 60 * 60 * 1000)

  return MOCK_INVENTARIO.filter((p) => {
    if (!p.fechaVencimiento) return false
    const vencimiento = new Date(p.fechaVencimiento)
    return vencimiento <= treintaDias && vencimiento >= hoy
  })
}

// Obtener productos desde Supabase
export async function getProductosInventarioFromDB(sucursalId?: string): Promise<ProductoInventario[]> {
  try {
    let query = supabase
      .from('inventario_productos')
      .select('*')
      .eq('activo', true)
      .order('nombre')
    
    if (sucursalId) {
      query = query.eq('sucursal_id', sucursalId)
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('Error obteniendo productos del inventario:', error)
      return []
    }
    
    if (!data) return []
    
    return data.map((producto: any) => ({
      id: producto.id,
      nombre: producto.nombre,
      descripcion: producto.descripcion || '',
      categoria: producto.categoria,
      sku: producto.sku,
      stockActual: producto.stock_actual || 0,
      stockMinimo: producto.stock_minimo || 0,
      stockMaximo: producto.stock_maximo || null,
      unidadMedida: producto.unidad_medida || 'unidad',
      precioCompra: Number(producto.precio_compra) || 0,
      precioVenta: producto.precio_venta ? Number(producto.precio_venta) : undefined,
      proveedor: producto.proveedor || '',
      sucursalId: producto.sucursal_id,
      ubicacion: producto.ubicacion || undefined,
      fechaVencimiento: producto.fecha_vencimiento || undefined,
      ultimaCompra: producto.ultima_compra || undefined,
      activo: producto.activo ?? true,
    }))
  } catch (error) {
    console.error('Error inesperado obteniendo productos:', error)
    return []
  }
}

// Obtener productos bajo stock desde BD
export async function getProductosBajoStockFromDB(sucursalId?: string): Promise<ProductoInventario[]> {
  try {
    let query = supabase
      .from('inventario_productos')
      .select('*')
      .eq('activo', true)
    
    if (sucursalId) {
      query = query.eq('sucursal_id', sucursalId)
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('Error obteniendo productos bajo stock:', error)
      return []
    }
    
    if (!data) return []
    
    return data
      .filter((p: any) => (p.stock_actual || 0) < (p.stock_minimo || 0))
      .map((producto: any) => ({
        id: producto.id,
        nombre: producto.nombre,
        descripcion: producto.descripcion || '',
        categoria: producto.categoria,
        sku: producto.sku,
        stockActual: producto.stock_actual || 0,
        stockMinimo: producto.stock_minimo || 0,
        stockMaximo: producto.stock_maximo || null,
        unidadMedida: producto.unidad_medida || 'unidad',
        precioCompra: Number(producto.precio_compra) || 0,
        precioVenta: producto.precio_venta ? Number(producto.precio_venta) : undefined,
        proveedor: producto.proveedor || '',
        sucursalId: producto.sucursal_id,
        ubicacion: producto.ubicacion || undefined,
        fechaVencimiento: producto.fecha_vencimiento || undefined,
        ultimaCompra: producto.ultima_compra || undefined,
        activo: producto.activo ?? true,
      }))
  } catch (error) {
    console.error('Error inesperado obteniendo productos bajo stock:', error)
    return []
  }
}

// Obtener productos próximos a vencer desde BD
export async function getProductosProximosVencerFromDB(sucursalId?: string): Promise<ProductoInventario[]> {
  try {
    const hoy = new Date().toISOString().split('T')[0]
    const treintaDias = new Date()
    treintaDias.setDate(treintaDias.getDate() + 30)
    const fechaLimite = treintaDias.toISOString().split('T')[0]
    
    let query = supabase
      .from('inventario_productos')
      .select('*')
      .eq('activo', true)
      .not('fecha_vencimiento', 'is', null)
      .gte('fecha_vencimiento', hoy)
      .lte('fecha_vencimiento', fechaLimite)
    
    if (sucursalId) {
      query = query.eq('sucursal_id', sucursalId)
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('Error obteniendo productos próximos a vencer:', error)
      return []
    }
    
    if (!data) return []
    
    return data.map((producto: any) => ({
      id: producto.id,
      nombre: producto.nombre,
      descripcion: producto.descripcion || '',
      categoria: producto.categoria,
      sku: producto.sku,
      stockActual: producto.stock_actual || 0,
      stockMinimo: producto.stock_minimo || 0,
      stockMaximo: producto.stock_maximo || null,
      unidadMedida: producto.unidad_medida || 'unidad',
      precioCompra: Number(producto.precio_compra) || 0,
      precioVenta: producto.precio_venta ? Number(producto.precio_venta) : undefined,
      proveedor: producto.proveedor || '',
      sucursalId: producto.sucursal_id,
      ubicacion: producto.ubicacion || undefined,
      fechaVencimiento: producto.fecha_vencimiento || undefined,
      ultimaCompra: producto.ultima_compra || undefined,
      activo: producto.activo ?? true,
    }))
  } catch (error) {
    console.error('Error inesperado obteniendo productos próximos a vencer:', error)
    return []
  }
}
