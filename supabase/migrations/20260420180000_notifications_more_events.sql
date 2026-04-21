-- Eventos adicionales de notificación in-app:
--   1) lead_contactado  → lead pasa a status='contactado' (admin-only, excluye actor)
--   2) lead_assigned    → un lead es asignado a un vendedor (notifica SOLO al asignado si rol='vendedor', excluye actor)
--
-- Complementan a los triggers ya existentes:
--   - lead_sold
--   - consignacion_created
--   - consignacion_stale (vía RPC)

-- ============================================================================
-- Trigger: notify_lead_contactado
-- ============================================================================
create or replace function public.notify_lead_contactado()
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
  -- Disparar solo en transición A 'contactado'
  if new.status is distinct from 'contactado' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'contactado' then
    return new;
  end if;

  v_tenant_id := new.tenant_id;
  if v_tenant_id is null and new.branch_id is not null then
    select b.tenant_id into v_tenant_id from public.branches b where b.id = new.branch_id;
  end if;
  if v_tenant_id is null then
    return new;
  end if;

  v_actor_id := coalesce(new.assigned_to, auth.uid());
  if v_actor_id is not null then
    select u.full_name into v_actor_name from public.users u where u.id = v_actor_id;
  end if;
  if new.branch_id is not null then
    select b.name into v_branch_name from public.branches b where b.id = new.branch_id;
  end if;

  v_message := 'Lead "' || new.full_name || '" marcado como contactado'
               || case when v_actor_name is not null then ' por ' || v_actor_name else '' end
               || case when v_branch_name is not null then ' — ' || v_branch_name else '' end;

  for r in
    select u.id as user_id
    from public.users u
    where u.tenant_id = v_tenant_id
      and u.role::text = 'admin'
      and coalesce(u.is_active, true) = true
      and (v_actor_id is null or u.id <> v_actor_id)
  loop
    insert into public.notifications (
      tenant_id, branch_id, recipient_user_id, actor_user_id,
      type, title, message, entity_type, entity_id, action_url, metadata
    )
    values (
      v_tenant_id, new.branch_id, r.user_id, v_actor_id,
      'lead_contactado', 'Lead contactado', v_message,
      'lead', new.id,
      '/app/leads?openLead=' || new.id::text,
      jsonb_build_object(
        'lead_id', new.id,
        'lead_full_name', new.full_name,
        'actor_id', v_actor_id,
        'actor_name', v_actor_name,
        'branch_id', new.branch_id,
        'branch_name', v_branch_name,
        'source', new.source
      )
    );
  end loop;

  return new;
end $$;

drop trigger if exists trg_notify_lead_contactado on public.leads;
create trigger trg_notify_lead_contactado
after insert or update of status on public.leads
for each row
execute function public.notify_lead_contactado();

-- ============================================================================
-- Trigger: notify_lead_assigned
--   Dispara cuando assigned_to cambia a un usuario no nulo distinto del anterior
--   (o en INSERT con assigned_to seteado). Notifica SOLO al nuevo asignado y
--   solo si su rol es 'vendedor'. Excluye self-assignment.
-- ============================================================================
create or replace function public.notify_lead_assigned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_actor_id uuid := auth.uid();
  v_actor_name text;
  v_assignee_role text;
  v_assignee_active boolean;
  v_branch_name text;
  v_message text;
begin
  if new.assigned_to is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.assigned_to is not distinct from new.assigned_to then
    return new;
  end if;
  -- Self-assignment: no notificar
  if v_actor_id is not null and v_actor_id = new.assigned_to then
    return new;
  end if;

  -- Validar rol vendedor y usuario activo
  select u.role::text, coalesce(u.is_active, true)
    into v_assignee_role, v_assignee_active
  from public.users u
  where u.id = new.assigned_to;

  if v_assignee_role is null or v_assignee_role <> 'vendedor' or not coalesce(v_assignee_active, true) then
    return new;
  end if;

  v_tenant_id := new.tenant_id;
  if v_tenant_id is null and new.branch_id is not null then
    select b.tenant_id into v_tenant_id from public.branches b where b.id = new.branch_id;
  end if;
  if v_tenant_id is null then
    return new;
  end if;

  if v_actor_id is not null then
    select u.full_name into v_actor_name from public.users u where u.id = v_actor_id;
  end if;
  if new.branch_id is not null then
    select b.name into v_branch_name from public.branches b where b.id = new.branch_id;
  end if;

  v_message := 'Se te asignó el lead "' || new.full_name || '"'
               || case when v_actor_name is not null then ' (' || v_actor_name || ')' else '' end
               || case when v_branch_name is not null then ' — ' || v_branch_name else '' end;

  insert into public.notifications (
    tenant_id, branch_id, recipient_user_id, actor_user_id,
    type, title, message, entity_type, entity_id, action_url, metadata
  )
  values (
    v_tenant_id, new.branch_id, new.assigned_to, v_actor_id,
    'lead_assigned', 'Nuevo lead asignado', v_message,
    'lead', new.id,
    '/app/leads?openLead=' || new.id::text,
    jsonb_build_object(
      'lead_id', new.id,
      'lead_full_name', new.full_name,
      'lead_phone', new.phone,
      'lead_email', new.email,
      'actor_id', v_actor_id,
      'actor_name', v_actor_name,
      'branch_id', new.branch_id,
      'branch_name', v_branch_name,
      'source', new.source,
      'status', new.status
    )
  );

  return new;
end $$;

drop trigger if exists trg_notify_lead_assigned on public.leads;
create trigger trg_notify_lead_assigned
after insert or update of assigned_to on public.leads
for each row
execute function public.notify_lead_assigned();
