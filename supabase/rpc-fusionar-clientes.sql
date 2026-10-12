-- Fusión de clientes duplicados (admin global).
-- Ejecutar en Supabase SQL Editor o apply_migration antes de usar la UI.

CREATE TABLE IF NOT EXISTS public.clientes_fusiones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keep_id uuid NOT NULL,
  drop_id uuid NOT NULL,
  usuario_id uuid,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clientes_fusiones_keep ON public.clientes_fusiones (keep_id);
CREATE INDEX IF NOT EXISTS idx_clientes_fusiones_created ON public.clientes_fusiones (created_at DESC);

ALTER TABLE public.clientes_fusiones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clientes_fusiones_select_admin ON public.clientes_fusiones;
CREATE POLICY clientes_fusiones_select_admin ON public.clientes_fusiones
  FOR SELECT TO authenticated
  USING (public.user_is_global_admin());

COMMENT ON TABLE public.clientes_fusiones IS 'Auditoría de fusiones de clientes (sin deshacer automático)';

CREATE OR REPLACE FUNCTION public.recalcular_estadisticas_cliente(p_cliente_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_visitas int;
  v_gastado numeric;
  v_ultima date;
BEGIN
  SELECT
    COUNT(*)::int,
    COALESCE(SUM(precio), 0),
    MAX(fecha)::date
  INTO v_visitas, v_gastado, v_ultima
  FROM citas
  WHERE cliente_id = p_cliente_id
    AND estado = 'completada';

  UPDATE clientes
  SET
    total_visitas = COALESCE(v_visitas, 0),
    total_gastado = COALESCE(v_gastado, 0),
    ultima_visita = v_ultima,
    puntos_fidelidad = FLOOR(COALESCE(v_gastado, 0) / 10)::int,
    updated_at = NOW()
  WHERE id = p_cliente_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.preview_fusion_clientes(p_keep uuid, p_drop uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  k clientes%ROWTYPE;
  d clientes%ROWTYPE;
  n_citas int;
  n_pagos int;
  n_gift int;
BEGIN
  IF NOT public.user_is_global_admin() THEN
    RAISE EXCEPTION 'Solo administradores globales pueden previsualizar fusiones';
  END IF;

  IF p_keep IS NULL OR p_drop IS NULL OR p_keep = p_drop THEN
    RAISE EXCEPTION 'Debes indicar dos clientes distintos';
  END IF;

  SELECT * INTO k FROM clientes WHERE id = p_keep;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente a conservar no encontrado';
  END IF;

  SELECT * INTO d FROM clientes WHERE id = p_drop;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente a absorber no encontrado';
  END IF;

  SELECT COUNT(*)::int INTO n_citas FROM citas WHERE cliente_id = p_drop;
  SELECT COUNT(*)::int INTO n_pagos FROM pagos WHERE cliente_id = p_drop;
  SELECT COUNT(*)::int INTO n_gift FROM gift_cards WHERE cliente_id = p_drop;

  RETURN jsonb_build_object(
    'keep', jsonb_build_object(
      'id', k.id,
      'nombre', k.nombre,
      'apellido', k.apellido,
      'telefono', k.telefono,
      'email', k.email,
      'total_visitas', k.total_visitas,
      'total_gastado', k.total_gastado
    ),
    'drop', jsonb_build_object(
      'id', d.id,
      'nombre', d.nombre,
      'apellido', d.apellido,
      'telefono', d.telefono,
      'email', d.email,
      'total_visitas', d.total_visitas,
      'total_gastado', d.total_gastado
    ),
    'mover', jsonb_build_object(
      'citas', n_citas,
      'pagos', n_pagos,
      'gift_cards', n_gift
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.fusionar_clientes(p_keep uuid, p_drop uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  k clientes%ROWTYPE;
  d clientes%ROWTYPE;
  snap jsonb;
  merged_notas text;
  merged_estado text;
BEGIN
  IF NOT public.user_is_global_admin() THEN
    RAISE EXCEPTION 'Solo administradores globales pueden fusionar clientes';
  END IF;

  IF p_keep IS NULL OR p_drop IS NULL OR p_keep = p_drop THEN
    RAISE EXCEPTION 'Debes indicar dos clientes distintos';
  END IF;

  SELECT * INTO k FROM clientes WHERE id = p_keep FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente a conservar no encontrado';
  END IF;

  SELECT * INTO d FROM clientes WHERE id = p_drop FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente a absorber no encontrado';
  END IF;

  snap := public.preview_fusion_clientes(p_keep, p_drop);

  UPDATE citas SET cliente_id = p_keep, updated_at = NOW() WHERE cliente_id = p_drop;
  UPDATE pagos SET cliente_id = p_keep, updated_at = NOW() WHERE cliente_id = p_drop;
  UPDATE gift_cards SET cliente_id = p_keep, updated_at = NOW() WHERE cliente_id = p_drop;

  merged_estado := k.estado;
  IF d.estado = 'vip' OR k.estado = 'vip' THEN
    merged_estado := 'vip';
  ELSIF d.estado = 'activo' OR k.estado = 'activo' THEN
    merged_estado := 'activo';
  ELSE
    merged_estado := COALESCE(k.estado, 'inactivo');
  END IF;

  merged_notas := NULLIF(TRIM(COALESCE(k.notas, '')), '');
  IF d.notas IS NOT NULL AND TRIM(d.notas) <> '' THEN
    merged_notas := COALESCE(merged_notas || E'\n\n', '') ||
      '[Fusionado ' || to_char(NOW(), 'YYYY-MM-DD') || ' desde ' || d.nombre || ' ' || d.apellido || ' (' || d.id::text || ')]' ||
      E'\n' || TRIM(d.notas);
  END IF;

  UPDATE clientes
  SET
    email = COALESCE(NULLIF(TRIM(k.email), ''), NULLIF(TRIM(d.email), '')),
    fecha_registro = LEAST(k.fecha_registro, d.fecha_registro),
    fecha_nacimiento = COALESCE(k.fecha_nacimiento, d.fecha_nacimiento),
    genero = COALESCE(k.genero, d.genero),
    direccion = COALESCE(NULLIF(TRIM(k.direccion), ''), NULLIF(TRIM(d.direccion), '')),
    ciudad = COALESCE(NULLIF(TRIM(k.ciudad), ''), NULLIF(TRIM(d.ciudad), '')),
    notas = merged_notas,
    preferencias = (
      SELECT ARRAY(
        SELECT DISTINCT unnest(
          COALESCE(k.preferencias, ARRAY[]::text[]) || COALESCE(d.preferencias, ARRAY[]::text[])
        )
      )
    ),
    alergias = (
      SELECT ARRAY(
        SELECT DISTINCT unnest(
          COALESCE(k.alergias, ARRAY[]::text[]) || COALESCE(d.alergias, ARRAY[]::text[])
        )
      )
    ),
    sucursal_preferida = COALESCE(k.sucursal_preferida, d.sucursal_preferida),
    estado = merged_estado,
    embajadora = COALESCE(k.embajadora, false) OR COALESCE(d.embajadora, false),
    es_vetado = COALESCE(k.es_vetado, false) OR COALESCE(d.es_vetado, false),
    es_problematico = COALESCE(k.es_problematico, false) OR COALESCE(d.es_problematico, false),
    es_descuento = COALESCE(k.es_descuento, false) OR COALESCE(d.es_descuento, false),
    updated_at = NOW()
  WHERE id = p_keep;

  PERFORM public.recalcular_estadisticas_cliente(p_keep);

  INSERT INTO public.clientes_fusiones (keep_id, drop_id, usuario_id, snapshot)
  VALUES (p_keep, p_drop, auth.uid(), snap);

  DELETE FROM clientes WHERE id = p_drop;

  RETURN jsonb_build_object('success', true, 'keep_id', p_keep, 'drop_id', p_drop);
END;
$$;

COMMENT ON FUNCTION public.recalcular_estadisticas_cliente(uuid) IS 'Recalcula total_visitas/gastado/puntos desde citas completadas';
COMMENT ON FUNCTION public.preview_fusion_clientes(uuid, uuid) IS 'Vista previa de fusión (solo admin global)';
COMMENT ON FUNCTION public.fusionar_clientes(uuid, uuid) IS 'Fusiona p_drop en p_keep y elimina p_drop (solo admin global)';

GRANT EXECUTE ON FUNCTION public.recalcular_estadisticas_cliente(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_fusion_clientes(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fusionar_clientes(uuid, uuid) TO authenticated;
