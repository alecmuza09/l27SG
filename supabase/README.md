# Configuración de Supabase para Luna27 Spa Management

## Pasos para configurar la base de datos

### 1. Crear archivo de variables de entorno

Crea un archivo `.env.local` en la raíz del proyecto con el siguiente contenido:

```env
NEXT_PUBLIC_SUPABASE_URL=https://wrmabtdjtlefnxvdtxww.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_ir3wugq_Hsr0aT5J2IfvAQ_0p40ypQ-
SUPABASE_SERVICE_ROLE_KEY=sb_secret_a_0wSqFUGNFasapbTYjkMw_lhyYWwhs
```

### 2. Ejecutar el script SQL

1. Ve a tu proyecto en Supabase Dashboard: https://supabase.com/dashboard/project/wrmabtdjtlefnxvdtxww
2. Navega a **SQL Editor**
3. Crea un nuevo query
4. Copia y pega el contenido completo del archivo `supabase/schema.sql`
5. Ejecuta el script

### 3. Verificar las tablas creadas

Después de ejecutar el script, deberías ver las siguientes tablas en el **Table Editor**:

- ✅ `sucursales`
- ✅ `usuarios`
- ✅ `empleados`
- ✅ `clientes`
- ✅ `servicios`
- ✅ `citas`
- ✅ `pagos`
- ✅ `inventario_productos`
- ✅ `inventario_movimientos`
- ✅ `promociones`
- ✅ `gift_cards`
- ✅ `gift_card_transacciones`
- ✅ `vacaciones`
- ✅ `saldo_vacaciones`
- ✅ `periodos_bloqueados`

### 4. Configurar Row Level Security (RLS)

Por seguridad, deberás configurar políticas RLS en Supabase. Por ahora, el script crea las tablas sin RLS habilitado. Puedes habilitarlo después según tus necesidades de seguridad.

### 5. Usar el cliente de Supabase en la aplicación

El cliente ya está configurado en:
- `lib/supabase/client.ts` - Para uso en componentes del cliente
- `lib/supabase/server.ts` - Para uso en server components y API routes

Ejemplo de uso:

```typescript
import { supabase } from '@/lib/supabase/client'

// Obtener todas las sucursales
const { data, error } = await supabase
  .from('sucursales')
  .select('*')
  .eq('activa', true)
```

## Estructura de la base de datos

### Tablas principales

1. **sucursales**: Información de las sucursales del spa
2. **usuarios**: Usuarios del sistema (admin, manager, staff)
3. **empleados**: Empleados del spa (terapeutas, esteticistas, etc.)
4. **clientes**: Clientes del spa
5. **servicios**: Servicios ofrecidos
6. **citas**: Citas/reservaciones
7. **pagos**: Pagos realizados
8. **inventario_productos**: Productos del inventario
9. **inventario_movimientos**: Movimientos de inventario
10. **promociones**: Promociones y descuentos
11. **gift_cards**: Tarjetas de regalo
12. **gift_card_transacciones**: Transacciones de gift cards
13. **vacaciones**: Solicitudes de vacaciones
14. **saldo_vacaciones**: Saldo de vacaciones por empleado
15. **periodos_bloqueados**: Períodos bloqueados para citas

### Características

- ✅ Índices optimizados para búsquedas rápidas
- ✅ Triggers automáticos para `updated_at`
- ✅ Triggers para actualizar estadísticas de clientes
- ✅ Triggers para actualizar stock de inventario
- ✅ Validaciones de datos con CHECK constraints
- ✅ Foreign keys para integridad referencial

## Próximos pasos

1. Configurar autenticación con Supabase Auth
2. Implementar Row Level Security (RLS)
3. Crear funciones de migración de datos desde los mocks
4. Configurar backups automáticos





