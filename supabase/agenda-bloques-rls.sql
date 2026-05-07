-- ============================================================
-- agenda_bloques: tabla + índices + RLS (ejecutar TODO este archivo en Supabase)
-- Si antes falló con "relation agenda_bloques does not exist", era porque solo se
-- aplicó la parte de RLS; este script crea la tabla si falta y luego las políticas.
-- ============================================================

-- 1) Tabla (requiere que exista public.sucursales)
CREATE TABLE IF NOT EXISTS agenda_bloques (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sucursal_id UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  bloques JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (sucursal_id, fecha)
);

CREATE INDEX IF NOT EXISTS idx_agenda_bloques_lookup ON agenda_bloques (sucursal_id, fecha);

COMMENT ON TABLE agenda_bloques IS 'Comidas y descansos manuales en la agenda citas; visible para todos los roles';

-- 2) Row Level Security — usuarios con sesión Supabase Auth (admin y sucursal)
ALTER TABLE agenda_bloques ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agenda_bloques_select_authenticated ON agenda_bloques;
DROP POLICY IF EXISTS agenda_bloques_insert_authenticated ON agenda_bloques;
DROP POLICY IF EXISTS agenda_bloques_update_authenticated ON agenda_bloques;
DROP POLICY IF EXISTS agenda_bloques_delete_authenticated ON agenda_bloques;

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

-- 3) Opcional — Realtime para ver cambios entre pestañas/usuarios:
-- Dashboard → Database → Publications → supabase_realtime → incluir agenda_bloques
-- O una sola vez (si Postgres devuelve error de duplicado, ignóralo):
-- ALTER PUBLICATION supabase_realtime ADD TABLE agenda_bloques;
