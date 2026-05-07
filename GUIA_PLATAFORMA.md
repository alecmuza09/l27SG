# 📘 Guía Detallada de la Plataforma Luna27 Spa Management

## 🎯 Descripción General

**Luna27 Spa Management** es un sistema completo de gestión desarrollado específicamente para la administración integral de un spa. La plataforma permite gestionar clientes, citas, empleados, servicios, inventario, pagos, promociones, gift cards, vacaciones y reportes, todo desde una interfaz web moderna y responsiva.

---

## 🏗️ Arquitectura del Sistema

### Stack Tecnológico

- **Framework**: Next.js 15.5.9 (App Router)
- **UI**: React 19.1.0
- **Lenguaje**: TypeScript 5
- **Base de Datos**: Supabase (PostgreSQL)
- **Estilos**: Tailwind CSS 4.1.9
- **Componentes UI**: Radix UI
- **Validación**: Zod + React Hook Form
- **Notificaciones**: Sonner
- **Gráficos**: Recharts
- **Fechas**: date-fns
- **Iconos**: Lucide React
- **Gestor de Paquetes**: pnpm

### Estructura del Proyecto

```
├── app/                    # Aplicación Next.js (App Router)
│   ├── api/               # API Routes (autenticación, usuarios)
│   ├── dashboard/         # Páginas del dashboard
│   │   ├── citas/        # Gestión de citas
│   │   ├── clientes/     # Gestión de clientes
│   │   ├── empleados/    # Gestión de empleados
│   │   ├── servicios/    # Catálogo de servicios
│   │   ├── inventario/   # Control de inventario
│   │   ├── pagos/        # Registro de pagos
│   │   ├── gift-cards/   # Tarjetas de regalo
│   │   ├── promociones/  # Promociones y descuentos
│   │   ├── vacaciones/   # Gestión de vacaciones
│   │   ├── reportes/     # Reportes y análisis
│   │   ├── sucursales/   # Gestión de sucursales
│   │   └── configuracion/ # Configuración del sistema
│   ├── layout.tsx        # Layout principal
│   └── page.tsx          # Página de inicio/login
│
├── components/            # Componentes React
│   ├── auth/             # Componentes de autenticación
│   ├── citas/            # Componentes de citas (calendario, kanban, etc.)
│   ├── dashboard/        # Componentes del dashboard
│   ├── layout/           # Header, sidebar, navegación
│   ├── punto-venta/      # Componentes de punto de venta
│   ├── sucursales/       # Selector de sucursales
│   └── ui/               # Componentes UI reutilizables (57 componentes)
│
├── lib/                   # Lógica de negocio y utilidades
│   ├── auth.ts           # Sistema de autenticación
│   ├── data/             # Funciones CRUD por módulo
│   │   ├── clientes.ts
│   │   ├── citas.ts
│   │   ├── empleados.ts
│   │   ├── servicios.ts
│   │   ├── pagos.ts
│   │   ├── inventario.ts
│   │   ├── promociones.ts
│   │   ├── gift-cards.ts
│   │   ├── vacaciones.ts
│   │   ├── sucursales.ts
│   │   ├── usuarios.ts
│   │   └── dashboard.ts
│   ├── supabase/         # Configuración de Supabase
│   │   ├── client.ts     # Cliente de Supabase (cliente)
│   │   ├── server.ts     # Cliente de Supabase (servidor)
│   │   ├── types.ts      # Tipos TypeScript generados
│   │   └── examples.ts   # Ejemplos de uso
│   └── utils.ts          # Utilidades generales
│
├── scripts/               # Scripts de utilidad
│   ├── crear-usuario-admin.ts    # Crear usuario administrador
│   ├── import-clientes.ts        # Importación masiva de clientes
│   ├── import-empleados.ts       # Importación de empleados
│   ├── import-servicios.ts       # Importación de servicios
│   └── verificar-*.ts            # Scripts de verificación
│
├── supabase/              # Configuración de base de datos
│   ├── schema.sql        # Esquema completo de la BD
│   └── README.md         # Instrucciones de configuración
│
└── public/                # Archivos estáticos
```

