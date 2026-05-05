-- =============================================================================
-- Fusión de sucursales duplicadas Serena
--
-- CONSERVAR:  nombre esperado → "Luna27 Serena" (sin espacio entre Luna y 27)
-- ELIMINAR:  nombre esperado → "Luna 27 Serena" (con espacio)
--
-- Pasos antes de ejecutar:
-- 1) Ejecuta solo el bloque «PRE-CHECK» más abajo y confirma que ves exactamente
--    dos filas con los nombres esperados y los UUID correctos.
-- 2) Si los nombres en tu BD difieren (mayúsculas, espacios extra), ajusta las
--    variables id_keep / id_old en el bloque PRE-CHECK o edita los SELECT del DO.
--
-- La fusión mueve todas las FK conocidas hacia la sucursal que se conserva y
-- borra la duplicada. Incluye tablas opcionales solo si existen (agenda_bloques).
--
-- NOTA: Los usuarios que tengan la sucursal vieja guardada en localStorage del
-- navegador pueden tener que cerrar sesión o refrescar tras el cambio de IDs.
-- =============================================================================

-- ─── PRE-CHECK (ejecutar primero; no modifica datos) ─────────────────────────
SELECT id, nombre, activa, created_at
FROM sucursales
WHERE trim(nombre) ILIKE '%serena%'
ORDER BY nombre;

-- Debes tener exactamente una fila "Luna27 Serena" y una "Luna 27 Serena".
-- Si hay más duplicados, resuélvelos manualmente antes de continuar.

-- =============================================================================
-- MIGRACIÓN (ejecutar una sola vez; idealmente dentro de una transacción)
-- =============================================================================

BEGIN;

DO $$
DECLARE
  id_keep uuid;
  id_old  uuid;
  n_keep  int;
  n_old   int;
BEGIN
  SELECT id INTO id_keep FROM sucursales WHERE trim(nombre) = 'Luna27 Serena' LIMIT 1;
  SELECT id INTO id_old  FROM sucursales WHERE trim(nombre) = 'Luna 27 Serena' LIMIT 1;

  SELECT COUNT(*) INTO n_keep FROM sucursales WHERE trim(nombre) = 'Luna27 Serena';
  SELECT COUNT(*) INTO n_old  FROM sucursales WHERE trim(nombre) = 'Luna 27 Serena';

  IF n_keep <> 1 THEN
    RAISE EXCEPTION 'Se esperaba exactamente 1 sucursal ''Luna27 Serena'' (encontradas: %). Ajusta el nombre en el script.', n_keep;
  END IF;
  IF n_old <> 1 THEN
    RAISE EXCEPTION 'Se esperaba exactamente 1 sucursal ''Luna 27 Serena'' (encontradas: %). Ajusta el nombre en el script.', n_old;
  END IF;
  IF id_old = id_keep THEN
    RAISE EXCEPTION 'Los dos IDs coinciden; no hay fusión que hacer.';
  END IF;

  RAISE NOTICE 'Fusionando sucursal % (eliminar) → % (conservar)', id_old, id_keep;

  -- usuarios / usuario_sucursales (evitar UNIQUE(usuario_id, sucursal_id))
  DELETE FROM usuario_sucursales usd
  USING usuario_sucursales usk
  WHERE usd.sucursal_id = id_old
    AND usk.sucursal_id = id_keep
    AND usd.usuario_id = usk.usuario_id;

  UPDATE usuario_sucursales SET sucursal_id = id_keep WHERE sucursal_id = id_old;

  UPDATE usuarios SET sucursal_id = id_keep WHERE sucursal_id = id_old;

  -- empleado por día (UNIQUE empleado_id, fecha)
  DELETE FROM empleado_sucursal_dia ed
  USING empleado_sucursal_dia ek
  WHERE ed.sucursal_id = id_old
    AND ek.sucursal_id = id_keep
    AND ed.empleado_id = ek.empleado_id
    AND ed.fecha = ek.fecha;

  UPDATE empleado_sucursal_dia SET sucursal_id = id_keep WHERE sucursal_id = id_old;

  UPDATE empleado_sucursal_dia_historial
  SET sucursal_efectiva_anterior = id_keep
  WHERE sucursal_efectiva_anterior = id_old;

  UPDATE empleado_sucursal_dia_historial
  SET sucursal_efectiva_nueva = id_keep
  WHERE sucursal_efectiva_nueva = id_old;

  UPDATE clientes SET sucursal_preferida = id_keep WHERE sucursal_preferida = id_old;

  UPDATE empleados SET sucursal_id = id_keep WHERE sucursal_id = id_old;

  UPDATE citas SET sucursal_id = id_keep WHERE sucursal_id = id_old;

  UPDATE pagos SET sucursal_id = id_keep WHERE sucursal_id = id_old;

  UPDATE inventario_productos SET sucursal_id = id_keep WHERE sucursal_id = id_old;

  UPDATE inventario_movimientos SET sucursal_origen = id_keep WHERE sucursal_origen = id_old;
  UPDATE inventario_movimientos SET sucursal_destino = id_keep WHERE sucursal_destino = id_old;

  UPDATE gift_cards SET sucursal_id = id_keep WHERE sucursal_id = id_old;

  UPDATE periodos_bloqueados SET sucursal_id = id_keep WHERE sucursal_id = id_old;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'agenda_bloques'
  ) THEN
    EXECUTE format('UPDATE agenda_bloques SET sucursal_id = %L WHERE sucursal_id = %L', id_keep, id_old);
  END IF;

  -- promociones.sucursales_aplicables: reemplazar UUID en arrays
  UPDATE promociones pr
  SET sucursales_aplicables = sub.new_arr
  FROM (
    SELECT pr2.id AS promo_id,
      ARRAY(
        SELECT DISTINCT CASE WHEN x = id_old THEN id_keep ELSE x END
        FROM unnest(pr2.sucursales_aplicables) AS x
      ) AS new_arr
    FROM promociones pr2
    WHERE pr2.sucursales_aplicables IS NOT NULL
      AND cardinality(pr2.sucursales_aplicables) > 0
      AND id_old = ANY(pr2.sucursales_aplicables)
  ) sub
  WHERE pr.id = sub.promo_id;

  DELETE FROM sucursales WHERE id = id_old;

  RAISE NOTICE 'OK: sucursal duplicada eliminada. Conservada id=%', id_keep;
