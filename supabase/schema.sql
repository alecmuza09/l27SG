-- ============================================
-- Luna27 Spa Management System - Database Schema
-- ============================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Para búsquedas de texto

-- ============================================
-- TABLA: sucursales
-- ============================================
CREATE TABLE IF NOT EXISTS sucursales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(255) NOT NULL,
  direccion TEXT NOT NULL,
  telefono VARCHAR(50) NOT NULL,
  email VARCHAR(255) NOT NULL,
  horario TEXT,
  ciudad VARCHAR(100),
  pais VARCHAR(100) DEFAULT 'México',
  activa BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TABLA: usuarios (para autenticación)
-- ============================================
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  rol VARCHAR(50) NOT NULL CHECK (rol IN ('admin', 'manager', 'staff')),
  sucursal_id UUID REFERENCES sucursales(id) ON DELETE SET NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TABLA: empleados
-- ============================================
CREATE TABLE IF NOT EXISTS empleados (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(255) NOT NULL,
  apellido VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  telefono VARCHAR(50) NOT NULL,
  rol VARCHAR(50) NOT NULL CHECK (rol IN ('terapeuta', 'esteticista', 'recepcionista', 'manager')),
  sucursal_id UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  especialidades TEXT[], -- Array de especialidades
  horario_inicio TIME NOT NULL,
  horario_fin TIME NOT NULL,
  dias_trabajo INTEGER[], -- Array de días de la semana (0=Domingo, 6=Sábado)
  comision DECIMAL(5,2) DEFAULT 0,
  foto TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TABLA: clientes
-- ============================================
CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(255) NOT NULL,
  apellido VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  telefono VARCHAR(50) NOT NULL,
  fecha_nacimiento DATE,
  genero VARCHAR(20) CHECK (genero IN ('masculino', 'femenino', 'otro')),
  direccion TEXT,
  ciudad VARCHAR(100),
  notas TEXT,
  fecha_registro DATE DEFAULT CURRENT_DATE,
  ultima_visita DATE,
  total_visitas INTEGER DEFAULT 0,
  total_gastado DECIMAL(10,2) DEFAULT 0,
  puntos_fidelidad INTEGER DEFAULT 0,
  preferencias TEXT[],
  alergias TEXT[],
  sucursal_preferida UUID REFERENCES sucursales(id) ON DELETE SET NULL,
  estado VARCHAR(20) DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo', 'vip')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TABLA: servicios
-- ============================================
CREATE TABLE IF NOT EXISTS servicios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  duracion INTEGER NOT NULL, -- en minutos
  precio DECIMAL(10,2) NOT NULL,
  categoria VARCHAR(100) NOT NULL,
  color VARCHAR(7), -- Color hexadecimal
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TABLA: citas
-- ============================================
CREATE TABLE IF NOT EXISTS citas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  empleado_id UUID NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  servicio_id UUID NOT NULL REFERENCES servicios(id) ON DELETE RESTRICT,
  sucursal_id UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  duracion INTEGER NOT NULL, -- en minutos
  precio DECIMAL(10,2) NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmada', 'en-progreso', 'completada', 'cancelada', 'no-asistio')),
  notas TEXT,
  metodo_pago VARCHAR(50),
  pagado BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_time_range CHECK (hora_fin > hora_inicio)
);

-- ============================================
-- TABLA: pagos
-- ============================================
CREATE TABLE IF NOT EXISTS pagos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cita_id UUID REFERENCES citas(id) ON DELETE SET NULL,
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  empleado_id UUID NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  sucursal_id UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  monto DECIMAL(10,2) NOT NULL,
  metodo_pago VARCHAR(50) NOT NULL CHECK (metodo_pago IN ('efectivo', 'tarjeta', 'transferencia', 'otro')),
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'completado', 'reembolsado', 'cancelado')),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  hora TIME NOT NULL DEFAULT CURRENT_TIME,
  servicios TEXT[], -- Array de nombres de servicios
  notas TEXT,
  referencia VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TABLA: inventario_productos
-- ============================================
CREATE TABLE IF NOT EXISTS inventario_productos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  categoria VARCHAR(50) NOT NULL CHECK (categoria IN ('productos', 'insumos', 'equipamiento', 'limpieza')),
  sku VARCHAR(100) UNIQUE NOT NULL,
  stock_actual INTEGER NOT NULL DEFAULT 0,
  stock_minimo INTEGER NOT NULL DEFAULT 0,
  stock_maximo INTEGER,
  unidad_medida VARCHAR(50) DEFAULT 'unidad',
  precio_compra DECIMAL(10,2) NOT NULL,
  precio_venta DECIMAL(10,2),
  proveedor VARCHAR(255),
  sucursal_id UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  ubicacion VARCHAR(255),
  fecha_vencimiento DATE,
  ultima_compra DATE,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TABLA: inventario_movimientos
