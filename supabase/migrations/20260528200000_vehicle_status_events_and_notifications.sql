-- Historial de cambios de estado en inventario + notificación admin cuando un vendedor
-- marca vendido / vendido_por_dueno. Aislamiento estricto por tenant_id.

-- ============================================================================
-- 1) vehicles.status_changed_at (último cambio de status, como leads)
-- ============================================================================
alter table public.vehicles
  add column if not exists status_changed_at timestamptz;

update public.vehicles
set status_changed_at = coalesce(updated_at, created_at)
where status_changed_at is null;

create or replace function public.vehicles_sync_status_changed_at()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.status_changed_at is null then
      new.status_changed_at := now();
    end if;
    return new;
  end if;
  if new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;
  return new;
end $$;

drop trigger if exists trg_vehicles_sync_status_changed_at on public.vehicles;
create trigger trg_vehicles_sync_status_changed_at
  before insert or update of status on public.vehicles
  for each row
  execute function public.vehicles_sync_status_changed_at();

create index if not exists idx_vehicles_status_changed_at
  on public.vehicles (tenant_id, status, status_changed_at)
  where tenant_id is not null;

-- ============================================================================
-- 2) vehicle_status_events (append-only, métricas)
-- ============================================================================
create table if not exists public.vehicle_status_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.vehicle_status_events is
  'Bitácora de transiciones de vehicles.status para auditoría y métricas.';

create index if not exists idx_vehicle_status_events_tenant_created
  on public.vehicle_status_events (tenant_id, created_at desc);

create index if not exists idx_vehicle_status_events_vehicle_created
  on public.vehicle_status_events (vehicle_id, created_at desc);

create index if not exists idx_vehicle_status_events_tenant_to_status
  on public.vehicle_status_events (tenant_id, to_status, created_at desc);

alter table public.vehicle_status_events enable row level security;

drop policy if exists tenant_restrict_vehicle_status_events on public.vehicle_status_events;
create policy tenant_restrict_vehicle_status_events on public.vehicle_status_events
  as restrictive for all to authenticated
  using (
    public.current_is_legacy_protected()
    or tenant_id = public.current_tenant_id()
  );

drop policy if exists vehicle_status_events_select on public.vehicle_status_events;
create policy vehicle_status_events_select on public.vehicle_status_events
  for select to authenticated
  using (
    public.current_is_legacy_protected()
    or tenant_id = public.current_tenant_id()
  );

-- INSERT solo vía trigger SECURITY DEFINER (sin policy INSERT para authenticated).

-- ============================================================================
-- 3) Trigger: log + notify admin (vendedor -> vendido | vendido_por_dueno)
-- ============================================================================
create or replace function public.vehicles_on_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_actor_id uuid;
  v_actor_role text;
  v_actor_name text;
  v_branch_name text;
  v_vehicle_desc text;
  v_message text;
  v_title text;
  v_sold_kind text;
  r record;
begin
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;

  v_tenant_id := new.tenant_id;
  if v_tenant_id is null and new.branch_id is not null then
    select b.tenant_id into v_tenant_id from public.branches b where b.id = new.branch_id;
  end if;
  if v_tenant_id is null then
    return new;
  end if;

  v_actor_id := auth.uid();

  insert into public.vehicle_status_events (
    tenant_id,
    branch_id,
    vehicle_id,
    from_status,
    to_status,
    changed_by,
    metadata
  )
  values (
    v_tenant_id,
    new.branch_id,
    new.id,
    case when tg_op = 'INSERT' then null else old.status end,
    new.status,
    v_actor_id,
    jsonb_build_object(
      'make', new.make,
      'model', new.model,
      'year', new.year,
      'patente', new.patente,
      'vin', new.vin
    )
  );

  if new.status not in ('vendido', 'vendido_por_dueno') then
    return new;
  end if;

  if v_actor_id is null then
    return new;
  end if;

  select u.role::text, u.full_name
  into v_actor_role, v_actor_name
  from public.users u
  where u.id = v_actor_id
    and u.tenant_id = v_tenant_id
    and coalesce(u.is_active, true) = true
  limit 1;

  if v_actor_role is distinct from 'vendedor' then
    return new;
  end if;

  if new.branch_id is not null then
    select b.name into v_branch_name from public.branches b where b.id = new.branch_id;
  end if;

  v_vehicle_desc := trim(
    coalesce(new.make, '') || ' ' ||
    coalesce(new.model, '') || ' ' ||
    coalesce(new.year::text, '')
  );
  if v_vehicle_desc = '' then
    v_vehicle_desc := coalesce(new.patente, new.vin, 'vehículo');
  end if;

  if new.status = 'vendido' then
    v_title := 'Vehículo vendido';
    v_sold_kind := 'vendido';
  else
    v_title := 'Vendido por dueño';
    v_sold_kind := 'vendido_por_dueno';
  end if;

  v_message := coalesce(v_actor_name, 'Un vendedor')
    || ' marcó como ' || lower(v_title) || ' el vehículo ' || v_vehicle_desc
    || case when v_branch_name is not null then ' — ' || v_branch_name else '' end;

  for r in
    select rn.user_id
    from public.resolve_notification_recipients(
      v_tenant_id,
      new.branch_id,
      array['admin']::text[],
      v_actor_id
    ) rn
  loop
    insert into public.notifications (
      tenant_id,
      branch_id,
      recipient_user_id,
      actor_user_id,
      type,
      title,
      message,
      entity_type,
      entity_id,
      action_url,
      metadata
    )
    values (
      v_tenant_id,
      new.branch_id,
      r.user_id,
      v_actor_id,
      'vehicle_sold',
      v_title,
      v_message,
      'vehicle',
      new.id,
      '/app/inventory?vehicle=' || new.id::text,
      jsonb_build_object(
        'vehicle_id', new.id,
        'make', new.make,
        'model', new.model,
        'year', new.year,
        'patente', new.patente,
        'from_status', case when tg_op = 'INSERT' then null else old.status end,
        'to_status', new.status,
        'sold_kind', v_sold_kind,
        'seller_id', v_actor_id,
        'seller_name', v_actor_name,
        'branch_id', new.branch_id,
        'branch_name', v_branch_name
      )
    );
  end loop;

  return new;
end $$;

drop trigger if exists trg_vehicles_on_status_change on public.vehicles;
create trigger trg_vehicles_on_status_change
  after insert or update of status on public.vehicles
  for each row
  execute function public.vehicles_on_status_change();

comment on function public.vehicles_on_status_change() is
  'Registra vehicle_status_events en cada cambio de status. Notifica admins (misma sucursal/tenant) cuando un vendedor marca vendido o vendido_por_dueno.';
