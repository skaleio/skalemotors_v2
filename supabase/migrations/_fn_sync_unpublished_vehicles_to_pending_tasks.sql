create or replace function public.sync_unpublished_vehicles_to_pending_tasks(
  dias_sin_publicar int default 5
)
returns table (pending_tasks_created int, notifications_created int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_limite timestamptz := v_now - (dias_sin_publicar || ' days')::interval;
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
  if v_role not in ('admin', 'jefe_jefe', 'gerente', 'jefe_sucursal', 'inventario') or v_tenant is null then
    pending_tasks_created := 0;
    notifications_created := 0;
    return next;
    return;
  end if;

  update public.pending_tasks pt
  set completed_at = v_now, updated_at = v_now
  from public.vehicles v
  where pt.entity_type = 'vehicle'
    and pt.entity_id = v.id
    and pt.completed_at is null
    and pt.source = 'rule'
    and pt.metadata->>'alert_reason' = 'unpublished'
    and v.tenant_id = v_tenant
    and (coalesce(v.publicado, false) = true or v.status <> 'disponible');

  for r in
    select
      v.id, v.branch_id, v.make, v.model, v.year, v.patente,
      coalesce(v.arrival_date, v.created_at) as listed_at,
      b.name as branch_name
    from public.vehicles v
    left join public.branches b on b.id = v.branch_id
    where v.tenant_id = v_tenant
      and v.status = 'disponible'
      and coalesce(v.publicado, false) = false
      and coalesce(v.arrival_date, v.created_at) < v_limite
  loop
    v_dias := greatest(0, extract(day from (v_now - r.listed_at))::int);
    v_priority := case when v_dias >= (dias_sin_publicar * 2) then 'today' else 'later' end;

    v_title := 'Publicar vehículo: '
      || trim(coalesce(r.make, '') || ' ' ||
              coalesce(r.model, '') || ' ' ||
              coalesce(r.year::text, ''));
    if v_title = 'Publicar vehículo: ' then
      v_title := 'Publicar vehículo sin datos'
        || coalesce(' (' || r.patente || ')', '');
    end if;

    v_desc := 'Lleva ' || v_dias || ' días en inventario sin publicarse'
      || case when r.branch_name is not null then ' — ' || r.branch_name else '' end
      || case when r.patente is not null then ' (' || r.patente || ')' else '' end;

    if r.branch_id is not null and not public.pending_task_blocks_auto_create(
      'vehicle', r.id, jsonb_build_object('alert_reason', 'unpublished')
    ) then
      insert into public.pending_tasks (
        branch_id, tenant_id, priority, title, description,
        action_type, action_label, entity_type, entity_id,
        metadata, source, due_at
      )
      values (
        r.branch_id, v_tenant, v_priority, v_title, v_desc,
        'otro', 'Ver inventario', 'vehicle', r.id,
        jsonb_build_object(
          'vehicle_id', r.id,
          'make', r.make,
          'model', r.model,
          'year', r.year,
          'patente', r.patente,
          'branch_id', r.branch_id,
          'branch_name', r.branch_name,
          'dias_sin_publicar', v_dias,
          'threshold_dias', dias_sin_publicar,
          'alert_reason', 'unpublished'
        ),
        'rule', null
      );
      v_tasks_count := v_tasks_count + 1;
    end if;

    v_message := 'El vehículo '
      || trim(coalesce(r.make, '') || ' ' || coalesce(r.model, ''))
      || ' lleva ' || v_dias || ' días sin publicarse en inventario'
      || case when r.branch_name is not null then ' — ' || r.branch_name else '' end
      || case when r.patente is not null then ' (' || r.patente || ')' else '' end;

    for a in
      select rn.user_id
      from public.resolve_notification_recipients(
        v_tenant,
        r.branch_id,
        array['admin', 'gerente', 'jefe_jefe', 'jefe_sucursal', 'inventario']::text[],
        null
      ) rn
    loop
      if not exists (
        select 1 from public.notifications n
        where n.type = 'vehicle_unpublished'
          and n.entity_type = 'vehicle'
          and n.entity_id = r.id
          and n.recipient_user_id = a.user_id
      ) then
        insert into public.notifications (
          tenant_id, branch_id, recipient_user_id, actor_user_id,
          type, title, message, entity_type, entity_id, action_url, metadata
        )
        values (
          v_tenant, r.branch_id, a.user_id, null,
          'vehicle_unpublished',
          'Vehículo sin publicar',
          v_message,
          'vehicle', r.id,
          '/app/inventory',
          jsonb_build_object(
            'vehicle_id', r.id,
            'make', r.make,
            'model', r.model,
            'year', r.year,
            'patente', r.patente,
            'branch_id', r.branch_id,
            'branch_name', r.branch_name,
            'dias_sin_publicar', v_dias,
            'threshold_dias', dias_sin_publicar
          )
        );
        v_notif_count := v_notif_count + 1;
      end if;
    end loop;
  end loop;

  pending_tasks_created := v_tasks_count;
  notifications_created := v_notif_count;
  return next;
end;
$$;