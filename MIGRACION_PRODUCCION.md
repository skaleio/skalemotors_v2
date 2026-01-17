# 🚀 Plan de Migración a Producción - SKALEMOTORS

## 📋 Resumen Ejecutivo

Este documento describe el plan completo para migrar SKALEMOTORS de datos mock a una implementación de producción usando Supabase como backend, con seguridad robusta y herramientas para demos.

## 🏗️ Arquitectura de Producción

### Stack Tecnológico
- **Frontend**: React + TypeScript + Vite
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Autenticación**: Supabase Auth (JWT)
- **Base de Datos**: PostgreSQL con Row Level Security (RLS)
- **Storage**: Supabase Storage para imágenes y documentos
- **Seguridad**: RLS policies, JWT tokens, HTTPS, CORS

### Componentes Principales

```
┌─────────────────┐
│   React App     │
│   (Frontend)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Supabase SDK   │
│  (Cliente JS)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Supabase      │
│   ┌───────────┐ │
│   │ PostgreSQL│ │ ← Base de datos
│   │   + RLS   │ │
│   ├───────────┤ │
│   │   Auth    │ │ ← Autenticación
│   ├───────────┤ │
│   │  Storage  │ │ ← Archivos
│   ├───────────┤ │
│   │ Realtime  │ │ ← WebSockets
│   └───────────┘ │
└─────────────────┘
```

## 🔐 Seguridad

### 1. Row Level Security (RLS)
- Todas las tablas tienen RLS habilitado
- Políticas basadas en roles de usuario
- Acceso restringido por sucursal (branch_id)
- Admins pueden ver todo, usuarios solo sus datos asignados

### 2. Autenticación
- JWT tokens con expiración
- Refresh tokens automáticos
- Sesiones seguras en localStorage (con encriptación opcional)
- Protección contra CSRF

### 3. Variables de Entorno
- Credenciales en `.env` (no en código)
- Diferentes configuraciones para dev/staging/prod
- Secrets management

### 4. Validación de Datos
- Validación en frontend (Zod)
- Validación en backend (PostgreSQL constraints)
- Sanitización de inputs

## 📦 Estructura de Archivos

```
src/
├── lib/
│   ├── supabase.ts          # Cliente Supabase
│   ├── services/            # Servicios de datos
│   │   ├── vehicles.ts
│   │   ├── leads.ts
│   │   ├── sales.ts
│   │   └── ...
│   └── hooks/              # Custom hooks
│       ├── useVehicles.ts
│       ├── useLeads.ts
│       └── ...
├── contexts/
│   └── AuthContext.tsx     # Migrado a Supabase
└── types/
    └── database.ts         # Tipos generados de Supabase
```

## 🔄 Proceso de Migración

### Fase 1: Configuración Base ✅
- [x] Configurar variables de entorno
- [x] Crear servicios base
- [x] Migrar AuthContext

### Fase 2: Migración de Datos
- [ ] Crear script de migración de datos mock
- [ ] Migrar vehículos
- [ ] Migrar leads
- [ ] Migrar usuarios
- [ ] Migrar citas y cotizaciones

### Fase 3: Reemplazo de Mocks
- [ ] Reemplazar mock-data en Dashboard
- [ ] Reemplazar mock-data en Leads
- [ ] Reemplazar mock-data en Inventory
- [ ] Reemplazar mock-data en todas las páginas

### Fase 4: Testing y Validación
- [ ] Tests de integración
- [ ] Validación de seguridad
- [ ] Performance testing
- [ ] User acceptance testing

### Fase 5: Deployment
- [ ] Configurar staging environment
- [ ] Deploy a producción
- [ ] Monitoreo y alertas

## 🛠️ Herramientas para Demo

### 1. Seed Data Script
Script para poblar la base de datos con datos de demostración:
- Usuarios de prueba
- Vehículos de ejemplo
- Leads de muestra
- Citas y cotizaciones

### 2. Reset Demo Script
Script para resetear la base de datos a estado inicial para nuevas demos.

### 3. Usuarios de Prueba
- `demo@skale.io` / `demo123` - Admin
- `vendedor@skale.io` / `demo123` - Vendedor
- `gerente@skale.io` / `demo123` - Gerente

## 📊 Monitoreo y Logs

- Supabase Dashboard para métricas
- Logs de errores en frontend
- Analytics de uso
- Performance monitoring

## 🔧 Mantenimiento

- Backups automáticos diarios
- Actualizaciones de seguridad
- Optimización de queries
- Limpieza de datos antiguos

## 📝 Checklist de Producción

- [ ] Variables de entorno configuradas
- [ ] RLS policies implementadas y testeadas
- [ ] Autenticación funcionando
- [ ] Datos migrados
- [ ] Tests pasando
- [ ] Documentación actualizada
- [ ] Backup configurado
- [ ] Monitoreo activo
- [ ] SSL/HTTPS configurado
- [ ] CORS configurado correctamente


