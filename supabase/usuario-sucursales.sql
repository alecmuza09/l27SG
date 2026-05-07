-- Relación muchos-a-muchos entre usuarios y sucursales
-- Ejecutar en el SQL Editor de Supabase

CREATE TABLE IF NOT EXISTS usuario_sucursales (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id   UUID NOT NULL REFERENCES usuarios(id)   ON DELETE CASCADE,
  sucursal_id  UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(usuario_id, sucursal_id)
);

CREATE INDEX IF NOT EXISTS idx_usuario_sucursales_usuario
  ON usuario_sucursales(usuario_id);

CREATE INDEX IF NOT EXISTS idx_usuario_sucursales_sucursal
  ON usuario_sucursales(sucursal_id);

-- Migrar datos existentes de la columna sucursal_id
INSERT INTO usuario_sucursales (usuario_id, sucursal_id)
SELECT id, sucursal_id
FROM usuarios
WHERE sucursal_id IS NOT NULL
ON CONFLICT (usuario_id, sucursal_id) DO NOTHING;
