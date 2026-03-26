# Checklist de onboarding SaaS (por mentoría / tenant)

Usar después de `npm run provision:tenant -- <slug> <nombre> <email_jefe> <nombre_jefe>` (requiere `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`).

## Pre-requisitos

- [ ] Migraciones aplicadas en el proyecto Supabase (incl. multi-tenant + RLS).
- [ ] Usuario Auth del **Jefe Jefe** ya creado en Supabase Auth (el script enlaza `public.users` por email).
- [ ] Secret opcional `SENTRY_DSN` en Edge Functions para errores con contexto.

## Datos y seguridad

- [ ] Verificar fila en `tenants` (slug único, `legacy_mode = false`).
- [ ] Verificar `users.tenant_id` y `branches.tenant_id` del tenant.
- [ ] Revisar `tenant_feature_flags` (defaults insertados por `provision_tenant`).
- [ ] Confirmar `tenant_billing.billing_mode = manual` hasta activar Stripe u otro PSP.

## Producto

- [ ] Invitar/alta de **Jefe Sucursal** y **Vendedores** (roles `jefe_sucursal` / `vendedor` cuando el enum DB lo permita; hoy se usa `gerente` / `vendedor` + RBAC frontend).
- [ ] Smoke: login, inventario, consignaciones, trámites, calendario (alcance por rol).
- [ ] Smoke finanzas solo con rol `admin` / `financiero` (y cuenta no legacy si aplica política restrictiva).

## Cuenta protegida

- [ ] **No** reutilizar email `hessen@test.io` en tenants nuevos; permanece en modo legacy según reglas de negocio.

## Rollout

- [ ] Activar flags por tenant en DB antes que overrides globales en Vercel.
- [ ] Documentar fecha de go-live y responsable en el runbook (`docs/runbook.md`).
