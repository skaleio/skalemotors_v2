# Auditoría de Seguridad Pre-MVP — Skale Motors v2

**Fecha**: 2026-05-05
**Alcance**: Auditoría profunda completa (RLS, Edge Functions, frontend, secrets, headers HTTP, auth flows, endpoints Vercel)
**Estado del proyecto**: ~80% MVP, listo para refinamiento de seguridad antes de salir a producción

---

## Aclaración crítica antes de empezar

**Las passwords ya están hasheadas.** Supabase Auth usa **bcrypt con salt automático** internamente — nunca se almacenan en texto plano. Eso ya está resuelto a nivel de infraestructura. La preocupación sobre password hashing está cubierta sin necesidad de tocar nada.

**Lo que sí requiere trabajo** son las capas que rodean la autenticación: RLS, validación de tenant en Edge Functions, MFA, y algunos vectores de bypass que se detallan abajo.

---

## ⚠️ Bloqueador previo — proyecto Supabase desalineado

El MCP de Supabase está conectado al proyecto **NOMADEV.IO** (`rxgrhvrseejzbzneabrz`), cuyo schema (tablas `agents`, `conversations`, `dropi_orders`, `shopify_*`) **no corresponde a Skale Motors v2** (que tiene `vehicles`, `sales`, `branches`, `tenants`, `leads`, etc.).

**Implicación**:
- El advisor de Supabase corrió contra el proyecto equivocado.
- La auditoría de RLS y Edge Functions abajo se hizo **leyendo migraciones y código fuente del repo** (que sí es Skale Motors), no contra una BD productiva.

**Acción requerida**:
- Confirmar cuál es el `project_id` productivo de Skale Motors (probablemente otro de la organización).
- Re-correr `get_advisors` y `list_tables` contra el proyecto correcto.
- Si Skale Motors aún no tiene proyecto Supabase productivo creado, ese es el primer paso operativo.

---

## Resumen ejecutivo

| Severidad | Hallazgos | Bloqueante para MVP |
|-----------|-----------|----------------------|
| 🔴 CRÍTICO | 7 | Sí — fix antes de producción |
| 🟠 ALTO | 14 | Sí — fix antes de producción |
| 🟡 MEDIO | 12 | Recomendado pre-MVP, aceptable post-launch |
| 🟢 BAJO | 8 | Post-launch, hardening progresivo |

**Veredicto general**: La base es sólida (multi-tenant con RLS, JWT, headers HTTP fuertes, secrets bien gestionados). Los problemas críticos están concentrados en:
1. **Bypass de tenant para rol admin** en tablas de IA.
2. **Edge Functions sin auth** que llaman OpenAI/Anthropic (cost amplification).
3. **Fallback manual de signup** que crea usuarios saltándose validación.
4. **MFA no implementado** (single point of failure ante password leak).
5. **N8N_LEAD_INGEST_API_KEY env-key** que permite inyectar leads en cualquier branch.

---

## 🔴 CRÍTICOS (bloqueantes para MVP)

### C1. Bypass de aislamiento entre tenants en tablas de IA por rol admin
**Tablas**: `ai_conversations`, `ai_messages`, `ai_usage_logs`, `ai_branch_brain`
**Migración**: `supabase/migrations/20260803120000_ai_tables_tenant_isolation.sql:27-160`

La policy permisiva incluye `EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')` **sin filtrar por `tenant_id`**. Un admin del tenant A puede leer conversaciones, mensajes, logs de uso y "brain data" del tenant B.

**Fix**: combinar la condición admin con tenant: `(role = 'admin' AND tenant_id = current_tenant_id())`.

### C2. Edge Function `studio-ia-generate` sin auth → cost amplification OpenAI
**Archivo**: `supabase/functions/studio-ia-generate/index.ts:312`

No requiere JWT. Cualquier persona en internet puede llamarla, mandar `payload` arbitrario, y disparar llamadas a OpenAI con tu `OPENAI_API_KEY`. Un atacante puede vaciar el saldo / generar facturas inesperadas.

**Fix**: agregar `verify_jwt: true` en `supabase/config.toml`, validar `auth.uid()`, y aplicar rate-limit por usuario.

### C3. Edge Function `ai-generate` sin auth → cost amplification Anthropic
**Archivo**: `supabase/functions/ai-generate/index.ts:120-168`

Mismo problema que C2 pero contra `ANTHROPIC_API_KEY`. Sin JWT, sin rate-limit.

**Fix**: idéntico a C2.

