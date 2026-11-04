-- Registro de quién capturó y quién resolvió vacaciones y ausencias.
-- Ejecutar manualmente en Supabase (SQL Editor). No modifica datos existentes:
-- los registros anteriores quedan con estas columnas en NULL ("—" en pantalla).

-- ── vacaciones ──────────────────────────────────────────────────────────────
ALTER TABLE vacaciones
  ADD COLUMN IF NOT EXISTS registrado_por_id     UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS registrado_por_nombre TEXT,
  ADD COLUMN IF NOT EXISTS aprobado_por_nombre   TEXT,
  ADD COLUMN IF NOT EXISTS resuelto_en           TIMESTAMPTZ;

-- ── ausencias ───────────────────────────────────────────────────────────────
ALTER TABLE ausencias
  ADD COLUMN IF NOT EXISTS registrado_por_id     UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS registrado_por_nombre TEXT;
