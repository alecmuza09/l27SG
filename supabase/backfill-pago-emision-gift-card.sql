-- Backfill: registrar en `pagos` una venta de gift card ya emitida que no tiene cobro en caja.
-- Ejecutar en SQL Editor de Supabase después de aplicar fix-pagos-cliente-nullable.sql (si aplica).
--
-- Pasos:
-- 1) Busca la tarjeta: SELECT id, codigo, monto_inicial, sucursal_id, cliente_id, empleado_emisor_id, fecha_emision FROM gift_cards WHERE codigo ILIKE '%TU_CODIGO%';
-- 2) Si ya existe el cobro: SELECT id FROM pagos WHERE referencia = 'giftcard_emision:' || 'UUID_DE_LA_GC';
-- 3) Completa el INSERT (metodo_pago, montos según cómo pagaron).

/*
INSERT INTO pagos (
  cita_id,
  cliente_id,
  empleado_id,
  sucursal_id,
  monto,
  metodo_pago,
  estado,
  fecha,
  hora,
  servicios,
  notas,
  referencia,
  subtotal,
  descuento_monto,
  propina,
  monto_efectivo,
  monto_tarjeta
)
VALUES (
  NULL,
  NULL,                           -- o UUID del cliente si aplica
  NULL,                           -- o UUID del empleado emisor
  'UUID_SUCURSAL_SERENA'::uuid,
  2500.00,
  'efectivo',                     -- efectivo | tarjeta | transferencia | otro
  'completado',
  '2026-04-29'::date,             -- fecha real de la venta
  '12:00:00',
  ARRAY['Gift card · GC-XXXX-YYYY'],
  'Emisión gift card · GC-XXXX-YYYY',
  'giftcard_emision:UUID_DE_LA_GC'::text,
  2500.00,
  0,
  0,
  2500.00,                        -- si fue efectivo; si tarjeta usar 0 aquí y monto_tarjeta = 2500
  0
);

UPDATE gift_card_transacciones t
SET venta_id = p.id
FROM pagos p
WHERE t.gift_card_id = 'UUID_DE_LA_GC'::uuid
  AND t.tipo = 'emision'
  AND p.referencia = 'giftcard_emision:UUID_DE_LA_GC'
  AND t.venta_id IS NULL;
*/