### C4. Fallback manual de signup salta validación de provisioning
**Archivo**: `src/contexts/AuthContext.tsx:558-630`

Si el trigger `handle_new_user_signup` falla o tarda más de 1 segundo, el código frontend hace `supabase.from("users").insert()` con `role: "vendedor"` hardcoded, **bypassando la tabla `pending_vendor_provisions`** que es la que controla qué emails pueden crear cuenta y para qué tenant.

**Riesgo**: cualquiera con email puede signup-ar y obtener un usuario con rol `vendedor`. Si la RLS de `users` permite ese insert (lo permite por la policy de self-insert), tenés signups no autorizados.

**Fix**: eliminar el fallback manual; si el trigger falla, mostrar error y reintentar, no insertar desde el cliente. La creación de users debería ser exclusivamente vía trigger SECURITY DEFINER.

### C5. `N8N_LEAD_INGEST_API_KEY` env-key permite inyectar leads en cualquier branch
**Archivo**: `api/n8n-lead-ingest.ts:222-231, 306`

Cuando la env var global está seteada y matchea, **no hay lookup por branch en la BD** — solo se valida que el body tenga `branch_id`. Quien tenga la key puede mandar leads a cualquier `branch_id` que conozca/adivine.

**Fix**:
- Marcar la env-key como exclusiva para desarrollo (gate `process.env.NODE_ENV === 'development'`).
- En producción usar exclusivamente `lead_ingest_keys` (rotables, scopeadas a branch).
- Documentar la rotación y deprecar la env-key.

### C6. MFA no implementado
**Estado**: ningún componente de UI para TOTP/2FA. Solo existe `ui/input-otp.tsx` no usado.

**Riesgo**: si un admin filtra su password (phishing, reuse en otro sitio), el atacante toma la cuenta sin segundo factor. Para un SaaS B2B con datos financieros y de clientes, MFA al menos para roles `admin`/`gerente`/`jefe_jefe` es estándar.

**Fix**: implementar TOTP de Supabase Auth (`supabase.auth.mfa.enroll()`) en una pantalla `/settings/security`, opcional para vendedor, **obligatorio para roles privilegiados**.

### C7. Tabla `expense_types` sin RLS y sin `tenant_id`
**Migración**: `supabase/migrations/20260328120000_expense_types_limpieza_uber_comida_regalos_propinas.sql`

La tabla está sin `ENABLE ROW LEVEL SECURITY` y sin columna `tenant_id`. Cualquier usuario autenticado lee/escribe los tipos de gasto globalmente.

**Fix**:
- Decidir: ¿reference data global o por-tenant? Si global, dejar SELECT abierto pero **bloquear INSERT/UPDATE/DELETE** a roles admin del platform.
- Si por-tenant, agregar `tenant_id`, backfill, y policies estándar.

---

## 🟠 ALTOS (también bloqueantes)

### H1. Tabla `lead_ingest_keys` con RLS habilitada pero sin policies
**Migración**: `supabase/migrations/20260413120000_lead_ingest_keys_table.sql:42`

Solo tiene policy restrictiva. Sin policies permisivas, las RPCs `mint_lead_ingest_key`, `list_lead_ingest_keys`, `revoke_lead_ingest_key` funcionan vía SECURITY DEFINER, pero la UI directa fallaría. Riesgo: si en el futuro se intenta leer la tabla desde un service que no use la RPC, no devuelve nada y la UI rompe silenciosa.

**Fix**: agregar policy permisiva SELECT/UPDATE/DELETE filtrada por `tenant_id = current_tenant_id()` y rol `admin`/`jefe_jefe`.

### H2. Filtros por `branch_id` sin validar `tenant_id`
**Tablas**: `chileautos_saved_listings`, `ai_usage_logs`, `ai_branch_brain`

Patrón: `branch_id IN (SELECT branch_id FROM users WHERE id = auth.uid())`. Si `branch_id` colisiona o se reasigna entre tenants (improbable pero posible con UUIDs), permite cross-tenant leak.

**Fix**: extender el filtro a `branch_id IN (SELECT id FROM branches WHERE tenant_id = current_tenant_id())`.

### H3. Edge Function `whatsapp-send` no valida tenant del inbox
**Archivo**: `supabase/functions/whatsapp-send/index.ts:34-37, 83-101`

Verifica JWT pero permite que el usuario mande mensajes especificando `inboxId` o `branch_id` arbitrario. No hay check de que el inbox pertenezca al `tenant_id` del usuario.

**Fix**: derivar `tenant_id` desde `auth.uid()`, y rechazar si `inbox.tenant_id !== user.tenant_id`.

