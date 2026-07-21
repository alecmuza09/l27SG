-- =============================================================================
-- gastos: permisos + RLS (ejecutar en Supabase SQL Editor)
-- Requiere tabla `gastos` ya creada.
-- Requiere funciones user_is_global_admin() y user_sucursal_ids()
--   (vacaciones-rls-y-usuarios-branch-admin.sql o restringir-scope-sucursal-rls).
-- =============================================================================

GRANT SELECT, INSERT, DELETE ON TABLE public.gastos TO authenticated;
GRANT ALL ON TABLE public.gastos TO service_role;

ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gastos_select_authenticated ON public.gastos;
DROP POLICY IF EXISTS gastos_insert_authenticated ON public.gastos;
DROP POLICY IF EXISTS gastos_delete_authenticated ON public.gastos;
DROP POLICY IF EXISTS gastos_select_scope ON public.gastos;
DROP POLICY IF EXISTS gastos_insert_scope ON public.gastos;
DROP POLICY IF EXISTS gastos_delete_scope ON public.gastos;

CREATE POLICY gastos_select_scope ON public.gastos
  FOR SELECT TO authenticated
  USING (
    public.user_is_global_admin()
    OR sucursal_id IN (SELECT public.user_sucursal_ids())
  );

CREATE POLICY gastos_insert_scope ON public.gastos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_is_global_admin()
    OR sucursal_id IN (SELECT public.user_sucursal_ids())
  );

CREATE POLICY gastos_delete_scope ON public.gastos
  FOR DELETE TO authenticated
  USING (
    public.user_is_global_admin()
    OR sucursal_id IN (SELECT public.user_sucursal_ids())
  );

-- Verificación (debe devolver 3 políticas):
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'gastos';