END $$;

COMMIT;

-- =============================================================================
-- POST-CHECK: huérfanos apuntando al ID viejo (sustituye :id_old por el UUID
-- que anotaste en PRE-CHECK para «Luna 27 Serena», luego ejecuta cada SELECT).
-- Si algún COUNT > 0, revisa esa tabla antes de dar por cerrada la fusión.
-- =============================================================================
--
-- SELECT COUNT(*) AS usuarios FROM usuarios WHERE sucursal_id = ':id_old';
-- SELECT COUNT(*) AS usuario_sucursales FROM usuario_sucursales WHERE sucursal_id = ':id_old';
-- SELECT COUNT(*) AS empleados FROM empleados WHERE sucursal_id = ':id_old';
-- SELECT COUNT(*) AS empleado_sucursal_dia FROM empleado_sucursal_dia WHERE sucursal_id = ':id_old';
-- SELECT COUNT(*) AS historial_ant FROM empleado_sucursal_dia_historial WHERE sucursal_efectiva_anterior = ':id_old';
-- SELECT COUNT(*) AS historial_nue FROM empleado_sucursal_dia_historial WHERE sucursal_efectiva_nueva = ':id_old';
-- SELECT COUNT(*) AS clientes FROM clientes WHERE sucursal_preferida = ':id_old';
-- SELECT COUNT(*) AS citas FROM citas WHERE sucursal_id = ':id_old';
-- SELECT COUNT(*) AS pagos FROM pagos WHERE sucursal_id = ':id_old';
-- SELECT COUNT(*) AS inventario FROM inventario_productos WHERE sucursal_id = ':id_old';
-- SELECT COUNT(*) AS mov_origen FROM inventario_movimientos WHERE sucursal_origen = ':id_old';
-- SELECT COUNT(*) AS mov_dest FROM inventario_movimientos WHERE sucursal_destino = ':id_old';
-- SELECT COUNT(*) AS gift_cards FROM gift_cards WHERE sucursal_id = ':id_old';
-- SELECT COUNT(*) AS periodos FROM periodos_bloqueados WHERE sucursal_id = ':id_old';

-- Listar cualquier columna FK hacia sucursales que siga referenciando id viejo:
-- SELECT conrelid::regclass AS tabla, a.attname AS columna
-- FROM pg_constraint c
-- JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
-- WHERE c.contype = 'f'
--   AND c.confrelid = 'sucursales'::regclass
-- ORDER BY 1, 2;
