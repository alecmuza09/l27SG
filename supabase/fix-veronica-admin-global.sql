-- Corregir acceso global de veronica@luna27.mx en agenda / RLS
-- Ejecutar en Supabase SQL Editor.
--
-- Diagnóstico previo (opcional):
-- SELECT u.id, u.email, u.rol, u.sucursal_id, u.activo,
--        au.id AS auth_uid,
--        (u.id = au.id) AS ids_coinciden,
--        public.user_is_global_admin() AS es_admin_rls
-- FROM public.usuarios u
-- LEFT JOIN auth.users au ON lower(trim(au.email)) = lower(trim(u.email))
-- WHERE lower(trim(u.email)) = 'veronica@luna27.mx';

-- 1. Rol admin global y sin sucursal base fija
UPDATE public.usuarios
SET
  rol         = 'admin',
  sucursal_id = NULL,
  activo      = true,
  updated_at  = NOW()
WHERE lower(trim(email)) = 'veronica@luna27.mx';

-- 2. Quitar asignaciones en junction (evita scope de una sola sede)
DELETE FROM public.usuario_sucursales us
USING public.usuarios u
WHERE u.id = us.usuario_id
  AND lower(trim(u.email)) = 'veronica@luna27.mx';

-- 3. Alinear metadata de Auth (por si el fallback cliente usa user_metadata)
UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
  || jsonb_build_object('rol', 'admin', 'nombre', 'Verónica')
WHERE lower(trim(email)) = 'veronica@luna27.mx';

-- Verificación
SELECT u.id, u.email, u.rol, u.sucursal_id, u.activo,
       (SELECT count(*) FROM public.usuario_sucursales us WHERE us.usuario_id = u.id) AS junction_rows
FROM public.usuarios u
WHERE lower(trim(u.email)) = 'veronica@luna27.mx';
