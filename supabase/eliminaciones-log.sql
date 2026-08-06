-- =============================================================================
-- eliminaciones_log: tabla de auditoría para eliminaciones/cancelaciones
-- Ejecutar en Supabase SQL Editor.
-- Requiere funciones user_is_global_admin() y user_sucursal_ids()
--   (vacaciones-rls-y-usuarios-branch-admin.sql o restringir-scope-sucursal-rls).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.eliminaciones_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tabla VARCHAR(50) NOT NULL,               -- ej. 'pagos', 'citas'
  registro_id UUID NOT NULL,                -- id del registro eliminado/cancelado
  datos_eliminados JSONB NOT NULL,          -- snapshot completo del registro antes de eliminar
  sucursal_id UUID REFERENCES public.sucursales(id) ON DELETE SET NULL,
  eliminado_por UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eliminaciones_log_tabla_registro
  ON public.eliminaciones_log (tabla, registro_id);

CREATE INDEX IF NOT EXISTS idx_eliminaciones_log_created_at
  ON public.eliminaciones_log (created_at DESC);

-- ── Permisos y RLS ───────────────────────────────────────────────────────────
-- Sin política de UPDATE/DELETE a propósito: el log es de solo lectura una vez
-- insertado (inmutable), para preservar la integridad de la auditoría.

GRANT SELECT, INSERT ON TABLE public.eliminaciones_log TO authenticated;
GRANT ALL ON TABLE public.eliminaciones_log TO service_role;

ALTER TABLE public.eliminaciones_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS eliminaciones_log_select_admin ON public.eliminaciones_log;
DROP POLICY IF EXISTS eliminaciones_log_insert_scope ON public.eliminaciones_log;

-- Solo administradores globales pueden consultar el historial de auditoría.
CREATE POLICY eliminaciones_log_select_admin ON public.eliminaciones_log
  FOR SELECT TO authenticated
  USING (public.user_is_global_admin());

-- Cualquier usuario autenticado puede registrar una eliminación dentro de su
-- propio alcance de sucursal (o sin sucursal_id / siendo admin global).
CREATE POLICY eliminaciones_log_insert_scope ON public.eliminaciones_log
  FOR INSERT TO authenticated
  WITH CHECK (
    sucursal_id IS NULL
    OR public.user_is_global_admin()
    OR sucursal_id IN (SELECT public.user_sucursal_ids())
  );
