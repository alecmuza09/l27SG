-- =============================================================================
-- Auditoría: gift cards de tienda en línea (Lovable / luna27.mx) mal reflejadas
-- Ejecutar en Supabase → SQL Editor. Solo lectura (SELECT).
--
-- Criterio de negocio: «en línea» = se validó en Lovable al registrar (origen en_linea).
-- Estas consultas ayudan a encontrar casos sospechosos para revisar manualmente
-- (verificar código en luna27.mx) antes de corregir origen / excluir_de_totales.
-- =============================================================================

-- ── 1) Resumen rápido ───────────────────────────────────────────────────────
SELECT
  COUNT(*) FILTER (WHERE gc.origen = 'en_linea') AS gc_marcadas_en_linea,
  COUNT(*) FILTER (WHERE COALESCE(gc.origen, 'sucursal') <> 'en_linea') AS gc_marcadas_sucursal,
  COUNT(*) FILTER (
    WHERE gc.origen = 'en_linea'
      AND p.id IS NOT NULL
      AND COALESCE(p.excluir_de_totales, false) = false
  ) AS en_linea_con_cobro_que_aun_suma_al_total,
  COUNT(*) FILTER (
    WHERE COALESCE(gc.origen, 'sucursal') <> 'en_linea'
      AND (
        t.notas ILIKE '%tienda en línea%'
        OR t.notas ILIKE '%tienda en linea%'
        OR p.servicios::text ILIKE '%tienda en línea%'
        OR p.notas ILIKE '%luna27.mx%'
      )
  ) AS sospechosas_origen_sucursal_con_texto_tienda
FROM gift_cards gc
LEFT JOIN pagos p ON p.referencia = 'giftcard_emision:' || gc.id::text
LEFT JOIN gift_card_transacciones t ON t.gift_card_id = gc.id AND t.tipo = 'emision';


-- ── 2) GC en línea OK en origen, pero el cobro AÚN suma al total del día ─────
-- (corregir: UPDATE pagos SET excluir_de_totales = true … ver backfill)
SELECT
  gc.codigo,
  gc.fecha_emision,
  gc.origen,
  s.nombre AS sucursal_registro,
  p.fecha AS fecha_cobro,
  p.monto,
  p.excluir_de_totales,
  p.id AS pago_id,
  gc.id AS gift_card_id
FROM gift_cards gc
JOIN pagos p ON p.referencia = 'giftcard_emision:' || gc.id::text
LEFT JOIN sucursales s ON s.id = gc.sucursal_id
WHERE gc.origen = 'en_linea'
  AND p.estado = 'completado'
  AND COALESCE(p.excluir_de_totales, false) = false
ORDER BY p.fecha DESC, gc.codigo;


-- ── 3) Sospechosas: origen «sucursal» pero el historial dice tienda en línea ─
-- Muy probable que se registraron como venta de sucursal por error (como LUNATGRXN).
-- Siguiente paso: confirmar cada código en https://luna27.mx (API verify-code) y luego:
--   UPDATE gift_cards SET origen = 'en_linea' WHERE id = '…';
SELECT
  gc.codigo,
  gc.fecha_emision,
  gc.origen,
  gc.monto_inicial,
  s.nombre AS sucursal_registro,
  t.notas AS notas_emision,
  p.monto AS monto_cobro,
  COALESCE(p.excluir_de_totales, false) AS excluir_de_totales,
  p.id AS pago_id,
  gc.id AS gift_card_id
FROM gift_cards gc
JOIN gift_card_transacciones t ON t.gift_card_id = gc.id AND t.tipo = 'emision'
LEFT JOIN pagos p ON p.referencia = 'giftcard_emision:' || gc.id::text
LEFT JOIN sucursales s ON s.id = gc.sucursal_id
WHERE COALESCE(gc.origen, 'sucursal') <> 'en_linea'
  AND (
    t.notas ILIKE '%tienda en línea%'
    OR t.notas ILIKE '%tienda en linea%'
  )
ORDER BY gc.fecha_emision DESC, gc.codigo;


