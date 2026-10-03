-- =============================================================================
-- Cruzar folios confirmados de tienda luna27.mx (Lovable) vs agenda Supabase
-- Lista capturada 2026-10-03. Algunos pueden no estar registrados aún.
-- =============================================================================

WITH folios_lovable (codigo) AS (
  VALUES
    ('LUNAc22HWL'),
    ('LUNAc5WD2B'),
    ('LUNAc6DMHE'),
    ('LUNAr1XE7T'),
    ('LUNAc3YXAU'),
    ('LUNAc62WXK'),
    ('LUNAc27NRC'),
    ('LUNAc1XL3W'),
    ('LUNAc6K7M3'),
    ('LUNAc6BUFV'),
    ('LUNAc6XLHL'),
    ('LUNAc2QHQV'),
    ('LUNAr1JW4C'),
    ('LUNAr1C4EQ'),
    ('LUNAr19KU3'),
    ('LUNAtGRXN'),
    ('LUNAc1SQS5'),
    ('LUNAc47AML'),
    ('LUNAc1DDX6'),
    ('LUNAc6TTWN'),
    ('LUNAtQBQE'),
    ('LUNAc6J89F'),
    ('LUNAc6KZCQ'),
    ('LUNAc6LLR3'),
    ('LUNAt8WJX')
)
SELECT
  f.codigo AS folio_lovable,
  gc.id AS gift_card_id,
  CASE
    WHEN gc.id IS NULL THEN 'no_registrada_en_agenda'
    WHEN gc.origen = 'en_linea' THEN 'origen_en_linea_ok'
    ELSE 'origen_sucursal_revisar'
  END AS estado_origen,
  gc.fecha_emision,
  s.nombre AS sucursal_registro,
  gc.monto_inicial,
  p.id AS pago_id,
  p.fecha AS fecha_cobro,
  p.monto AS monto_cobro,
  COALESCE(p.excluir_de_totales, false) AS excluir_de_totales,
  CASE
    WHEN gc.id IS NULL THEN '—'
    WHEN p.id IS NULL THEN 'sin_cobro_en_pagos'
    WHEN gc.origen = 'en_linea' AND COALESCE(p.excluir_de_totales, false) = false
      THEN 'cobro_suma_al_total_corregir'
    WHEN gc.origen = 'en_linea' AND p.excluir_de_totales = true
      THEN 'ok_tienda_en_linea'
    WHEN gc.origen <> 'en_linea' AND p.id IS NOT NULL
      THEN 'mal_como_venta_sucursal_corregir_origen_y_excluir'
    ELSE 'revisar_manual'
  END AS accion_sugerida
FROM folios_lovable f
LEFT JOIN gift_cards gc ON upper(trim(gc.codigo)) = upper(trim(f.codigo))
LEFT JOIN sucursales s ON s.id = gc.sucursal_id
LEFT JOIN pagos p ON p.referencia = 'giftcard_emision:' || gc.id::text
ORDER BY
  CASE
    WHEN gc.id IS NULL THEN 3
    WHEN gc.origen <> 'en_linea' THEN 1
    WHEN COALESCE(p.excluir_de_totales, false) = false AND p.id IS NOT NULL THEN 2
    ELSE 4
  END,
  f.codigo;


