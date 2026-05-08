-- =============================================================================
-- Restricción de alcance por sucursal en RLS + corrección cuenta Paseo Tec
-- Ejecutar en Supabase SQL Editor tras revisionar en staging.
--
-- Objetivos:
-- 1. Dejar paseotecnat@luna27.mx como branch-admin sólo ligado a Paseo Tec
--    (sin filas extras en usuario_sucursales).
-- 2. Políticas RLS: admins globales ven todo; el resto sólo datos cuyas
--    sucursales estén en user_sucursal_ids() (+ funciones helper existentes).
--
-- Requiere: extensión uuid-ossp o gen_random_uuid() según proyecto.
-- Debe ejecutarse DESPUÉS de vacaciones-rls-y-usuarios-branch-admin.sql
-- si aún no existen user_is_global_admin() y user_sucursal_ids().
-- =============================================================================

-- ─── Helpers (idempotentes; alineados con vacaciones-rls-y-usuarios-branch-admin.sql)
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

-- ─── 1. Corregir usuario paseotecnat@luna27.mx ─────────────────────────────
-- Sustituye el UUID si tu ID de sucursal Paseo Tec difiere en tu instancia.

UPDATE public.usuarios
SET
  rol           = 'branch-admin',
  sucursal_id   = 'b37b010f-6e12-4700-abde-f646956a271f'::uuid,
  activo        = true,
  updated_at    = NOW()
WHERE lower(trim(email)) = lower(trim('paseotecnat@luna27.mx'));

DELETE FROM public.usuario_sucursales us
USING public.usuarios u
WHERE u.id = us.usuario_id
  AND lower(trim(u.email)) = lower(trim('paseotecnat@luna27.mx'));

UPDATE public.usuarios u
SET updated_at = NOW()
WHERE lower(trim(u.email)) = lower(trim('paseotecnat@luna27.mx'));

-- ─── 2. usuarios / usuario_sucursales (evitar fugas entre cuentas) ─────────--
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS usuarios_select_scope ON public.usuarios;
CREATE POLICY usuarios_select_scope ON public.usuarios
  FOR SELECT TO authenticated
  USING (public.user_is_global_admin() OR id = auth.uid());

-- Sin UPDATE vía cliente: evita escalada de rol. Altas/edición masiva = service role / admin en panel.
DROP POLICY IF EXISTS usuarios_update_scope ON public.usuarios;

ALTER TABLE public.usuario_sucursales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS usuario_sucursales_select_scope ON public.usuario_sucursales;
CREATE POLICY usuario_sucursales_select_scope ON public.usuario_sucursales
  FOR SELECT TO authenticated
  USING (public.user_is_global_admin() OR usuario_id = auth.uid());

DROP POLICY IF EXISTS usuario_sucursales_insert_scope ON public.usuario_sucursales;
DROP POLICY IF EXISTS usuario_sucursales_update_scope ON public.usuario_sucursales;
DROP POLICY IF EXISTS usuario_sucursales_delete_scope ON public.usuario_sucursales;

CREATE POLICY usuario_sucursales_insert_scope ON public.usuario_sucursales
  FOR INSERT TO authenticated
  WITH CHECK (public.user_is_global_admin());

CREATE POLICY usuario_sucursales_update_scope ON public.usuario_sucursales
  FOR UPDATE TO authenticated
  USING (public.user_is_global_admin())
  WITH CHECK (public.user_is_global_admin());

CREATE POLICY usuario_sucursales_delete_scope ON public.usuario_sucursales
  FOR DELETE TO authenticated
  USING (public.user_is_global_admin());

-- ─── 3. sucursales (solo las asignadas, salvo admin global) ────────────────
ALTER TABLE public.sucursales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sucursales_select_scope ON public.sucursales;
CREATE POLICY sucursales_select_scope ON public.sucursales
  FOR SELECT TO authenticated
  USING (
    public.user_is_global_admin()
    OR id IN (SELECT public.user_sucursal_ids())
  );

