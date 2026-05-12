-- Fechas opcionales de ingreso y fin de vigencia de contrato por empleada
ALTER TABLE empleados
  ADD COLUMN IF NOT EXISTS fecha_ingreso DATE,
  ADD COLUMN IF NOT EXISTS fecha_contrato_hasta DATE;

COMMENT ON COLUMN empleados.fecha_ingreso IS 'Fecha en que la persona comenzó a trabajar (opcional)';
COMMENT ON COLUMN empleados.fecha_contrato_hasta IS 'Hasta cuándo está vigente el contrato (opcional)';
