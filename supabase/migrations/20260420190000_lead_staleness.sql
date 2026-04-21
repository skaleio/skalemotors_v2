-- Staleness de leads: detecta leads que llevan N días sin cambiar de estado.
-- Crea pending_tasks (visibles en Dashboard) + notificaciones admin-only.
--
-- Requiere conocer la fecha del último cambio de status. Agregamos
-- leads.status_changed_at mantenido por trigger. Backfill con updated_at.

-- ============================================================================
-- 1) Columna status_changed_at + trigger + backfill
-- ============================================================================
alter table public.leads
  add column if not exists status_changed_at timestamptz;

update public.leads
set status_changed_at = coalesce(updated_at, created_at)
where status_changed_at is null;

create or replace function public.leads_sync_status_changed_at()
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

drop trigger if exists trg_leads_sync_status_changed_at on public.leads;
create trigger trg_leads_sync_status_changed_at
  before insert or update of status on public.leads
  for each row
  execute function public.leads_sync_status_changed_at();

create index if not exists idx_leads_status_changed_at
  on public.leads (tenant_id, status, status_changed_at)
  where deleted_at is null;

-- ============================================================================
-- 2) RPC sync_stale_leads_to_pending_tasks
-- ============================================================================
create or replace function public.sync_stale_leads_to_pending_tasks(
  dias_sin_movimiento int default 3
)
returns table (pending_tasks_created int, notifications_created int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_limite timestamptz := v_now - (dias_sin_movimiento || ' days')::interval;
  v_tenant uuid := public.current_tenant_id();
  v_role text := public.current_user_role();
  v_tasks_count int := 0;
  v_notif_count int := 0;
  r record;
  a record;
  v_dias int;
  v_priority text;
  v_title text;
  v_desc text;
  v_message text;
begin
  if v_role is distinct from 'admin' or v_tenant is null then
    pending_tasks_created := 0;
    notifications_created := 0;
    return next;
    return;
  end if;

  -- (a) Cerrar tareas de leads que ya se movieron / cerraron / fueron borrados
  update public.pending_tasks pt
  set completed_at = v_now, updated_at = v_now
  from public.leads l
  where pt.entity_type = 'lead'
    and pt.entity_id = l.id
    and pt.completed_at is null
    and pt.source = 'rule'
    and pt.metadata->>'stale_reason' = 'no_movement'
    and l.tenant_id = v_tenant
    and (
      l.deleted_at is not null
      or l.status in ('vendido', 'perdido')
      or coalesce(l.status_changed_at, l.updated_at) >= v_limite
    );

  -- (b) Crear pending_tasks + notificaciones admin por cada lead stale sin tarea activa
  for r in
    select
      l.id, l.full_name, l.status, l.branch_id,
      l.assigned_to, l.status_changed_at, l.updated_at,
      b.name as branch_name,
      u.full_name as assignee_name
    from public.leads l
    left join public.branches b on b.id = l.branch_id
    left join public.users u on u.id = l.assigned_to
    where l.tenant_id = v_tenant
      and l.deleted_at is null
      and l.status in ('nuevo', 'contactado', 'interesado', 'cotizando', 'negociando', 'para_cierre')
      and coalesce(l.status_changed_at, l.updated_at) < v_limite
  loop
    v_dias := greatest(0, extract(day from (v_now - coalesce(r.status_changed_at, r.updated_at)))::int);
    v_priority := case when v_dias >= (dias_sin_movimiento * 3) then 'today' else 'later' end;

    v_title := 'Mover lead: ' || coalesce(r.full_name, 'Lead s/n');
    v_desc := 'Lleva ' || v_dias || ' días en "' || r.status || '"'
      || case when r.branch_name is not null then ' — ' || r.branch_name else '' end
      || case when r.assignee_name is not null then ' · ' || r.assignee_name else '' end;

    if r.branch_id is not null and not exists (
      select 1 from public.pending_tasks pt
      where pt.entity_type = 'lead'
        and pt.entity_id = r.id
        and pt.completed_at is null
        and pt.metadata->>'stale_reason' = 'no_movement'
    ) then
      insert into public.pending_tasks (
        branch_id, tenant_id, priority, title, description,
        action_type, action_label, entity_type, entity_id,
        metadata, source, due_at
      )
      values (
        r.branch_id, v_tenant, v_priority, v_title, v_desc,
        'otro', 'Ver lead', 'lead', r.id,
        jsonb_build_object(
          'lead_id', r.id,
          'lead_full_name', r.full_name,
          'status', r.status,
          'assigned_to', r.assigned_to,
          'assignee_name', r.assignee_name,
          'branch_id', r.branch_id,
          'branch_name', r.branch_name,
          'dias_sin_movimiento', v_dias,
          'threshold_dias', dias_sin_movimiento,
          'stale_reason', 'no_movement'
        ),
        'rule', null
      );
      v_tasks_count := v_tasks_count + 1;
    end if;

    v_message := 'El lead "' || coalesce(r.full_name, 's/n') || '" lleva '
                 || v_dias || ' días sin moverse (estado: ' || r.status || ')'
                 || case when r.branch_name is not null then ' — ' || r.branch_name else '' end;

    for a in
      select u.id as user_id
      from public.users u
      where u.tenant_id = v_tenant
        and u.role::text = 'admin'
        and coalesce(u.is_active, true) = true
    loop
      if not exists (
        select 1 from public.notifications n
        where n.type = 'lead_stale'
          and n.entity_type = 'lead'
          and n.entity_id = r.id
          and n.recipient_user_id = a.user_id
      ) then
        insert into public.notifications (
          tenant_id, branch_id, recipient_user_id, actor_user_id,
          type, title, message, entity_type, entity_id, action_url, metadata
        )
        values (
          v_tenant, r.branch_id, a.user_id, null,
          'lead_stale', 'Lead sin movimiento', v_message,
          'lead', r.id,
          '/app/leads?openLead=' || r.id::text,
          jsonb_build_object(
            'lead_id', r.id,
            'lead_full_name', r.full_name,
            'status', r.status,
            'assigned_to', r.assigned_to,
            'assignee_name', r.assignee_name,
            'branch_id', r.branch_id,
            'branch_name', r.branch_name,
            'dias_sin_movimiento', v_dias,
            'threshold_dias', dias_sin_movimiento
          )
        );
        v_notif_count := v_notif_count + 1;
      end if;
    end loop;
  end loop;

  pending_tasks_created := v_tasks_count;
  notifications_created := v_notif_count;
  return next;
end $$;

comment on function public.sync_stale_leads_to_pending_tasks(int) is
  'Staleness de leads: crea pending_tasks y notificaciones admin-only para leads en estados activos que no han cambiado de status en más de N días. Idempotente por (entity_id, stale_reason=no_movement) y (recipient, entity_id) respectivamente.';

revoke all on function public.sync_stale_leads_to_pending_tasks(int) from public;
grant execute on function public.sync_stale_leads_to_pending_tasks(int) to authenticated;
grant execute on function public.sync_stale_leads_to_pending_tasks(int) to service_role;

-- ============================================================================
-- 3) Trigger auto-cierre: cuando el lead cambia de status, cerrar su pending_task stale
-- ============================================================================
create or replace function public.close_lead_stale_pending_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    update public.pending_tasks
    set completed_at = now(), updated_at = now()
    where entity_type = 'lead'
      and entity_id = new.id
      and completed_at is null
      and source = 'rule'
      and metadata->>'stale_reason' = 'no_movement';
  end if;
  return new;
end $$;

drop trigger if exists trg_close_lead_stale_pending_task on public.leads;
create trigger trg_close_lead_stale_pending_task
after update of status on public.leads
for each row
execute function public.close_lead_stale_pending_task();
