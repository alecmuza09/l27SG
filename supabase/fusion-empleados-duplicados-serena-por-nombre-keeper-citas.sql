-- =============================================================================
-- Fusión de empleados duplicados en Luna27 Serena (criterio por nombre + keeper = más citas)
--
-- Contexto: tras unificar sucursales, pueden quedar varias filas en `empleados` para
-- la misma persona en la sucursal `Luna27 Serena`.
--
-- Criterio de agrupación (analítico; aquí los pares están fijados en VALUES):
--   Normalización de nombre (minúsculas, sin acentos en á é í ó ú ü ñ), espacios colapsados.
--   Casos especiales en el mismo grupo: Liz + Lizbeth; Andrea + Andrea Mata (nombre = andrea o andrea mata%);
--   Rubi y Rubí quedan unificados al quitar acentos.
--
-- Keeper: empleado con más filas en `citas` por grupo (acordado tras revisión; no se recalcula aquí).
-- Duplicados: 7 grupos, 8 pares keeper → dup (Andrea tiene dos dup_id).
--
-- Ejecutar el bloque BEGIN … COMMIT de una sola vez. Revisar PRE-CHECK antes.
-- =============================================================================

-- ─── PRE-CHECK (solo lectura) ────────────────────────────────────────────────
-- Sucursal objetivo
-- SELECT id, nombre FROM sucursales WHERE trim(nombre) = 'Luna27 Serena';

