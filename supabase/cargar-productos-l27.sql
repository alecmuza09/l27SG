-- ============================================================
-- Carga masiva de productos Luna27 en todas las sucursales
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================
-- SKU único: L27-{id_producto}-S{numero_sucursal}
-- El número de sucursal se asigna por orden alfabético (1,2,3,4...)

WITH sucursales_numeradas AS (
  SELECT id, nombre, ROW_NUMBER() OVER (ORDER BY nombre) AS n
  FROM sucursales
  WHERE activa = true
),
productos AS (
  SELECT * FROM (VALUES
    ('007',  'CREMA',                                           200.00, 15, 'GEL'),
    ('008',  'Crema Spa Luna Granada',                          199.00, 15, 'SERVICIO LUNA27'),
    ('009',  'Crema Spa Luna Melón pepino',                     199.00, 15, 'SERVICIO LUNA27'),
    ('011',  'Crema Melón/pepino',                              100.00,  5, 'SERVICIO LUNA27'),
    ('012',  'Crema Chocolate',                                 100.00,  5, 'SERVICIO LUNA27'),
    ('013',  'Crema Mandarina',                                 100.00,  5, 'SERVICIO LUNA27'),
    ('014',  'Crema Menta',                                     100.00,  5, 'SERVICIO LUNA27'),
    ('015',  'Crema Granada',                                   100.00,  5, 'SERVICIO LUNA27'),
    ('016',  'Crema Piña',                                      100.00,  5, 'SERVICIO LUNA27'),
    ('017',  'Crema Lavanda',                                   100.00,  5, 'SERVICIO LUNA27'),
    ('018',  'Crema Lima Limón',                                100.00,  5, 'SERVICIO LUNA27'),
    ('019',  'Exfoliante Melón/pepino',                         100.00,  5, 'SERVICIO LUNA27'),
    ('020',  'Exfoliante Chocolate',                            100.00,  5, 'SERVICIO LUNA27'),
    ('021',  'Exfoliante Mandarina',                            100.00,  5, 'SERVICIO LUNA27'),
    ('022',  'Exfoliante Menta',                                100.00,  5, 'SERVICIO LUNA27'),
    ('023',  'Exfoliante Granada',                              100.00,  5, 'SERVICIO LUNA27'),
    ('024',  'Exfoliante Piña',                                 100.00,  5, 'SERVICIO LUNA27'),
    ('025',  'Exfoliante Lavanda',                              100.00,  5, 'SERVICIO LUNA27'),
    ('026',  'Exfoliante Lima Limón',                           100.00,  5, 'SERVICIO LUNA27'),
    ('027',  'Calcio',                                          199.00,  5, 'SERVICIO LUNA27'),
    ('028',  'Aloe Esmalte',                                    199.00,  5, 'SERVICIO LUNA27'),
    ('029',  'NAIL REPAIR',                                     199.00,  5, 'SERVICIO LUNA27'),
    ('030',  'Aceite cutícula brocha 12ml',                     125.00,  5, 'SERVICIO LUNA27'),
    ('031',  'VITE 20 BRUSH',                                   399.00,  5, 'SERVICIO LUNA27'),
    ('032',  'VITÉ 20/20ML',                                    425.00,  5, 'SERVICIO LUNA27'),
    ('033',  'PANTUFLAS - PRECIO OFERTA',                        85.00,  0, 'SERVICIO LUNA27'),
    ('034',  'SANDALIAS',                                        85.00,  0, 'SERVICIO LUNA27'),
    ('035',  'Crema Spa Mandarina',                             199.00, 15, 'SERVICIO LUNA27'),
    ('036',  'Crema Spa Granada',                               199.00, 15, 'SERVICIO LUNA27'),
    ('037',  'Crema Spa Lima Limón',                            199.00, 15, 'SERVICIO LUNA27'),
    ('038',  'Crema Spa Lavanda',                               199.00, 15, 'SERVICIO LUNA27'),
    ('039',  'Crema Spa Menta',                                 199.00, 15, 'SERVICIO LUNA27'),
    ('040',  'Crema Spa Piña',                                  199.00, 15, 'SERVICIO LUNA27'),
    ('041',  'Crema Spa Chocolate',                             199.00, 15, 'SERVICIO LUNA27'),
    ('042',  'Bath Boom',                                        50.00, 30, 'SERVICIO LUNA27'),
    ('043',  'Mascarilla p/pies Barielle',                      136.00,  5, 'SERVICIO LUNA27'),
    ('044',  'Certificado Mom Paq #1 (MANI+GEL)',               350.00,  0, 'SERVICIO LUNA27'),
    ('045',  'Certificado Mom Paq #2 (MANI + PEDI SPA)',        699.00,  0, 'SERVICIO LUNA27'),
    ('046',  'Certificado Paq Mom #3 (MANI+DISEÑO SENC.)',      499.00,  0, 'SERVICIO LUNA27'),
    ('047',  'Jabón SPA Luna 27',                                99.00, 15, 'SERVICIO LUNA27'),
    ('048',  'Sanitizante Luna27',                               99.00, 15, 'SERVICIO LUNA27'),
    ('049',  'Esmalte Normal Luna 27',                          135.00,  5, 'GEL'),
    ('050',  'CERTIFICADO DE GEL',                              220.00,  0, 'SERVICIO LUNA27'),
    ('051',  'Mascarilla Satin Smooth',                         136.00,  0, 'PROMOS'),
    ('052',  'VIP PASS MANI CLÁSICO',                          2399.00,  0, 'SERVICIO LUNA27'),
    ('053',  'VIP PASS PEDI CLÁSICO',                          3399.00,  0, 'SERVICIO LUNA27'),
    ('054',  'VIP PASS GEL',                                   1699.00,  0, 'SERVICIO LUNA27'),
    ('055',  'GIFT MERRY CHRISTMAS CLÁSICO',                    599.00,  0, 'SERVICIO LUNA27'),
    ('056',  'GIFT MERRY CHRISTMAS SPA',                        699.00,  0, 'SERVICIO LUNA27'),
    ('057',  'GIFT CARD MERRY CHRISTMAS LUNA TERAPÉUTICO',      859.00,  0, 'SERVICIO LUNA27'),
    ('058',  'GIFT CARD MERRY CHRISTMAS VIP',                  1049.00,  0, 'SERVICIO LUNA27'),
    ('059',  'Gel Antibacterial con dispensador 240ml',          99.00,  0, 'SERVICIO LUNA27'),
    ('060',  'FLASH ONLINE Crema 240ml (aroma a elegir)',        149.00,  5, 'PROMOS'),
    ('061',  'Aceite cutícula gotero 15ml',                     159.00,  5, 'SERVICIO LUNA27'),
    ('062',  'Paquete Deluxe Mom',                             1099.00,  0, 'SERVICIO LUNA27'),
    ('063',  'Mani Spa + Gel MOM',                              450.00,  0, 'SERVICIO LUNA27'),
    ('064',  'Crema SPA Té Verde',                              199.00, 15, 'SERVICIO LUNA27'),
    ('065',  'Exfoliante Té Verde 100ml',                       100.00, 15, 'SERVICIO LUNA27'),
    ('066',  'Crema Té Verde 100ml',                            100.00, 15, 'SERVICIO LUNA27'),
    ('067',  'CREMA LOYALTY 100ML',                               0.00,  0, 'PROMOS'),
    ('068',  'Certificado Gel',                                 220.00,  0, 'SERVICIO LUNA27'),
    ('069',  'Certificado Pedi Clásico',                        420.00,  0, 'SERVICIO LUNA27'),
    ('070',  'Certificado Pedi Spa',                            499.00, 30, 'SERVICIO LUNA27'),
    ('071',  'Certificado Pedi Luna',                           599.00,  0, 'SERVICIO LUNA27'),
    ('072',  'Certificado Pedi Podológico',                     679.00,  0, 'SERVICIO LUNA27'),
    ('073',  'Certificado Mani Clásico',                        299.00,  0, 'SERVICIO LUNA27'),
    ('074',  'Certificado Mani Spa',                            349.00,  0, 'SERVICIO LUNA27'),
    ('075',  'Certificado Mani Luna',                           420.00,  0, 'SERVICIO LUNA27'),
    ('076',  'Certificado Mani Vip',                            565.00,  0, 'SERVICIO LUNA27'),
    ('077',  'Certificado Pedi Vip',                            699.00,  0, 'SERVICIO LUNA27'),
    ('078',  'Certificado 2 Gel',                               440.00,  0, 'SERVICIO LUNA27'),
    ('079',  'Certificado Mother Days Mani + Pedi Spa',         679.00,  0, 'PROMOS')
  ) AS t(prod_id, nombre, precio, stock, categoria_orig)
)
INSERT INTO inventario_productos (
  nombre, descripcion, categoria, sku,
  stock_actual, stock_minimo, precio_compra, precio_venta,
  unidad_medida, sucursal_id, activo
)
SELECT
  p.nombre,
  p.categoria_orig                                      AS descripcion,
  'productos'                                           AS categoria,
  'L27-' || p.prod_id || '-S' || sn.n                  AS sku,
  p.stock                                               AS stock_actual,
  CASE WHEN p.stock > 0 THEN 3 ELSE 0 END              AS stock_minimo,
  p.precio                                              AS precio_compra,
  p.precio                                              AS precio_venta,
  'unidad'                                              AS unidad_medida,
  sn.id                                                 AS sucursal_id,
  true                                                  AS activo
FROM productos p
CROSS JOIN sucursales_numeradas sn
ON CONFLICT (sku) DO UPDATE SET
  precio_venta  = EXCLUDED.precio_venta,
  precio_compra = EXCLUDED.precio_compra,
  stock_actual  = EXCLUDED.stock_actual,
  nombre        = EXCLUDED.nombre;

-- Verificar resultado
SELECT COUNT(*) AS total_productos_cargados FROM inventario_productos WHERE sku LIKE 'L27-%';
