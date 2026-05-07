-- =============================================================================
-- Deduplicación de empleadas tras fusión de sucursales Serena
--
-- Contexto: al mover empleados de «Luna 27 Serena» → «Luna27 Serena», pueden
-- quedar dos filas en `empleados` para la misma persona (misma sucursal final).
--
-- Criterio de duplicado (misma sucursal Luna27 Serena):
--   lower(trim(nombre)) || '|' || lower(trim(apellido)) || '|' || sólo dígitos(teléfono)
--
-- Registro que se conserva: el de menor created_at (empate → menor id).
--
-- Antes de ejecutar, revisa el PRE-CHECK. Ejecuta todo el bloque en una sola vez.
-- =============================================================================

-- ─── PRE-CHECK (solo lectura) ────────────────────────────────────────────────
-- Sucursal objetivo
-- SELECT id, nombre FROM sucursales WHERE trim(nombre) = 'Luna27 Serena';

-- Grupos con más de un empleado (posibles duplicados)
/*
WITH base AS (
  SELECT
    e.id,
    e.nombre,
    e.apellido,
    e.telefono,
    e.email,
    e.created_at,
    (lower(trim(e.nombre)) || '|' || lower(trim(e.apellido)) || '|'
      || regexp_replace(coalesce(e.telefono, ''), '\D', '', 'g')) AS clave_dup,
    s.nombre AS sucursal_nombre
  FROM empleados e
  JOIN sucursales s ON s.id = e.sucursal_id
  WHERE trim(s.nombre) = 'Luna27 Serena'
)
SELECT clave_dup, COUNT(*) AS n, array_agg(id ORDER BY created_at, id) AS ids
FROM base
GROUP BY clave_dup
HAVING COUNT(*) > 1;
*/

-- =============================================================================
-- MIGRACIÓN
-- =============================================================================

BEGIN;

DO $$
DECLARE
  id_sucursal uuid;
  n_pairs     int;
  rec         RECORD;
