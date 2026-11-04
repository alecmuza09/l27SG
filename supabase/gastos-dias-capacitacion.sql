-- gastos: días de capacitación (reemplaza rango de fechas en UI nueva)
-- Ejecutar en Supabase SQL Editor del proyecto L27.
-- Los campos capacitacion_fecha_inicio / capacitacion_fecha_fin se conservan
-- para mostrar gastos viejos; los nuevos usan dias_capacitacion.

ALTER TABLE public.gastos
  ADD COLUMN IF NOT EXISTS dias_capacitacion integer;

COMMENT ON COLUMN public.gastos.dias_capacitacion IS
  'Número de días de capacitación (1–10). Reemplaza el rango de fechas para gastos nuevos.';
