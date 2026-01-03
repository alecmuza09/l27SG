# Sistema de Gestión de Spa Luna27

Sistema completo de gestión para spa desarrollado con Next.js 15, React 19, TypeScript y Supabase.

## 🚀 Características

### Módulos Principales

- **Dashboard**: Visualización de métricas clave y estadísticas en tiempo real
- **Clientes**: Gestión completa de base de clientes (55,630+ clientes importados)
- **Citas**: Sistema de agendamiento con vistas de calendario, día y kanban
- **Empleados**: Administración de personal y horarios
- **Servicios**: Catálogo de servicios ofrecidos
- **Inventario**: Control de productos e insumos
- **Pagos**: Registro y seguimiento de transacciones
- **Gift Cards**: Gestión de tarjetas de regalo
- **Promociones**: Sistema de descuentos y ofertas
- **Vacaciones**: Gestión de días libres y vacaciones del personal
- **Reportes**: Análisis y reportes del negocio

### Funcionalidades Técnicas

- ✅ Integración completa con Supabase
- ✅ Autenticación y gestión de usuarios
- ✅ CRUD completo de clientes con datos reales
- ✅ Importación masiva desde CSV (script incluido)
- ✅ UI moderna y responsiva con Tailwind CSS v4
- ✅ Componentes de UI con Radix UI
- ✅ Sistema de notificaciones con Sonner
- ✅ Validación de formularios
- ✅ Estados de carga y manejo de errores
- ✅ TypeScript estricto

## 🛠️ Stack Tecnológico

- **Framework**: Next.js 15.5.9 (App Router)
- **UI**: React 19.1.0
- **Lenguaje**: TypeScript 5
- **Base de Datos**: Supabase (PostgreSQL)
- **Estilos**: Tailwind CSS 4.1.9
- **Componentes**: Radix UI
- **Gestión de Estado**: React Hooks
- **Validación**: Zod
- **Formularios**: React Hook Form
- **Notificaciones**: Sonner
- **Gráficos**: Recharts
- **Fechas**: date-fns
- **Iconos**: Lucide React
- **Gestor de Paquetes**: pnpm

## 📦 Instalación

### Prerrequisitos

- Node.js 18+ 
- pnpm (recomendado) o npm
- Cuenta de Supabase

### Pasos

1. **Clonar el repositorio**

```bash
git clone https://github.com/alecmuza09/l27SG.git
cd l27SG
```

2. **Instalar dependencias**

```bash
pnpm install
```

3. **Configurar variables de entorno**

Crear un archivo `.env.local` en la raíz del proyecto:

```env
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
```

4. **Configurar la base de datos**

Ejecutar el script SQL en Supabase Dashboard:

```bash
# El archivo está en: supabase/schema.sql
```

Ve a tu proyecto en Supabase → SQL Editor → Ejecuta el contenido de `schema.sql`

5. **Ejecutar el proyecto**

```bash
pnpm dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

## 📊 Importación de Clientes

El proyecto incluye un script para importar clientes masivamente desde un archivo CSV:

```bash
pnpm tsx scripts/import-clientes.ts /ruta/al/archivo.csv
```

El CSV debe tener las siguientes columnas:
- `id`: ID del cliente (opcional)
- `nombre`: Nombre completo del cliente
- `telefono`: Teléfono (requerido)

El script:
- Separa automáticamente nombre y apellido
- Valida y limpia números de teléfono
- Detecta y omite duplicados
- Inserta en lotes de 1000 para mejor rendimiento
- Muestra progreso y resumen final

## 🗂️ Estructura del Proyecto

```
├── app/
│   ├── api/              # API Routes
│   ├── dashboard/        # Páginas del dashboard
│   │   ├── clientes/     # Gestión de clientes
│   │   ├── citas/        # Sistema de citas
│   │   ├── empleados/    # Gestión de empleados
│   │   └── ...
│   ├── globals.css       # Estilos globales
│   ├── layout.tsx        # Layout principal
│   └── page.tsx          # Página de inicio
├── components/
│   ├── auth/             # Componentes de autenticación
│   ├── citas/            # Componentes de citas
│   ├── dashboard/        # Componentes del dashboard
│   ├── layout/           # Header, sidebar, etc.
│   └── ui/               # Componentes UI reutilizables
├── lib/
│   ├── data/             # Funciones de datos
│   │   ├── clientes.ts   # CRUD de clientes
│   │   └── ...
│   ├── supabase/         # Configuración de Supabase
│   │   ├── client.ts     # Cliente de Supabase
│   │   ├── server.ts     # Cliente servidor
│   │   └── types.ts      # Tipos TypeScript
│   └── utils.ts          # Utilidades
├── scripts/
│   ├── import-clientes.ts        # Script de importación
│   └── verificar-importacion.ts  # Verificar datos
├── supabase/
│   ├── README.md         # Instrucciones de configuración
│   └── schema.sql        # Esquema de la base de datos
└── public/               # Archivos estáticos
```

## 🔐 Seguridad

- Las credenciales se manejan mediante variables de entorno
- No se incluyen archivos `.env` en el repositorio
- Se usa el Service Role Key solo en el servidor
- Validación de datos en cliente y servidor

## 📝 Base de Datos

### Tablas Principales

- `sucursales`: Sucursales del spa
- `usuarios`: Usuarios del sistema
- `empleados`: Personal del spa
- `clientes`: Base de clientes (55,630+ registros)
- `servicios`: Servicios ofrecidos
- `citas`: Reservaciones y citas
- `pagos`: Transacciones
- `inventario_productos`: Inventario
- `inventario_movimientos`: Movimientos de inventario
- `promociones`: Descuentos y ofertas
- `gift_cards`: Tarjetas de regalo
- `vacaciones`: Vacaciones del personal

Ver `supabase/schema.sql` para el esquema completo.

## 🎨 Características de la UI

- Diseño moderno y limpio
- Modo claro/oscuro (preparado)
- Totalmente responsivo
- Animaciones suaves
- Estados de carga
- Notificaciones toast
- Diálogos modales
- Tablas con búsqueda y filtros
- Formularios validados
- Calendario interactivo
- Gráficos y estadísticas

## 🚀 Despliegue

### Vercel (Recomendado)

1. Conecta tu repositorio con Vercel
2. Configura las variables de entorno
3. Despliega automáticamente

### Otras Plataformas

Compatible con cualquier plataforma que soporte Next.js:
- Netlify
- Railway
- Render
- AWS Amplify

## 📈 Roadmap

- [ ] Sistema de reportes avanzados
- [ ] Notificaciones por email/SMS
- [ ] Integración con sistemas de pago
- [ ] App móvil con React Native
- [ ] Panel de análisis avanzado
- [ ] Exportación de datos en múltiples formatos
- [ ] Sistema de recordatorios automáticos
- [ ] Integración con calendarios externos

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto es privado y de uso exclusivo para Luna27 Spa.

## 👤 Autor

**Alec Muza**
- GitHub: [@alecmuza09](https://github.com/alecmuza09)

## 🙏 Agradecimientos

- Next.js Team
- Supabase Team
- Vercel
- Radix UI
- Shadcn/ui

---

Desarrollado con ❤️ para Luna27 Spa
