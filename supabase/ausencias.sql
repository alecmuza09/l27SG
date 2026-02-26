-- ============================================================
-- Módulo de Ausencias — Luna 27 Spa Management
-- Registra faltas, permisos, incapacidades y salidas anticipadas
-- con flujo de aprobación y trazabilidad.
-- ============================================================

-- Tabla principal de ausencias
CREATE TABLE IF NOT EXISTS ausencias (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id   UUID NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,

  -- Tipo de ausencia
  tipo          VARCHAR(30) NOT NULL CHECK (tipo IN (
    'falta',          -- Falta injustificada
    'falta_justificada', -- Falta con justificante
    'permiso',        -- Permiso personal
    'incapacidad',    -- Incapacidad médica
    'salida',         -- Salida anticipada
    'tarde'           -- Llegada tarde
  )),

  motivo        TEXT,
  fecha_inicio  DATE NOT NULL,
  fecha_fin     DATE NOT NULL,
  duracion_horas NUMERIC(5,2),  -- Horas de ausencia (útil para salidas/tardes)

  -- Flujo de aprobación
  estatus       VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estatus IN (
    'pendiente',    -- Esperando revisión
    'aprobada',     -- Aprobada por el responsable
    'rechazada',    -- Rechazada con motivo
    'cancelada'     -- Cancelada por el empleado o admin
  )),

  -- Trazabilidad de aprobación
  aprobado_por    TEXT,   -- Nombre o email del responsable que actuó
  fecha_aprobacion TIMESTAMPTZ,
  motivo_rechazo  TEXT,   -- Solo cuando estatus = 'rechazada'
  notas           TEXT,   -- Notas internas del admin

  -- Auditoría
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_ausencias_empleado ON ausencias (empleado_id);
CREATE INDEX IF NOT EXISTS idx_ausencias_fecha    ON ausencias (fecha_inicio, fecha_fin);
CREATE INDEX IF NOT EXISTS idx_ausencias_estatus  ON ausencias (estatus);
CREATE INDEX IF NOT EXISTS idx_ausencias_tipo     ON ausencias (tipo);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_ausencias_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_ausencias_updated_at ON ausencias;
CREATE TRIGGER tg_ausencias_updated_at
  BEFORE UPDATE ON ausencias
  FOR EACH ROW EXECUTE FUNCTION update_ausencias_updated_at();
