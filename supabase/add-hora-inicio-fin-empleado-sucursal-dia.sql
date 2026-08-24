-- Agregar rango horario opcional a la asignación de sucursal por día.
-- hora_inicio y hora_fin son NULL cuando la asignación no tiene horario específico
-- (aplica todo el día, comportamiento actual).

ALTER TABLE empleado_sucursal_dia
  ADD COLUMN IF NOT EXISTS hora_inicio TIME,
  ADD COLUMN IF NOT EXISTS hora_fin    TIME;

-- También se guarda en el historial para poder mostrar el rango horario
-- en "Últimos movimientos" sin tener que consultar la fila vigente.
ALTER TABLE empleado_sucursal_dia_historial
  ADD COLUMN IF NOT EXISTS hora_inicio TIME,
  ADD COLUMN IF NOT EXISTS hora_fin    TIME;