DROP POLICY IF EXISTS sucursales_insert_scope ON public.sucursales;
DROP POLICY IF EXISTS sucursales_update_scope ON public.sucursales;
DROP POLICY IF EXISTS sucursales_delete_scope ON public.sucursales;

CREATE POLICY sucursales_insert_scope ON public.sucursales
  FOR INSERT TO authenticated
  WITH CHECK (public.user_is_global_admin());

CREATE POLICY sucursales_update_scope ON public.sucursales
  FOR UPDATE TO authenticated
  USING (public.user_is_global_admin())
  WITH CHECK (public.user_is_global_admin());

CREATE POLICY sucursales_delete_scope ON public.sucursales
  FOR DELETE TO authenticated
  USING (public.user_is_global_admin());

-- ─── 4. servicios (catálogo legible por operación; escritura sólo admins) ─
ALTER TABLE public.servicios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS servicios_select_auth ON public.servicios;
CREATE POLICY servicios_select_auth ON public.servicios
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS servicios_write_scope ON public.servicios;
CREATE POLICY servicios_write_scope ON public.servicios
  FOR INSERT TO authenticated
  WITH CHECK (public.user_is_global_admin());

DROP POLICY IF EXISTS servicios_update_scope ON public.servicios;
CREATE POLICY servicios_update_scope ON public.servicios
  FOR UPDATE TO authenticated
  USING (public.user_is_global_admin())
  WITH CHECK (public.user_is_global_admin());

DROP POLICY IF EXISTS servicios_delete_scope ON public.servicios;
CREATE POLICY servicios_delete_scope ON public.servicios
  FOR DELETE TO authenticated
  USING (public.user_is_global_admin());

-- ─── 5. empleados (lectura por sucursal base; alta/baja sólo admins) ─────────
ALTER TABLE public.empleados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS empleados_select_scope ON public.empleados;
CREATE POLICY empleados_select_scope ON public.empleados
  FOR SELECT TO authenticated
  USING (
    public.user_is_global_admin()
    OR sucursal_id IN (SELECT public.user_sucursal_ids())
  );

DROP POLICY IF EXISTS empleados_insert_scope ON public.empleados;
CREATE POLICY empleados_insert_scope ON public.empleados
  FOR INSERT TO authenticated
  WITH CHECK (public.user_is_global_admin());

DROP POLICY IF EXISTS empleados_update_scope ON public.empleados;
CREATE POLICY empleados_update_scope ON public.empleados
  FOR UPDATE TO authenticated
  USING (public.user_is_global_admin())
  WITH CHECK (public.user_is_global_admin());

DROP POLICY IF EXISTS empleados_delete_scope ON public.empleados;
CREATE POLICY empleados_delete_scope ON public.empleados
  FOR DELETE TO authenticated
  USING (public.user_is_global_admin());

-- ─── 6. Clientes visibles si atendidos / pagaron / gc / preferidos en alcance ─
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clientes_select_scope ON public.clientes;
CREATE POLICY clientes_select_scope ON public.clientes
  FOR SELECT TO authenticated
  USING (
    public.user_is_global_admin()
    OR (sucursal_preferida IS NOT NULL AND sucursal_preferida IN (SELECT public.user_sucursal_ids()))
    OR EXISTS (
      SELECT 1 FROM public.citas c
      WHERE c.cliente_id = clientes.id
        AND c.sucursal_id IN (SELECT public.user_sucursal_ids())
    )
    OR EXISTS (
      SELECT 1 FROM public.pagos p
      WHERE p.cliente_id = clientes.id
        AND p.sucursal_id IN (SELECT public.user_sucursal_ids())
    )
    OR EXISTS (
      SELECT 1 FROM public.gift_cards g
      WHERE g.cliente_id = clientes.id
        AND g.sucursal_id IN (SELECT public.user_sucursal_ids())
    )
  );

DROP POLICY IF EXISTS clientes_insert_scope ON public.clientes;
CREATE POLICY clientes_insert_scope ON public.clientes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_is_global_admin()
    OR sucursal_preferida IS NULL
    OR sucursal_preferida IN (SELECT public.user_sucursal_ids())
  );

