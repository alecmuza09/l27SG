-- ============================================
-- Actualizar horarios de todas las sucursales y empleados
-- a 10:00 - 20:00
-- ============================================

-- 1. Actualizar el campo de texto "horario" de todas las sucursales activas
UPDATE sucursales
SET horario = 'Lun-Sab: 10:00 - 20:00',
    updated_at = NOW()
WHERE activa = true;

-- 2. Ajustar horario_inicio de empleados que empezaban a las 09:00
UPDATE empleados
SET horario_inicio = '10:00',
    updated_at = NOW()
WHERE horario_inicio < '10:00';

-- 3. Ajustar horario_fin de empleados que terminaban antes de las 20:00
UPDATE empleados
SET horario_fin = '20:00',
    updated_at = NOW()
WHERE horario_fin < '20:00';
