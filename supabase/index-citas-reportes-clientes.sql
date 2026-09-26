-- Acelera reportes / stats de clientes (citas completadas por fecha).
-- Ejecutar una vez en Supabase SQL Editor si el tab Clientes sigue lento con mucho historial.

CREATE INDEX IF NOT EXISTS idx_citas_completada_fecha_cliente
  ON citas (fecha, cliente_id)
  WHERE estado = 'completada';

CREATE INDEX IF NOT EXISTS idx_citas_completada_sucursal_fecha
  ON citas (sucursal_id, fecha, cliente_id)
  WHERE estado = 'completada';
