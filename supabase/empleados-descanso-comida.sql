-- Añadir horario de comida a empleados (para bloquear slots en la agenda)
ALTER TABLE empleados
  ADD COLUMN IF NOT EXISTS comida_inicio TIME,
  ADD COLUMN IF NOT EXISTS comida_fin TIME;

COMMENT ON COLUMN empleados.comida_inicio IS 'Inicio del horario de comida (ej. 14:00)';
COMMENT ON COLUMN empleados.comida_fin IS 'Fin del horario de comida (ej. 15:00)';
-- dias_trabajo ya existe: array de días que SÍ trabaja (0=Dom, 1=Lun, ..., 6=Sáb). Los no incluidos son días de descanso.
