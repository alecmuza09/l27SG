-- Agregar columnas de rango horario a ausencias parciales
-- hora_inicio y hora_fin son NULL para ausencias de día completo

ALTER TABLE ausencias
  ADD COLUMN IF NOT EXISTS hora_inicio TIME,
  ADD COLUMN IF NOT EXISTS hora_fin    TIME;