### H4. Edge Function `pending-task-create` con auth solo por API key
**Archivo**: `supabase/functions/pending-task-create/index.ts:57-64, 118`

No usa JWT. Auth por shared API key + service_role. Crea tareas en cualquier branch sin validar ownership.

**Fix**: scope la API key a un branch específico (igual que `lead_ingest_keys`), o requerir JWT y derivar tenant del usuario.

### H5. Edge Function `lead-state-update` actualiza estado en cualquier branch
**Archivo**: `supabase/functions/lead-state-update/index.ts:53-60, 122`

Auth por shared API key. El upsert se hace por `branch_id` del body sin validar que el caller sea dueño de ese branch.

**Fix**: validar que el `branch_id` del payload corresponda al tenant cuya key se usó.

### H6. Edge Function `lead-create` permite merge silencioso de leads
**Archivo**: `supabase/functions/lead-create/index.ts:174-223`

Con `update_existing=true`, si un atacante adivina `phone + branch_id`, sobreescribe el lead existente. No hay rate-limit; podría usarse para data tampering.

**Fix**: requerir un nonce/idempotency key, rate-limitar por API key, log audit de cada update.

### H7. Webhook `studio-ia-generate → n8n` sin firma
**Archivo**: `supabase/functions/studio-ia-generate/index.ts:297-310`

Forwardea POST a un webhook de n8n sin verificar token/firma. Cualquiera puede dispararlo si descubre la URL.

**Fix**: validar header `x-webhook-token` contra un secret en env, o firma HMAC.

### H8. Bypass `legacy_protected` en `ai-chat` y `support-chat`
**Archivos**: `supabase/functions/ai-chat/index.ts:174-185`, `supabase/functions/support-chat/index.ts:257`

Usuarios con flag `legacy_protected=true` (ej: `hessen@test.io`) saltan filtros de tenant en queries. Si esa cuenta se filtra, lee data de todos los tenants.

**Fix**: auditar usuarios con `legacy_protected`. Si es solo el dev/owner, restringir a un email allowlist hardcoded en el Edge; idealmente eliminar el bypass o convertirlo en logging-only.

### H9. Credenciales de marketplace almacenadas en plaintext
**Tabla**: `marketplace_connections.credentials` (JSON column)
**Tabla**: `meta_ads_connections.access_token` (text)

Tokens long-lived de Meta, MercadoLibre, ChileAutos en plaintext. Si la BD se compromete (backup leak, RLS bypass), exposición masiva.

**Fix**: cifrar con `pgcrypto` (`pgp_sym_encrypt`) usando una llave en Supabase Vault. Solo descifrar dentro de Edge Functions con service_role.

### H10. CORS wildcard en endpoints autenticados
**Archivos**: `supabase/functions/_shared/cors.ts:2`, `api/n8n-lead-ingest.ts:266`

`Access-Control-Allow-Origin: *` en todas las Edge Functions y en el ingest. Si una API key se filtra, cualquier origen puede usarla desde browser.

**Fix**: setear `Access-Control-Allow-Origin: <FRONTEND_ORIGIN>` para Edge Functions con JWT, y restringir el ingest a IPs/dominios de n8n conocidos.

### H11. Brute-force protection solo client-side en login
**Archivo**: `src/pages/Login.tsx:46-98`

Throttle 3-strikes/15s y 5-strikes/60s implementado en frontend. Un atacante hace requests directo contra `supabase.auth.signInWithPassword`, salteándose el throttle.

**Fix**: confiar en el rate-limit interno de Supabase Auth (existe pero no documentado en código), o implementar Edge Function intermedia con rate-limit por IP.

### H12. Race condition en signup → manual insert duplicado
**Archivo**: `src/contexts/AuthContext.tsx:581-615`

El timeout de 1s antes del fallback puede chocar con el trigger lento. Resultado: row duplicado o estado inconsistente.

**Fix**: junto con C4, eliminar el manual insert por completo.

### H13. Errors de Supabase filtran schema al cliente
**Archivo**: `api/n8n-lead-ingest.ts:244, 345, 405, 417, 456`

Errors crudos de Supabase (`error.message`) se devuelven al caller. Ejemplo: "column 'state_confidence' of relation 'leads' does not exist" — atacante mapea schema gratis.

**Fix**: try/catch + log full server-side, return generic message al cliente.

### H14. Endpoint `chileautos-scrape` público sin rate-limit
**Archivo**: `api/chileautos-scrape.ts`

