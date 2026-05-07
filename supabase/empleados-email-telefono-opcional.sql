-- Hacer email y teléfono opcionales en empleados (solo nombre, apellido, rol y sucursal obligatorios).
-- Ejecutar en Supabase: SQL Editor → New query → pegar y ejecutar.

ALTER TABLE empleados
  ALTER COLUMN email DROP NOT NULL;

ALTER TABLE empleados
  ALTER COLUMN telefono DROP NOT NULL;