DROP POLICY IF EXISTS clientes_update_scope ON public.clientes;
CREATE POLICY clientes_update_scope ON public.clientes
  FOR UPDATE TO authenticated
  USING (
    public.user_is_global_admin()
    OR sucursal_preferida IS NULL
    OR sucursal_preferida IN (SELECT public.user_sucursal_ids())
    OR EXISTS (
      SELECT 1 FROM public.citas c
      WHERE c.cliente_id = clientes.id
        AND c.sucursal_id IN (SELECT public.user_sucursal_ids())
    )
    OR EXISTS (
      SELECT 1 FROM public.pagos p
      WHERE p.cliente_id = clientes.id
        AND p.sucursal_id IN (SELECT public.user_sucursal_ids())
    )
  )
  WITH CHECK (
    public.user_is_global_admin()
    OR sucursal_preferida IS NULL
    OR sucursal_preferida IN (SELECT public.user_sucursal_ids())
  );

DROP POLICY IF EXISTS clientes_delete_scope ON public.clientes;
CREATE POLICY clientes_delete_scope ON public.clientes
  FOR DELETE TO authenticated
  USING (public.user_is_global_admin());

-- ─── 7. citas ──────────────────────────────────────────────────────────────
ALTER TABLE public.citas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS citas_select_scope ON public.citas;
CREATE POLICY citas_select_scope ON public.citas
  FOR SELECT TO authenticated
  USING (
    public.user_is_global_admin()
    OR sucursal_id IN (SELECT public.user_sucursal_ids())
  );

DROP POLICY IF EXISTS citas_insert_scope ON public.citas;
CREATE POLICY citas_insert_scope ON public.citas
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_is_global_admin()
    OR sucursal_id IN (SELECT public.user_sucursal_ids())
  );

DROP POLICY IF EXISTS citas_update_scope ON public.citas;
CREATE POLICY citas_update_scope ON public.citas
  FOR UPDATE TO authenticated
  USING (
    public.user_is_global_admin()
    OR sucursal_id IN (SELECT public.user_sucursal_ids())
  )
  WITH CHECK (
    public.user_is_global_admin()
    OR sucursal_id IN (SELECT public.user_sucursal_ids())
  );

DROP POLICY IF EXISTS citas_delete_scope ON public.citas;
CREATE POLICY citas_delete_scope ON public.citas
  FOR DELETE TO authenticated
  USING (
    public.user_is_global_admin()
    OR sucursal_id IN (SELECT public.user_sucursal_ids())
  );

-- ─── 8. pagos ──────────────────────────────────────────────────────────────
ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pagos_select_authenticated ON public.pagos;
DROP POLICY IF EXISTS pagos_insert_authenticated ON public.pagos;
DROP POLICY IF EXISTS pagos_update_authenticated ON public.pagos;
DROP POLICY IF EXISTS pagos_delete_authenticated ON public.pagos;

CREATE POLICY pagos_select_scope ON public.pagos
  FOR SELECT TO authenticated
  USING (
    public.user_is_global_admin()
    OR sucursal_id IN (SELECT public.user_sucursal_ids())
  );

CREATE POLICY pagos_insert_scope ON public.pagos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_is_global_admin()
    OR sucursal_id IN (SELECT public.user_sucursal_ids())
  );

CREATE POLICY pagos_update_scope ON public.pagos
  FOR UPDATE TO authenticated
  USING (
    public.user_is_global_admin()
    OR sucursal_id IN (SELECT public.user_sucursal_ids())
  )
  WITH CHECK (
    public.user_is_global_admin()
    OR sucursal_id IN (SELECT public.user_sucursal_ids())
  );

CREATE POLICY pagos_delete_scope ON public.pagos
  FOR DELETE TO authenticated
  USING (
    public.user_is_global_admin()
    OR sucursal_id IN (SELECT public.user_sucursal_ids())
  );

-- ─── 9. gift_cards y gift_card_transacciones ───────────────────────────────
ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gift_cards_select_authenticated ON public.gift_cards;
DROP POLICY IF EXISTS gift_cards_insert_authenticated ON public.gift_cards;
DROP POLICY IF EXISTS gift_cards_update_authenticated ON public.gift_cards;

