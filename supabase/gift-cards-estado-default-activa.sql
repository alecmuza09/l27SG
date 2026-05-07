-- Las nuevas gift cards quedan activas por defecto (la app también envía estado en INSERT).
ALTER TABLE gift_cards ALTER COLUMN estado SET DEFAULT 'activa';