-- Resumen de la misma lista
WITH folios_lovable (codigo) AS (
  VALUES
    ('LUNAc22HWL'), ('LUNAc5WD2B'), ('LUNAc6DMHE'), ('LUNAr1XE7T'), ('LUNAc3YXAU'),
    ('LUNAc62WXK'), ('LUNAc27NRC'), ('LUNAc1XL3W'), ('LUNAc6K7M3'), ('LUNAc6BUFV'),
    ('LUNAc6XLHL'), ('LUNAc2QHQV'), ('LUNAr1JW4C'), ('LUNAr1C4EQ'), ('LUNAr19KU3'),
    ('LUNAtGRXN'), ('LUNAc1SQS5'), ('LUNAc47AML'), ('LUNAc1DDX6'), ('LUNAc6TTWN'),
    ('LUNAtQBQE'), ('LUNAc6J89F'), ('LUNAc6KZCQ'), ('LUNAc6LLR3'), ('LUNAt8WJX')
)
SELECT
  COUNT(*) AS folios_en_lista,
  COUNT(gc.id) AS registradas_en_agenda,
  COUNT(*) FILTER (WHERE gc.id IS NULL) AS pendientes_registrar,
  COUNT(*) FILTER (WHERE gc.id IS NOT NULL AND COALESCE(gc.origen, 'sucursal') <> 'en_linea') AS origen_sucursal_incorrecto,
  COUNT(*) FILTER (
    WHERE gc.origen = 'en_linea' AND p.id IS NOT NULL AND COALESCE(p.excluir_de_totales, false) = false
  ) AS en_linea_cobro_suma_total,
  COUNT(*) FILTER (
    WHERE gc.origen = 'en_linea' AND (p.id IS NULL OR p.excluir_de_totales = true)
  ) AS en_linea_ok_o_sin_cobro
FROM folios_lovable f
LEFT JOIN gift_cards gc ON upper(trim(gc.codigo)) = upper(trim(f.codigo))
LEFT JOIN pagos p ON p.referencia = 'giftcard_emision:' || gc.id::text;


-- ── Corrección solo para folios DE ESTA LISTA ya registrados ─────────────────
-- Ejecutar DESPUÉS de revisar el SELECT anterior.

-- UPDATE gift_cards gc
-- SET origen = 'en_linea'
-- FROM (VALUES
--   ('LUNAc22HWL'), ('LUNAc5WD2B'), ('LUNAc6DMHE'), ('LUNAr1XE7T'), ('LUNAc3YXAU'),
--   ('LUNAc62WXK'), ('LUNAc27NRC'), ('LUNAc1XL3W'), ('LUNAc6K7M3'), ('LUNAc6BUFV'),
--   ('LUNAc6XLHL'), ('LUNAc2QHQV'), ('LUNAr1JW4C'), ('LUNAr1C4EQ'), ('LUNAr19KU3'),
--   ('LUNAtGRXN'), ('LUNAc1SQS5'), ('LUNAc47AML'), ('LUNAc1DDX6'), ('LUNAc6TTWN'),
--   ('LUNAtQBQE'), ('LUNAc6J89F'), ('LUNAc6KZCQ'), ('LUNAc6LLR3'), ('LUNAt8WJX')
-- ) AS f(codigo)
-- WHERE upper(trim(gc.codigo)) = upper(trim(f.codigo));

-- UPDATE pagos p
-- SET excluir_de_totales = true
-- FROM gift_cards gc
-- JOIN (VALUES
--   ('LUNAc22HWL'), ('LUNAc5WD2B'), ('LUNAc6DMHE'), ('LUNAr1XE7T'), ('LUNAc3YXAU'),
--   ('LUNAc62WXK'), ('LUNAc27NRC'), ('LUNAc1XL3W'), ('LUNAc6K7M3'), ('LUNAc6BUFV'),
--   ('LUNAc6XLHL'), ('LUNAc2QHQV'), ('LUNAr1JW4C'), ('LUNAr1C4EQ'), ('LUNAr19KU3'),
--   ('LUNAtGRXN'), ('LUNAc1SQS5'), ('LUNAc47AML'), ('LUNAc1DDX6'), ('LUNAc6TTWN'),
--   ('LUNAtQBQE'), ('LUNAc6J89F'), ('LUNAc6KZCQ'), ('LUNAc6LLR3'), ('LUNAt8WJX')
-- ) AS f(codigo) ON upper(trim(gc.codigo)) = upper(trim(f.codigo))
-- WHERE p.referencia = 'giftcard_emision:' || gc.id::text
--   AND p.estado = 'completado';
