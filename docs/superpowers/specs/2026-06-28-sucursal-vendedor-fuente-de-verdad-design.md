# Sucursal del vendedor: fuente de verdad en Finanzas → Vendedores

**Fecha:** 2026-06-28
**Estado:** Aprobado (diseño) — pendiente plan de implementación

## Problema

La sucursal de cada vendedor vive hoy en dos tablas paralelas que se vinculan **por coincidencia de nombre**, no por ID:

- `users` — cuenta de login/CRM. Tiene `branch_id`. Es la columna que leen reportes, ranking, engagement y el scoping de RLS (jefe_sucursal ve su sucursal).
- `branch_sales_staff` — plantilla comercial editable en **Finanzas → Vendedores** (`VendorManagement.tsx`, ruta `/app/vendors`). Tiene su propio `branch_id`.

El vínculo es frágil en todos lados:

- `update_branch_sales_staff_profile` (RPC, `supabase/migrations/20260609150000_update_branch_sales_staff_profile.sql:74-75`) sincroniza `users.branch_id` haciendo match por `lower(trim(full_name))` **y la sucursal anterior**. Si el nombre difiere o la sucursal previa ya no coincide, la sync no hace nada en silencio (`users_synced = 0`).
- `get_seller_engagement_metrics` (`supabase/migrations/20260602120000_seller_engagement.sql:153-168`) arma `staff_user_map` por nombre.
- Dedupe de ranking (`20260420150000_sales_ranking_dedupe_staff_user.sql`, `20260420160000_sales_ranking_dedupe_by_name_tenant.sql`) por nombre.

Consecuencia: editás la sucursal de un vendedor en Finanzas → Vendedores y el reporte diario / ranking sigue mostrando la sucursal vieja, porque la supervisión lee `users.branch_id` (`src/lib/services/dailySalesReports.ts:279`) y la sync por nombre no prendió.

## Objetivo

`branch_sales_staff.branch_id` (Finanzas → Vendedores) es la **fuente de verdad** de la sucursal de cada vendedor. El vínculo staff↔user pasa a ser por **ID explícito**, no por nombre. La sucursal fluye de forma confiable a `users.branch_id`, que sigue siendo la columna operativa que todo el sistema lee.

Alcance: **todo el sistema** (reportes, ranking, engagement, dashboards), vía la columna espejo.

## Enfoque elegido (Enfoque 1)

FK explícita `users.sales_staff_id → branch_sales_staff(id)` + `users.branch_id` como **espejo sincronizado por trigger**. Mínimo cambio en las lecturas (siguen leyendo `users.branch_id`), scoping de RLS intacto, vínculo robusto.

Descartados:
- **Enfoque 2** (derivar la sucursal en cada lectura con join): toca muchos sitios de lectura y RLS igual necesita `users.branch_id` → modelo mixto, más riesgo.
- **Enfoque 3** (solo arreglar el match por nombre): sigue frágil ante homónimos, renombres y altas manuales. No cumple "por ID".

## Diseño

### 1. Schema (migración)

```sql
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS sales_staff_id uuid
  REFERENCES public.branch_sales_staff(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_sales_staff
  ON public.users(sales_staff_id) WHERE sales_staff_id IS NOT NULL;
```

`branch_sales_staff.branch_id` queda como fuente de verdad (sin cambio de columna; cambia quién manda).

### 2. Backfill (una vez, dentro de la misma migración)

Enlazar pares existentes con el mismo criterio que se usa hoy, para no introducir un match nuevo:

- Match por `lower(trim(u.full_name)) = lower(trim(s.full_name))` dentro del mismo `tenant_id`, ambos activos, `u.role = 'vendedor'`.
- Desempate determinista: preferir misma sucursal (`u.branch_id IS NOT DISTINCT FROM s.branch_id`), luego `u.created_at ASC` — idéntico a `staff_user_map` actual (`seller_engagement.sql:165-168`).
- 1 staff ↔ 1 user (DISTINCT ON staff). Lo ambiguo o sin match queda con `sales_staff_id = NULL` y conserva su `branch_id` actual (no se toca).

### 3. Trigger de sincronización + RPC

**Trigger** `AFTER UPDATE ON branch_sales_staff` cuando cambia `branch_id` (o `full_name`): propaga a todos los `users` con `sales_staff_id = NEW.id` el nuevo `branch_id` (y `full_name`), y sincroniza `auth.users.raw_user_meta_data.full_name`. Por ID, no por nombre.

