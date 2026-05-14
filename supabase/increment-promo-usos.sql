-- Incrementa atómicamente usos_actuales de una promoción por código (cupón).
-- Ejecutar en Supabase SQL Editor o incluir en migraciones.

CREATE OR REPLACE FUNCTION public.increment_promo_usos(p_codigo TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE promociones
  SET
    usos_actuales = COALESCE(usos_actuales, 0) + 1,
    updated_at = NOW()
  WHERE codigo_promo IS NOT NULL
    AND TRIM(codigo_promo) <> ''
    AND UPPER(TRIM(codigo_promo)) = UPPER(TRIM(p_codigo));
END;
$$;

COMMENT ON FUNCTION public.increment_promo_usos(TEXT) IS 'Suma 1 a usos_actuales tras aplicar un cupón en cobro';

GRANT EXECUTE ON FUNCTION public.increment_promo_usos(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.increment_promo_usos(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_promo_usos(TEXT) TO service_role;
