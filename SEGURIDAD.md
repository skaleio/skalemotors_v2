# 🔐 Guía de Seguridad - SKALEMOTORS

## 📋 Resumen

Este documento describe las medidas de seguridad implementadas en SKALEMOTORS para proteger datos sensibles y garantizar el acceso controlado.

## 🛡️ Capas de Seguridad

### 1. Autenticación y Autorización

#### Supabase Auth
- **JWT Tokens**: Tokens firmados con expiración automática
- **Refresh Tokens**: Renovación automática de sesiones
- **Password Hashing**: Bcrypt con salt automático
- **Email Verification**: Opcional para producción

#### Roles y Permisos
```typescript
'admin'      // Acceso completo
'gerente'    // Acceso a sucursal
'vendedor'   // Acceso a leads asignados
'financiero' // Acceso a finanzas
'servicio'   // Acceso a post-venta
'inventario' // Acceso a vehículos
```

### 2. Row Level Security (RLS)

#### Principios
- **Principio de Menor Privilegio**: Usuarios solo ven lo necesario
- **Aislamiento por Sucursal**: Datos separados por branch_id
- **Control por Rol**: Permisos basados en roles

#### Políticas Implementadas

**Usuarios:**
- Ver su propio perfil
- Actualizar su propio perfil (excepto role)
- Admins ven todos los usuarios

**Vehículos:**
- Todos los usuarios autenticados pueden ver
- Solo staff autorizado puede modificar

**Leads:**
- Ver leads asignados a ellos
- Gerentes y admins ven todos
- Crear leads propios

**Ventas:**
- Ver propias ventas
- Gerentes y admins ven todas
- Solo vendedores pueden crear

### 3. Validación de Datos

#### Frontend (Zod)
```typescript
// Validación de formularios
const schema = z.object({
  email: z.string().email(),
  phone: z.string().regex(/^\+56\d{9}$/),
  rut: z.string().refine(validateRUT)
})
```

#### Backend (PostgreSQL)
- **Constraints**: Tipos y valores permitidos
- **Foreign Keys**: Integridad referencial
- **Check Constraints**: Validación de rangos

### 4. Protección de APIs

#### Supabase Client
- **Anon Key**: Solo para operaciones públicas
- **Service Role Key**: NUNCA en frontend
- **RLS**: Protección automática en todas las queries

#### Rate Limiting
- Configurado en Supabase Dashboard
- Límites por IP y usuario

### 5. Almacenamiento Seguro

#### Supabase Storage
- **Buckets Privados**: Por defecto
- **Políticas de Acceso**: Basadas en autenticación
- **URLs Firmadas**: Para acceso temporal

#### Variables de Entorno
- **No commitear**: `.env` en `.gitignore`
- **Secrets Management**: Usar servicios como Vercel/Netlify
- **Rotación**: Cambiar keys periódicamente

## 🔒 Mejores Prácticas

### 1. Desarrollo

✅ **Hacer:**
- Usar variables de entorno
- Validar inputs en frontend y backend
- Usar tipos TypeScript
- Revisar políticas RLS regularmente

❌ **No hacer:**
- Hardcodear credenciales
- Exponer service_role key
- Deshabilitar RLS
- Confiar solo en validación frontend

### 2. Producción

✅ **Hacer:**
- Habilitar email verification
- Configurar CORS correctamente
- Usar HTTPS siempre
- Monitorear logs de seguridad

❌ **No hacer:**
- Usar anon key en server-side
- Permitir registros abiertos sin verificación
- Exponer información sensible en errores

### 3. Datos Sensibles

#### Información Protegida
- RUTs de clientes
- Números de teléfono
- Direcciones
- Información financiera

#### Cifrado
- **En Tránsito**: HTTPS/TLS
- **En Reposo**: PostgreSQL encryption
- **Backups**: Encriptados automáticamente

## 🚨 Incidentes de Seguridad

### Procedimiento

1. **Identificar**: Detectar actividad sospechosa
2. **Contener**: Bloquear acceso si es necesario
3. **Investigar**: Revisar logs y políticas
4. **Corregir**: Aplicar parches o cambios
5. **Documentar**: Registrar incidente

### Monitoreo

- **Supabase Dashboard**: Logs de autenticación
- **Error Tracking**: Sentry o similar
- **Audit Logs**: Revisar cambios importantes

## 📊 Auditoría

### Logs Importantes

1. **Autenticación**: Login/logout, intentos fallidos
2. **Cambios de Datos**: Updates en tablas críticas
3. **Accesos**: Queries a datos sensibles
4. **Errores**: Excepciones y fallos

### Revisión Periódica

- **Semanal**: Revisar logs de seguridad
- **Mensual**: Auditar políticas RLS
- **Trimestral**: Revisar accesos de usuarios
- **Anual**: Auditoría completa de seguridad

## 🔐 Checklist de Seguridad

### Configuración
- [ ] RLS habilitado en todas las tablas
- [ ] Políticas RLS configuradas correctamente
- [ ] Variables de entorno configuradas
- [ ] Service role key protegida
- [ ] CORS configurado correctamente

### Autenticación
- [ ] Email verification habilitado (producción)
- [ ] Password requirements configurados
- [ ] Session timeout configurado
- [ ] Refresh tokens funcionando

### Datos
- [ ] Validación en frontend y backend
- [ ] Constraints en base de datos
- [ ] Backups configurados
- [ ] Datos sensibles protegidos

### Monitoreo
- [ ] Logs configurados
- [ ] Alertas de seguridad
- [ ] Revisión periódica programada

## 📚 Recursos

- [Supabase Security](https://supabase.com/docs/guides/auth/security)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/security.html)


