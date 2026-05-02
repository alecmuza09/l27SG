-- =============================================================================
-- Diagnóstico: gift card vendida pero no aparece en Pagos / Cobros
-- Ejecutar en Supabase → SQL Editor (rol que ve todas las filas, p. ej. postgres)
-- =============================================================================

-- 1) Últimas gift cards (comprueba fecha_emision y sucursal_id)
SELECT id, codigo, monto_inicial, fecha_emision, sucursal_id, cliente_id, empleado_emisor_id, metodo_pago, created_at
FROM gift_cards
ORDER BY created_at DESC
LIMIT 25;

-- 2) ¿Existe ya el cobro enlazado por referencia?
SELECT p.id, p.fecha, p.sucursal_id, p.monto, p.metodo_pago, p.estado, p.referencia, p.servicios
FROM pagos p
WHERE p.referencia LIKE 'giftcard_emision:%'
ORDER BY p.fecha DESC, p.created_at DESC
LIMIT 25;

-- 3) Para una gift card concreta (sustituye el UUID):
-- SELECT id FROM pagos WHERE referencia = 'giftcard_emision:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';

-- 4) Políticas RLS actuales (si ves políticas muy restrictivas, el navegador puede devolver 0 filas)
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN ('pagos', 'gift_cards', 'gift_card_transacciones')
ORDER BY tablename, policyname;
