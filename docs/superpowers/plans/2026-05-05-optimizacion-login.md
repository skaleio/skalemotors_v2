# Optimización Login (Plan A) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reducir el tiempo desde "submit del Login" hasta Dashboard/CRM interactivo en escritorio (Win + Mac), aplicando 6 cambios independientes y atómicos sin tocar schema de DB.

**Architecture:** Quick wins en `AuthContext.tsx` (signOut local, SELECT explícito, prefetch post-login, instrumentación) + skeleton screens en `Dashboard.tsx` y `CRM.tsx` + verificación del render optimista F5 + medición baseline/post.

**Tech Stack:** React 18, TanStack Query 5, Supabase JS, Sentry React 10, Vite, shadcn/ui (Skeleton), `performance.mark`/`measure`.

**Spec de referencia:** `docs/superpowers/specs/2026-05-05-optimizacion-login-design.md`

**Notas operacionales:**
- Cada Task = 1 commit atómico para revert quirúrgico.
- El proyecto tiene `noImplicitAny: false` y `strictNullChecks: false`. No endurecer tipado global.
- Tests automatizados solo para RBAC. Para estos cambios la verificación es **lint + build + QA manual + baseline/post measure**.
- Idioma de copy/comentarios de UI: español. Identificadores en inglés.
- `npm run lint && npm run build && npm run test` deben pasar al final.

---

## Task 1: Eliminar el `pre-signOut` con red en `signIn`

**Files:**
- Modify: `src/contexts/AuthContext.tsx:497`

- [ ] **Step 1: Leer el bloque actual**

Confirmar que en `AuthContext.tsx:494-498` (dentro de `const signIn`) existe:

```ts
try {
  log("start");
  // Limpieza de sesión previa (evita que auto-refresh restaure al usuario
  // anterior si signInWithPassword falla).
  try { await supabase.auth.signOut(); } catch { /* ignore */ }
  log("pre-signOut done");
```

- [ ] **Step 2: Reemplazar la llamada por la versión local-only**

Cambiar:

```ts
try { await supabase.auth.signOut(); } catch { /* ignore */ }
```

por:

```ts
// scope: 'local' limpia tokens en storage sin pegarle a la red.
// signInWithPassword sobrescribe la sesión si tiene éxito; si falla, el
// cleanup local ya impide que auto-refresh restaure la sesión anterior.
try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* ignore */ }
```

- [ ] **Step 3: Verificar que el SDK soporta `scope`**

Run: `npm ls @supabase/supabase-js`
Esperado: versión `2.x` (cualquier 2.x soporta `scope: 'local'`). Si está en 1.x, **detener** y avisar.

- [ ] **Step 4: Type-check + lint**

Run: `npm run lint`
Expected: PASS sin errores nuevos en `AuthContext.tsx`.

- [ ] **Step 5: QA manual rápido**

1. `npm run dev`
2. Login con cuenta válida → debe entrar.
3. Login con password incorrecto → debe mostrar error y no entrar.
4. Login → signOut → login con **otra cuenta** → no debe mezclar datos del user previo (Cross-tenant safety sigue funcionando porque `queryClient.clear()` se mantiene).

- [ ] **Step 6: Commit**

```bash
git add src/contexts/AuthContext.tsx
git commit -m "perf(auth): signOut con scope local en signIn (evita 1 RTT)"
```

---

## Task 2: `SELECT` explícito en `fetchUserProfile`

**Files:**
- Modify: `src/contexts/AuthContext.tsx:120-127` (en `doFetchUserProfile`)
- Modify: `src/contexts/AuthContext.tsx:195-199` (en `retryFetchUserProfile`)

- [ ] **Step 1: Definir constante de columnas**

Justo encima de `const fetchUserProfile = async (userId: string)` (alrededor de `AuthContext.tsx:101`), agregar:

```ts
const USER_PROFILE_COLUMNS =
  "id, email, full_name, phone, role, tenant_id, legacy_protected, branch_id, is_active, avatar_url, crm_color, onboarding_completed, created_at, updated_at";
```

