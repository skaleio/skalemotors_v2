create or replace function public.sync_leads_contacted_no_attempts_to_pending_tasks(
  horas_sin_intento int default 24
)
returns table (pending_tasks_created int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_limite timestamptz := v_now - (horas_sin_intento || ' hours')::interval;
  v_tenant uuid := public.current_tenant_id();
  v_role text := public.current_user_role();
  v_tasks_count int := 0;
  r record;
  v_horas int;
  v_title text;
  v_desc text;
begin
  if v_role is distinct from 'admin' or v_tenant is null then
    pending_tasks_created := 0;
    return next;
    return;
  end if;

  -- (a) Cerrar tareas cuando ya registraron un intento o el lead salió de 'contactado'.
  update public.pending_tasks pt
  set completed_at = v_now, updated_at = v_now
  from public.leads l
  where pt.entity_type = 'lead'
    and pt.entity_id = l.id
    and pt.completed_at is null
    and pt.source = 'rule'
    and pt.metadata->>'alert_reason' = 'contacted_no_attempts'
    and l.tenant_id = v_tenant
    and (
      l.deleted_at is not null
      or l.status <> 'contactado'
      or coalesce(l.contact_attempts, 0) > 0
    );

  -- (b) Crear pending_tasks (urgent) por lead marcado contactado sin intento.
  -- Usamos updated_at/created_at como proxy del "cuándo entró en contactado"
  -- porque leads.status_changed_at no está garantizado en este tenant.
  for r in
    select
      l.id, l.full_name, l.branch_id, l.assigned_to,
      l.updated_at, l.created_at,
      b.name as branch_name,
      u.full_name as assignee_name
    from public.leads l
    left join public.branches b on b.id = l.branch_id
    left join public.users u on u.id = l.assigned_to
    where l.tenant_id = v_tenant
      and l.deleted_at is null
      and l.status = 'contactado'
      and coalesce(l.contact_attempts, 0) = 0
      and coalesce(l.updated_at, l.created_at) < v_limite
  loop
    v_horas := greatest(1, extract(epoch from (v_now - coalesce(r.updated_at, r.created_at)))::int / 3600);

    v_title := 'Registrar contacto: ' || coalesce(r.full_name, 'Lead s/n');
    v_desc := 'Marcado como "contactado" hace ' || v_horas || ' h sin registrar ningún intento'
      || case when r.assignee_name is not null then ' · ' || r.assignee_name else '' end
      || case when r.branch_name is not null then ' — ' || r.branch_name else '' end;

    if r.branch_id is not null and not public.pending_task_blocks_auto_create(
      'lead', r.id, jsonb_build_object('alert_reason', 'contacted_no_attempts')
    ) then
      insert into public.pending_tasks (
        branch_id, tenant_id, priority, title, description,
        action_type, action_label, entity_type, entity_id,
        metadata, source, due_at
      )
      values (
        r.branch_id, v_tenant, 'urgent', v_title, v_desc,
        'otro', 'Ver lead', 'lead', r.id,
        jsonb_build_object(
          'lead_id', r.id,
          'lead_full_name', r.full_name,
          'assigned_to', r.assigned_to,
          'assignee_name', r.assignee_name,
          'branch_id', r.branch_id,
          'branch_name', r.branch_name,
          'horas_sin_intento', v_horas,
          'threshold_horas', horas_sin_intento,
          'alert_reason', 'contacted_no_attempts'
        ),
        'rule', null
      );
      v_tasks_count := v_tasks_count + 1;
    end if;
  end loop;

  pending_tasks_created := v_tasks_count;
  return next;
end $$;