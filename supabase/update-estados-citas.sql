-- Script para actualizar los estados permitidos en la tabla citas
-- Ejecutar este script en el SQL Editor de Supabase

-- Primero, eliminar la constraint existente
ALTER TABLE citas DROP CONSTRAINT IF EXISTS citas_estado_check;

-- Agregar la nueva constraint con todos los estados solicitados
ALTER TABLE citas ADD CONSTRAINT citas_estado_check 
  CHECK (estado IN (
    'pendiente', 
    'confirmada', 
    'en-progreso', 
    'completada', 
    'cancelada', 
    'no-asistio',
    'en-espera',
    'en-atencion',
    'pendiente-por-pagar',
    'pagado'
  ));

-- Nota: Los estados 'en-espera' y 'en-atencion' se mapean a 'en-progreso' en el código
-- Los estados 'pendiente-por-pagar' y 'pagado' se mapean a 'completada' en el código
-- Si prefieres usar los estados directamente sin mapeo, ejecuta este script