-- Existencia de los 8 dup_id y conteo de citas keeper vs dup (opcional):
/*
WITH p(keeper_id, dup_id) AS (
  VALUES
    ('19d78966-4f71-4777-a845-a194549699d1'::uuid, 'c7b22102-d155-46b9-840b-566839f8a363'::uuid),
    ('19d78966-4f71-4777-a845-a194549699d1'::uuid, '1d4a1ef3-3405-4991-ac78-74eb38db65e1'::uuid),
    ('9b96e202-5eb8-4dce-b7d7-f66508aeb99e'::uuid, 'ba1ce2a5-e96c-4ec8-bddf-479fede3f1ae'::uuid),
    ('702593c7-31f3-414b-966d-5e0de5f5f4fa'::uuid, '71485733-5b45-4843-8ffb-28e18ee571f3'::uuid),
    ('7e0d633f-d532-43c9-b3e5-ad50632e47f9'::uuid, 'c424a7ab-ae54-481d-8f97-1be4f516d631'::uuid),
    ('4cde04bd-3c1d-45e3-a9b6-ec64b41a833b'::uuid, '11f32a4d-cc82-40ee-b4da-13463c70feed'::uuid),
    ('e2e2729e-2328-450d-a71b-1efc2737d4ab'::uuid, 'e1d8f30b-e385-4243-8c82-b89c0bcba910'::uuid),
    ('38165732-50b6-4ec2-b755-644d5dbdb021'::uuid, 'a03efc54-b103-408b-98ab-1a2b414325b4'::uuid)
)
SELECT p.keeper_id, p.dup_id,
  (SELECT COUNT(*)::int FROM citas c WHERE c.empleado_id = p.keeper_id) AS citas_keeper,
  (SELECT COUNT(*)::int FROM citas c WHERE c.empleado_id = p.dup_id) AS citas_dup
FROM p;
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
  ids_fusion  uuid[] := ARRAY[
    '19d78966-4f71-4777-a845-a194549699d1'::uuid,
    'c7b22102-d155-46b9-840b-566839f8a363'::uuid,
    '1d4a1ef3-3405-4991-ac78-74eb38db65e1'::uuid,
    '9b96e202-5eb8-4dce-b7d7-f66508aeb99e'::uuid,
    'ba1ce2a5-e96c-4ec8-bddf-479fede3f1ae'::uuid,
    '702593c7-31f3-414b-966d-5e0de5f5f4fa'::uuid,
    '71485733-5b45-4843-8ffb-28e18ee571f3'::uuid,
    '7e0d633f-d532-43c9-b3e5-ad50632e47f9'::uuid,
    'c424a7ab-ae54-481d-8f97-1be4f516d631'::uuid,
    '4cde04bd-3c1d-45e3-a9b6-ec64b41a833b'::uuid,
    '11f32a4d-cc82-40ee-b4da-13463c70feed'::uuid,
    'e2e2729e-2328-450d-a71b-1efc2737d4ab'::uuid,
    'e1d8f30b-e385-4243-8c82-b89c0bcba910'::uuid,
    '38165732-50b6-4ec2-b755-644d5dbdb021'::uuid,
    'a03efc54-b103-408b-98ab-1a2b414325b4'::uuid
  ];
  n_encontrados int;
BEGIN
  SELECT id INTO id_sucursal FROM sucursales WHERE trim(nombre) = 'Luna27 Serena' LIMIT 1;
  IF id_sucursal IS NULL THEN
    RAISE EXCEPTION 'No se encontró la sucursal ''Luna27 Serena''.';
  END IF;

  SELECT COUNT(DISTINCT e.id) INTO n_encontrados
  FROM empleados e
  WHERE e.id = ANY(ids_fusion) AND e.sucursal_id = id_sucursal;

  IF n_encontrados <> array_length(ids_fusion, 1) THEN
    RAISE EXCEPTION 'Esperados % empleados en Luna27 Serena con los UUID del plan; encontrados %.',
      array_length(ids_fusion, 1), n_encontrados;
  END IF;

  DROP TABLE IF EXISTS _dup_empleados_serena;
  CREATE TEMP TABLE _dup_empleados_serena (
    keeper_id uuid NOT NULL,
    dup_id    uuid NOT NULL,
    PRIMARY KEY (dup_id)
  ) ON COMMIT DROP;

  INSERT INTO _dup_empleados_serena (keeper_id, dup_id) VALUES
    ('19d78966-4f71-4777-a845-a194549699d1', 'c7b22102-d155-46b9-840b-566839f8a363'),
    ('19d78966-4f71-4777-a845-a194549699d1', '1d4a1ef3-3405-4991-ac78-74eb38db65e1'),
    ('9b96e202-5eb8-4dce-b7d7-f66508aeb99e', 'ba1ce2a5-e96c-4ec8-bddf-479fede3f1ae'),
    ('702593c7-31f3-414b-966d-5e0de5f5f4fa', '71485733-5b45-4843-8ffb-28e18ee571f3'),
    ('7e0d633f-d532-43c9-b3e5-ad50632e47f9', 'c424a7ab-ae54-481d-8f97-1be4f516d631'),
    ('4cde04bd-3c1d-45e3-a9b6-ec64b41a833b', '11f32a4d-cc82-40ee-b4da-13463c70feed'),
    ('e2e2729e-2328-450d-a71b-1efc2737d4ab', 'e1d8f30b-e385-4243-8c82-b89c0bcba910'),
    ('38165732-50b6-4ec2-b755-644d5dbdb021', 'a03efc54-b103-408b-98ab-1a2b414325b4');

  SELECT COUNT(*) INTO n_pairs FROM _dup_empleados_serena;
  RAISE NOTICE 'Fusionando % pares (Serena, keeper por citas)...', n_pairs;

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
-- POST-CHECK
-- =============================================================================
-- Referencias huérfanas (debe ser 0 en todas):
/*
WITH dups AS (
  SELECT unnest(ARRAY[
    'c7b22102-d155-46b9-840b-566839f8a363'::uuid,
    '1d4a1ef3-3405-4991-ac78-74eb38db65e1'::uuid,
    'ba1ce2a5-e96c-4ec8-bddf-479fede3f1ae'::uuid,
    '71485733-5b45-4843-8ffb-28e18ee571f3'::uuid,
    'c424a7ab-ae54-481d-8f97-1be4f516d631'::uuid,
    '11f32a4d-cc82-40ee-b4da-13463c70feed'::uuid,
    'e1d8f30b-e385-4243-8c82-b89c0bcba910'::uuid,
    'a03efc54-b103-408b-98ab-1a2b414325b4'::uuid
  ]) AS dup_id
)
SELECT 'citas', COUNT(*) FROM citas c JOIN dups ON c.empleado_id = dups.dup_id
UNION ALL SELECT 'pagos', COUNT(*) FROM pagos p JOIN dups ON p.empleado_id = dups.dup_id
UNION ALL SELECT 'ausencias', COUNT(*) FROM ausencias a JOIN dups ON a.empleado_id = dups.dup_id
UNION ALL SELECT 'empleados', COUNT(*) FROM empleados e JOIN dups ON e.id = dups.dup_id;
*/

-- Duplicados restantes por nombre (mismo criterio analítico):
/*
WITH base AS (
  SELECT e.id,
    translate(
      regexp_replace(lower(trim(e.nombre)), '\s+', ' ', 'g'),
      'áéíóúüñ',
      'aeiouun'
    ) AS nombre_norm
  FROM empleados e
  JOIN sucursales s ON s.id = e.sucursal_id
  WHERE trim(s.nombre) = 'Luna27 Serena'
),
con_grupo AS (
  SELECT id,
    CASE
      WHEN nombre_norm IN ('liz', 'lizbeth') THEN '__grp_liz__'
      WHEN nombre_norm = 'andrea' OR nombre_norm LIKE 'andrea mata%' THEN '__grp_andrea__'
      ELSE nombre_norm
    END AS grupo_dup
  FROM base
)
SELECT grupo_dup, COUNT(*) AS n
FROM con_grupo
GROUP BY grupo_dup
HAVING COUNT(*) > 1;
-- Debe devolver 0 filas.
*/
