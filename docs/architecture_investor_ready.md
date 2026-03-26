# Arquitectura Investor-Ready

## Principios
- Multi-tenant por diseño: `1 mentoría = 1 tenant`.
- Aislamiento de datos por `tenant_id` en DB + RLS.
- Flags por tenant en tabla `tenant_feature_flags` (lectura vía API con RLS); overrides globales opcionales con `VITE_FLAG_*` para staging o kill-switch.
- Legacy protegido (`hessen@test.io`) sin cambios destructivos.
- Facturación: tabla `tenant_billing` (`manual` hasta PSP); sin bloquear operación actual.

## Componentes
- Frontend React/Vite con rutas protegidas y RBAC.
- Supabase Postgres con migraciones aditivas.
- Edge Functions críticas con trazabilidad contextual.
- Sentry para observabilidad de frontend.

## Flujo de autorización
1. Login en Supabase Auth.
2. Perfil en `public.users` con `tenant_id`, `role`, `legacy_protected`.
3. UI aplica permisos por módulo (RBAC).
4. DB aplica aislamiento por `tenant_id` y restricciones por rol (RLS).

## Provisioning
- RPC `provision_tenant` crea tenant + sucursal base + asignación de jefe.
- Script `npm run provision:tenant -- <slug> <name> <email> <nombre>` para alta operativa.

## Continuidad
- Rollout por oleadas.
- Rollback por feature flags + release anterior.
- Telemetría en Sentry y logs edge con contexto operacional.
