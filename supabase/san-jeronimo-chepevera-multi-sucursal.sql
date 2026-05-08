-- =============================================================================
-- Multi-sucursal: cuenta San Jerónimo + Chepe Vera (usuario_sucursales)
-- Ejecutar en Supabase SQL Editor tras revisar nombres en public.sucursales.
--
-- Contexto:
-- - user_sucursal_ids() ya une usuarios.sucursal_id con filas en usuario_sucursales.
-- - Las políticas RLS del proyecto filtran por ese conjunto; no suelen requerir cambios
--   adicionales al añadir una fila en usuario_sucursales.
--
-- Ajusta el correo si la cuenta usa otro email.
-- =============================================================================

-- Sucursal adicional: Chepe Vera (no sustituye usuarios.sucursal_id)
INSERT INTO public.usuario_sucursales (usuario_id, sucursal_id)
SELECT u.id, s_cv.id
FROM public.usuarios u
CROSS JOIN LATERAL (
  SELECT id
  FROM public.sucursales
  WHERE COALESCE(activa, true)
    AND (
      nombre ILIKE '%Chepe%Vera%'
      OR nombre ILIKE '%Chepevera%'
    )
  ORDER BY nombre
  LIMIT 1
) s_cv
WHERE lower(trim(u.email)) = lower(trim('sanjeronimo@luna27.mx'))
  AND COALESCE(u.activo, true)
ON CONFLICT (usuario_id, sucursal_id) DO NOTHING;

-- Opcional: fijar sucursal principal del perfil a Amazonas San Jerónimo (columna usuarios.sucursal_id)
UPDATE public.usuarios u
SET sucursal_id = s_sj.id
FROM (
  SELECT id
  FROM public.sucursales
  WHERE COALESCE(activa, true)
    AND (
      nombre ILIKE '%Amazonas%San Jerónimo%'
      OR (nombre ILIKE '%San Jerónimo%' AND nombre ILIKE '%Amazonas%')
    )
  ORDER BY nombre
  LIMIT 1
) s_sj
WHERE lower(trim(u.email)) = lower(trim('sanjeronimo@luna27.mx'))
  AND COALESCE(u.activo, true);

-- Verificación manual (resultados esperados: 2 filas distintas de sucursal para el usuario)
-- SELECT u.email, u.sucursal_id AS principal, us.sucursal_id AS adicional
-- FROM public.usuarios u
-- LEFT JOIN public.usuario_sucursales us ON us.usuario_id = u.id
-- WHERE lower(trim(u.email)) = lower(trim('sanjeronimo@luna27.mx'));
