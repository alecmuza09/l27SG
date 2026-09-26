-- Reportes: agregaciones en servidor (ejecutar en Supabase SQL Editor).

-- Servicios más vendidos en un período
CREATE OR REPLACE FUNCTION reporte_servicios_populares(
  p_fecha_desde date,
  p_fecha_hasta date,
  p_sucursal_id uuid DEFAULT NULL,
  p_limite int DEFAULT 10
)
RETURNS TABLE (
  nombre text,
  cantidad bigint,
  ingresos numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COALESCE(s.nombre, 'Servicio desconocido') AS nombre,
    COUNT(*)::bigint AS cantidad,
    COALESCE(SUM(c.precio), 0)::numeric AS ingresos
  FROM citas c
  LEFT JOIN servicios s ON s.id = c.servicio_id
  WHERE c.estado = 'completada'
    AND c.servicio_id IS NOT NULL
    AND c.fecha >= p_fecha_desde
    AND c.fecha <= p_fecha_hasta
    AND (p_sucursal_id IS NULL OR c.sucursal_id = p_sucursal_id)
  GROUP BY s.id, s.nombre
  ORDER BY cantidad DESC
  LIMIT GREATEST(p_limite, 1);
$$;

-- Top clientes por gasto (pagos completados)
CREATE OR REPLACE FUNCTION reporte_top_clientes_gasto(
  p_fecha_desde date,
  p_fecha_hasta date,
  p_sucursal_id uuid DEFAULT NULL,
  p_limite int DEFAULT 10
)
RETURNS TABLE (
  cliente_id uuid,
  nombre text,
  visitas bigint,
  total_gastado numeric,
  ultima_visita date
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    p.cliente_id,
    TRIM(COALESCE(cl.nombre, '') || ' ' || COALESCE(cl.apellido, '')) AS nombre,
    COUNT(*)::bigint AS visitas,
    COALESCE(SUM(p.monto), 0)::numeric AS total_gastado,
    MAX(p.fecha)::date AS ultima_visita
  FROM pagos p
  LEFT JOIN clientes cl ON cl.id = p.cliente_id
  WHERE p.estado = 'completado'
    AND p.cliente_id IS NOT NULL
    AND p.fecha >= p_fecha_desde
    AND p.fecha <= p_fecha_hasta
    AND (p_sucursal_id IS NULL OR p.sucursal_id = p_sucursal_id)
  GROUP BY p.cliente_id, cl.nombre, cl.apellido
  ORDER BY total_gastado DESC
  LIMIT GREATEST(p_limite, 1);
$$;

-- Stats del tab Clientes (sin barrer citas desde el navegador)
CREATE OR REPLACE FUNCTION reporte_clientes_tab_stats(
  p_fecha_desde date,
  p_fecha_hasta date,
  p_sucursal_id uuid DEFAULT NULL,
  p_sucursal_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_total bigint := 0;
  v_activos_inicio bigint := 0;
  v_vip bigint := 0;
  v_emb bigint := 0;
  v_vigentes bigint := 0;
  v_con_visita_cierre bigint := 0;
  v_inactivos bigint := 0;
  v_usar_scope boolean := false;
BEGIN
  IF p_sucursal_id IS NOT NULL OR (p_sucursal_ids IS NOT NULL AND array_length(p_sucursal_ids, 1) > 0) THEN
    v_usar_scope := true;
  END IF;

  IF NOT v_usar_scope THEN
    SELECT COUNT(*) INTO v_total
    FROM clientes c
    WHERE c.fecha_registro <= p_fecha_hasta;

    SELECT COUNT(*) INTO v_activos_inicio
    FROM clientes c
    WHERE c.fecha_registro <= p_fecha_hasta
      AND EXISTS (
        SELECT 1 FROM citas ci
        WHERE ci.cliente_id = c.id
          AND ci.estado = 'completada'
          AND ci.fecha < p_fecha_desde
      );

    SELECT COUNT(DISTINCT ci.cliente_id) INTO v_con_visita_cierre
    FROM citas ci
    WHERE ci.estado = 'completada'
      AND ci.fecha <= p_fecha_hasta
      AND ci.cliente_id IS NOT NULL;

    SELECT COUNT(*) INTO v_vip
    FROM clientes c
    WHERE c.fecha_registro <= p_fecha_hasta AND c.estado = 'vip';

    SELECT COUNT(*) INTO v_emb
    FROM clientes c
    WHERE c.fecha_registro <= p_fecha_hasta AND c.embajadora IS TRUE;

    SELECT COUNT(*) INTO v_vigentes
    FROM clientes c
    WHERE c.fecha_registro <= p_fecha_hasta AND c.estado IN ('activo', 'vip');

    v_inactivos := GREATEST(0, v_total - v_con_visita_cierre);
  ELSE
    WITH scope AS (
      SELECT DISTINCT x.cliente_id
      FROM (
        SELECT c.cliente_id
        FROM citas c
        WHERE c.cliente_id IS NOT NULL
          AND (
            (p_sucursal_id IS NOT NULL AND c.sucursal_id = p_sucursal_id)
            OR (p_sucursal_ids IS NOT NULL AND c.sucursal_id = ANY (p_sucursal_ids))
          )
        UNION
        SELECT p.cliente_id
        FROM pagos p
        WHERE p.cliente_id IS NOT NULL
          AND p.estado = 'completado'
          AND (
            (p_sucursal_id IS NOT NULL AND p.sucursal_id = p_sucursal_id)
            OR (p_sucursal_ids IS NOT NULL AND p.sucursal_id = ANY (p_sucursal_ids))
          )
      ) x
    )
    SELECT COUNT(*) INTO v_total
    FROM clientes c
    INNER JOIN scope s ON s.cliente_id = c.id
    WHERE c.fecha_registro <= p_fecha_hasta;

    WITH scope AS (
      SELECT DISTINCT x.cliente_id
      FROM (
        SELECT c.cliente_id FROM citas c
        WHERE c.cliente_id IS NOT NULL
          AND (
            (p_sucursal_id IS NOT NULL AND c.sucursal_id = p_sucursal_id)
            OR (p_sucursal_ids IS NOT NULL AND c.sucursal_id = ANY (p_sucursal_ids))
          )
        UNION
        SELECT p.cliente_id FROM pagos p
        WHERE p.cliente_id IS NOT NULL AND p.estado = 'completado'
          AND (
            (p_sucursal_id IS NOT NULL AND p.sucursal_id = p_sucursal_id)
            OR (p_sucursal_ids IS NOT NULL AND p.sucursal_id = ANY (p_sucursal_ids))
          )
      ) x
    )
    SELECT COUNT(*) INTO v_activos_inicio
    FROM clientes c
    INNER JOIN scope s ON s.cliente_id = c.id
    WHERE c.fecha_registro <= p_fecha_hasta
      AND EXISTS (
        SELECT 1 FROM citas ci
        WHERE ci.cliente_id = c.id
          AND ci.estado = 'completada'
          AND ci.fecha < p_fecha_desde
          AND (
            (p_sucursal_id IS NOT NULL AND ci.sucursal_id = p_sucursal_id)
            OR (p_sucursal_ids IS NOT NULL AND ci.sucursal_id = ANY (p_sucursal_ids))
          )
      );

    WITH scope AS (
      SELECT DISTINCT x.cliente_id
      FROM (
        SELECT c.cliente_id FROM citas c
        WHERE c.cliente_id IS NOT NULL
          AND (
            (p_sucursal_id IS NOT NULL AND c.sucursal_id = p_sucursal_id)
            OR (p_sucursal_ids IS NOT NULL AND c.sucursal_id = ANY (p_sucursal_ids))
          )
        UNION
        SELECT p.cliente_id FROM pagos p
        WHERE p.cliente_id IS NOT NULL AND p.estado = 'completado'
          AND (
            (p_sucursal_id IS NOT NULL AND p.sucursal_id = p_sucursal_id)
            OR (p_sucursal_ids IS NOT NULL AND p.sucursal_id = ANY (p_sucursal_ids))
          )
      ) x
    )
    SELECT COUNT(*) INTO v_vip
    FROM clientes c
    INNER JOIN scope s ON s.cliente_id = c.id
    WHERE c.fecha_registro <= p_fecha_hasta AND c.estado = 'vip';

    SELECT COUNT(*) INTO v_emb
    FROM clientes c
    INNER JOIN scope s ON s.cliente_id = c.id
    WHERE c.fecha_registro <= p_fecha_hasta AND c.embajadora IS TRUE;

    SELECT COUNT(*) INTO v_vigentes
    FROM clientes c
    INNER JOIN scope s ON s.cliente_id = c.id
    WHERE c.fecha_registro <= p_fecha_hasta AND c.estado IN ('activo', 'vip');

    SELECT COUNT(DISTINCT ci.cliente_id) INTO v_con_visita_cierre
    FROM citas ci
    WHERE ci.estado = 'completada'
      AND ci.fecha <= p_fecha_hasta
      AND ci.cliente_id IS NOT NULL
      AND (
        (p_sucursal_id IS NOT NULL AND ci.sucursal_id = p_sucursal_id)
        OR (p_sucursal_ids IS NOT NULL AND ci.sucursal_id = ANY (p_sucursal_ids))
      );

    v_inactivos := GREATEST(0, v_total - v_con_visita_cierre);
  END IF;

  RETURN jsonb_build_object(
    'total', v_total,
    'activos_inicio_periodo', v_activos_inicio,
    'vip', v_vip,
    'inactivos', v_inactivos,
    'embajadoras', v_emb,
    'vigentes', v_vigentes,
    'con_visitas', v_con_visita_cierre,
    'activos', v_con_visita_cierre
  );
END;
$$;

GRANT EXECUTE ON FUNCTION reporte_servicios_populares(date, date, uuid, int) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION reporte_top_clientes_gasto(date, date, uuid, int) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION reporte_clientes_tab_stats(date, date, uuid, uuid[]) TO authenticated, anon;

CREATE INDEX IF NOT EXISTS idx_pagos_completado_fecha_sucursal
  ON pagos (fecha, sucursal_id, cliente_id)
  WHERE estado = 'completado';

CREATE INDEX IF NOT EXISTS idx_citas_completada_fecha_sucursal_servicio
  ON citas (fecha, sucursal_id, servicio_id)
  WHERE estado = 'completada';
