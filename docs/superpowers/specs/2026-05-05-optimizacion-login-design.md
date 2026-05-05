# Optimización del Login — Plan A (Quick Wins)

**Fecha**: 2026-05-05
**Alcance**: escritorio (Windows + macOS), todos los navegadores modernos
**Objetivo**: bajar el tiempo desde click "Iniciar sesión" hasta Dashboard/CRM interactivo, sin tocar schema de DB ni introducir Service Worker.

---

## 1. Contexto

El flujo de auth actual (`src/contexts/AuthContext.tsx`) ya tiene varias optimizaciones:
- Cache de perfil en `localStorage` con render optimista al reload.
- Dedup de `fetchUserProfile` en vuelo.
- `BroadcastChannel` para sync cross-tab.
- Throttle de revalidación (30s) en `visibilitychange` / `online`.
- `<link rel="preconnect">` al subdominio Supabase desde `index.html`.

Quedan cuellos de botella accionables sin tocar backend:
1. `signIn` ejecuta `signOut → signInWithPassword → fetchUserProfile` en serie. El primer `signOut` es una request de red redundante.
2. Después del `navigate(...)` post-login, las páginas montan y **recién ahí** disparan sus queries. El tiempo de bundle + tiempo de query no se solapan.
3. El loader post-login es un spinner genérico (`DashboardLoader`) — el usuario percibe la espera entera como "cargando".
4. No hay instrumentación del flujo de login: las optimizaciones siguientes serían a ciegas.
5. `fetchUserProfile` hace `SELECT *` (cleanup menor, pero deja la consulta opaca).

## 2. Cambios

Los cambios son **independientes** y van en commits atómicos para permitir rollback quirúrgico.

### 2.1 Eliminar el `pre-signOut` con red en `signIn`

**Archivo**: `src/contexts/AuthContext.tsx`
**Línea actual**: ~497

Reemplazar:
```ts
try { await supabase.auth.signOut(); } catch { /* ignore */ }
```
por:
```ts
try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* ignore */ }
```

**Razón**: el comentario actual dice que el signOut evita que `auto-refresh` restaure al usuario anterior si `signInWithPassword` falla. Esa garantía la cumple el scope `local` (limpia tokens en storage) sin pagar 1 RTT. Si `signInWithPassword` tiene éxito, sobrescribe la sesión igual; si falla, el local cleanup ya bastó.

**Ahorro estimado**: 200–500ms por login.

### 2.2 Prefetch de la primera query post-login antes del `navigate`

**Archivo**: `src/contexts/AuthContext.tsx` (dentro de `signIn`, después de `fetchUserProfileWithReason` exitoso, antes de `return`).

Después de tener `tenant_id` y `role`, disparar (sin `await`) un `queryClient.prefetchQuery` con la query primaria del destino:
- Si `role === 'vendedor'` → prefetch de leads del CRM (la misma key que usa `useLeads` por default).
- Otros roles → prefetch de stats del Dashboard (la misma key que usa `useDashboardStats`).

El `Login.tsx` ya prefetcha **el chunk** de CRM en idle; este cambio prefetcha **los datos**. Cuando `Dashboard`/`CRM` montan, su `useQuery` encuentra el cache caliente y renderiza sin pasar por loading state.

**Importante**: usar `queryClient.prefetchQuery` (no `fetchQuery`) para no bloquear el `navigate`. Si el prefetch falla, la página hace su query normal — no hay regresión.

**Las query keys exactas y los servicios a importar se confirman en el plan de implementación** (no en el spec) tras leer `useLeads.ts`, `useDashboardStats.ts`, `services/leads.ts`, `services/sales.ts`, etc.

**Ahorro estimado**: 300–800ms de tiempo percibido.

### 2.3 Skeleton específico en Dashboard y CRM (primer render)

**Archivos**: `src/pages/Dashboard.tsx`, `src/pages/CRM.tsx`.

Cuando `isLoading` de la query principal está en `true` y no hay `data`, renderizar un skeleton con la **forma real** de la página (cards de KPIs, columnas del Kanban, filas de la tabla) en lugar del spinner genérico.

Usar el componente `Skeleton` de shadcn/ui (ya disponible en `src/components/ui/skeleton.tsx`).

**Razón**: percepción. Cuando el usuario ve la estructura inmediatamente, el tiempo de carga real se siente menor aunque no haya cambiado.

### 2.4 Verificar y consolidar render optimista en reload (F5)

**Archivo**: `src/contexts/AuthContext.tsx:286-313`.

La lógica de "cache válido → render → revalidar en background" ya existe. Confirmar con prueba manual:
- Login normal, reload (F5).
- Esperado: Dashboard se ve **inmediatamente** (cache hit), `setLoading(false)` ocurre antes de que `fetchUserProfile` termine.
- Si no se cumple, ajustar para que `fetchUserProfile` se dispare como fire-and-forget en este path.

No es un cambio nuevo, es una verificación + ajuste si hace falta.

### 2.5 Instrumentación del flujo de login

**Archivos**: `src/contexts/AuthContext.tsx`, `src/lib/observability.ts` (o crear `src/lib/loginPerf.ts`).

