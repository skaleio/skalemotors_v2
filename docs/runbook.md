# Runbook de Operación (SkaleMotors)

## Deploy
- Validar pipeline CI (`lint`, `build`, `test`) en PR.
- Confirmar flags por tenant antes de producción.
- Desplegar frontend y luego edge functions.
- Ejecutar migraciones aditivas de `supabase/migrations`.

## Rollback
- Si hay incidencia crítica, desactivar flags del release por tenant.
- Revertir deployment frontend al build anterior.
- Para edge functions, redeploy versión previa.
- No ejecutar migraciones destructivas; solo rollback funcional por flags/release.

## Incidente severo
- Abrir incidente y asignar owner técnico.
- Revisar errores en Sentry (por `tenant_id`, `user_id`, `role`, `module`).
- Aislar impacto (tenant específico vs global).
- Aplicar mitigación inmediata (flag off / rollback).
- Publicar postmortem con causa, impacto y acciones correctivas.

## Regla legacy
- `hessen@test.io` permanece en modo protegido.
- Cualquier cambio de permisos para legacy requiere ventana controlada y aprobación explícita.
