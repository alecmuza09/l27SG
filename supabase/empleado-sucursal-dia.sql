-- ============================================================
-- Asignación de sucursal por empleado y día + historial + RLS
-- Ejecutar en Supabase SQL Editor (proyectos ya existentes).
-- ============================================================

CREATE TABLE IF NOT EXISTS empleado_sucursal_dia (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empleado_id UUID NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  sucursal_id UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  created_by UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (empleado_id, fecha)
);

CREATE TABLE IF NOT EXISTS empleado_sucursal_dia_historial (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empleado_id UUID NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  sucursal_efectiva_anterior UUID REFERENCES sucursales(id) ON DELETE SET NULL,
  sucursal_efectiva_nueva UUID REFERENCES sucursales(id) ON DELETE SET NULL,
  accion VARCHAR(20) NOT NULL CHECK (accion IN ('asignar', 'cambiar', 'quitar')),
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_empleado_sucursal_dia_fecha ON empleado_sucursal_dia (fecha);
CREATE INDEX IF NOT EXISTS idx_empleado_sucursal_dia_empleado_fecha ON empleado_sucursal_dia (empleado_id, fecha);
CREATE INDEX IF NOT EXISTS idx_empleado_sucursal_dia_sucursal_fecha ON empleado_sucursal_dia (sucursal_id, fecha);
CREATE INDEX IF NOT EXISTS idx_empleado_sucursal_dia_hist_empleado ON empleado_sucursal_dia_historial (empleado_id);
CREATE INDEX IF NOT EXISTS idx_empleado_sucursal_dia_hist_fecha ON empleado_sucursal_dia_historial (fecha DESC);

COMMENT ON TABLE empleado_sucursal_dia IS 'Asignación de sucursal por empleado y fecha (temporal)';
COMMENT ON TABLE empleado_sucursal_dia_historial IS 'Historial de cambios de sucursal efectiva por día';

ALTER TABLE empleado_sucursal_dia ENABLE ROW LEVEL SECURITY;
ALTER TABLE empleado_sucursal_dia_historial ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS empleado_sucursal_dia_select_auth ON empleado_sucursal_dia;
DROP POLICY IF EXISTS empleado_sucursal_dia_insert_auth ON empleado_sucursal_dia;
DROP POLICY IF EXISTS empleado_sucursal_dia_update_auth ON empleado_sucursal_dia;
DROP POLICY IF EXISTS empleado_sucursal_dia_delete_auth ON empleado_sucursal_dia;

CREATE POLICY empleado_sucursal_dia_select_auth ON empleado_sucursal_dia FOR SELECT TO authenticated USING (true);
CREATE POLICY empleado_sucursal_dia_insert_auth ON empleado_sucursal_dia FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY empleado_sucursal_dia_update_auth ON empleado_sucursal_dia FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY empleado_sucursal_dia_delete_auth ON empleado_sucursal_dia FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS empleado_sucursal_dia_hist_select_auth ON empleado_sucursal_dia_historial;
DROP POLICY IF EXISTS empleado_sucursal_dia_hist_insert_auth ON empleado_sucursal_dia_historial;

CREATE POLICY empleado_sucursal_dia_hist_select_auth ON empleado_sucursal_dia_historial FOR SELECT TO authenticated USING (true);
CREATE POLICY empleado_sucursal_dia_hist_insert_auth ON empleado_sucursal_dia_historial FOR INSERT TO authenticated WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON empleado_sucursal_dia TO authenticated;
GRANT SELECT, INSERT ON empleado_sucursal_dia_historial TO authenticated;

DROP TRIGGER IF EXISTS update_empleado_sucursal_dia_updated_at ON empleado_sucursal_dia;
CREATE TRIGGER update_empleado_sucursal_dia_updated_at
  BEFORE UPDATE ON empleado_sucursal_dia
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
