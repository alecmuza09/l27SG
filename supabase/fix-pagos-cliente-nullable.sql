-- Ventas sin cita (p. ej. emisión de gift card sin cliente ligado) pueden tener cliente_id NULL
ALTER TABLE pagos ALTER COLUMN cliente_id DROP NOT NULL;
