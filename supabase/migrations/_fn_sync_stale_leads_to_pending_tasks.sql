create or replace function public.sync_stale_leads_to_pending_tasks(
  dias_sin_movimiento int default 4
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
  v_last_activity timestamptz;
begin
  if v_role not in ('admin', 'jefe_jefe', 'gerente', 'jefe_sucursal') or v_tenant is null then
    pending_tasks_created := 0;
    notifications_created := 0;
    return next;
    return;
  end if;

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
      or coalesce(greatest(l.status_changed_at, l.updated_at), l.created_at) >= v_limite
    );

  for r in
    select
      l.id, l.full_name, l.status, l.branch_id,
      l.assigned_to, l.status_changed_at, l.updated_at, l.created_at,
      b.name as branch_name,
      u.full_name as assignee_name
    from public.leads l
    left join public.branches b on b.id = l.branch_id
    left join public.users u on u.id = l.assigned_to
    where l.tenant_id = v_tenant
      and l.deleted_at is null
      and l.status in (
        'nuevo', 'contactado', 'interesado', 'cotizando',
        'negociando', 'en_espera', 'para_cierre'
      )
      and coalesce(greatest(l.status_changed_at, l.updated_at), l.created_at) < v_limite
  loop
    v_last_activity := coalesce(greatest(r.status_changed_at, r.updated_at), r.created_at);
    v_dias := greatest(0, extract(day from (v_now - v_last_activity))::int);
    v_priority := case when v_dias >= (dias_sin_movimiento * 2) then 'today' else 'later' end;

    v_title := 'Mover lead: ' || coalesce(r.full_name, 'Lead s/n');
    v_desc := 'Sin actualización hace ' || v_dias || ' días (estado: ' || r.status || ')'
      || case when r.branch_name is not null then ' — ' || r.branch_name else '' end
      || case when r.assignee_name is not null then ' · ' || r.assignee_name else '' end;

    if r.branch_id is not null and not public.pending_task_blocks_auto_create(
      'lead', r.id, jsonb_build_object('stale_reason', 'no_movement')
    ) then
      insert into public.pending_tasks (
        branch_id, tenant_id, priority, title, description,
        action_type, action_label, entity_type, entity_id,
        assigned_to, metadata, source, due_at
      )
      values (
        r.branch_id, v_tenant, v_priority, v_title, v_desc,
        'otro', 'Ver lead', 'lead', r.id,
        r.assigned_to,
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
      || v_dias || ' días sin movimiento ni actualización (estado: ' || r.status || ')'
      || case when r.branch_name is not null then ' — ' || r.branch_name else '' end;

    for a in
      select rn.user_id
      from public.resolve_notification_recipients(
        v_tenant,
        r.branch_id,
        array['admin', 'gerente', 'jefe_jefe', 'jefe_sucursal']::text[],
        null
      ) rn
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

    if r.assigned_to is not null
       and exists (
         select 1 from public.users u
         where u.id = r.assigned_to
           and u.tenant_id = v_tenant
           and coalesce(u.is_active, true) = true
           and u.role::text = 'vendedor'
       )
       and not exists (
         select 1 from public.notifications n
         where n.type = 'lead_stale'
           and n.entity_type = 'lead'
           and n.entity_id = r.id
           and n.recipient_user_id = r.assigned_to
       )
    then
      insert into public.notifications (
        tenant_id, branch_id, recipient_user_id, actor_user_id,
        type, title, message, entity_type, entity_id, action_url, metadata
      )
      values (
        v_tenant, r.branch_id, r.assigned_to, null,
        'lead_stale', 'Tu lead está estancado', v_message,
        'lead', r.id,
        '/app/leads?openLead=' || r.id::text,
        jsonb_build_object(
          'lead_id', r.id,
          'lead_full_name', r.full_name,
          'status', r.status,
          'dias_sin_movimiento', v_dias,
          'threshold_dias', dias_sin_movimiento,
          'stale_reason', 'no_movement'
        )
      );
      v_notif_count := v_notif_count + 1;
    end if;
  end loop;

  pending_tasks_created := v_tasks_count;
  notifications_created := v_notif_count;
  return next;
end;
$$;