**RPC** `update_branch_sales_staff_profile`: se reescribe para que la sincronización a `users`/`auth` use `sales_staff_id = p_staff_id` en vez del match por nombre+sucursal previa. El `UPDATE branch_sales_staff` que dispara el trigger puede dejar la sync de `users` al trigger (evitar doble escritura); el RPC mantiene su contrato de retorno (`users_synced`) contando las filas afectadas. Mantiene las validaciones actuales (solo admin, nombre no vacío/único, no inactivo).

> Nota de diseño: la sync vive en el trigger **o** en el RPC, **no en ambos**. Preferencia: trigger (cubre cualquier UPDATE de `branch_id`, incluido el del propio RPC), y el RPC solo cuenta el resultado.

### 4. Alta de vendedor

- `vendor-user-create` (`supabase/functions/vendor-user-create/index.ts`): aceptar `sales_staff_id?: string` opcional en el body. Validar formato UUID y que el staff pertenezca al `tenant_id` del caller. Setearlo en el `users` recién creado, junto al `created_by_user_id` (línea 178). Si viene inválido o de otro tenant → 400 explícito (no enlazar mal en silencio).
- `Users.tsx` (`submitCreate`, línea 302): incluir `sales_staff_id: selectedStaffId !== MANUAL_STAFF_VALUE ? selectedStaffId : null` en el payload de `createVendorMutation`.
- Alta manual ("Otro") sigue sin vínculo: `sales_staff_id = NULL`, branch gestionada como hoy.

## 5. Lecturas que migran de nombre → FK

- `get_seller_engagement_metrics`: `staff_user_map` pasa a `JOIN ... ON u.sales_staff_id = s.id` (en vez del match por nombre). El resto de la función no cambia.
- Dedupe de ranking (`sales_ranking_dedupe_staff_user`, `sales_ranking_dedupe_by_name_tenant`): dedupe staff↔user por `sales_staff_id` cuando existe; fallback por nombre solo para filas sin vínculo (compat con datos no enlazados).
- Supervisión de reportes (`buildDailyReportSupervisionRows`, `dailySalesReports.ts:271-312`): **sin cambio** — sigue leyendo `users.branch_id`, ahora siempre correcto vía trigger.
- `VendorManagement.tsx` `staffLinkedUserId` (línea 298-306): puede simplificarse para usar `sales_staff_id` directamente en vez de `engagementRows`, pero no es bloqueante.

### 6. Casos borde

- **Vendedor sin staff** (`sales_staff_id = NULL`): conserva su `branch_id`, editable como hoy. El trigger no lo toca.
- **Staff sin user**: vive solo en la plantilla; engagement/ranking ya lo contemplan vía `closed_by_staff_id`.
- **Homónimos**: dejan de ser un problema — el vínculo es por ID.
- **Reasignar staff a otra sucursal**: el trigger mueve a los users enlazados. Esto puede cambiar el scope de RLS de ese vendedor (deseado: refleja la sucursal real).
- **Borrar staff** (`ON DELETE SET NULL`): el user queda sin vínculo y conserva su última `branch_id`.

## Plan de entrega (PRs encadenados, ~≤300 líneas c/u)

1. **Schema + backfill + trigger + RPC** (migración) + regenerar tipos.
2. **Alta**: Edge Function `vendor-user-create` + `Users.tsx`.
3. **Lecturas**: `get_seller_engagement_metrics` + dedupe de ranking (migraciones) + simplificación opcional en `VendorManagement.tsx`.

## Verificación

- Editar sucursal de un vendedor enlazado en Finanzas → Vendedores → su `users.branch_id` cambia y el reporte diario / supervisión muestra la nueva sucursal.
- Alta de vendedor eligiendo un staff → `users.sales_staff_id` queda seteado; editar luego la sucursal del staff lo arrastra.
- Homónimos en distintas sucursales → cada uno mantiene su vínculo correcto.
- Backfill: contar `users` vendedor activos con vs. sin `sales_staff_id` tras la migración; revisar los no enlazados.
- `npm run lint && npm run build && npm run test` antes de `gh pr ready`. Correr `get_advisors` tras la migración (toca RLS-adyacente).

## Fuera de alcance

- Migrar `users.branch_id` a columna derivada/generada (seguimos con espejo).
- UI nueva en Finanzas → Vendedores más allá de lo existente.
- Unificar las dos tablas en una sola entidad.
