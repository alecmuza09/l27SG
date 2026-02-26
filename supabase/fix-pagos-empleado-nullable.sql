-- Hacer empleado_id nullable en pagos (ventas directas pueden no tener empleado asignado)
ALTER TABLE pagos ALTER COLUMN empleado_id DROP NOT NULL;
