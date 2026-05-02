-- =============================================================================
-- OPCIONAL — Solo si el diagnóstico muestra que RLS bloquea lectura/escritura
-- para usuarios autenticados (la app usa Supabase Auth + rol `authenticated`).
--
-- ADVERTENCIA: Estas políticas permiten a cualquier usuario autenticado leer y
-- escribir `pagos` y `gift_cards`. Ajusta según tu modelo de seguridad (por
-- sucursal, por rol, etc.) antes de usar en producción.
-- =============================================================================

ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pagos_select_authenticated ON pagos;
DROP POLICY IF EXISTS pagos_insert_authenticated ON pagos;
DROP POLICY IF EXISTS pagos_update_authenticated ON pagos;
DROP POLICY IF EXISTS pagos_delete_authenticated ON pagos;

CREATE POLICY pagos_select_authenticated ON pagos FOR SELECT TO authenticated USING (true);
CREATE POLICY pagos_insert_authenticated ON pagos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY pagos_update_authenticated ON pagos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY pagos_delete_authenticated ON pagos FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS gift_cards_select_authenticated ON gift_cards;
DROP POLICY IF EXISTS gift_cards_insert_authenticated ON gift_cards;
DROP POLICY IF EXISTS gift_cards_update_authenticated ON gift_cards;

CREATE POLICY gift_cards_select_authenticated ON gift_cards FOR SELECT TO authenticated USING (true);
CREATE POLICY gift_cards_insert_authenticated ON gift_cards FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY gift_cards_update_authenticated ON gift_cards FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