CREATE POLICY gift_cards_select_scope ON public.gift_cards
  FOR SELECT TO authenticated
  USING (
    public.user_is_global_admin()
    OR sucursal_id IN (SELECT public.user_sucursal_ids())
  );

CREATE POLICY gift_cards_insert_scope ON public.gift_cards
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_is_global_admin()
    OR sucursal_id IN (SELECT public.user_sucursal_ids())
  );

CREATE POLICY gift_cards_update_scope ON public.gift_cards
  FOR UPDATE TO authenticated
  USING (
    public.user_is_global_admin()
    OR sucursal_id IN (SELECT public.user_sucursal_ids())
  )
  WITH CHECK (
    public.user_is_global_admin()
    OR sucursal_id IN (SELECT public.user_sucursal_ids())
  );

CREATE POLICY gift_cards_delete_scope ON public.gift_cards
  FOR DELETE TO authenticated
  USING (public.user_is_global_admin());

ALTER TABLE public.gift_card_transacciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gct_select_scope ON public.gift_card_transacciones;
CREATE POLICY gct_select_scope ON public.gift_card_transacciones
  FOR SELECT TO authenticated
  USING (
    public.user_is_global_admin()
    OR EXISTS (
      SELECT 1 FROM public.gift_cards g
      WHERE g.id = gift_card_transacciones.gift_card_id
        AND g.sucursal_id IN (SELECT public.user_sucursal_ids())
    )
  );

DROP POLICY IF EXISTS gct_insert_scope ON public.gift_card_transacciones;
CREATE POLICY gct_insert_scope ON public.gift_card_transacciones
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_is_global_admin()
    OR EXISTS (
      SELECT 1 FROM public.gift_cards g
      WHERE g.id = gift_card_transacciones.gift_card_id
        AND g.sucursal_id IN (SELECT public.user_sucursal_ids())
    )
  );

DROP POLICY IF EXISTS gct_update_scope ON public.gift_card_transacciones;
CREATE POLICY gct_update_scope ON public.gift_card_transacciones
  FOR UPDATE TO authenticated
  USING (
    public.user_is_global_admin()
    OR EXISTS (
      SELECT 1 FROM public.gift_cards g
      WHERE g.id = gift_card_transacciones.gift_card_id
        AND g.sucursal_id IN (SELECT public.user_sucursal_ids())
    )
  )
  WITH CHECK (
    public.user_is_global_admin()
    OR EXISTS (
      SELECT 1 FROM public.gift_cards g
      WHERE g.id = gift_card_transacciones.gift_card_id
        AND g.sucursal_id IN (SELECT public.user_sucursal_ids())
    )
  );

DROP POLICY IF EXISTS gct_delete_scope ON public.gift_card_transacciones;
CREATE POLICY gct_delete_scope ON public.gift_card_transacciones
  FOR DELETE TO authenticated
  USING (
    public.user_is_global_admin()
    OR EXISTS (
      SELECT 1 FROM public.gift_cards g
      WHERE g.id = gift_card_transacciones.gift_card_id
        AND g.sucursal_id IN (SELECT public.user_sucursal_ids())
    )
  );