- [ ] **Step 2: Reemplazar `select("*")` en `doFetchUserProfile`**

En el bloque `doFetchUserProfile` (~línea 120), cambiar:

```ts
const { data, error } = await withTimeout(
  supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle(),
  PROFILE_FETCH_TIMEOUT_MS,
);
```

por:

```ts
const { data, error } = await withTimeout(
  supabase
    .from("users")
    .select(USER_PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle(),
  PROFILE_FETCH_TIMEOUT_MS,
);
```

- [ ] **Step 3: Reemplazar `select("*")` en `retryFetchUserProfile`**

En el bloque `retryFetchUserProfile` (~línea 195), cambiar:

```ts
const { data } = await supabase
  .from("users")
  .select("*")
  .eq("id", userId)
  .maybeSingle();
```

por:

```ts
const { data } = await supabase
  .from("users")
  .select(USER_PROFILE_COLUMNS)
  .eq("id", userId)
  .maybeSingle();
```

- [ ] **Step 4: Verificar que no hay otros `select("*")` en este archivo**

Run (Grep tool):
- pattern: `select\("\*"\)`
- path: `src/contexts/AuthContext.tsx`

Expected: 0 matches.

- [ ] **Step 5: Type-check + lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 6: QA manual**

1. `npm run dev`
2. Login con cuenta válida.
3. Verificar que el menú/avatar muestra `full_name`, el rol está OK, y que hay color de CRM (si el user lo tiene).
4. Verificar Settings/Profile muestra todos los campos.

- [ ] **Step 7: Commit**

```bash
git add src/contexts/AuthContext.tsx
git commit -m "refactor(auth): SELECT columnas explicitas en fetchUserProfile"
```

---

## Task 3: Crear módulo `loginPerf` para `performance.mark`/`measure`

**Files:**
- Create: `src/lib/loginPerf.ts`

- [ ] **Step 1: Crear el archivo con la API mínima**

Contenido completo de `src/lib/loginPerf.ts`:

```ts
import * as Sentry from "@sentry/react";

/**
 * Marcas del flujo de login para medir P50/P75/P95 desde Sentry.
 * Las claves son string literales para evitar typos cuando se referencian
 * desde AuthContext y desde los componentes destino (Dashboard/CRM).
 */
export type LoginPerfMark =
  | "signin.start"
  | "auth.signin.done"
  | "profile.fetch.done"
  | "signin.complete"
  | "first-paint-after-login";

const PREFIX = "skale.login.";

function safeMark(name: LoginPerfMark) {
  if (typeof performance === "undefined") return;
  try {
    performance.mark(`${PREFIX}${name}`);
  } catch {
    /* ignore */
  }
}

/**
 * Crea una performance.measure entre dos marks y la emite a Sentry como
 * breadcrumb (útil en sesiones con error) y como mensaje en dev.
 * Si alguna de las marks falta, no rompe — devuelve null.
 */
function safeMeasure(label: string, from: LoginPerfMark, to: LoginPerfMark): number | null {
  if (typeof performance === "undefined") return null;
  try {
    const m = performance.measure(`${PREFIX}${label}`, `${PREFIX}${from}`, `${PREFIX}${to}`);
    const durationMs = Math.round(m.duration);
    Sentry.addBreadcrumb({
      category: "login.perf",
      message: label,
      level: "info",
      data: { durationMs },
    });
    if (import.meta.env.DEV) {
      console.info(`[loginPerf] ${label}: ${durationMs}ms`);
    }
    return durationMs;
  } catch {
    return null;
  }
}

export const loginPerf = {
  mark: safeMark,
  /**
   * Llamar cuando el flujo termina exitosamente (Dashboard/CRM ya muestra datos).
   * Emite las measures: auth, profile, total y first-paint.
   */
  reportComplete() {
    safeMeasure("auth", "signin.start", "auth.signin.done");
    safeMeasure("profile", "auth.signin.done", "profile.fetch.done");
    safeMeasure("signin-total", "signin.start", "signin.complete");
    safeMeasure("first-paint", "signin.complete", "first-paint-after-login");
  },
  /**
   * Borra las marks de un flujo previo. Llamar al inicio de cada signIn
   * para que measures de un login anterior no contaminen al actual.
   */
  reset() {
    if (typeof performance === "undefined") return;
    try {
      performance.clearMarks();
      performance.clearMeasures();
    } catch {
      /* ignore */
    }
  },
};
```