---

## 🔐 Sistema de Autenticación y Roles

### Roles de Usuario

El sistema implementa un sistema jerárquico de roles con tres niveles:

1. **Admin** (Nivel 3)
   - Acceso completo a todas las funcionalidades
   - Puede gestionar todas las sucursales
   - Puede crear y gestionar usuarios
   - Acceso a todos los reportes y configuraciones

2. **Manager** (Nivel 2)
   - Acceso a la sucursal asignada
   - Puede gestionar empleados, clientes y citas de su sucursal
   - Acceso a reportes de su sucursal
   - No puede crear usuarios ni cambiar configuraciones globales

3. **Staff** (Nivel 1)
   - Acceso limitado a funciones operativas
   - Puede ver y gestionar citas
   - Puede registrar pagos
   - Acceso limitado a reportes

### Autenticación

- **Método**: Supabase Auth + cookies HTTP-only
- **Sesión**: 7 días de duración
- **Seguridad**: 
  - Cookies HTTP-only para prevenir XSS
  - Validación en cliente y servidor
  - Service Role Key solo en servidor

### Flujo de Autenticación

1. Usuario ingresa email y contraseña
2. Sistema valida credenciales con Supabase Auth
3. Se obtiene información del usuario de la tabla `usuarios`
4. Se crea cookie de sesión con información del usuario
5. Se almacena token de Supabase Auth
6. Usuario es redirigido al dashboard según su rol

---

## 📊 Módulos Principales

### 1. Dashboard

**Ubicación**: `/dashboard`

**Funcionalidades**:
- **Métricas en tiempo real**:
  - Citas del día
  - Clientes activos
  - Ingresos del día
  - Ocupación (%)
  
- **Visualizaciones**:
  - Gráfico de productividad por sucursales
  - Top 10 empleados más productivos
  - Estado de citas (completadas, en progreso, pendientes, canceladas)
  - Resumen de sucursales (solo admin)
  - Próximas citas
  - Servicios más populares

- **Filtros**:
  - Selector de sucursal (solo admin)
  - Los managers/staff ven automáticamente su sucursal

### 2. Gestión de Clientes

**Ubicación**: `/dashboard/clientes`

**Funcionalidades**:
- **CRUD completo** de clientes
- **Búsqueda avanzada** por nombre, teléfono, email
- **Filtros** por estado (activo, inactivo, VIP)
- **Estadísticas del cliente**:
  - Total de visitas
  - Total gastado
  - Puntos de fidelidad
  - Última visita
  - Sucursal preferida

**Campos del Cliente**:
- Información básica (nombre, apellido, email, teléfono)
- Datos demográficos (fecha de nacimiento, género)
- Dirección y ciudad
- Preferencias y alergias (arrays)
- Notas y observaciones
- Estado (activo, inactivo, VIP)

**Importación Masiva**:
- Script para importar desde CSV
- Validación y limpieza automática
- Detección de duplicados
- Inserción en lotes de 1000 registros

### 3. Sistema de Citas

**Ubicación**: `/dashboard/citas`

**Funcionalidades**:
- **Múltiples vistas**:
  - Vista de calendario mensual
  - Vista de día
  - Vista Kanban (por estado)
  
- **Gestión de citas**:
  - Crear nueva cita
  - Editar cita existente
  - Cambiar estado de cita
  - Cancelar cita
  - Marcar como completada
  
- **Estados de cita**:
  - `pendiente`: Cita creada pero no confirmada
  - `confirmada`: Cita confirmada con el cliente
  - `en-progreso`: Cita en curso
  - `completada`: Cita finalizada exitosamente
  - `cancelada`: Cita cancelada
  - `no-asistio`: Cliente no se presentó

**Información de la Cita**:
- Cliente
- Empleado asignado
- Servicio
- Sucursal
- Fecha y hora (inicio y fin)
- Duración
- Precio
- Estado
- Método de pago
- Notas

