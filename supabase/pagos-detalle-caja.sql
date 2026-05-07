-- ============================================
-- Migración: Agregar campos de detalle de caja a la tabla pagos
-- ============================================

ALTER TABLE pagos
  ADD COLUMN IF NOT EXISTS subtotal          DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS descuento_monto   DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS descuento_tipo    VARCHAR(50),   -- 'cupon', 'gift_card', 'manual'
  ADD COLUMN IF NOT EXISTS descuento_codigo  VARCHAR(100),  -- código de cupón o gift card
  ADD COLUMN IF NOT EXISTS propina           DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monto_efectivo    DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monto_tarjeta     DECIMAL(10,2) DEFAULT 0;

COMMENT ON COLUMN pagos.subtotal          IS 'Precio base del servicio antes de descuentos';
COMMENT ON COLUMN pagos.descuento_monto   IS 'Monto total descontado';
COMMENT ON COLUMN pagos.descuento_tipo    IS 'Tipo de descuento: cupon, gift_card, manual';
COMMENT ON COLUMN pagos.descuento_codigo  IS 'Código del cupón o gift card aplicado';
COMMENT ON COLUMN pagos.propina           IS 'Propina dada a la empleada';
COMMENT ON COLUMN pagos.monto_efectivo    IS 'Parte del pago en efectivo (pagos mixtos o solo efectivo)';
COMMENT ON COLUMN pagos.monto_tarjeta     IS 'Parte del pago en tarjeta (pagos mixtos o solo tarjeta)';
