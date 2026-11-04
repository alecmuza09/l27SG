-- gastos: nombre libre para persona no registrada como empleada
-- Ejecutar en Supabase SQL Editor del proyecto L27.

ALTER TABLE public.gastos
  ADD COLUMN IF NOT EXISTS empleada_nombre_libre text;

COMMENT ON COLUMN public.gastos.empleada_nombre_libre IS
  'Nombre de persona externa (no en empleados). Se usa cuando empleada_id es null.';