**Validaciones**:
- Verificación de disponibilidad del empleado
- Validación de horarios de trabajo
- Prevención de solapamientos
- Verificación de horarios de sucursal

### 4. Gestión de Empleados

**Ubicación**: `/dashboard/empleados`

**Funcionalidades**:
- **CRUD completo** de empleados
- **Roles de empleado**:
  - `terapeuta`: Terapeutas de masajes
  - `esteticista`: Esteticistas
  - `recepcionista`: Personal de recepción
  - `manager`: Gerentes de sucursal

**Información del Empleado**:
- Datos personales (nombre, apellido, email, teléfono)
- Rol y especialidades (array)
- Sucursal asignada
- Horario de trabajo (inicio y fin)
- Días de trabajo (array de números 0-6)
- Comisión (%)
- Foto
- Estado (activo/inactivo)

**Gestión de Horarios**:
- Configuración de horarios por empleado
- Días de trabajo configurables
- Validación de disponibilidad para citas

### 5. Catálogo de Servicios

**Ubicación**: `/dashboard/servicios`

**Funcionalidades**:
- **CRUD completo** de servicios
- **Categorización** de servicios
- **Configuración**:
  - Nombre y descripción
  - Duración (en minutos)
  - Precio
  - Categoría
  - Color (para visualización en calendario)
  - Estado (activo/inactivo)

**Uso en Citas**:
- Los servicios se seleccionan al crear citas
- El precio y duración se asignan automáticamente
- Los servicios pueden estar asociados a promociones

### 6. Control de Inventario

**Ubicación**: `/dashboard/inventario`

**Funcionalidades**:
- **Gestión de productos**:
  - Productos, insumos, equipamiento, limpieza
  - SKU único
  - Stock actual, mínimo y máximo
  - Precio de compra y venta
  - Proveedor
  - Ubicación en sucursal
  - Fecha de vencimiento
  
- **Movimientos de inventario**:
  - Entradas (compras, recepciones)
  - Salidas (uso, ventas)
  - Ajustes (inventarios físicos)
  - Transferencias entre sucursales
  
- **Alertas**:
  - Stock bajo (cuando stock < stock mínimo)
  - Productos próximos a vencer
  - Productos sin movimiento

**Categorías**:
- `productos`: Productos para venta
- `insumos`: Materiales de consumo
- `equipamiento`: Equipos y herramientas
- `limpieza`: Productos de limpieza

### 7. Gestión de Pagos

**Ubicación**: `/dashboard/pagos`

**Funcionalidades**:
- **Registro de pagos**:
  - Pagos asociados a citas
  - Pagos independientes (venta directa)
  - Múltiples servicios en un pago
  
- **Métodos de pago**:
  - `efectivo`: Pago en efectivo
  - `tarjeta`: Pago con tarjeta
  - `transferencia`: Transferencia bancaria
  - `otro`: Otros métodos
  
- **Estados de pago**:
  - `pendiente`: Pago registrado pero no completado
  - `completado`: Pago completado
  - `reembolsado`: Pago reembolsado
  - `cancelado`: Pago cancelado

**Información del Pago**:
- Cliente
- Empleado
- Sucursal
- Monto
- Método de pago
- Fecha y hora
- Servicios incluidos
- Referencia (número de transacción)
- Notas

### 8. Gift Cards (Tarjetas de Regalo)

**Ubicación**: `/dashboard/gift-cards`

**Funcionalidades**:
- **Gestión de gift cards**:
  - Emisión de nuevas tarjetas
  - Activación
  - Canje/uso
  - Recarga
  - Cancelación
  
- **Estados**:
  - `pendiente`: Tarjeta emitida pero no activada
  - `activa`: Tarjeta activa y disponible
  - `agotada`: Saldo agotado
  - `cancelada`: Tarjeta cancelada
  - `expirada`: Tarjeta vencida

**Información de Gift Card**:
- Código único
- Monto inicial
- Saldo actual
- Cliente asociado (opcional)
- Sucursal
- Empleado emisor
- Fechas (emisión, activación, vencimiento)
- Historial de transacciones

### 9. Promociones y Descuentos

