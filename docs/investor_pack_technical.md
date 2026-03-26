# Investor Pack Técnico

## Estado técnico actual
- Base multi-tenant incorporada (`tenants`, `tenant_feature_flags`, `tenant_id` en tablas críticas).
- Endurecimiento inicial de RLS y controles de acceso por rol.
- MFA TOTP habilitable en configuración Supabase local.
- Observabilidad integrada con Sentry en frontend.
- CI/CD con gate obligatorio (`lint + build + test`).

## Métricas sugeridas para due diligence
- Uptime mensual por entorno.
- Error rate por módulo y tenant.
- p95 de carga inicial por módulo.
- Adopción por módulo (usuarios activos / tenant).

## Seguridad y continuidad
- Guardrail explícito para `hessen@test.io` (`legacy_protected`).
- Migraciones aditivas, sin cambios destructivos en caliente.
- Rollback rápido por flags + release revert.
- Runbook operativo documentado en `docs/runbook.md`.

## Roadmap inmediato
1. Completar backfill de `tenant_id` en todos los registros históricos.
2. Endurecer RLS tabla por tabla con tests negativos por rol.
3. Activar telemetría avanzada en edge functions críticas.
4. Instrumentar Web Vitals para baseline de performance y objetivos trimestrales.
