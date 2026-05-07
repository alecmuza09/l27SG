-- Rol branch-admin / superadmin en usuarios + RLS por sucursal en vacaciones, saldo_vacaciones y periodos_bloqueados.
-- Ejecutar en Supabase (SQL editor) o vía migración. Requiere tabla public.usuario_sucursales para user_sucursal_ids().

ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;

ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_rol_check
  CHECK (rol IN ('admin', 'manager', 'staff', 'branch-admin', 'superadmin'));

CREATE OR REPLACE FUNCTION public.user_is_global_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = auth.uid()
    AND COALESCE(u.activo, true)
    AND u.rol IN ('admin', 'superadmin')
  );
$$;

CREATE OR REPLACE FUNCTION public.user_sucursal_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT x.sucursal_id
  FROM (
    SELECT u.sucursal_id AS sucursal_id
    FROM public.usuarios u
    WHERE u.id = auth.uid() AND COALESCE(u.activo, true) AND u.sucursal_id IS NOT NULL
    UNION ALL
    SELECT us.sucursal_id
    FROM public.usuario_sucursales us
    INNER JOIN public.usuarios u ON u.id = us.usuario_id AND u.id = auth.uid() AND COALESCE(u.activo, true)
  ) x
  WHERE x.sucursal_id IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.user_is_global_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_sucursal_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_is_global_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_sucursal_ids() TO authenticated;

-- vacaciones (acceso vía empleados.sucursal_id)
ALTER TABLE public.vacaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vacaciones_select_scope ON public.vacaciones;
DROP POLICY IF EXISTS vacaciones_insert_scope ON public.vacaciones;
DROP POLICY IF EXISTS vacaciones_update_scope ON public.vacaciones;
DROP POLICY IF EXISTS vacaciones_delete_scope ON public.vacaciones;

CREATE POLICY vacaciones_select_scope ON public.vacaciones FOR SELECT TO authenticated
USING (
  public.user_is_global_admin()
  OR EXISTS (
    SELECT 1 FROM public.empleados e
    WHERE e.id = vacaciones.empleado_id
    AND e.sucursal_id IN (SELECT public.user_sucursal_ids())
  )
);

CREATE POLICY vacaciones_insert_scope ON public.vacaciones FOR INSERT TO authenticated
WITH CHECK (
  public.user_is_global_admin()
  OR EXISTS (
    SELECT 1 FROM public.empleados e
    WHERE e.id = vacaciones.empleado_id
    AND e.sucursal_id IN (SELECT public.user_sucursal_ids())
  )
);

CREATE POLICY vacaciones_update_scope ON public.vacaciones FOR UPDATE TO authenticated
USING (
  public.user_is_global_admin()
  OR EXISTS (
    SELECT 1 FROM public.empleados e
    WHERE e.id = vacaciones.empleado_id
    AND e.sucursal_id IN (SELECT public.user_sucursal_ids())
  )
)
WITH CHECK (
  public.user_is_global_admin()
  OR EXISTS (
    SELECT 1 FROM public.empleados e
    WHERE e.id = vacaciones.empleado_id
    AND e.sucursal_id IN (SELECT public.user_sucursal_ids())
  )
);

CREATE POLICY vacaciones_delete_scope ON public.vacaciones FOR DELETE TO authenticated
USING (
  public.user_is_global_admin()
  OR EXISTS (
    SELECT 1 FROM public.empleados e
    WHERE e.id = vacaciones.empleado_id
    AND e.sucursal_id IN (SELECT public.user_sucursal_ids())
  )
);

-- saldo_vacaciones
ALTER TABLE public.saldo_vacaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS saldo_vacaciones_select_scope ON public.saldo_vacaciones;
DROP POLICY IF EXISTS saldo_vacaciones_insert_scope ON public.saldo_vacaciones;
DROP POLICY IF EXISTS saldo_vacaciones_update_scope ON public.saldo_vacaciones;
DROP POLICY IF EXISTS saldo_vacaciones_delete_scope ON public.saldo_vacaciones;

CREATE POLICY saldo_vacaciones_select_scope ON public.saldo_vacaciones FOR SELECT TO authenticated
USING (
  public.user_is_global_admin()
  OR EXISTS (
    SELECT 1 FROM public.empleados e
    WHERE e.id = saldo_vacaciones.empleado_id
    AND e.sucursal_id IN (SELECT public.user_sucursal_ids())
  )
);

CREATE POLICY saldo_vacaciones_insert_scope ON public.saldo_vacaciones FOR INSERT TO authenticated
WITH CHECK (
  public.user_is_global_admin()
  OR EXISTS (
    SELECT 1 FROM public.empleados e
    WHERE e.id = saldo_vacaciones.empleado_id
    AND e.sucursal_id IN (SELECT public.user_sucursal_ids())
  )
);

CREATE POLICY saldo_vacaciones_update_scope ON public.saldo_vacaciones FOR UPDATE TO authenticated
USING (
  public.user_is_global_admin()
  OR EXISTS (
    SELECT 1 FROM public.empleados e
    WHERE e.id = saldo_vacaciones.empleado_id
    AND e.sucursal_id IN (SELECT public.user_sucursal_ids())
  )
)
WITH CHECK (
  public.user_is_global_admin()
  OR EXISTS (
    SELECT 1 FROM public.empleados e
    WHERE e.id = saldo_vacaciones.empleado_id
    AND e.sucursal_id IN (SELECT public.user_sucursal_ids())
  )
);

CREATE POLICY saldo_vacaciones_delete_scope ON public.saldo_vacaciones FOR DELETE TO authenticated
USING (
  public.user_is_global_admin()
  OR EXISTS (
    SELECT 1 FROM public.empleados e
    WHERE e.id = saldo_vacaciones.empleado_id
    AND e.sucursal_id IN (SELECT public.user_sucursal_ids())
  )
);

-- periodos_bloqueados (sucursal directa)
ALTER TABLE public.periodos_bloqueados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS periodos_bloqueados_select_scope ON public.periodos_bloqueados;
DROP POLICY IF EXISTS periodos_bloqueados_insert_scope ON public.periodos_bloqueados;
DROP POLICY IF EXISTS periodos_bloqueados_update_scope ON public.periodos_bloqueados;
DROP POLICY IF EXISTS periodos_bloqueados_delete_scope ON public.periodos_bloqueados;

CREATE POLICY periodos_bloqueados_select_scope ON public.periodos_bloqueados FOR SELECT TO authenticated
USING (
  public.user_is_global_admin()
  OR periodos_bloqueados.sucursal_id IN (SELECT public.user_sucursal_ids())
);

CREATE POLICY periodos_bloqueados_insert_scope ON public.periodos_bloqueados FOR INSERT TO authenticated
WITH CHECK (
  public.user_is_global_admin()
  OR periodos_bloqueados.sucursal_id IN (SELECT public.user_sucursal_ids())
);

CREATE POLICY periodos_bloqueados_update_scope ON public.periodos_bloqueados FOR UPDATE TO authenticated
USING (
  public.user_is_global_admin()
  OR periodos_bloqueados.sucursal_id IN (SELECT public.user_sucursal_ids())
)
WITH CHECK (
  public.user_is_global_admin()
  OR periodos_bloqueados.sucursal_id IN (SELECT public.user_sucursal_ids())
);

CREATE POLICY periodos_bloqueados_delete_scope ON public.periodos_bloqueados FOR DELETE TO authenticated
USING (
  public.user_is_global_admin()
  OR periodos_bloqueados.sucursal_id IN (SELECT public.user_sucursal_ids())
);
