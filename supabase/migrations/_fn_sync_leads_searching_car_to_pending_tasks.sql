create or replace function public.sync_leads_searching_car_to_pending_tasks(
  dias_buscando int default 5
)
returns table (pending_tasks_created int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_limite timestamptz := v_now - (dias_buscando || ' days')::interval;
  v_tenant uuid := public.current_tenant_id();
  v_role text := public.current_user_role();
  v_tasks_count int := 0;
  r record;
  v_dias int;
  v_priority text;
  v_title text;
  v_desc text;
  v_vehiculo text;
begin
  if v_role is distinct from 'admin' or v_tenant is null then
    pending_tasks_created := 0;
    return next;
    return;
  end if;

  -- (a) Cerrar tareas: el lead cerró o le quitaron el vehículo preferido.
  update public.pending_tasks pt
  set completed_at = v_now, updated_at = v_now
  from public.leads l
  where pt.entity_type = 'lead'
    and pt.entity_id = l.id
    and pt.completed_at is null
    and pt.source = 'rule'
    and pt.metadata->>'alert_reason' = 'searching_car'
    and l.tenant_id = v_tenant
    and (
      l.deleted_at is not null
      or l.status in ('vendido', 'perdido')
      or l.preferred_vehicle_id is null
    );

  -- (b) Crear pending_tasks por lead activo que lleva días buscando un auto.
  for r in
    select
      l.id, l.full_name, l.branch_id, l.assigned_to, l.created_at,
      l.preferred_vehicle_id,
      v.make as v_make, v.model as v_model, v.year as v_year,
      b.name as branch_name,
      u.full_name as assignee_name
    from public.leads l
    join public.vehicles v on v.id = l.preferred_vehicle_id
    left join public.branches b on b.id = l.branch_id
    left join public.users u on u.id = l.assigned_to
    where l.tenant_id = v_tenant
      and l.deleted_at is null
      and l.preferred_vehicle_id is not null
      and l.status not in ('vendido', 'perdido')
      and l.created_at < v_limite
  loop
    v_dias := greatest(0, extract(day from (v_now - r.created_at))::int);
    v_priority := case when v_dias >= (dias_buscando * 2) then 'today' else 'later' end;
    v_vehiculo := trim(coalesce(r.v_make, '') || ' ' ||
                       coalesce(r.v_model, '') || ' ' ||
                       coalesce(r.v_year::text, ''));
    if v_vehiculo = '' then v_vehiculo := 'auto de interés'; end if;

    v_title := coalesce(r.full_name, 'Cliente s/n') || ' busca ' || v_vehiculo;
    v_desc := 'Hace ' || v_dias || ' días buscando ' || v_vehiculo
      || case when r.assignee_name is not null then ' · ' || r.assignee_name else '' end
      || case when r.branch_name is not null then ' — ' || r.branch_name else '' end;

    if r.branch_id is not null and not public.pending_task_blocks_auto_create(
      'lead', r.id, jsonb_build_object('alert_reason', 'searching_car')
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
          'preferred_vehicle_id', r.preferred_vehicle_id,
          'vehicle_make', r.v_make,
          'vehicle_model', r.v_model,
          'vehicle_year', r.v_year,
          'assigned_to', r.assigned_to,
          'assignee_name', r.assignee_name,
          'branch_id', r.branch_id,
          'branch_name', r.branch_name,
          'dias_buscando', v_dias,
          'threshold_dias', dias_buscando,
          'alert_reason', 'searching_car'
        ),
        'rule', null
      );
      v_tasks_count := v_tasks_count + 1;
    end if;
  end loop;

  pending_tasks_created := v_tasks_count;
  return next;
end $$;