**Ubicación**: `/dashboard/promociones`

**Funcionalidades**:
- **Tipos de promoción**:
  - `porcentaje`: Descuento por porcentaje
  - `monto_fijo`: Descuento de monto fijo
  - `paquete`: Paquetes de servicios
  - `2x1`: Promoción 2x1
  - `otro`: Otros tipos
  
- **Configuración**:
  - Fechas de vigencia
  - Servicios aplicables (array)
  - Sucursales aplicables (array)
  - Usos máximos
  - Código promocional (opcional)
  - Condiciones especiales

**Aplicación**:
- Las promociones se aplican automáticamente al crear citas
- Se valida vigencia y disponibilidad
- Se registra el uso de la promoción

### 10. Gestión de Vacaciones

**Ubicación**: `/dashboard/vacaciones`

**Funcionalidades**:
- **Solicitudes de vacaciones**:
  - Crear solicitud
  - Aprobar/rechazar (manager/admin)
  - Cancelar solicitud
  - Ver historial
  
- **Estados**:
  - `pendiente`: Solicitud en espera de aprobación
  - `aprobada`: Solicitud aprobada
  - `rechazada`: Solicitud rechazada
  - `cancelada`: Solicitud cancelada
  - `completada`: Vacaciones completadas

**Control de Saldo**:
- Tabla `saldo_vacaciones` por empleado y año
- Días correspondientes
- Días tomados
- Días disponibles
- Actualización automática

**Periodos Bloqueados**:
- Bloqueo de fechas para toda la sucursal
- Motivo del bloqueo
- Prevención de citas en periodos bloqueados

### 11. Reportes

**Ubicación**: `/dashboard/reportes`

**Funcionalidades**:
- **Reportes disponibles**:
  - Ingresos por periodo
  - Citas por empleado
  - Servicios más vendidos
  - Clientes más frecuentes
  - Productividad por sucursal
  - Análisis de ocupación
  - Reportes de inventario
  
- **Filtros**:
  - Por fecha (rango)
  - Por sucursal
  - Por empleado
  - Por servicio
  - Exportación de datos

### 12. Gestión de Sucursales

**Ubicación**: `/dashboard/sucursales`

**Funcionalidades**:
- **CRUD completo** de sucursales
- **Información de sucursal**:
  - Nombre
  - Dirección completa
  - Teléfono y email
  - Horario de atención
  - Ciudad y país
  - Estado (activa/inactiva)

**Asignación**:
- Empleados asignados a sucursales
- Clientes con sucursal preferida
- Citas por sucursal
- Inventario por sucursal

### 13. Configuración

**Ubicación**: `/dashboard/configuracion`

**Funcionalidades**:
- Configuración general del sistema
- Gestión de usuarios (solo admin)
- Configuración de parámetros
- Preferencias de la aplicación

---

## 🗄️ Base de Datos

### Modelo de Datos

#### Tablas Principales

1. **sucursales**: Sucursales del spa
2. **usuarios**: Usuarios del sistema (autenticación)
3. **empleados**: Personal del spa
4. **clientes**: Base de clientes (55,630+ registros)
5. **servicios**: Servicios ofrecidos
6. **citas**: Reservaciones y citas
7. **pagos**: Transacciones de pago
8. **inventario_productos**: Productos del inventario
9. **inventario_movimientos**: Movimientos de inventario
10. **promociones**: Promociones y descuentos
11. **gift_cards**: Tarjetas de regalo
12. **gift_card_transacciones**: Historial de transacciones de gift cards
13. **vacaciones**: Solicitudes de vacaciones
14. **saldo_vacaciones**: Saldo de vacaciones por empleado
15. **periodos_bloqueados**: Periodos bloqueados para citas

### Relaciones Clave

- **Empleados** → **Sucursales** (muchos a uno)
- **Clientes** → **Sucursales** (muchos a uno, preferida)
- **Citas** → **Clientes**, **Empleados**, **Servicios**, **Sucursales**
- **Pagos** → **Citas**, **Clientes**, **Empleados**, **Sucursales**
- **Inventario** → **Sucursales** (muchos a uno)
- **Gift Cards** → **Clientes**, **Sucursales**, **Empleados**
- **Vacaciones** → **Empleados**, **Usuarios** (aprobador)