BEGIN
  SELECT id INTO id_sucursal FROM sucursales WHERE trim(nombre) = 'Luna27 Serena' LIMIT 1;
  IF id_sucursal IS NULL THEN
    RAISE EXCEPTION 'No se encontró la sucursal ''Luna27 Serena''.';
  END IF;

  DROP TABLE IF EXISTS _dup_empleados_serena;
  CREATE TEMP TABLE _dup_empleados_serena (
    keeper_id uuid NOT NULL,
    dup_id    uuid NOT NULL,
    PRIMARY KEY (dup_id)
  ) ON COMMIT DROP;

  INSERT INTO _dup_empleados_serena (keeper_id, dup_id)
  WITH g AS (
    SELECT
      id,
      (lower(trim(nombre)) || '|' || lower(trim(apellido)) || '|'
        || regexp_replace(coalesce(telefono, ''), '\D', '', 'g')) AS k,
      ROW_NUMBER() OVER (
        PARTITION BY (lower(trim(nombre)) || '|' || lower(trim(apellido)) || '|'
          || regexp_replace(coalesce(telefono, ''), '\D', '', 'g'))
        ORDER BY created_at ASC NULLS LAST, id ASC
      ) AS rn
    FROM empleados
    WHERE sucursal_id = id_sucursal
  )
  SELECT k.id AS keeper_id, d.id AS dup_id
  FROM g d
  JOIN g k ON d.k = k.k AND d.rn > 1 AND k.rn = 1;

  SELECT COUNT(*) INTO n_pairs FROM _dup_empleados_serena;
  IF n_pairs = 0 THEN
    RAISE NOTICE 'No hay pares duplicados para fusionar en Luna27 Serena.';
    RETURN;
  END IF;

  RAISE NOTICE 'Fusionando % pares de empleados duplicados (Serena)...', n_pairs;

  FOR rec IN (SELECT keeper_id, dup_id FROM _dup_empleados_serena ORDER BY dup_id)
  LOOP
    -- saldo_vacaciones: mismo (empleado, año) → sumar en keeper y quitar fila dup
    UPDATE saldo_vacaciones k SET
      dias_correspondientes = COALESCE(k.dias_correspondientes, 0) + COALESCE(s.dias_correspondientes, 0),
      dias_tomados = COALESCE(k.dias_tomados, 0) + COALESCE(s.dias_tomados, 0),
      dias_disponibles = GREATEST(0,
        (COALESCE(k.dias_correspondientes, 0) + COALESCE(s.dias_correspondientes, 0))
        - (COALESCE(k.dias_tomados, 0) + COALESCE(s.dias_tomados, 0))
      ),
      fecha_actualizacion = CURRENT_DATE,
      updated_at = NOW()
    FROM saldo_vacaciones s
    WHERE k.empleado_id = rec.keeper_id
      AND s.empleado_id = rec.dup_id
      AND k.anio = s.anio;

    DELETE FROM saldo_vacaciones s
    USING saldo_vacaciones k
    WHERE s.empleado_id = rec.dup_id
      AND k.empleado_id = rec.keeper_id
      AND s.anio = k.anio;

    UPDATE saldo_vacaciones SET empleado_id = rec.keeper_id WHERE empleado_id = rec.dup_id;

    -- empleado_sucursal_dia: UNIQUE(empleado_id, fecha)
    DELETE FROM empleado_sucursal_dia d
    USING empleado_sucursal_dia k
    WHERE d.empleado_id = rec.dup_id
      AND k.empleado_id = rec.keeper_id
      AND d.fecha = k.fecha;

    UPDATE empleado_sucursal_dia SET empleado_id = rec.keeper_id WHERE empleado_id = rec.dup_id;

    UPDATE empleado_sucursal_dia_historial SET empleado_id = rec.keeper_id WHERE empleado_id = rec.dup_id;

    UPDATE citas SET empleado_id = rec.keeper_id WHERE empleado_id = rec.dup_id;

    UPDATE pagos SET empleado_id = rec.keeper_id WHERE empleado_id = rec.dup_id;

    UPDATE gift_cards SET empleado_emisor_id = rec.keeper_id
    WHERE empleado_emisor_id = rec.dup_id;

    UPDATE gift_card_transacciones SET empleado_id = rec.keeper_id WHERE empleado_id = rec.dup_id;

    UPDATE vacaciones SET empleado_id = rec.keeper_id WHERE empleado_id = rec.dup_id;

    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'ausencias'
    ) THEN
      EXECUTE format('UPDATE ausencias SET empleado_id = %L WHERE empleado_id = %L',
        rec.keeper_id, rec.dup_id);
    END IF;

    -- agenda_bloques (JSON): bloques[].empleadoId
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'agenda_bloques'
    ) THEN
      UPDATE agenda_bloques ab SET
        bloques = (
          SELECT COALESCE(jsonb_agg(
            CASE
              WHEN (e->>'empleadoId') IS NOT NULL
                AND (e->>'empleadoId') = rec.dup_id::text
              THEN jsonb_set(e, '{empleadoId}', to_jsonb(rec.keeper_id::text), true)
              ELSE e
            END
          ), '[]'::jsonb)
          FROM jsonb_array_elements(COALESCE(ab.bloques, '[]'::jsonb)) AS e
        ),
        updated_at = NOW()
      WHERE ab.sucursal_id = id_sucursal
        AND ab.bloques::text ILIKE '%' || rec.dup_id::text || '%';
    END IF;

  END LOOP;

  DELETE FROM empleados e
  USING _dup_empleados_serena d
  WHERE e.id = d.dup_id;

  RAISE NOTICE 'OK: empleados duplicados eliminados; referencias migradas a keeper.';
END $$;

COMMIT;

-- =============================================================================
-- POST-CHECK (sustituye :id_sucursal_luna27_serena y lista de UUID eliminados
-- si quieres verificar a mano; tras el script los dup ya no existen)
-- =============================================================================
-- Ver que no queden grupos duplicados:
/*
WITH base AS (
  SELECT
    (lower(trim(nombre)) || '|' || lower(trim(apellido)) || '|'
      || regexp_replace(coalesce(telefono, ''), '\D', '', 'g')) AS clave_dup
  FROM empleados e
  JOIN sucursales s ON s.id = e.sucursal_id
  WHERE trim(s.nombre) = 'Luna27 Serena'
)
SELECT clave_dup, COUNT(*) AS n FROM base GROUP BY clave_dup HAVING COUNT(*) > 1;
-- Debe devolver 0 filas.
*/

-- Opcional: buscar referencias huérfanas a un id que ya no exista (ejemplo manual)
-- SELECT * FROM citas c WHERE NOT EXISTS (SELECT 1 FROM empleados e WHERE e.id = c.empleado_id);