-- ── 4) Todos los cobros «venta saldo GC» que siguen contando en caja ──────────
-- Incluye ventas legítimas de sucursal Y las en línea mal configuradas.
-- Revisa columna origen_gc: si debe ser en_linea, corrige la fila en gift_cards.
SELECT
  gc.codigo,
  COALESCE(gc.origen, 'sucursal') AS origen_gc,
  gc.fecha_emision,
  s.nombre AS sucursal_cobro,
  p.fecha,
  p.monto,
  p.metodo_pago,
  p.servicios,
  p.notas,
  p.excluir_de_totales,
  p.id AS pago_id,
  gc.id AS gift_card_id
FROM pagos p
JOIN gift_cards gc ON p.referencia = 'giftcard_emision:' || gc.id::text
LEFT JOIN sucursales s ON s.id = p.sucursal_id
WHERE p.estado = 'completado'
  AND COALESCE(p.excluir_de_totales, false) = false
ORDER BY p.fecha DESC, p.monto DESC;


-- ── 5) Lista para revisar en Lovable (pista por formato de código, NO automático) ─
-- Solo ayuda a priorizar; confirma cada uno en tienda en línea antes de marcar origen.
SELECT
  gc.codigo,
  gc.fecha_emision,
  gc.origen,
  gc.monto_inicial,
  s.nombre AS sucursal_registro,
  CASE
    WHEN gc.codigo ~* '^LUNA[1-4]m[A-Za-z0-9]{4}$' THEN 'folio paquete tienda (LUNA1m–4m)'
    WHEN gc.codigo ~* '^LUNAt' THEN 'código Lovable (LUNAt…)'
    WHEN gc.codigo ~* '^GIFT' THEN 'código GIFT…'
    WHEN gc.codigo ~* '^LUNAc[0-9]' THEN 'código LUNAc…'
    WHEN gc.codigo ~* '^LUNAr[0-9]' THEN 'código LUNAr…'
    ELSE 'otro'
  END AS pista_formato,
  gc.id AS gift_card_id
FROM gift_cards gc
LEFT JOIN sucursales s ON s.id = gc.sucursal_id
WHERE COALESCE(gc.origen, 'sucursal') <> 'en_linea'
  AND (
    gc.codigo ~* '^LUNA[1-4]m[A-Za-z0-9]{4}$'
    OR gc.codigo ~* '^LUNAt'
    OR gc.codigo ~* '^GIFT'
    OR gc.codigo ~* '^LUNAc[0-9]'
    OR gc.codigo ~* '^LUNAr[0-9]'
  )
ORDER BY gc.fecha_emision DESC;


-- ── 6a) Paso A — Solo cobros de GC ya marcadas en_linea (caso consulta 2) ───
-- Debe coincidir el conteo con «en_linea_con_cobro_que_aun_suma_al_total» del resumen.
SELECT COUNT(*) AS filas_a_actualizar
FROM pagos p
JOIN gift_cards gc ON p.referencia = 'giftcard_emision:' || gc.id::text
WHERE gc.origen = 'en_linea'
  AND p.estado = 'completado'
  AND COALESCE(p.excluir_de_totales, false) = false;

-- UPDATE pagos p
-- SET excluir_de_totales = true
-- FROM gift_cards gc
-- WHERE p.referencia = 'giftcard_emision:' || gc.id::text
--   AND gc.origen = 'en_linea'
--   AND p.estado = 'completado'
--   AND COALESCE(p.excluir_de_totales, false) = false;
-- → Esperado: 17 filas (según tu auditoría 2026-10-03). No toca las 6976 GC de sucursal.

-- ── 6b) Paso B — GC mal clasificadas (origen sucursal pero vendidas en Lovable) ─
-- Consulta 3 vacía = ninguna con notas «Tienda en línea» en emisión.
-- Si aún hay códigos como LUNATGRXN con origen sucursal, corrígelos uno a uno tras verify-code:
--
-- UPDATE gift_cards SET origen = 'en_linea' WHERE codigo = 'LUNATGRXN';
-- UPDATE pagos p SET excluir_de_totales = true
-- FROM gift_cards gc
-- WHERE p.referencia = 'giftcard_emision:' || gc.id::text AND gc.codigo = 'LUNATGRXN';
