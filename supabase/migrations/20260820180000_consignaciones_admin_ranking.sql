-- Refinamiento del scope de consignaciones + RPC para ranking del admin.
--
-- Modelo nuevo (reemplaza al definido en 20260820120000):
--   - jefe_jefe: ve todo el tenant.
--   - cualquier user: ve las que él creó (created_by = auth.uid()).
--   - admin: además ve las consignaciones de cualquier user de su mismo branch
--            (su "equipo" — vendedores y otros roles del mismo branch).
--   - vendedor / financiero / jefe_sucursal / inventario / servicio:
--     SOLO ven las suyas (no las de pares del branch).
--
-- UPDATE/DELETE alineadas con SELECT.
--
-- RPC consignaciones_admin_ranking() devuelve, sobre la lista visible al caller
-- (RLS via SECURITY INVOKER), un agregado por creador:
--   user_id, full_name, email, avatar_url, role,
--   count_total, count_publicadas, count_stale (>= 7 días sin publicar)

-- ============================================================================
-- 1) Reemplazar policy SELECT
-- ============================================================================
drop policy if exists consignaciones_select_scoped on public.consignaciones;

create policy consignaciones_select_scoped
on public.consignaciones
for select
using (
  current_is_legacy_protected()
  or (
    tenant_id = current_tenant_id()
    and (
      current_user_role() = 'jefe_jefe'
      or created_by = (select auth.uid())
      or (
        current_user_role() = 'admin'
        and consignaciones.branch_id = (
          select u.branch_id from public.users u
          where u.id = (select auth.uid()) limit 1
        )
      )
    )
  )
);

-- ============================================================================
-- 2) UPDATE/DELETE alineadas
-- ============================================================================
drop policy if exists consignaciones_update_scoped on public.consignaciones;
drop policy if exists consignaciones_delete_scoped on public.consignaciones;

create policy consignaciones_update_scoped
on public.consignaciones
for update
using (
  current_is_legacy_protected()
  or (
    tenant_id = current_tenant_id()
    and (
      current_user_role() = 'jefe_jefe'
      or created_by = (select auth.uid())
      or (
        current_user_role() = 'admin'
        and consignaciones.branch_id = (
          select u.branch_id from public.users u
          where u.id = (select auth.uid()) limit 1
        )
      )
    )
  )
)
with check (
  current_is_legacy_protected()
  or (
    tenant_id = current_tenant_id()
    and (
      current_user_role() = 'jefe_jefe'
      or created_by = (select auth.uid())
      or (
        current_user_role() = 'admin'
        and consignaciones.branch_id = (
          select u.branch_id from public.users u
          where u.id = (select auth.uid()) limit 1
        )
      )
    )
  )
);

create policy consignaciones_delete_scoped
on public.consignaciones
for delete
using (
  current_is_legacy_protected()
  or (
    tenant_id = current_tenant_id()
    and (
      current_user_role() = 'jefe_jefe'
      or created_by = (select auth.uid())
      or (
        current_user_role() = 'admin'
        and consignaciones.branch_id = (
          select u.branch_id from public.users u
          where u.id = (select auth.uid()) limit 1
        )
      )
    )
  )
);

-- ============================================================================
-- 3) RPC para ranking — SECURITY INVOKER para que la RLS aplique al caller
-- ============================================================================
create or replace function public.consignaciones_admin_ranking()
returns table (
  user_id uuid,
  full_name text,
  email text,
  avatar_url text,
  role text,
  count_total int,
  count_publicadas int,
  count_stale int
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    u.id,
    u.full_name,
    u.email,
    u.avatar_url,
    u.role::text,
    count(c.id)::int                                                         as count_total,
    count(c.id) filter (where c.publicado)::int                              as count_publicadas,
    count(c.id) filter (
      where coalesce(c.publicado, false) = false
        and c.status not in ('vendido', 'devuelto')
        and c.created_at < now() - interval '7 days'
    )::int                                                                   as count_stale
  from public.consignaciones c
  join public.users u on u.id = c.created_by
  group by u.id, u.full_name, u.email, u.avatar_url, u.role
  order by count(c.id) desc, u.full_name nulls last;
$$;

revoke all on function public.consignaciones_admin_ranking() from public;
grant execute on function public.consignaciones_admin_ranking() to authenticated;
grant execute on function public.consignaciones_admin_ranking() to service_role;

comment on function public.consignaciones_admin_ranking() is
  'Ranking agregado de consignaciones por creador. Devuelve solo lo visible al caller (RLS via SECURITY INVOKER): admin ve su branch entero, vendedor solo lo suyo, jefe_jefe todo el tenant.';