Agregar `performance.mark(...)` en estos puntos:
- `signin.start` — al entrar a `signIn`
- `auth.signin.done` — después de `signInWithPassword` exitoso
- `profile.fetch.done` — después de `fetchUserProfile` exitoso
- `signin.complete` — antes de `return { error: null, role }`

En `Dashboard.tsx` / `CRM.tsx`, marcar:
- `first-paint-after-login` — al primer render con datos (no solo mount).

Crear un `performance.measure(...)` por cada par y enviarlos a Sentry como `Sentry.metrics.distribution(...)` (Sentry 10.45 lo soporta) o como spans de una transacción `login.flow`.

**Output esperado**: dashboard de Sentry con P50/P75/P95 de cada tramo del login.

### 2.6 `SELECT` con columnas explícitas en `fetchUserProfile`

**Archivo**: `src/contexts/AuthContext.tsx` (líneas ~120 y ~196).

Reemplazar `select("*")` por la lista explícita de columnas que efectivamente se mapean al objeto `User` (id, email, full_name, phone, role, tenant_id, legacy_protected, branch_id, is_active, avatar_url, crm_color, onboarding_completed, created_at, updated_at).

Win marginal, mejora auditabilidad y evita traer columnas nuevas no esperadas.

## 3. Out of scope

- **RPC bundle de sesión** (Plan B): un `get_session_bundle()` que devuelva perfil + datos críticos del Dashboard en 1 query. Se evaluará después de medir el impacto de A.
- **Service Worker** (Plan C): descartado en esta fase por el costo operacional de cache busting / versionado.
- **Cambios al schema de DB**.
- **Refactor de páginas grandes** (Finance, Inventory).
- **Login mobile**: el foco es escritorio (Windows + macOS).
- **Cambios al `signUp`, `resetPassword`, `signOut`**: solo se toca el flujo de login.

## 4. Riesgo y rollback

| Cambio | Riesgo principal | Mitigación / rollback |
|---|---|---|
| 2.1 `scope: 'local'` | SDK ignora el parámetro | 1 línea, `git revert` |
| 2.2 Prefetch | Query key incorrecta → no warmea | Si falla, la página hace su query normal; no rompe nada |
| 2.3 Skeleton | Cosmético | `git revert` |
| 2.4 Render optimista | Pantalla blanca si se rompe | Lógica ya existe; solo se verifica |
| 2.5 Telemetría | Solo añade datos | `git revert` |
| 2.6 `SELECT` columnas | Falta una columna y el `User` queda incompleto | Tests unitarios + `git revert` |

Cada cambio = 1 commit. Revert quirúrgico posible sin afectar a los demás.

## 5. Medición

### Baseline (antes de cualquier cambio)

5 logins en cada combo, registrar manual en una tabla:
- **Sistemas**: Win + Chrome, Win + Edge, macOS + Chrome, macOS + Safari.
- **Red**: sin throttle + Fast 3G simulado en DevTools.
- **Métrica**: tiempo desde `submit` del form de Login hasta primer render con datos en Dashboard/CRM (último paint significativo, medido visualmente con DevTools Performance).

### Post-cambios

Mismas 5 mediciones por combo.

### Criterio de éxito

- P50 sin throttle: ≥ 30% más rápido.
- P50 con Fast 3G: ≥ 40% más rápido.
- Sin regresiones en login normal, recovery de password ni cross-tab logout.

### Telemetría continua

`performance.measure` exportadas a Sentry sirven de monitor de regresión post-deploy.

## 6. Plan de QA

Tests manuales antes de declarar "listo":

1. **Login fresh** (sin cache): clear localStorage → login → verificar que llega a Dashboard/CRM con datos.
2. **Login con cache válido** (mismo user): login previo → signOut → login otra vez → verificar render optimista.
3. **Login con cuenta deshabilitada** (`is_active=false`): debe mostrar mensaje y no entrar.
4. **Login con perfil inexistente** en `public.users`: debe mostrar mensaje y signOut.
5. **Reload (F5)** con sesión activa: dashboard se ve **inmediatamente**, en background revalida.
6. **Cross-tab logout**: abrir 2 pestañas, signOut en una, verificar que la otra cierra sesión.
7. **Tab inactiva**: abrir, esperar 5 min, volver: revalida sin recargar.
8. **Cambio de cuenta**: signOut → login con otro user → verificar que `queryClient.clear()` borra el cache del user previo.
9. **Throttle Fast 3G**: las 5 mediciones del baseline deben mostrar mejora.

## 7. Criterios de aceptación

- [ ] Los 6 cambios commiteados como commits separados.
- [ ] Los 9 tests manuales pasan.
- [ ] Métricas baseline y post-cambio documentadas en un comment del commit final o en `docs/perf/login-baseline.md`.
- [ ] P50 sin throttle ≥ 30% más rápido.
- [ ] `npm run lint && npm run build && npm run test` pasan.
- [ ] No se introducen archivos `.md` nuevos fuera de `docs/superpowers/specs/` (este spec) y opcionalmente `docs/perf/login-baseline.md`.
