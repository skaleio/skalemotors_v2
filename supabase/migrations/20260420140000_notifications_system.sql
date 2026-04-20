-- Sistema de notificaciones in-app
--  - Tabla public.notifications (fan-out: una fila por destinatario)
--  - RLS: recipient-only SELECT/UPDATE, INSERT bloqueado (solo triggers SECURITY DEFINER / service_role)
--  - Triggers: lead -> status 'vendido', nueva consignación
--  - Publicación en supabase_realtime para entrega en tiempo real

create extension if not exists "pgcrypto";

-- ============================================================================
-- Tabla
-- ============================================================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  type text not null,
  title text not null,
  message text,
  entity_type text,
  entity_id uuid,
  action_url text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_recipient_created
  on public.notifications (recipient_user_id, created_at desc)
  where archived_at is null;

create index if not exists idx_notifications_recipient_unread
  on public.notifications (recipient_user_id)
  where read_at is null and archived_at is null;

create index if not exists idx_notifications_tenant_created
  on public.notifications (tenant_id, created_at desc);

create index if not exists idx_notifications_entity
  on public.notifications (entity_type, entity_id)
  where entity_id is not null;

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
on public.notifications
for select
to authenticated
using (
  recipient_user_id = auth.uid()
  and (tenant_id = public.current_tenant_id() or public.current_is_legacy_protected())
);

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own
on public.notifications
for update
to authenticated
using (
  recipient_user_id = auth.uid()
  and (tenant_id = public.current_tenant_id() or public.current_is_legacy_protected())
)
with check (
  recipient_user_id = auth.uid()
  and (tenant_id = public.current_tenant_id() or public.current_is_legacy_protected())
);

-- No hay policy INSERT/DELETE para authenticated: solo triggers SECURITY DEFINER y service_role.

-- ============================================================================
-- Realtime
-- ============================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      execute 'alter publication supabase_realtime add table public.notifications';
    exception when duplicate_object then null;
    end;
  end if;
end $$;

