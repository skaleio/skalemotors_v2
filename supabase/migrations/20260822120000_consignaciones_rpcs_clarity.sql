-- ============================================================================
-- Clarity + hardening sobre las dos RPCs de consignaciones que conviven en el
-- schema. NO son duplicadas: sirven a vistas distintas. Esta migración:
--
-- (1) Documenta explícitamente el propósito de cada una vía COMMENT, para que
--     un desarrollador nuevo entienda por qué coexisten sin tener que leer el
--     frontend.
-- (2) Re-aplica el revoke de EXECUTE a `anon` sobre get_consignaciones_ranking
--     (Supabase grantea por default a anon en funciones nuevas; alineamos
--     con el patrón hardening de get_sales_ranking + las migraciones
--     20260507120300/120500). En la base ya está aplicado; este código deja
--     la migración consistente para que un fresh deploy quede igual.
-- ============================================================================

-- (1) Documentar consignaciones_admin_ranking ---------------------------------
comment on function public.consignaciones_admin_ranking() is
  'Panel "mi equipo" en /app/consignaciones. Devuelve, para CADA usuario que '
  'haya creado consignaciones visibles al caller (RLS via SECURITY INVOKER): '
  'count_total, count_publicadas, count_stale (≥7 días sin publicar). Sin '
  'filtros de período (lifetime). NO filtra por rol → incluye admin, vendedor, '
  'jefe_sucursal, etc. Pensada para que un admin haga drill-down al equipo. '
  'NO confundir con get_consignaciones_ranking (esa es ranking competitivo de '
  'vendedores con períodos y delta).';

-- (2) Documentar get_consignaciones_ranking + revoke a anon -------------------
comment on function public.get_consignaciones_ranking(date, date, uuid) is
  'Ranking competitivo de VENDEDORES en /app/ranking + sidebar widget. '
  'SECURITY DEFINER, RBAC server-side. Acepta período (p_from, p_to) y '
  'p_branch_id opcional. Filtra users.role = vendedor (admins fuera del '
  'podio aunque también creen consignaciones). NO confundir con '
  'consignaciones_admin_ranking (esa es panel de equipo lifetime, todos los '
  'roles).';

-- Defaults de Supabase: las funciones nuevas reciben EXECUTE para anon. Lo
-- revocamos para alinear con get_sales_ranking y las migraciones
-- 20260507120300_revoke_anon_execute_security_definer / 120500_revoke_public_*.
revoke execute on function public.get_consignaciones_ranking(date, date, uuid) from anon;