Cualquiera puede scrappear ChileAutos vía tu Vercel. Costo de bandwidth + riesgo de IP-ban.

**Fix**: requerir auth (JWT o API key), rate-limit por IP, timeout en fetch (5s), cache 1-5min.

---

## 🟡 MEDIOS

### M1. `branch_sales_staff` con `USING (true)` permisiva
Migración `20260414120000_branch_sales_staff.sql:39`. La restrictiva sí filtra, pero la permisiva es código confuso y peligroso si se elimina la restrictiva.

### M2. Cache de profile en localStorage sin TTL
`src/contexts/AuthContext.tsx:81-99, 284-313`. Si admin cambia rol/tenant en otra tab, hasta 30s con permisos viejos. Agregar timestamp y TTL de 5min.

### M3. `Cache-Control: no-store` global rompe caché de assets
`vercel.json:7`. Bundles fingerprinted deberían cachear agresivo. Separar `/assets/*` con `public, max-age=31536000, immutable`.

### M4. Ausencia de session inactivity timeout
Sin auto-logout tras inactividad. Para apps usadas en concesionarias multi-usuario es desaconsejable.

### M5. Sin validación de tamaño en payloads de IA
`studio-ia-generate`, `ai-generate`, `vehicle-valuation`. Un usuario malintencionado puede mandar 100k tokens y reventar costos.

### M6. Direct `supabase.from(...)` desde componentes
Listados:
- `src/contexts/AuthContext.tsx:598`
- `src/hooks/useDashboardStats.ts:219-227`
- `src/pages/Leads.tsx:1081`
- `src/pages/Onboarding.tsx:334`
- `src/pages/VendorManagement.tsx:188`
- `src/components/settings/LeadIngestApiKeysSection.tsx:99`

Viola la regla del proyecto. No es vulnerabilidad directa, pero centralizar en services facilita auditoría.

### M7. `Documents.tsx:159` usa `document.write` con interpolación
Mitigado porque el contenido viene de React render, pero `${doc.document_number}` y campos del doc deberían escaparse explícitamente con un helper `escapeHTML`.

### M8. `chart.tsx:70` `dangerouslySetInnerHTML` para variables CSS
Si el config viene de input no validado, riesgo de CSS injection.

### M9. `main.tsx:69` `root.innerHTML` con escape parcial
Solo escapa `<` → `&lt;`. Falta escapar `>`, `"`, `'`, `&`.

### M10. Validación de tokens de password reset implícita
`src/pages/ResetPassword.tsx:23-39`. Confía 100% en Supabase JWT validation. Sin reuse prevention explícita.

### M11. `robots.txt` permite indexar todo
`public/robots.txt`. Sin `Disallow: /app/*`. Google podría indexar (cuando llegue auth, redirige, pero igual ruido).

### M12. Sin idempotency en `n8n-lead-ingest`
Replay attacks pueden duplicar updates. Agregar header `Idempotency-Key`.

---

## 🟢 BAJOS

### L1. `target="_blank"` sin `rel="noopener"` en algunos enlaces
`src/pages/Calls.tsx:311`, `src/pages/Listings.tsx:768`. Tabnabbing.

### L2. `n8n.ts:82` URL fallback hardcoded a `http://localhost:5678`
Solo si esa fallback se ejecuta en prod. Verificar.

### L3. `Landing.tsx` usa `window.location.href` en vez de `useNavigate`
Rompe SPA flow. Cambio cosmético.

### L4. HSTS preload no submitido
`hstspreload.org` con el dominio cuando esté listo.

### L5. Sin SRI en preconnect a Supabase (no aplica — es DNS prefetch).

### L6. Sin sitemap.xml.

### L7. Sin alertas configuradas en Sentry para errores de auth.

### L8. Recovery password reveals account existence parcialmente
`src/pages/ForgotPassword.tsx:27-32`. Mensaje genérico OK pero la lógica setea success=true en error path.

---

## Plan de remediación por fases

### **Fase 1 — Bloqueantes para MVP (1-2 sprints, ~5-10 días)**
*Objetivo: cerrar todo crítico y alto antes del primer cliente productivo.*

