# 🚀 Guía de Implementación - Migración a Producción

## 📋 Índice

1. [Configuración Inicial](#configuración-inicial)
2. [Migración de Datos](#migración-de-datos)
3. [Configuración de Seguridad](#configuración-de-seguridad)
4. [Reemplazo de Mocks](#reemplazo-de-mocks)
5. [Testing y Validación](#testing-y-validación)
6. [Deployment](#deployment)

## 🔧 Configuración Inicial

### 1. Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto basado en `env.example`:

```bash
cp env.example .env
```

Edita `.env` con tus credenciales de Supabase:

```env
VITE_SUPABASE_URL=https://knczbjmiqhkopsytkauo.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key_aqui
VITE_APP_ENV=development
VITE_ENABLE_MOCK_DATA=false
VITE_DEMO_MODE=false
```

### 2. Instalar Dependencias

```bash
npm install
```

### 3. Configurar Supabase

1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Ejecuta el script `supabase_schema.sql` en el SQL Editor
3. Verifica que todas las tablas se hayan creado correctamente

## 📊 Migración de Datos

### Paso 1: Crear Usuarios de Demo

1. Ve a Authentication > Users en Supabase Dashboard
2. Crea los siguientes usuarios:
   - `demo@skale.io` / `demo123` (Admin)
   - `vendedor@skale.io` / `demo123` (Vendedor)
   - `gerente@skale.io` / `demo123` (Gerente)

3. Ejecuta `scripts/create-demo-users.sql` en el SQL Editor
   - Reemplaza los `USER_ID_FROM_AUTH` con los IDs reales de los usuarios creados

### Paso 2: Migrar Datos Mock

Ejecuta `scripts/migrate-mock-data.sql` en el SQL Editor de Supabase.

Este script migrará:
- ✅ Vehículos de ejemplo
- ✅ Sucursales
- ✅ Marcas populares

### Paso 3: Verificar Datos

```sql
-- Verificar vehículos
SELECT COUNT(*) FROM public.vehicles;

-- Verificar usuarios
SELECT email, role, is_active FROM public.users;

-- Verificar sucursales
SELECT name, city, region FROM public.branches;
```

## 🔐 Configuración de Seguridad

### Paso 1: Configurar RLS Policies

Ejecuta `scripts/setup-rls-policies.sql` en el SQL Editor de Supabase.

Este script configurará:
- ✅ Políticas de acceso por rol
- ✅ Restricciones por sucursal
- ✅ Permisos de lectura/escritura

### Paso 2: Verificar Políticas

```sql
-- Ver todas las políticas
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'public';
```

### Paso 3: Configurar Storage

1. Ve a Storage en Supabase Dashboard
2. Crea un bucket llamado `vehicles`
3. Configura políticas de acceso:
   - Public read para imágenes
   - Authenticated write para uploads

## 🔄 Reemplazo de Mocks

### Opción 1: Cambio Gradual (Recomendado)

1. Mantén `VITE_ENABLE_MOCK_DATA=true` inicialmente
2. Migra página por página:
   - Dashboard
   - Leads
   - Inventory
   - etc.

3. Usa los servicios creados en `src/lib/services/`:
   ```typescript
   import { vehicleService } from '@/lib/services/vehicles'
   import { leadService } from '@/lib/services/leads'
   ```

### Opción 2: Cambio Completo

1. Cambia `VITE_ENABLE_MOCK_DATA=false` en `.env`
2. Reemplaza todas las importaciones de `mock-data.ts`
3. Usa los hooks personalizados:
   ```typescript
   import { useVehicles } from '@/hooks/useVehicles'
   import { useLeads } from '@/hooks/useLeads'
   ```

### Migrar AuthContext

Reemplaza `src/contexts/AuthContext.tsx` con `src/contexts/AuthContext.production.tsx`:

```bash
mv src/contexts/AuthContext.tsx src/contexts/AuthContext.mock.tsx
mv src/contexts/AuthContext.production.tsx src/contexts/AuthContext.tsx
```

## 🧪 Testing y Validación

### 1. Testing Manual

1. **Login**: Prueba con usuarios de demo
2. **Dashboard**: Verifica que los datos se carguen correctamente
3. **CRUD Operations**: 
   - Crear un lead
   - Actualizar un vehículo
   - Crear una cita

### 2. Verificar Seguridad

1. Intenta acceder a datos de otra sucursal (debe fallar)
2. Intenta cambiar tu rol (debe fallar)
3. Verifica que solo admins puedan crear usuarios

### 3. Performance

1. Verifica tiempos de carga
2. Revisa queries en Supabase Dashboard > Logs
3. Optimiza índices si es necesario

## 🚀 Deployment

### 1. Preparar para Producción

1. Crea un proyecto de producción en Supabase
2. Ejecuta todos los scripts en el proyecto de producción
3. Configura variables de entorno de producción

### 2. Build

```bash
npm run build
```

### 3. Deploy

Opciones:
- **Vercel**: Conecta tu repo y configura variables de entorno
- **Netlify**: Similar a Vercel
- **Otro hosting**: Sube la carpeta `dist/`

### 4. Configurar Dominio

1. Configura tu dominio
2. Actualiza `redirectTo` en `resetPassword` con tu dominio real
3. Configura CORS en Supabase si es necesario

## 📝 Checklist Final

- [ ] Variables de entorno configuradas
- [ ] Base de datos creada y migrada
- [ ] Usuarios de demo creados
- [ ] RLS policies configuradas
- [ ] Storage configurado
- [ ] AuthContext migrado
- [ ] Servicios implementados
- [ ] Hooks personalizados creados
- [ ] Datos mock reemplazados
- [ ] Testing completado
- [ ] Build de producción exitoso
- [ ] Deploy realizado
- [ ] Monitoreo configurado

## 🆘 Troubleshooting

### Error: "Row Level Security policy violation"

- Verifica que las políticas RLS estén correctamente configuradas
- Asegúrate de que el usuario tenga el rol correcto
- Revisa los logs en Supabase Dashboard

### Error: "Invalid API key"

- Verifica que `VITE_SUPABASE_ANON_KEY` esté correcto
- Asegúrate de usar la `anon` key, no la `service_role` key

### Datos no se cargan

- Verifica la consola del navegador para errores
- Revisa los logs en Supabase Dashboard
- Verifica que las tablas tengan datos

### Autenticación no funciona

- Verifica que `AuthContext` esté usando Supabase
- Revisa que los usuarios existan en `auth.users` y `public.users`
- Verifica las políticas RLS en la tabla `users`

## 📚 Recursos Adicionales

- [Documentación de Supabase](https://supabase.com/docs)
- [Guía de RLS](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase TypeScript](https://supabase.com/docs/reference/javascript/typescript-support)


