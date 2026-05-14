-- Fechas opcionales de ingreso y fin de vigencia de contrato por empleada.
-- Ejecutar en Supabase → SQL Editor (o: supabase db push / apply_migration).
-- Tras el DDL, PostgREST debe recargar el esquema para que la API reconozca las columnas.

ALTER TABLE empleados
  ADD COLUMN IF NOT EXISTS fecha_ingreso DATE,
  ADD COLUMN IF NOT EXISTS fecha_contrato_hasta DATE;

-- Tipo date y opcionales (nullable); no bloquear guardado si vienen vacías.
ALTER TABLE empleados
  ALTER COLUMN fecha_ingreso TYPE DATE USING fecha_ingreso::date,
  ALTER COLUMN fecha_ingreso DROP NOT NULL,
  ALTER COLUMN fecha_contrato_hasta TYPE DATE USING fecha_contrato_hasta::date,
  ALTER COLUMN fecha_contrato_hasta DROP NOT NULL;

COMMENT ON COLUMN empleados.fecha_ingreso IS 'Fecha en que la persona comenzó a trabajar (opcional)';
COMMENT ON COLUMN empleados.fecha_contrato_hasta IS 'Hasta cuándo está vigente el contrato (opcional)';

-- Refrescar caché de esquema de PostgREST (error "column ... not found in schema cache")
NOTIFY pgrst, 'reload schema';