1. **C2 + C3**: agregar `verify_jwt: true` a `studio-ia-generate` y `ai-generate` (cambio en `supabase/config.toml` + redeploy). Implementar rate-limit por user_id (Postgres-side: tabla `ai_rate_limits` con conteo por hora). [4h]
2. **C1**: nueva migración `20260505_fix_ai_tables_admin_tenant_check.sql` que reescribe las policies SELECT removiendo el bypass admin sin tenant filter. [3h]
3. **C4 + H12**: eliminar fallback manual de signup en `AuthContext.tsx`. Reforzar trigger `handle_new_user_signup` para que sea idempotente y robusto. [4h]
4. **C5**: gatear `N8N_LEAD_INGEST_API_KEY` a `process.env.NODE_ENV !== 'production'`. Documentar migración a `lead_ingest_keys` rotables. [2h]
5. **C7**: nueva migración para enable RLS en `expense_types` con decisión global vs per-tenant. [2h]
6. **C6 (MFA)**: implementar TOTP enrollment en `/settings/security`. Componente con QR + verify. Forzar para admin/gerente al primer login post-deploy. [2 días]
7. **H1**: policies faltantes en `lead_ingest_keys`. [1h]
8. **H3 + H4 + H5**: agregar validación tenant en `whatsapp-send`, `pending-task-create`, `lead-state-update`. [4h]
9. **H6**: idempotency key obligatoria en `lead-create`. [2h]
10. **H7**: firma HMAC en webhook de n8n. [2h]
11. **H8**: auditar y restringir `legacy_protected`. [2h]
12. **H9**: cifrar credenciales de marketplaces con `pgcrypto`. Migración + update de Edge Functions que las leen. [1 día]
13. **H10**: restringir CORS de Edge Functions y `n8n-lead-ingest`. [2h]
14. **H13**: wrapper de errores en `n8n-lead-ingest` y Edge Functions. [3h]
15. **H14**: auth + rate-limit en `chileautos-scrape`. [3h]
16. **H2**: extender filtros branch_id con tenant_id en las 3 tablas. [2h]
17. **H11**: dejar throttle frontend pero documentar reliance en Supabase Auth rate-limit. Agregar Sentry alert para >10 fallos auth/min/IP. [2h]

**Total estimado**: ~50-60 horas de dev focused + 1 día de testing.

### **Fase 2 — Endurecimiento (post-MVP, primeros 30 días)**
*Objetivo: reducir superficie y operacionalizar seguridad.*

- M1 (cleanup `branch_sales_staff`)
- M2 (TTL en profile cache)
- M3 (cache headers para assets)
- M4 (inactivity timeout 30min)
- M5 (límites de payload IA)
- M6 (mover `supabase.from` a services)
- M7-M9 (escape HTML)
- M10 (reuse prevention en password reset)
- M11 (robots.txt restrictivo)
- M12 (idempotency en lead-ingest)
- L7 (Sentry alerts auth)
- HSTS preload submission

**Total estimado**: ~2 semanas part-time.

### **Fase 3 — Observabilidad continua**
- Audit log table (`audit_events`) con triggers en tablas sensibles (`users`, `sales`, `leads`, `vehicles`, `tenants`).
- Alertas Sentry para: `auth_failed > N/min`, `cross_tenant_query_attempt`, `service_role_call_unexpected`.
- Re-run del Supabase advisor mensual.
- Pen-test externo antes del cliente #10.

---

## Cosas que ya están bien (no tocar)

- ✅ Passwords hasheadas (bcrypt nativo Supabase Auth).
- ✅ JWT firmado, refresh automático.
- ✅ `.env` y `.mcp.json` en `.gitignore`. No hay secrets hardcoded en repo.
- ✅ `vercel.json` con CSP, HSTS, X-Frame-Options, Permissions-Policy, COOP/CORP/COEP — config muy fuerte.
- ✅ RLS habilitada en la mayoría de tablas críticas (vehicles, sales, leads, appointments, finance, etc.).
- ✅ Frontend usa solo anon key. Service role nunca expuesta al cliente.
- ✅ `meta-webhook` valida firma HMAC-SHA256 con timing-safe comparison.
- ✅ `chileautos-proxy` con SSRF guard (hostname allowlist).
- ✅ `vendor-user-create` valida password strength + email regex.
- ✅ Funciones SECURITY DEFINER (`current_tenant_id`, `current_user_role`, `provision_tenant`) correctamente scopeadas.

---

## Próximos pasos sugeridos

1. **Confirmar el `project_id` productivo de Skale Motors** y re-correr Supabase advisor allá.
2. **Aprobar este plan** o ajustar prioridades.
3. Crear plan de implementación detallado (vía skill `writing-plans`) con tareas atómicas y orden de ejecución.
4. Ejecutar Fase 1, item por item, con tests + verificación browser.
5. Re-auditar después de Fase 1 para confirmar que los criticos están cerrados.