-- ============================================
CREATE TABLE IF NOT EXISTS inventario_movimientos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  producto_id UUID NOT NULL REFERENCES inventario_productos(id) ON DELETE CASCADE,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('entrada', 'salida', 'ajuste', 'transferencia')),
  cantidad INTEGER NOT NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  motivo TEXT,
  sucursal_origen UUID REFERENCES sucursales(id) ON DELETE SET NULL,
  sucursal_destino UUID REFERENCES sucursales(id) ON DELETE SET NULL,
  costo DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TABLA: promociones
-- ============================================
CREATE TABLE IF NOT EXISTS promociones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('porcentaje', 'monto_fijo', 'paquete', 'descuento_porcentaje', 'descuento_fijo', '2x1', 'otro')),
  valor DECIMAL(10,2), -- Porcentaje o monto fijo
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  servicios_aplicables UUID[], -- Array de IDs de servicios
  sucursales_aplicables UUID[], -- Array de IDs de sucursales
  usos_maximos INTEGER,
  usos_actuales INTEGER DEFAULT 0,
  codigo_promo VARCHAR(100) UNIQUE,
  activa BOOLEAN DEFAULT true,
  condiciones TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TABLA: gift_cards
-- ============================================
CREATE TABLE IF NOT EXISTS gift_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo VARCHAR(50) UNIQUE NOT NULL,
  monto_inicial DECIMAL(10,2) NOT NULL,
  saldo_actual DECIMAL(10,2) NOT NULL,
  estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'activa', 'agotada', 'cancelada', 'expirada')),
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  sucursal_id UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  empleado_emisor_id UUID REFERENCES empleados(id) ON DELETE SET NULL,
  fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_activacion DATE,
  fecha_vencimiento DATE,
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TABLA: gift_card_transacciones
-- ============================================
CREATE TABLE IF NOT EXISTS gift_card_transacciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gift_card_id UUID NOT NULL REFERENCES gift_cards(id) ON DELETE CASCADE,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('emision', 'activacion', 'canje', 'recarga', 'cancelacion', 'compra', 'uso', 'reembolso')),
  monto DECIMAL(10,2) NOT NULL,
  saldo_anterior DECIMAL(10,2) NOT NULL,
  saldo_nuevo DECIMAL(10,2) NOT NULL,
  venta_id UUID REFERENCES pagos(id) ON DELETE SET NULL,
  empleado_id UUID REFERENCES empleados(id) ON DELETE SET NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  referencia VARCHAR(255),
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TABLA: vacaciones
-- ============================================
CREATE TABLE IF NOT EXISTS vacaciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empleado_id UUID NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  dias_solicitados INTEGER NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'rechazada', 'cancelada', 'completada')),
  motivo_rechazo TEXT,
  aprobado_por_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha_solicitud DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_resolucion DATE,
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_date_range CHECK (fecha_fin >= fecha_inicio)
);

-- ============================================
-- TABLA: saldo_vacaciones
-- ============================================
CREATE TABLE IF NOT EXISTS saldo_vacaciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empleado_id UUID NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  anio INTEGER NOT NULL,
  dias_correspondientes INTEGER NOT NULL DEFAULT 0,
  dias_tomados INTEGER NOT NULL DEFAULT 0,
  dias_disponibles INTEGER NOT NULL DEFAULT 0,
  fecha_actualizacion DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(empleado_id, anio)
);

-- ============================================
-- TABLA: periodos_bloqueados
-- ============================================
CREATE TABLE IF NOT EXISTS periodos_bloqueados (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sucursal_id UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  motivo TEXT NOT NULL,
  creado_por_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_periodo_range CHECK (fecha_fin >= fecha_inicio)
);

-- ============================================
-- ÍNDICES para mejorar rendimiento
-- ============================================

-- Índices para sucursales
CREATE INDEX IF NOT EXISTS idx_sucursales_activa ON sucursales(activa);