### Funciones y Triggers

- **update_updated_at_column()**: Actualiza automáticamente `updated_at`
- **update_cliente_stats()**: Actualiza estadísticas del cliente al completar cita
- **update_inventario_stock()**: Actualiza stock automáticamente en movimientos

### Índices

El esquema incluye índices optimizados para:
- Búsquedas por email, teléfono
- Filtros por fecha, estado, sucursal
- Consultas de citas por empleado y fecha
- Búsquedas de texto (pg_trgm)

---

## 🔧 Configuración e Instalación

### Prerrequisitos

- Node.js 18+
- pnpm (recomendado) o npm
- Cuenta de Supabase
- Git

### Pasos de Instalación

1. **Clonar el repositorio**:
```bash
git clone https://github.com/alecmuza09/l27SG.git
cd l27SG
```

2. **Instalar dependencias**:
```bash
pnpm install
```

3. **Configurar variables de entorno**:
Crear archivo `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
```

4. **Configurar la base de datos**:
- Ir a Supabase Dashboard → SQL Editor
- Ejecutar el contenido de `supabase/schema.sql`

5. **Crear usuario administrador**:
```bash
pnpm tsx scripts/crear-usuario-admin.ts
```

6. **Ejecutar el proyecto**:
```bash
pnpm dev
```