-- ─── 10. agenda_bloques ────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.agenda_bloques') IS NOT NULL THEN
    ALTER TABLE public.agenda_bloques ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS agenda_bloques_select_authenticated ON public.agenda_bloques;
    DROP POLICY IF EXISTS agenda_bloques_insert_authenticated ON public.agenda_bloques;
    DROP POLICY IF EXISTS agenda_bloques_update_authenticated ON public.agenda_bloques;
    DROP POLICY IF EXISTS agenda_bloques_delete_authenticated ON public.agenda_bloques;
    DROP POLICY IF EXISTS agenda_bloques_select_scope ON public.agenda_bloques;
    DROP POLICY IF EXISTS agenda_bloques_insert_scope ON public.agenda_bloques;
    DROP POLICY IF EXISTS agenda_bloques_update_scope ON public.agenda_bloques;
    DROP POLICY IF EXISTS agenda_bloques_delete_scope ON public.agenda_bloques;

    CREATE POLICY agenda_bloques_select_scope ON public.agenda_bloques
      FOR SELECT TO authenticated
      USING (
        public.user_is_global_admin()
        OR sucursal_id IN (SELECT public.user_sucursal_ids())
      );

    CREATE POLICY agenda_bloques_insert_scope ON public.agenda_bloques
      FOR INSERT TO authenticated
      WITH CHECK (
        public.user_is_global_admin()
        OR sucursal_id IN (SELECT public.user_sucursal_ids())
      );

    CREATE POLICY agenda_bloques_update_scope ON public.agenda_bloques
      FOR UPDATE TO authenticated
      USING (
        public.user_is_global_admin()
        OR sucursal_id IN (SELECT public.user_sucursal_ids())
      )
      WITH CHECK (
        public.user_is_global_admin()
        OR sucursal_id IN (SELECT public.user_sucursal_ids())
      );

    CREATE POLICY agenda_bloques_delete_scope ON public.agenda_bloques
      FOR DELETE TO authenticated
      USING (
        public.user_is_global_admin()
        OR sucursal_id IN (SELECT public.user_sucursal_ids())
      );
  ELSE
    RAISE NOTICE 'Omitiendo agenda_bloques: crear la tabla con supabase/agenda-bloques-rls.sql y re-ejecutar esta sección.';
  END IF;
END $$;

-- ─── 11. empleado_sucursal_dia (+ historial) ─────────────────────────────────
ALTER TABLE public.empleado_sucursal_dia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS empleado_sucursal_dia_select_auth ON public.empleado_sucursal_dia;
DROP POLICY IF EXISTS empleado_sucursal_dia_insert_auth ON public.empleado_sucursal_dia;
DROP POLICY IF EXISTS empleado_sucursal_dia_update_auth ON public.empleado_sucursal_dia;
DROP POLICY IF EXISTS empleado_sucursal_dia_delete_auth ON public.empleado_sucursal_dia;

CREATE POLICY empleado_sucursal_dia_select_scope ON public.empleado_sucursal_dia
  FOR SELECT TO authenticated
  USING (
    public.user_is_global_admin()
    OR sucursal_id IN (SELECT public.user_sucursal_ids())
    OR EXISTS (
      SELECT 1 FROM public.empleados e
      WHERE e.id = empleado_sucursal_dia.empleado_id
        AND e.sucursal_id IN (SELECT public.user_sucursal_ids())
    )
  );

CREATE POLICY empleado_sucursal_dia_insert_scope ON public.empleado_sucursal_dia
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_is_global_admin()
    OR (
      sucursal_id IN (SELECT public.user_sucursal_ids())
      AND EXISTS (
        SELECT 1 FROM public.empleados e
        WHERE e.id = empleado_sucursal_dia.empleado_id
          AND e.sucursal_id IN (SELECT public.user_sucursal_ids())
      )
    )
  );

CREATE POLICY empleado_sucursal_dia_update_scope ON public.empleado_sucursal_dia
  FOR UPDATE TO authenticated
  USING (
    public.user_is_global_admin()
    OR (
      sucursal_id IN (SELECT public.user_sucursal_ids())
      AND EXISTS (
        SELECT 1 FROM public.empleados e
        WHERE e.id = empleado_sucursal_dia.empleado_id
          AND e.sucursal_id IN (SELECT public.user_sucursal_ids())
      )
    )
  )
  WITH CHECK (
    public.user_is_global_admin()
    OR (
      sucursal_id IN (SELECT public.user_sucursal_ids())
      AND EXISTS (
        SELECT 1 FROM public.empleados e
        WHERE e.id = empleado_sucursal_dia.empleado_id
          AND e.sucursal_id IN (SELECT public.user_sucursal_ids())
      )
    )
  );