-- Índices para empleados
CREATE INDEX IF NOT EXISTS idx_empleados_sucursal ON empleados(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_empleados_activo ON empleados(activo);
CREATE INDEX IF NOT EXISTS idx_empleados_email ON empleados(email);

-- Índices para clientes
CREATE INDEX IF NOT EXISTS idx_clientes_email ON clientes(email);
CREATE INDEX IF NOT EXISTS idx_clientes_telefono ON clientes(telefono);
CREATE INDEX IF NOT EXISTS idx_clientes_estado ON clientes(estado);
CREATE INDEX IF NOT EXISTS idx_clientes_sucursal_preferida ON clientes(sucursal_preferida);

-- Índices para citas
CREATE INDEX IF NOT EXISTS idx_citas_cliente ON citas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_citas_empleado ON citas(empleado_id);
CREATE INDEX IF NOT EXISTS idx_citas_fecha ON citas(fecha);
CREATE INDEX IF NOT EXISTS idx_citas_sucursal ON citas(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_citas_estado ON citas(estado);
CREATE INDEX IF NOT EXISTS idx_citas_fecha_empleado ON citas(fecha, empleado_id);

-- Índices para pagos
CREATE INDEX IF NOT EXISTS idx_pagos_cita ON pagos(cita_id);
CREATE INDEX IF NOT EXISTS idx_pagos_cliente ON pagos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pagos_fecha ON pagos(fecha);
CREATE INDEX IF NOT EXISTS idx_pagos_estado ON pagos(estado);

-- Índices para inventario
CREATE INDEX IF NOT EXISTS idx_inventario_sucursal ON inventario_productos(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_inventario_sku ON inventario_productos(sku);
CREATE INDEX IF NOT EXISTS idx_inventario_categoria ON inventario_productos(categoria);
CREATE INDEX IF NOT EXISTS idx_movimientos_producto ON inventario_movimientos(producto_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON inventario_movimientos(fecha);

-- Índices para gift cards
CREATE INDEX IF NOT EXISTS idx_gift_cards_codigo ON gift_cards(codigo);
CREATE INDEX IF NOT EXISTS idx_gift_cards_cliente ON gift_cards(cliente_id);
CREATE INDEX IF NOT EXISTS idx_gift_cards_activa ON gift_cards(activa);

-- Índices para vacaciones
CREATE INDEX IF NOT EXISTS idx_vacaciones_empleado ON vacaciones(empleado_id);
CREATE INDEX IF NOT EXISTS idx_vacaciones_fecha_inicio ON vacaciones(fecha_inicio);
CREATE INDEX IF NOT EXISTS idx_vacaciones_estado ON vacaciones(estado);

-- ============================================
-- FUNCIONES y TRIGGERS
-- ============================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_sucursales_updated_at BEFORE UPDATE ON sucursales
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_empleados_updated_at BEFORE UPDATE ON empleados
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_servicios_updated_at BEFORE UPDATE ON servicios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_citas_updated_at BEFORE UPDATE ON citas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pagos_updated_at BEFORE UPDATE ON pagos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventario_productos_updated_at BEFORE UPDATE ON inventario_productos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_promociones_updated_at BEFORE UPDATE ON promociones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gift_cards_updated_at BEFORE UPDATE ON gift_cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vacaciones_updated_at BEFORE UPDATE ON vacaciones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Función para actualizar estadísticas de cliente después de una cita
CREATE OR REPLACE FUNCTION update_cliente_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estado = 'completada' AND (OLD.estado IS NULL OR OLD.estado != 'completada') THEN
    UPDATE clientes
    SET 
      total_visitas = total_visitas + 1,
      ultima_visita = NEW.fecha,
      total_gastado = total_gastado + NEW.precio,
      puntos_fidelidad = puntos_fidelidad + FLOOR(NEW.precio / 10)
    WHERE id = NEW.cliente_id;
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_cliente_stats_trigger
  AFTER INSERT OR UPDATE ON citas
  FOR EACH ROW
  EXECUTE FUNCTION update_cliente_stats();

-- Función para actualizar stock después de un movimiento de inventario
CREATE OR REPLACE FUNCTION update_inventario_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tipo = 'entrada' THEN
    UPDATE inventario_productos
    SET stock_actual = stock_actual + NEW.cantidad
    WHERE id = NEW.producto_id;
  ELSIF NEW.tipo = 'salida' THEN
    UPDATE inventario_productos
    SET stock_actual = stock_actual - NEW.cantidad
    WHERE id = NEW.producto_id;
  ELSIF NEW.tipo = 'ajuste' THEN
    UPDATE inventario_productos
    SET stock_actual = NEW.cantidad
    WHERE id = NEW.producto_id;
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_inventario_stock_trigger
  AFTER INSERT ON inventario_movimientos
  FOR EACH ROW
  EXECUTE FUNCTION update_inventario_stock();

-- ============================================
-- COMENTARIOS en las tablas
-- ============================================
COMMENT ON TABLE sucursales IS 'Sucursales del spa Luna27';
COMMENT ON TABLE empleados IS 'Empleados del spa (terapeutas, esteticistas, etc.)';
COMMENT ON TABLE clientes IS 'Clientes del spa';
COMMENT ON TABLE servicios IS 'Servicios ofrecidos por el spa';
COMMENT ON TABLE citas IS 'Citas/Reservaciones de clientes';
COMMENT ON TABLE pagos IS 'Pagos realizados por los clientes';
COMMENT ON TABLE inventario_productos IS 'Productos del inventario';
COMMENT ON TABLE inventario_movimientos IS 'Movimientos de inventario (entradas/salidas)';
COMMENT ON TABLE promociones IS 'Promociones y descuentos';
COMMENT ON TABLE gift_cards IS 'Tarjetas de regalo';
COMMENT ON TABLE vacaciones IS 'Solicitudes de vacaciones de empleados';