7. **Acceder a la aplicación**:
Abrir [http://localhost:3000](http://localhost:3000)

### Importación de Datos

#### Importar Clientes desde CSV

```bash
pnpm tsx scripts/import-clientes.ts /ruta/al/archivo.csv
```

**Formato del CSV**:
- Columnas: `id` (opcional), `nombre`, `telefono`
- El script separa automáticamente nombre y apellido
- Valida y limpia números de teléfono
- Detecta y omite duplicados
- Inserta en lotes de 1000 registros

#### Importar Empleados

```bash
pnpm tsx scripts/import-empleados.ts /ruta/al/archivo.csv
```

#### Importar Servicios

```bash
pnpm tsx scripts/import-servicios.ts /ruta/al/archivo.csv
```

---

## 🎨 Interfaz de Usuario

### Características de la UI

- **Diseño moderno y limpio**
- **Totalmente responsivo** (móvil, tablet, desktop)
- **Modo claro/oscuro** (preparado)
- **Animaciones suaves**
- **Estados de carga** con spinners
- **Notificaciones toast** (Sonner)
- **Diálogos modales** para confirmaciones
- **Tablas interactivas** con:
  - Búsqueda en tiempo real
  - Filtros avanzados
  - Ordenamiento
  - Paginación
- **Formularios validados** con Zod
- **Calendario interactivo** para citas
- **Gráficos y estadísticas** con Recharts

### Componentes UI Disponibles

El proyecto incluye 57 componentes UI reutilizables basados en Radix UI:
- Botones, inputs, selects
- Cards, dialogs, sheets
- Tables, tabs, accordions
- Calendars, date pickers
- Badges, avatars, tooltips
- Y muchos más...

---

## 🔒 Seguridad

### Medidas Implementadas

1. **Autenticación segura**:
   - Cookies HTTP-only
   - Tokens de Supabase Auth
   - Validación en cliente y servidor

2. **Control de acceso**:
   - Sistema de roles jerárquico
   - Middleware de protección de rutas
   - Validación de permisos por función

3. **Protección de datos**:
   - Variables de entorno para credenciales
   - Service Role Key solo en servidor
   - Validación de datos con Zod

4. **Prevención de ataques**:
   - Protección contra XSS (cookies HTTP-only)
   - Validación de entrada
   - Sanitización de datos

---

## 📈 Funcionalidades Avanzadas

### Sistema de Puntos de Fidelidad

- Los clientes ganan puntos automáticamente al completar citas
- Fórmula: `puntos = floor(precio / 10)`
- Los puntos se acumulan en el perfil del cliente
- (Funcionalidad de canje pendiente de implementar)

### Actualización Automática de Estadísticas

- Al completar una cita:
  - Se incrementa `total_visitas`
  - Se actualiza `ultima_visita`
  - Se suma al `total_gastado`
  - Se calculan `puntos_fidelidad`

### Gestión Automática de Stock

- Los movimientos de inventario actualizan automáticamente el stock
- Tipos de movimiento:
  - `entrada`: Incrementa stock
  - `salida`: Decrementa stock
  - `ajuste`: Establece stock a valor específico
  - `transferencia`: Mueve stock entre sucursales

### Validación de Disponibilidad

- Al crear/editar citas:
  - Verifica disponibilidad del empleado
  - Valida horarios de trabajo
  - Previene solapamientos
  - Verifica periodos bloqueados

---

## 🚀 Despliegue

### Vercel (Recomendado)

1. Conectar repositorio con Vercel
2. Configurar variables de entorno en Vercel
3. Desplegar automáticamente

### Otras Plataformas

Compatible con cualquier plataforma que soporte Next.js:
- Netlify
- Railway
- Render
- AWS Amplify

### Variables de Entorno Requeridas

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

---

## 📝 Scripts Disponibles

### Scripts de Desarrollo

```bash
pnpm dev          # Iniciar servidor de desarrollo
pnpm build        # Construir para producción
pnpm start        # Iniciar servidor de producción
pnpm lint         # Ejecutar linter
```

### Scripts de Utilidad

```bash
# Crear usuario administrador
pnpm tsx scripts/crear-usuario-admin.ts

# Importar clientes
pnpm tsx scripts/import-clientes.ts archivo.csv

# Importar empleados
pnpm tsx scripts/import-empleados.ts archivo.csv

# Importar servicios
pnpm tsx scripts/import-servicios.ts archivo.csv

# Verificar datos
pnpm tsx scripts/verificar-importacion.ts
pnpm tsx scripts/verificar-empleados.ts
pnpm tsx scripts/verificar-servicios.ts
pnpm tsx scripts/verificar-sucursales.ts

# Limpiar usuarios
pnpm tsx scripts/limpiar-usuarios.ts
```

---

## 🐛 Solución de Problemas

### Problemas Comunes

1. **Error de conexión a Supabase**:
   - Verificar variables de entorno
   - Confirmar que las credenciales son correctas
   - Verificar que Supabase está activo

2. **Error de autenticación**:
   - Verificar que el usuario existe en Supabase Auth
   - Confirmar que el usuario está en la tabla `usuarios`
   - Verificar que el usuario está activo

3. **Error al importar datos**:
   - Verificar formato del CSV
   - Confirmar que la base de datos está configurada
   - Revisar logs del script

4. **Problemas de permisos**:
   - Verificar rol del usuario
   - Confirmar que tiene acceso a la sucursal
   - Revisar middleware de protección

---

## 🔮 Roadmap Futuro

Funcionalidades planificadas:

- [ ] Sistema de reportes avanzados
- [ ] Notificaciones por email/SMS
- [ ] Integración con sistemas de pago
- [ ] App móvil con React Native
- [ ] Panel de análisis avanzado
- [ ] Exportación de datos en múltiples formatos
- [ ] Sistema de recordatorios automáticos
- [ ] Integración con calendarios externos
- [ ] Sistema de canje de puntos de fidelidad
- [ ] Dashboard de métricas en tiempo real
- [ ] Sistema de reservas online para clientes

---

## 📞 Soporte y Contacto

**Desarrollador**: Alec Muza
- GitHub: [@alecmuza09](https://github.com/alecmuza09)

**Proyecto**: Sistema de Gestión Luna27 Spa
- Repositorio: https://github.com/alecmuza09/l27SG

---

## 📄 Licencia

Este proyecto es privado y de uso exclusivo para Luna27 Spa.

---

**Última actualización**: Diciembre 2024

Desarrollado con ❤️ para Luna27 Spa