CREATE POLICY empleado_sucursal_dia_delete_scope ON public.empleado_sucursal_dia
  FOR DELETE TO authenticated
  USING (
    public.user_is_global_admin()
    OR (
      sucursal_id IN (SELECT public.user_sucursal_ids())
      AND EXISTS (
        SELECT 1 FROM public.empleados e
        WHERE e.id = empleado_sucursal_dia.empleado_id
          AND e.sucursal_id IN (SELECT public.user_sucursal_ids())
      )
    )
  );

ALTER TABLE public.empleado_sucursal_dia_historial ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS empleado_sucursal_dia_hist_select_auth ON public.empleado_sucursal_dia_historial;
DROP POLICY IF EXISTS empleado_sucursal_dia_hist_insert_auth ON public.empleado_sucursal_dia_historial;

CREATE POLICY empleado_sucursal_dia_hist_select_scope ON public.empleado_sucursal_dia_historial
  FOR SELECT TO authenticated
  USING (
    public.user_is_global_admin()
    OR sucursal_efectiva_anterior IS NOT NULL AND sucursal_efectiva_anterior IN (SELECT public.user_sucursal_ids())
    OR sucursal_efectiva_nueva IS NOT NULL AND sucursal_efectiva_nueva IN (SELECT public.user_sucursal_ids())
    OR EXISTS (
      SELECT 1 FROM public.empleados e
      WHERE e.id = empleado_sucursal_dia_historial.empleado_id
        AND e.sucursal_id IN (SELECT public.user_sucursal_ids())
    )
  );

CREATE POLICY empleado_sucursal_dia_hist_insert_scope ON public.empleado_sucursal_dia_historial
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_is_global_admin()
    OR EXISTS (
      SELECT 1 FROM public.empleados e
      WHERE e.id = empleado_sucursal_dia_historial.empleado_id
        AND e.sucursal_id IN (SELECT public.user_sucursal_ids())
    )
  );

-- ─── 12. ausencias (si la tabla existe) ─────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.ausencias') IS NOT NULL THEN
    EXECUTE '
      ALTER TABLE public.ausencias ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS ausencias_select_scope ON public.ausencias;
      DROP POLICY IF EXISTS ausencias_insert_scope ON public.ausencias;
      DROP POLICY IF EXISTS ausencias_update_scope ON public.ausencias;
      DROP POLICY IF EXISTS ausencias_delete_scope ON public.ausencias;

      CREATE POLICY ausencias_select_scope ON public.ausencias FOR SELECT TO authenticated
        USING (
          public.user_is_global_admin()
          OR EXISTS (
            SELECT 1 FROM public.empleados e
            WHERE e.id = ausencias.empleado_id
              AND e.sucursal_id IN (SELECT public.user_sucursal_ids())
          )
        );
      CREATE POLICY ausencias_insert_scope ON public.ausencias FOR INSERT TO authenticated
        WITH CHECK (
          public.user_is_global_admin()
          OR EXISTS (
            SELECT 1 FROM public.empleados e
            WHERE e.id = ausencias.empleado_id
              AND e.sucursal_id IN (SELECT public.user_sucursal_ids())
          )
        );
      CREATE POLICY ausencias_update_scope ON public.ausencias FOR UPDATE TO authenticated
        USING (
          public.user_is_global_admin()
          OR EXISTS (
            SELECT 1 FROM public.empleados e
            WHERE e.id = ausencias.empleado_id
              AND e.sucursal_id IN (SELECT public.user_sucursal_ids())
          )
        )
        WITH CHECK (
          public.user_is_global_admin()
          OR EXISTS (
            SELECT 1 FROM public.empleados e
            WHERE e.id = ausencias.empleado_id
              AND e.sucursal_id IN (SELECT public.user_sucursal_ids())
          )
        );
      CREATE POLICY ausencias_delete_scope ON public.ausencias FOR DELETE TO authenticated
        USING (
          public.user_is_global_admin()
          OR EXISTS (
            SELECT 1 FROM public.empleados e
            WHERE e.id = ausencias.empleado_id
              AND e.sucursal_id IN (SELECT public.user_sucursal_ids())
          )
        );
    ';
  END IF;
END $$;
