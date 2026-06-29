# Diseño — Switch CRM Venta / Consignación

**Fecha:** 2026-06-28
**Branch:** `feat/crm-switch-venta-consignacion` (encadenada sobre `feat/lead-tipo-venta-consignacion`, PR #117)
**Depende de:** columna `leads.lead_type` (`'venta' | 'consignacion'`, default `'venta'`) introducida en PR #117.

## Problema

Hoy "consignación" existe en dos formas desconectadas:

1. **Manual:** lead cargado en el formulario de Leads con `lead_type = 'consignacion'` (PR #117).
2. **Automática:** lead creado por el módulo `Consignaciones.tsx` al registrar un auto. Ese lead se taguea con `consignacion:<label>` y **se excluye del kanban del CRM** (`CRM.tsx:995-998`), por lo que vive solo en la página Consignaciones.

El CRM kanban mezcla/oculta tipos y no permite trabajar el pipeline de consignación. El objetivo: separar visualmente el pipeline de **Venta** del de **Consignación** sin que los leads se confundan, usando `lead_type` como única fuente de verdad.

## Objetivo

- Un **toggle** en `/app/crm` para alternar entre el tablero de leads de **Venta** y el de **Consignación**.
- Cada lead aparece **en un solo** tablero, según su `lead_type`.
- Filtro **Tipo** en la lista de Leads (`Leads.tsx`) para la tabla.
- Unificar el origen viejo (tag `consignacion:`) dentro de `lead_type` para que no queden dos listas paralelas.

## No-objetivos (YAGNI)

- No se crean etapas/pipeline distintos para consignación: ambos tableros reutilizan `CRM_PIPELINE_STAGES`.
- No se toca la página `Consignaciones.tsx` salvo marcar `lead_type` al crear el lead.
- No se crean rutas nuevas ni entradas de menú nuevas (el toggle vive dentro de `/app/crm`).
- No se agrega lógica especial al cambiar el tipo de un lead: conserva su `status`/etapa.

## Decisiones (tomadas con el usuario)

| Decisión | Elección |
|----------|----------|
| Forma del switch | Toggle in-page en `/app/crm` (no rutas separadas) |
| Qué muestra el toggle Consignación | **Todos** los de consignación (manuales + del módulo Consignaciones) |
| Reconciliación | `lead_type` = única fuente de verdad. Backfill de leads viejos + marcar en `Consignaciones.tsx` |
| Alcance | Toggle en CRM kanban **+** filtro Tipo en la lista de Leads |
| Default del toggle | Siempre **Venta**, para todos los roles |
| Persistencia | Recordar última elección por usuario (`localStorage`) + deep-link por `?tipo=` |
| Cambio de tipo de un lead en una etapa | Conserva su etapa; "se mueve" de tablero |

## Arquitectura

### 1. Migración de datos (SQL)

Nuevo archivo `supabase/migrations/<ts>_leads_backfill_lead_type_consignacion.sql`:

- Backfill: `UPDATE public.leads SET lead_type = 'consignacion'` para todo lead cuyo `tags` (JSONB array de strings) contenga un elemento que empiece con `consignacion:`.
  - Implementación: `WHERE jsonb_typeof(tags) = 'array' AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(tags) t WHERE t LIKE 'consignacion:%')`.
- Idempotente: re-ejecutar no cambia nada (los ya marcados siguen igual).
- Se aplica vía MCP `apply_migration` tras correr `get_advisors` (regla del proyecto). No toca RLS.

### 2. Forward-fill en el módulo Consignaciones

`Consignaciones.tsx` (~línea 990): al crear el lead, agregar `lead_type: 'consignacion'` al payload de `leadService.create`. (Sigue tagueando como hoy; el tag deja de ser el discriminador del CRM pero se conserva por compatibilidad/etiquetas.)

### 3. Capa de datos

- `src/lib/services/leads.ts` — `getAll`: nuevo filtro opcional `leadType?: 'venta' | 'consignacion'` → `if (filters?.leadType) query = query.eq('lead_type', filters.leadType)`.
- `src/hooks/useLeads.ts` — agregar `leadType` a `UseLeadsOptions`, al `queryKey` (`['leads', branchId, assignedTo, status, source, search, leadType]`) y al call de `getAll`.

> Nota: el CRM hoy trae todos los leads y filtra client-side. El toggle se resolverá **client-side** sobre `scopedLeads` (igual que el filtro de supervisión) para que el cambio de pestaña sea instantáneo y las métricas se recalculen sin refetch. El parámetro `leadType` del hook se usa en la **lista de Leads**. (Si a futuro el volumen lo exige, el CRM puede pasar a server-side reusando el mismo parámetro.)

### 4. CRM kanban — toggle

`src/pages/CRM.tsx`:

- Estado `crmLeadType: 'venta' | 'consignacion'`, inicializado desde `?tipo=` (URL) → `localStorage('crm.leadType')` → `'venta'`.
- Al cambiar: actualiza estado, `localStorage` y el query param `?tipo=` (sin recargar).
- UI: control segmentado (patrón `Tabs`/`ToggleGroup` ya usado en `SalespersonRanking.tsx:265`) encima del tablero, junto al selector de supervisión existente.
- **Filtrado:** en `filteredLeads` (`CRM.tsx:992-1024`), reemplazar la exclusión hardcodeada por tag (`isConsignacion → return false`) por `lead.lead_type === crmLeadType`. Tras el backfill, los leads del módulo Consignaciones quedan en el tablero de Consignación y desaparecen del de Venta.
- **Métricas:** `stageCounts` y demás KPIs derivan de `scopedLeads`; al aplicar el filtro por `crmLeadType` antes del cálculo, reflejan el tablero activo.
- `crmLeadType` se agrega a las dependencias de los `useMemo` relevantes.

### 5. Lista de Leads — filtro Tipo

`src/pages/Leads.tsx`: en la barra de filtros existente (estado/búsqueda) agregar un selector **Tipo** (Todos / Venta / Consignación). Filtrado client-side sobre la lista ya cargada (consistente con los filtros actuales de la página). La columna/badge Tipo ya es visible por PR #117.

## Flujo de datos

```
Form Leads (Tipo) ─┐
                   ├─► leads.lead_type ──► useLeads (cache) ──► CRM scopedLeads
Consignaciones ────┘                                              │
(lead_type='consignacion')                                       ├─ filtro crmLeadType ─► tablero Venta
Backfill SQL (tag→lead_type) ────────────────────────────────────┘                    └─► tablero Consignación
```

## Manejo de errores / edge cases

- Lead sin `lead_type` (imposible: columna NOT NULL DEFAULT 'venta') → cae en Venta.
- `?tipo=` con valor inválido → se ignora, default Venta.
- Lead que cambia de tipo desde el form de edición → al invalidarse la query de leads, reaparece en el tablero del nuevo tipo, misma etapa.
- Backfill sobre leads con `tags` null o no-array → la guarda `jsonb_typeof` los salta.

## Testing

- **Unit (servicio/hook):** `getAll` aplica `eq('lead_type', …)` cuando se pasa `leadType`; no lo aplica cuando se omite.
- **Unit (helper de filtrado CRM):** extraer/usar la lógica de partición por `lead_type` y testear que un lead de cada tipo cae en el tablero correcto y nunca en ambos.
- **Migración:** verificación manual vía SQL (`SELECT count(*) ... WHERE lead_type='consignacion'` antes/después) — documentar en el PR.
- Suite existente (`npm run test`) debe seguir verde; `npm run lint` y `tsc -p tsconfig.app.json` sin regresiones nuevas.

## Plan de entrega

- PR encadenado sobre #117. No mergear hasta que #117 esté en `main` (o rebasar si #117 cambia).
- Diff objetivo < ~300 líneas. Si se pasa, partir: (a) backfill + capa de datos, (b) toggle CRM, (c) filtro lista Leads.