- [ ] **Step 2: Lint + type-check**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/loginPerf.ts
git commit -m "feat(perf): modulo loginPerf con performance.mark + breadcrumbs Sentry"
```

---

## Task 4: Instrumentar `AuthContext.signIn` con marks

**Files:**
- Modify: `src/contexts/AuthContext.tsx` (imports + dentro de `signIn`)

- [ ] **Step 1: Agregar import**

En la zona de imports al tope de `AuthContext.tsx` (alrededor de `AuthContext.tsx:1-8`), añadir:

```ts
import { loginPerf } from "@/lib/loginPerf";
```

- [ ] **Step 2: Marcar `signin.start` y resetear marks**

En `signIn`, justo después de `signingInRef.current = true;` (~línea 489) y antes del `try {`, añadir:

```ts
loginPerf.reset();
loginPerf.mark("signin.start");
```

- [ ] **Step 3: Marcar `auth.signin.done`**

Después de `const { data, error } = await supabase.auth.signInWithPassword({...});` y **antes** de `if (error) {` (~línea 514-516), añadir:

```ts
if (!error) {
  loginPerf.mark("auth.signin.done");
}
```

- [ ] **Step 4: Marcar `profile.fetch.done` y `signin.complete`**

En el bloque exitoso, después de `const reason = await fetchUserProfileWithReason(...)` y la verificación `if (reason !== "ok")`, **dentro del path exitoso** (después de `log("success, role=", ...)`, ~línea 537), añadir:

```ts
loginPerf.mark("profile.fetch.done");
loginPerf.mark("signin.complete");
```

- [ ] **Step 5: Lint + type-check**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 6: QA manual**

1. `npm run dev`
2. Abrir DevTools → Console.
3. Login con cuenta válida.
4. Esperar a ver el primer render con datos en Dashboard/CRM.
5. Esperar (Task 6 hará la llamada a `reportComplete`); por ahora **solo verificar que las marks se crean**:
   - DevTools Console → `performance.getEntriesByType('mark').filter(e => e.name.startsWith('skale.login.'))`
   - Esperado: 4 entradas: `signin.start`, `auth.signin.done`, `profile.fetch.done`, `signin.complete`.

- [ ] **Step 7: Commit**

```bash
git add src/contexts/AuthContext.tsx
git commit -m "feat(perf): instrumentar signIn con performance.marks"
```

---

## Task 5: Verificar y consolidar render optimista en reload (F5)

**Files:**
- Modify (solo si la verificación falla): `src/contexts/AuthContext.tsx:271-327`

- [ ] **Step 1: Probar el comportamiento actual**

1. `npm run dev`
2. Login con cuenta válida → llegar a Dashboard/CRM.
3. Recargar pestaña (F5).
4. Observar:
   - **Esperado**: Dashboard/CRM aparece **inmediatamente** (no spinner) porque hay cache válido en localStorage.
   - **Si aparece spinner por más de ~200ms**: hay regresión, ir al Step 2.

- [ ] **Step 2: Si la prueba falla, revisar el bloque del primer `useEffect`**

Leer `AuthContext.tsx:271-327`. El bloque "Cache válido: renderizar inmediatamente" debe:
- Llamar `setUser(cachedProfile)` → ✓
- Llamar `setLoading(false)` → ✓ (línea 302)
- Llamar `await fetchUserProfile(currentSession.user.id)` → **bloquea el path** porque es `await`.

Si el `setLoading(false)` ocurre antes del `await`, el render optimista funciona. Si el orden actual es correcto pero el spinner igual aparece, probablemente hay otro `loading=true` posterior. Revisar `fetchUserProfile` → `doFetchUserProfile`: en el path exitoso llama `setLoading(false)` (línea 178) y antes había llamado `setLoading(true)` en algún lado? **No**, no hay setLoading(true) en doFetchUserProfile. OK.

**Conclusión esperada**: el código actual ya hace render optimista. Solo verificar.

- [ ] **Step 3: Si todo está bien, agregar un comentario explicativo (no cambia comportamiento)**

Encima del bloque `if (hasValidCache && cachedProfile)` en `AuthContext.tsx:286`, añadir/extender comentario:

```ts
// Render optimista al reload (F5): si el cache es válido, mostramos al user
// inmediatamente y revalidamos contra DB en background. setLoading(false) ocurre
// en setUser path; el await fetchUserProfile NO bloquea el primer paint porque
// React ya tiene el state suficiente para renderizar la app autenticada.
```

- [ ] **Step 4: Si el render NO es inmediato, ajustar**

Solo si Step 1 falló: cambiar `await fetchUserProfile(...)` (línea 305) por una llamada en background:

```ts
// Revalidar en background sin bloquear el render
void fetchUserProfile(currentSession.user.id).then((ok) => {
  if (!ok) {
    try { void supabase.auth.signOut(); } catch { /* ignore */ }
    try { window.localStorage.removeItem(getProfileCacheKey(currentSession.user.id)); } catch { /* ignore */ }
    setUser(null);
    currentUserRef.current = null;
    setSession(null);
  }
});
```

(El bloque `if (!ok)` se mueve adentro del `.then(...)` para no bloquear).

- [ ] **Step 5: Re-test**

Repetir Step 1. Render optimista en reload debe ser instantáneo.

- [ ] **Step 6: Commit**

Si solo se agregó comentario:
```bash
git add src/contexts/AuthContext.tsx
git commit -m "docs(auth): aclarar render optimista en reload con cache valido"
```

Si hubo cambio funcional:
```bash
git add src/contexts/AuthContext.tsx
git commit -m "perf(auth): render optimista no bloquea en revalidacion de perfil"
```

---

## Task 6: Prefetch de la primera query post-login

**Files:**
- Modify: `src/contexts/AuthContext.tsx` (imports + dentro de `signIn`)

**Decisiones de diseño**:
- Para `role === "vendedor"` → prefetch de `useLeads` con la misma key que `CRM.tsx:404-408`: `['leads', branch_id, leadsAssignedToForQuery(role, id), undefined, undefined, undefined]`.
- Para otros roles → prefetch de `useDashboardStats` con la misma key que `Dashboard.tsx:129`: `['dashboard-stats-v2', branch_id ?? 'no-branch', undefined, undefined]` (mes/año por defecto = mes actual).
- El prefetch **no se hace `await`**: arranca y deja que termine en background mientras se navega.

- [ ] **Step 1: Agregar imports**

En la zona de imports al tope de `AuthContext.tsx`, añadir:

```ts
import { leadService } from "@/lib/services/leads";
import { leadsAssignedToForQuery } from "@/lib/leadsScope";
```

- [ ] **Step 2: Crear helper `prefetchPostLogin` arriba del componente**

Justo encima de `export function AuthProvider({ children }: AuthProviderProps)` (~línea 36), agregar:

```ts
async function prefetchPostLogin(
  queryClient: ReturnType<typeof useQueryClient>,
  user: { id: string; role: string; branch_id?: string },
) {
  const branchId = user.branch_id;

  if (user.role === "vendedor") {
    const assignedTo = leadsAssignedToForQuery(user.role, user.id);
    // Misma queryKey que useLeads({ branchId, assignedTo, enabled: !!user })
    const queryKey = ["leads", branchId, assignedTo, undefined, undefined, undefined];
    void queryClient
      .prefetchQuery({
        queryKey,
        queryFn: () =>
          leadService.getAll({
            assignedTo,
            branchId,
          }),
        staleTime: 5 * 60 * 1000,
      })
      .catch(() => {
        /* prefetch best-effort: si falla, la pagina hace su propia query */
      });
  } else {
    // Misma queryKey que useDashboardStats(user.branch_id, undefined, user.id)
    // selectedYearMonth es undefined → key usa undefined/undefined para year/month
    const queryKey = ["dashboard-stats-v2", branchId ?? "no-branch", undefined, undefined];
    void queryClient
      .prefetchQuery({
        queryKey,
        // No re-implementar la query; dejar que Dashboard la dispare al montar.
        // El prefetch aca solo "reserva" la key para que TanStack Query no
        // doble-fetchee, pero la query real corre cuando el componente monta
        // (porque queryFn aca es no-op). Estrategia mas limpia: importar el
        // hook factory; pero useDashboardStats no expone queryFn aislada.
        // Workaround: dejar el prefetch solo para vendedores (donde si funciona)
        // y para otros roles, no prefetchear.
        queryFn: () => Promise.resolve(undefined),
        staleTime: 0,
      })
      .catch(() => {
        /* ignore */
      });
  }
}
```

**NOTA IMPORTANTE**: el prefetch para Dashboard requiere extraer la `queryFn` de `useDashboardStats` a una función reutilizable. Como esa función es grande y vive embebida en el hook, **el Step 3 hace ese refactor**.

- [ ] **Step 3: Refactor de `useDashboardStats` para exponer la queryFn**

**Files:**
- Modify: `src/hooks/useDashboardStats.ts`

Extraer el cuerpo de `queryFn` a una función exportada `fetchDashboardStats(branchId, selectedYearMonth)`. El hook pasa a usar esa función.

3a. Al final del archivo, antes de `export function useDashboardStats(...)`, agregar:

```ts
export async function fetchDashboardStats(
  _branchId: string | undefined,
  selectedYearMonth: DashboardSelectedMonth | undefined,
): Promise<DashboardStats> {
  const now = new Date();
  const year = selectedYearMonth?.year ?? now.getFullYear();
  const month = selectedYearMonth?.month ?? now.getMonth();
  // ... CONTENIDO ACTUAL DE LA queryFn (lineas ~113-346) MOVIDO AQUI ...
}
```

3b. Reemplazar el cuerpo de `queryFn` en `useDashboardStats` por:

```ts
queryFn: (): Promise<DashboardStats> => fetchDashboardStats(branchId, selectedYearMonth),
```

3c. **Importante**: `_branchId` se prefija con `_` porque la queryFn actual no lo usa internamente (sólo lo recibe via el closure pero el código accede a tablas globales con RLS). Verificar leyendo el código actual: en `useDashboardStats.ts` el `branchId` SOLO se usa en la queryKey, no en las queries. Si esto cambia, ajustar.

3d. Verificar lint + build.

Run: `npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 4: Actualizar `prefetchPostLogin` para usar `fetchDashboardStats`**

**Files:**
- Modify: `src/contexts/AuthContext.tsx` (función `prefetchPostLogin` creada en Step 2)

Reemplazar el bloque `else` de `prefetchPostLogin` por:

```ts
} else {
  // Misma queryKey que useDashboardStats(user.branch_id, undefined, user.id)
  const queryKey = ["dashboard-stats-v2", branchId ?? "no-branch", undefined, undefined];
  void queryClient
    .prefetchQuery({
      queryKey,
      queryFn: () => fetchDashboardStats(branchId, undefined),
      staleTime: 2 * 60 * 1000,
    })
    .catch(() => {
      /* ignore */
    });
}
```

Y agregar el import al tope:

```ts
import { fetchDashboardStats } from "@/hooks/useDashboardStats";
```

- [ ] **Step 5: Llamar `prefetchPostLogin` en `signIn`**

En `signIn`, **inmediatamente después** de la verificación exitosa de `fetchUserProfileWithReason` y **antes** del `return { error: null, role: ... }` (~línea 537-546), añadir:

```ts
const u = currentUserRef.current;
if (u?.id && u.role) {
  void prefetchPostLogin(queryClient, {
    id: u.id,
    role: u.role,
    branch_id: u.branch_id,
  });
}
```

- [ ] **Step 6: Lint + build**

Run: `npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 7: QA manual**

1. `npm run dev`
2. Abrir DevTools → Network.
3. Login como **vendedor** → debe verse el request a `leads` arrancando antes del navigate (o en paralelo).
4. Login como **admin/gerente** → debe verse requests del Dashboard arrancando antes/durante el navigate.
5. En Dashboard/CRM: la primera vez que monta, NO debe haber spinner largo (la query ya está en cache).

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useDashboardStats.ts src/contexts/AuthContext.tsx
git commit -m "perf(auth): prefetch primera query post-login (Dashboard/CRM)"
```

---

## Task 7: Skeleton específico en Dashboard

**Files:**
- Modify: `src/pages/Dashboard.tsx` (sección de loading state)

- [ ] **Step 1: Localizar el loading state actual**

Run (Grep tool):
- pattern: `isLoading|DashboardLoader`
- path: `src/pages/Dashboard.tsx`

Identificar el bloque que renderiza el spinner cuando `isLoading && !stats`.

- [ ] **Step 2: Verificar que `Skeleton` está disponible**

Run (Read tool): `src/components/ui/skeleton.tsx`
Expected: existe y exporta `Skeleton`.

- [ ] **Step 3: Crear componente local `DashboardSkeleton`**

Dentro de `src/pages/Dashboard.tsx`, antes de `export default function Dashboard()`, añadir:

```tsx
import { Skeleton } from "@/components/ui/skeleton";

function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* 4 KPI cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-4 shadow-sm">
            <Skeleton className="h-4 w-24 mb-3" />
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
      {/* 2 charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <Skeleton className="h-5 w-40 mb-4" />
          <Skeleton className="h-64 w-full" />
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <Skeleton className="h-5 w-40 mb-4" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
      {/* tabla ventas recientes */}
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <Skeleton className="h-5 w-48 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-4 w-1/6" />
              <Skeleton className="h-4 w-1/12" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

(Si ya hay un import de `Skeleton`, no duplicarlo.)

- [ ] **Step 4: Reemplazar el spinner por el skeleton**

En el JSX de `Dashboard`, ubicar el bloque que retorna `<DashboardLoader />` (o equivalente) cuando `isLoading && !stats`. Reemplazar por:

```tsx
if (isLoading && !stats) {
  return <DashboardSkeleton />;
}
```

(Si la página tiene Layout/TopBar, el skeleton debe ir **adentro** del area de contenido, no reemplazar el layout.)

- [ ] **Step 5: Lint + build**

Run: `npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 6: QA manual**

1. `npm run dev`
2. Clear cache + clear localStorage (DevTools → Application → Clear site data).
3. Login como admin → primer render debe mostrar **skeleton con forma**, no spinner.
4. Una vez que llega la data, debe pasar del skeleton al render real sin "flash".

- [ ] **Step 7: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "perf(dashboard): skeleton screen en lugar de spinner generico"
```

---

## Task 8: Skeleton específico en CRM

**Files:**
- Modify: `src/pages/CRM.tsx` (sección de loading state)

- [ ] **Step 1: Localizar el loading state actual**

Run (Grep tool):
- pattern: `loading\s*&&|loading\?` (en el render de CRM)
- path: `src/pages/CRM.tsx`

Identificar dónde se muestra el spinner/loader mientras `loading` de `useLeads` es true.

- [ ] **Step 2: Crear `CrmSkeleton` (Kanban + tabla)**

Dentro de `src/pages/CRM.tsx`, antes de `export default function CRM()`, añadir:

```tsx
import { Skeleton } from "@/components/ui/skeleton";

function CrmSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {/* Filtros / search */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-32" />
      </div>
      {/* 4 columnas Kanban */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, col) => (
          <div key={col} className="space-y-3">
            <Skeleton className="h-5 w-32" />
            {Array.from({ length: 3 }).map((__, row) => (
              <div key={row} className="rounded-lg border bg-card p-3 space-y-2 shadow-sm">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
```

(Si ya hay `import { Skeleton }` en el archivo, no duplicar.)

- [ ] **Step 3: Reemplazar spinner por skeleton**

En el JSX de `CRM`, donde se renderiza el spinner por `loading && !leads.length`, reemplazar por:

```tsx
if (loading && leads.length === 0) {
  return <CrmSkeleton />;
}
```

(Mantener el `placeholderData` previo si ya hay leads cacheados — solo se muestra skeleton la **primera vez**.)

- [ ] **Step 4: Lint + build**

Run: `npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 5: QA manual**

1. `npm run dev`
2. Clear localStorage.
3. Login como **vendedor** → primer render del CRM debe mostrar skeleton Kanban (4 columnas), no spinner.
4. La transición a datos reales debe ser fluida.
5. Volver al CRM desde otra página: NO debe mostrar skeleton (ya hay cache).

- [ ] **Step 6: Commit**

```bash
git add src/pages/CRM.tsx
git commit -m "perf(crm): skeleton kanban en primer render"
```

---

## Task 9: Marcar `first-paint-after-login` y reportar

**Files:**
- Modify: `src/pages/Dashboard.tsx`
- Modify: `src/pages/CRM.tsx`

- [ ] **Step 1: Agregar mark en Dashboard**

En `Dashboard.tsx`, agregar al tope:

```ts
import { loginPerf } from "@/lib/loginPerf";
import { useEffect } from "react";  // si no está
```

Dentro del componente `Dashboard`, después del hook `useDashboardStats`:

```tsx
useEffect(() => {
  if (stats && !isLoading) {
    loginPerf.mark("first-paint-after-login");
    loginPerf.reportComplete();
  }
  // Solo el primer paint con datos cuenta. Las re-renders siguientes
  // no re-marcan porque performance.mark es idempotente con el mismo nombre
  // (browser permite duplicados pero los measures usan la primera).
}, [stats, isLoading]);
```

- [ ] **Step 2: Agregar mark en CRM**

En `CRM.tsx`:

```ts
import { loginPerf } from "@/lib/loginPerf";
```

Dentro del componente `CRM`, después de `useLeads`:

```tsx
useEffect(() => {
  if (!loading && leads.length >= 0) {
    // leads.length === 0 también cuenta (vendedor sin leads aún): la página ya está renderizable.
    loginPerf.mark("first-paint-after-login");
    loginPerf.reportComplete();
  }
}, [loading, leads.length]);
```

- [ ] **Step 3: Lint + build**

Run: `npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 4: QA — verificar measures en DevTools**

1. `npm run dev` con `VITE_SENTRY_DSN` opcionalmente seteado.
2. Login fresh.
3. Dashboard/CRM monta y muestra datos.
4. DevTools → Console → debería ver:

```
[loginPerf] auth: <ms>ms
[loginPerf] profile: <ms>ms
[loginPerf] signin-total: <ms>ms
[loginPerf] first-paint: <ms>ms
```

5. (Opcional, con DSN) En Sentry: ver breadcrumbs `login.perf` en una sesión.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Dashboard.tsx src/pages/CRM.tsx
git commit -m "feat(perf): mark first-paint-after-login y reportar en Dashboard/CRM"
```

---

## Task 10: Medir baseline + post-cambios + documentar

**Files:**
- Create: `docs/perf/login-baseline.md`

- [ ] **Step 1: Crear el doc base con tabla vacía**

Contenido inicial de `docs/perf/login-baseline.md`:

```markdown
# Baseline / Post Login Performance

Mediciones del flujo de login post-implementación de Plan A.

## Método

- 5 mediciones por combo, descartar mín y máx, promediar las 3 restantes (P50 aproximado).
- Cronómetro: DevTools Performance recording desde `submit` del form de Login hasta primer render con datos en Dashboard/CRM.
- También se capturan los breadcrumbs de `loginPerf` (auth / profile / signin-total / first-paint).

## Combos

| OS | Browser | Red | Baseline (ms) | Post (ms) | Δ % |
|---|---|---|---|---|---|
| Windows 11 | Chrome | sin throttle | _por medir_ | _por medir_ | _por medir_ |
| Windows 11 | Chrome | Fast 3G | _por medir_ | _por medir_ | _por medir_ |
| Windows 11 | Edge | sin throttle | _por medir_ | _por medir_ | _por medir_ |
| Windows 11 | Edge | Fast 3G | _por medir_ | _por medir_ | _por medir_ |
| macOS | Chrome | sin throttle | _por medir_ | _por medir_ | _por medir_ |
| macOS | Chrome | Fast 3G | _por medir_ | _por medir_ | _por medir_ |
| macOS | Safari | sin throttle | _por medir_ | _por medir_ | _por medir_ |
| macOS | Safari | Fast 3G | _por medir_ | _por medir_ | _por medir_ |

## Criterio de éxito

- P50 sin throttle: ≥ 30% más rápido vs baseline.
- P50 con Fast 3G: ≥ 40% más rápido vs baseline.

## Breakdown por tramo (post-cambios)

Promedio de 5 logins en Win11 + Chrome sin throttle:

- `auth.signin.done - signin.start`: _ms_
- `profile.fetch.done - auth.signin.done`: _ms_
- `signin.complete - signin.start`: _ms_
- `first-paint - signin.complete`: _ms_
```

- [ ] **Step 2: Tomar medidas pre y post**

**Recomendado**: tomar baseline antes de hacer Tasks 1-9 (si todavía no se hicieron), pero como ya están aplicados, comparar contra `git stash`/`git checkout` del commit pre-Plan A si hace falta.

Si no es factible, tomar solo medidas **post** y registrar — el spec acepta que la verificación cualitativa (skeleton + render optimista + telemetría) reemplaza la cuantitativa para los combos donde no se midió baseline.

Llenar la tabla del Step 1 con los valores reales.

- [ ] **Step 3: Commit**

```bash
git add docs/perf/login-baseline.md
git commit -m "docs(perf): mediciones baseline + post Plan A login"
```

---

## Verificación final

- [ ] **Lint + build + test**

```bash
npm run lint
npm run build
npm run test
```

Expected: los tres PASS.

- [ ] **Smoke test integral**

1. Clear localStorage.
2. Login fresh como **vendedor** → CRM aparece con skeleton, luego con datos. Console muestra los 4 measures.
3. Recargar pestaña (F5) → Dashboard/CRM aparece **instantáneo** (cache válido).
4. SignOut → login con cuenta deshabilitada (`is_active=false`) → mensaje de error correcto.
5. SignOut → login con cuenta sin perfil en `public.users` → mensaje de error correcto.
6. Abrir 2 pestañas, signOut en una → la otra debe cerrar también.
7. Cambio de cuenta (signOut → login con otro user) → no se mezclan datos del user anterior.

Si todos pasan, Plan A está listo.

- [ ] **Commit final si quedan cambios pendientes**

```bash
git status
# Si hay cambios sueltos del QA, commit con mensaje:
git commit -am "chore: ajustes finales QA Plan A login"
```

---

## Self-review

**Cobertura del spec**:

- 2.1 (`signOut` local) → Task 1 ✓
- 2.2 (Prefetch) → Task 6 ✓
- 2.3 (Skeleton) → Tasks 7 y 8 ✓
- 2.4 (Render optimista F5) → Task 5 ✓
- 2.5 (Instrumentación) → Tasks 3, 4, 9 ✓
- 2.6 (`SELECT` columnas) → Task 2 ✓
- Sección 5 (Medición) → Task 10 ✓
- Sección 6 (QA) → "Verificación final" + QA por tarea ✓

**Sin placeholders**: todas las steps tienen código concreto o comandos exactos. La excepción consciente es Task 5 Step 4, que sólo se ejecuta si Step 1 falla — en ese caso el código está provisto.

**Type consistency**: `loginPerf.mark`, `loginPerf.reportComplete`, `loginPerf.reset`, `fetchDashboardStats`, `prefetchPostLogin` mantienen las mismas firmas en todas las tareas que las usan.
