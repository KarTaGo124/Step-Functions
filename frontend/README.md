# 🛒 E-Commerce Multi-Tenant Frontend

Frontend desarrollado en **Next.js 15** con **TypeScript** para el sistema de e-commerce multi-tenant con Step Functions de AWS.

## 🚀 Características

### ✅ Implementado

-   ✅ **Autenticación Multi-Tenant**: Login/Registro con soporte para múltiples organizaciones
-   ✅ **Sistema de Roles**: Usuario (cliente) y Administrador (supervisor)
-   ✅ **Dashboard en Tiempo Real**: Seguimiento de pedidos con polling automático
-   ✅ **Gestión de Estado**: Context API para autenticación y localStorage para carrito
-   ✅ **UI Responsive**: Interfaz moderna con Tailwind CSS
-   ✅ **TypeScript**: Tipado fuerte para mejor desarrollo
-   ✅ **Componentes Reutilizables**: UI kit personalizado

### 🔄 Funcionalidades Core

1. **Autenticación**

    - Registro con tenant_id y selección de rol
    - Login con validación JWT
    - Gestión automática de tokens y sesiones

2. **Dashboard Cliente (Usuario)**

    - Estado de pedidos en tiempo real
    - Contador de compras por estado
    - Polling automático para actualizaciones

3. **Dashboard Supervisor (Admin)**
    - Panel de aprobaciones pendientes
    - Gestión de productos (CRUD)
    - Alertas de inventario

## 📋 Próximos Pasos para Completar

### 1. Configurar URLs de APIs

```bash
# Copiar archivo de ejemplo
cp .env.local.example .env.local

# Editar con las URLs reales de tus APIs desplegadas
NEXT_PUBLIC_API_USUARIOS_URL=https://tu-usuarios-api.amazonaws.com/dev
NEXT_PUBLIC_API_PRODUCTOS_URL=https://tu-productos-api.amazonaws.com/dev
NEXT_PUBLIC_API_COMPRAS_URL=https://tu-compras-api.amazonaws.com/dev
NEXT_PUBLIC_STEP_FUNCTIONS_URL=https://tu-stepfunctions-api.amazonaws.com/dev
```

### 2. Páginas por Crear

```bash
# Crear estas páginas adicionales:
src/app/productos/page.tsx          # Lista de productos para comprar
src/app/carrito/page.tsx            # Carrito de compras
src/app/compras/page.tsx            # Historial de compras
src/app/admin/productos/page.tsx    # Gestión de productos (CRUD)
src/app/admin/dashboard/page.tsx    # Panel de aprobaciones
```

### 3. Funcionalidades Faltantes

-   **Página de Productos**: Catálogo con búsqueda y filtros
-   **Carrito de Compras**: Gestión de productos, cantidades, checkout
-   **Historial de Compras**: Lista paginada con detalles y seguimiento
-   **Admin - CRUD Productos**: Crear, editar, eliminar productos
-   **Admin - Panel Aprobaciones**: Aprobar/rechazar pedidos pendientes
-   **Notificaciones**: WebSockets o Server-Sent Events para updates

### 4. Deployment a S3

```bash
# Build para producción
npm run build
npm run export  # Generar archivos estáticos

# Subir a S3 bucket configurado para hosting estático
aws s3 sync out/ s3://tu-bucket-name --delete
aws s3 website s3://tu-bucket-name --index-document index.html
```

## 🏗️ Estructura del Proyecto

```
src/
├── app/                    # App Router de Next.js
│   ├── auth/              # Páginas de autenticación
│   ├── dashboard/         # Dashboard principal
│   ├── layout.tsx         # Layout global
│   └── page.tsx           # Página home (redirect)
├── components/            # Componentes React
│   ├── ui/               # Componentes de UI reutilizables
│   ├── MainLayout.tsx    # Layout principal con navbar
│   └── Navbar.tsx        # Navegación principal
├── hooks/                # Custom hooks
│   ├── useAuth.tsx       # Hook de autenticación
│   └── useCart.ts        # Hook del carrito
├── lib/                  # Utilidades y servicios
│   └── api.ts           # Cliente API con Axios
└── types/               # Definiciones TypeScript
    └── index.ts         # Tipos principales
```

## 🔧 Tecnologías Utilizadas

-   **Next.js 15**: Framework React con App Router
-   **TypeScript**: Tipado estático
-   **Tailwind CSS**: Framework CSS utility-first
-   **Axios**: Cliente HTTP para APIs
-   **React Hook Form**: Gestión de formularios
-   **React Hot Toast**: Notificaciones
-   **js-cookie**: Gestión de cookies
-   **date-fns**: Manipulación de fechas

## 🚦 Estados de Workflow

El sistema trackea los siguientes estados de pedidos:

-   **Pendiente**: Pedido recién creado
-   **Validando**: Verificando datos y stock
-   **Esperando Aprobación**: Pedidos >$500 requieren aprobación
-   **Procesando**: Procesando pago y generando factura
-   **Completado**: Pedido finalizado exitosamente
-   **Rechazado**: Pedido rechazado por supervisor
-   **Error**: Error en el procesamiento

## 📱 Multi-Tenancy

El sistema soporta múltiples organizaciones mediante `tenant_id`:

-   Cada usuario pertenece a un tenant específico
-   Los datos están completamente separados por tenant
-   Las APIs filtran automáticamente por tenant del usuario autenticado

## 🔐 Roles y Permisos

### Usuario (Cliente)

-   Ver y comprar productos
-   Gestionar carrito de compras
-   Ver historial y estado de pedidos
-   Dashboard con seguimiento en tiempo real

### Administrador (Supervisor)

-   Todas las funciones de usuario
-   Gestionar catálogo de productos (CRUD)
-   Aprobar/rechazar pedidos pendientes
-   Ver dashboard de administración
-   Gestionar alertas de inventario

## 🚀 Comandos de Desarrollo

```bash
# Instalar dependencias
npm install

# Desarrollo local
npm run dev

# Build para producción
npm run build

# Verificar tipos
npm run lint

# Iniciar servidor de producción
npm start
```

## 📝 Notas de Implementación

1. **Polling en Tiempo Real**: El dashboard usa polling cada 3 segundos para actualizar estados de pedidos
2. **Gestión de Estado**: Context API para auth, localStorage para carrito persistente
3. **Manejo de Errores**: Interceptores Axios para manejo centralizado de errores 401
4. **Responsive Design**: Optimizado para mobile, tablet y desktop
5. **Performance**: Lazy loading y code splitting automático con Next.js

Este frontend está listo para conectarse con tus APIs del backend. Solo necesitas configurar las URLs correctas y completar las páginas faltantes según los requirements.