-- ============================================================================
-- Helper: resolver destinatarios por rol y sucursal dentro de un tenant
-- ============================================================================
create or replace function public.resolve_notification_recipients(
  p_tenant_id uuid,
  p_branch_id uuid,
  p_roles text[],
  p_exclude_user_id uuid
)
returns table (user_id uuid, user_branch_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.branch_id
  from public.users u
  where u.tenant_id = p_tenant_id
    and coalesce(u.is_active, true) = true
    and u.role::text = any (p_roles)
    and (p_exclude_user_id is null or u.id <> p_exclude_user_id)
    and (
      u.role::text in ('admin', 'gerente', 'financiero', 'jefe_jefe')
      or p_branch_id is null
      or u.branch_id is null
      or u.branch_id = p_branch_id
    )
$$;

revoke all on function public.resolve_notification_recipients(uuid, uuid, text[], uuid) from public;
grant execute on function public.resolve_notification_recipients(uuid, uuid, text[], uuid)
  to authenticated, service_role;

-- ============================================================================
-- Trigger 1: lead.status -> 'vendido'
-- ============================================================================
create or replace function public.notify_lead_sold()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_actor_id uuid;
  v_actor_name text;
  v_branch_name text;
  v_message text;
  r record;
begin
  if new.status is distinct from 'vendido' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'vendido' then
    return new;
  end if;

  v_tenant_id := new.tenant_id;
  if v_tenant_id is null and new.branch_id is not null then
    select b.tenant_id into v_tenant_id from public.branches b where b.id = new.branch_id;
  end if;
  if v_tenant_id is null then
    return new;
  end if;

  v_actor_id := coalesce(new.closed_by_staff_id, new.assigned_to, auth.uid());
  if v_actor_id is not null then
    select u.full_name into v_actor_name from public.users u where u.id = v_actor_id;
  end if;
  if new.branch_id is not null then
    select b.name into v_branch_name from public.branches b where b.id = new.branch_id;
  end if;

  v_message := coalesce(v_actor_name, 'Un vendedor')
               || ' cerró el lead "' || new.full_name || '"'
               || case when v_branch_name is not null then ' — ' || v_branch_name else '' end;

  for r in
    select rn.user_id
    from public.resolve_notification_recipients(
      v_tenant_id,
      new.branch_id,
      array['admin','gerente','jefe_jefe','jefe_sucursal']::text[],
      v_actor_id
    ) rn
  loop
    insert into public.notifications (
      tenant_id, branch_id, recipient_user_id, actor_user_id,
      type, title, message, entity_type, entity_id, action_url, metadata
    ) values (
      v_tenant_id, new.branch_id, r.user_id, v_actor_id,
      'lead_sold', 'Negocio cerrado', v_message,
      'lead', new.id,
      '/app/leads?openLead=' || new.id::text,
      jsonb_build_object(
        'lead_id', new.id,
        'lead_full_name', new.full_name,
        'seller_id', v_actor_id,
        'seller_name', v_actor_name,
        'branch_id', new.branch_id,
        'branch_name', v_branch_name
      )
    );
  end loop;

  return new;
end $$;

drop trigger if exists trg_notify_lead_sold on public.leads;
create trigger trg_notify_lead_sold
after insert or update of status on public.leads
for each row
execute function public.notify_lead_sold();

-- ============================================================================
-- Trigger 2: INSERT en public.consignaciones
-- ============================================================================
create or replace function public.notify_consignacion_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_actor_id uuid;
  v_actor_name text;
  v_branch_name text;
  v_vehicle_desc text;
  v_message text;
  r record;
begin
  v_tenant_id := new.tenant_id;
  if v_tenant_id is null and new.branch_id is not null then
    select b.tenant_id into v_tenant_id from public.branches b where b.id = new.branch_id;
  end if;
  if v_tenant_id is null then
    return new;
  end if;

  v_actor_id := coalesce(new.created_by, auth.uid());
  if v_actor_id is not null then
    select u.full_name into v_actor_name from public.users u where u.id = v_actor_id;
  end if;
  if new.branch_id is not null then
    select b.name into v_branch_name from public.branches b where b.id = new.branch_id;
  end if;

  v_vehicle_desc := trim(
    coalesce(new.vehicle_make, '') || ' ' ||
    coalesce(new.vehicle_model, '') ||
    case when new.vehicle_year is not null then ' ' || new.vehicle_year::text else '' end
  );
  if v_vehicle_desc = '' then
    v_vehicle_desc := 'vehículo en consignación';
  end if;

  v_message := 'Se agregó ' || v_vehicle_desc
               || ' (' || coalesce(new.owner_name, 'propietario s/d') || ')'
               || case when v_branch_name is not null then ' — ' || v_branch_name else '' end;

  for r in
    select rn.user_id
    from public.resolve_notification_recipients(
      v_tenant_id,
      new.branch_id,
      array['admin','gerente','jefe_jefe','jefe_sucursal','inventario']::text[],
      v_actor_id
    ) rn
  loop
    insert into public.notifications (
      tenant_id, branch_id, recipient_user_id, actor_user_id,
      type, title, message, entity_type, entity_id, action_url, metadata
    ) values (
      v_tenant_id, new.branch_id, r.user_id, v_actor_id,
      'consignacion_created', 'Nueva consignación', v_message,
      'consignacion', new.id,
      '/app/consignaciones',
      jsonb_build_object(
        'consignacion_id', new.id,
        'vehicle_make', new.vehicle_make,
        'vehicle_model', new.vehicle_model,
        'vehicle_year', new.vehicle_year,
        'owner_name', new.owner_name,
        'branch_id', new.branch_id,
        'branch_name', v_branch_name,
        'actor_id', v_actor_id,
        'actor_name', v_actor_name
      )
    );
  end loop;

  return new;
end $$;

drop trigger if exists trg_notify_consignacion_created on public.consignaciones;
create trigger trg_notify_consignacion_created
after insert on public.consignaciones
for each row
execute function public.notify_consignacion_created();
