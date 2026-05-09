# Ranking de consignaciones por vendedor — Spec

**Fecha**: 2026-05-09
**Estado**: aprobado, en implementación
**Branch**: `feat/consignaciones-ranking`

## Objetivo

Cada vez que un usuario con rol `vendedor` agrega una consignación, su contador
sube +1 dentro del período. Se exponen dos vistas:

1. **Vendedor**: widget compacto en el sidebar (debajo del ranking de ventas).
2. **Admin / gerente / financiero / jefe_jefe / jefe_sucursal**: tabs
   `Ventas / Consignaciones` dentro de la página `/app/ranking` existente.

## Atribución y anti-fraude

- Atribución = `consignaciones.created_by` (uuid del creador).
- Hueco actual: el trigger `consignaciones_set_creator` solo setea `created_by`
  si el cliente lo manda NULL. Si manda un uuid de otro usuario, se respeta.
- Fix: trigger pasa a forzar `created_by := auth.uid()` siempre que haya sesión
  JWT (`auth.uid() is not null`). Service_role (scripts, seed) sigue intocado.
- Cambio de `created_by` post-creación: bloqueado por la RLS UPDATE existente
  (`with check created_by = auth.uid()` para no-admins). No requiere trigger
  adicional.

## Backend

Migración nueva con:

1. **Hardening del trigger BEFORE INSERT** sobre `consignaciones_set_creator`.
2. **Index** `(tenant_id, created_at, created_by) where created_by is not null`
   para acelerar el ranking.
3. **RPC** `public.get_consignaciones_ranking(p_from date, p_to date, p_branch_id uuid)`:
   - SECURITY DEFINER, mismo patrón RBAC que `get_sales_ranking`.
   - Filtra `users.role = 'vendedor'` (admins quedan fuera del podio).
   - Devuelve por vendedor: `consignaciones_count`, `publicadas_count`
     (`publicado = true`), `vendidas_count` (`status = 'vendido'`).
   - Orden: count DESC, publicadas DESC, nombre ASC.

## Frontend

| Archivo | Acción |
|---|---|
| `src/hooks/useSalesRanking.ts` | export de `resolveRange` |
| `src/hooks/useConsignacionesRanking.ts` | nuevo |
| `src/components/SidebarConsignacionesRanking.tsx` | nuevo |
| `src/components/AppSidebar.tsx` | mount del widget bajo el de ventas |
| `src/pages/SalespersonRanking.tsx` | tabs `Ventas` / `Consignaciones` |

Diferenciación visual del widget: icono `Boxes`, highlight `sky` (vs `pink`
del ranking de ventas).

## Tests

- `src/hooks/useConsignacionesRanking.test.ts`: valida `resolveRange` mes/semana/trimestre
  (regresión defensiva al export del helper) + parser de filas del RPC.
- No agrego tests de DB (el repo no tiene infra). El comportamiento del
  trigger anti-fraude se valida vía smoke manual + queda documentado.

## Anti-bug checklist

- [ ] Trigger no rompe scripts service_role (`auth.uid()` NULL → respeta cliente).
- [ ] RPC valida `p_from <= p_to` y exige tenant context.
- [ ] `servicio` / `inventario` reciben `42501`.
- [ ] `vendedor` / `jefe_sucursal` quedan forzados a su `branch_id`.
- [ ] Index parcial cubre la consulta (verificar EXPLAIN post-merge).
- [ ] `created_by IS NULL` (legacy) excluido del ranking.
- [ ] Filtro `role = 'vendedor'` excluye admins que también crean.
- [ ] Range timestamp incluye día final completo (`< (p_to + 1)::timestamptz`).
- [ ] Hook tipa el `rpc` como `as never` (sin regenerar database.ts).
- [ ] Sidebar widget oculto cuando colapsado o role ≠ vendedor.
- [ ] Tabs de admin comparten período/sucursal entre Ventas y Consignaciones.

## Workflow

Branch `feat/consignaciones-ranking` desde main. Draft PR tras primer commit.
Validación final: `npm run lint && npm run build && npm run test`.
