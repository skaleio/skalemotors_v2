-- ============================================================================
-- Ranking de consignaciones por vendedor (creador) + hardening anti-fraude.
--
-- (1) Endurece el trigger BEFORE INSERT consignaciones_set_creator: pasa a
--     forzar created_by := auth.uid() siempre que haya sesión JWT, ignorando
--     lo que mande el cliente. Service_role queda intocado (auth.uid() es NULL)
--     para no romper provisioning / seeds / scripts.
--
-- (2) Index parcial sobre (tenant_id, created_at, created_by) para que el
--     ranking escale.
--
-- (3) RPC public.get_consignaciones_ranking — gemela de get_sales_ranking:
--     SECURITY DEFINER, RBAC server-side, devuelve solo agregados.
--
-- Nota: la inmutabilidad de created_by post-creación ya está garantizada por
-- la RLS UPDATE consignaciones_update_scoped (with check created_by = auth.uid()
-- para no-admins). No se agrega trigger adicional.
-- ============================================================================

-- (1) Hardening del trigger ----------------------------------------------------
create or replace function public.consignaciones_set_creator()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Si hay sesión, fijar el creador al uid del JWT y descartar lo que mande
  -- el cliente. Esto cierra el hueco de "asignarse consignaciones ajenas".
  if auth.uid() is not null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

revoke execute on function public.consignaciones_set_creator() from public;
revoke execute on function public.consignaciones_set_creator() from anon;
revoke execute on function public.consignaciones_set_creator() from authenticated;

comment on function public.consignaciones_set_creator() is
  'BEFORE INSERT trigger sobre consignaciones. Fuerza created_by = auth.uid() '
  'cuando hay sesión JWT (anti-fraude). Para service_role (auth.uid() NULL) '
  'respeta el valor enviado por el cliente, lo que permite scripts y seeds.';

-- (2) Index --------------------------------------------------------------------
create index if not exists idx_consignaciones_ranking_tenant_created
  on public.consignaciones (tenant_id, created_at, created_by)
  where created_by is not null;

-- (3) RPC ----------------------------------------------------------------------
drop function if exists public.get_consignaciones_ranking(date, date, uuid);

create or replace function public.get_consignaciones_ranking(
  p_from date,
  p_to date,
  p_branch_id uuid default null
)
returns table (
  seller_key text,
  seller_id uuid,
  seller_name text,
  branch_id uuid,
  branch_name text,
  consignaciones_count bigint,
  publicadas_count bigint,
  vendidas_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.current_user_role();
  v_tenant uuid := public.current_tenant_id();
  v_user uuid := auth.uid();
  v_user_branch uuid;
  v_effective_branch uuid := p_branch_id;
begin
  if v_tenant is null then
    raise exception 'No tenant context' using errcode = '42501';
  end if;

  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'Invalid date range' using errcode = '22023';
  end if;

  if v_role in ('servicio', 'inventario') then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  select u.branch_id into v_user_branch from public.users u where u.id = v_user;

  -- Vendedor / jefe_sucursal: forzar a su sucursal (no eligen p_branch_id).
  if v_role in ('vendedor', 'jefe_sucursal') then
    v_effective_branch := v_user_branch;
    if v_effective_branch is null then
      return;
    end if;
  end if;

  return query
  with filtered as (
    select
      c.created_by,
      c.branch_id,
      c.status,
      c.publicado
    from public.consignaciones c
    where c.tenant_id = v_tenant
      and c.created_by is not null
      and c.created_at >= p_from::timestamptz
      and c.created_at < (p_to + 1)::timestamptz
      and (v_effective_branch is null or c.branch_id = v_effective_branch)
  ),
  by_user as (
    select
      'uid:' || f.created_by::text as seller_key,
      f.created_by as seller_id,
      coalesce(u.full_name, 'Usuario sin nombre') as seller_name,
      (array_agg(f.branch_id order by f.branch_id) filter (where f.branch_id is not null))[1] as branch_id,
      count(*)::bigint as consignaciones_count,
      count(*) filter (where coalesce(f.publicado, false) = true)::bigint as publicadas_count,
      count(*) filter (where f.status = 'vendido')::bigint as vendidas_count
    from filtered f
    join public.users u on u.id = f.created_by
    where u.role::text = 'vendedor'
    group by f.created_by, u.full_name
  )
  select
    by_user.seller_key,
    by_user.seller_id,
    by_user.seller_name,
    by_user.branch_id,
    b.name as branch_name,
    by_user.consignaciones_count,
    by_user.publicadas_count,
    by_user.vendidas_count
  from by_user
  left join public.branches b on b.id = by_user.branch_id
  order by by_user.consignaciones_count desc,
           by_user.publicadas_count desc,
           by_user.seller_name asc;
end;
$$;

comment on function public.get_consignaciones_ranking(date, date, uuid) is
  'Ranking de vendedores por consignaciones creadas en el rango [p_from, p_to]. '
  'Cuenta sobre public.consignaciones agrupado por created_by, filtrando '
  'users.role = vendedor. SECURITY DEFINER: expone solo agregados; '
  'vendedor / jefe_sucursal quedan forzados a su sucursal.';

revoke all on function public.get_consignaciones_ranking(date, date, uuid) from public;
grant execute on function public.get_consignaciones_ranking(date, date, uuid) to authenticated;
grant execute on function public.get_consignaciones_ranking(date, date, uuid) to service_role;
