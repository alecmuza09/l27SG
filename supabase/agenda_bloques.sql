-- Bloques de comida/descanso por sucursal y día (compartidos entre todas las cuentas)
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
