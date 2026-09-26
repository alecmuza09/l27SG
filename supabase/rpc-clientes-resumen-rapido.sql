-- Resumen rápido para tarjetas de Clientes / Dashboard (57k+ clientes).
-- Ejecutar en Supabase SQL Editor junto con index-citas-reportes-clientes.sql

CREATE INDEX IF NOT EXISTS idx_citas_completada_fecha_cliente
  ON citas (fecha, cliente_id)
  WHERE estado = 'completada';

CREATE INDEX IF NOT EXISTS idx_clientes_total_visitas
  ON clientes (total_visitas)
  WHERE total_visitas > 0;

CREATE INDEX IF NOT EXISTS idx_clientes_embajadora
  ON clientes (embajadora)
  WHERE embajadora = true;

-- Clientes cuya primera cita completada cae en [desde, hasta] (global, sin filtro sucursal)
CREATE OR REPLACE FUNCTION contar_clientes_nuevos_periodo(
  p_fecha_desde date,
  p_fecha_hasta date
)
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::bigint
  FROM (
    SELECT c.cliente_id
    FROM citas c
    WHERE c.estado = 'completada'
      AND c.cliente_id IS NOT NULL
    GROUP BY c.cliente_id
    HAVING MIN(c.fecha) >= p_fecha_desde
       AND MIN(c.fecha) <= p_fecha_hasta
  ) sub;
$$;

GRANT EXECUTE ON FUNCTION contar_clientes_nuevos_periodo(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION contar_clientes_nuevos_periodo(date, date) TO anon;
