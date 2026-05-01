-- ============================================================
-- agenda_bloques: permisos para Citas (comida / descanso)
-- Sin esto, RLS puede bloquear INSERT/UPDATE para cuentas no admin.
-- Ejecutar en el SQL Editor de Supabase tras crear la tabla (agenda_bloques.sql).
-- ============================================================

ALTER TABLE agenda_bloques ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agenda_bloques_select_authenticated ON agenda_bloques;
DROP POLICY IF EXISTS agenda_bloques_insert_authenticated ON agenda_bloques;
DROP POLICY IF EXISTS agenda_bloques_update_authenticated ON agenda_bloques;
DROP POLICY IF EXISTS agenda_bloques_delete_authenticated ON agenda_bloques;

-- Cualquier usuario con sesión Supabase Auth puede leer y escribir bloques de agenda.
-- La app ya controla qué sucursal ve cada rol en el cliente.
CREATE POLICY agenda_bloques_select_authenticated
  ON agenda_bloques FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY agenda_bloques_insert_authenticated
  ON agenda_bloques FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY agenda_bloques_update_authenticated
  ON agenda_bloques FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY agenda_bloques_delete_authenticated
  ON agenda_bloques FOR DELETE
  TO authenticated
  USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON agenda_bloques TO authenticated;

-- Para que otras sesiones vean cambios al instante: Supabase Dashboard → Database → Publications
-- → habilitar `agenda_bloques` en `supabase_realtime` (o ejecutar solo si aún no está):
-- ALTER PUBLICATION supabase_realtime ADD TABLE agenda_bloques;
