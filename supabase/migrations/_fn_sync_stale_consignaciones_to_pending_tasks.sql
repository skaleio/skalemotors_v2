create or replace function public.sync_stale_consignaciones_to_pending_tasks(
  dias_sin_publicar int default 7
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
  v_desc text;
  v_title text;
  v_message text;
begin
  if v_role not in ('admin','jefe_jefe') or v_tenant is null then
    pending_tasks_created := 0;
    notifications_created := 0;
    return next;
    return;
  end if;

  -- (a) Cerrar tareas cuya consignación ya no califica como "olvidada sin
  --     publicar": publicada, vendida, devuelta, O movida a en_venta/negociando.
  update public.pending_tasks pt
  set completed_at = v_now, updated_at = v_now
  from public.consignaciones c
  where pt.entity_type = 'consignacion'
    and pt.entity_id = c.id
    and pt.completed_at is null
    and c.tenant_id = v_tenant
    and (
      c.publicado = true
      or c.status in ('vendido', 'devuelto', 'en_venta', 'negociando')
    );

  -- (b) Crear pendientes solo para consignaciones realmente olvidadas:
  --     status IN ('nuevo','en_revision'), no publicadas, > N días.
  for r in
    select
      c.id, c.branch_id, c.tenant_id, c.owner_name, c.created_by,
      c.vehicle_make, c.vehicle_model, c.vehicle_year, c.patente,
      c.created_at, c.status, c.publicado,
      b.name as branch_name
    from public.consignaciones c
    left join public.branches b on b.id = c.branch_id
    where c.tenant_id = v_tenant
      and coalesce(c.publicado, false) = false
      and c.status in ('nuevo', 'en_revision')
      and c.created_at < v_limite
  loop
    v_dias := greatest(0, extract(day from (v_now - r.created_at))::int);
    v_priority := case when v_dias >= (dias_sin_publicar * 2) then 'today' else 'later' end;

    v_title := 'Publicar consignación: '
      || trim(coalesce(r.vehicle_make, '') || ' ' ||
              coalesce(r.vehicle_model, '') || ' ' ||
              coalesce(r.vehicle_year::text, ''));
    if v_title = 'Publicar consignación: ' then
      v_title := 'Publicar consignación de ' || coalesce(r.owner_name, 'propietario s/d');
    end if;

    v_desc := 'Lleva ' || v_dias || ' días sin publicarse'
      || case when r.branch_name is not null then ' — ' || r.branch_name else '' end
      || case when r.patente is not null then ' (' || r.patente || ')' else '' end;

    if r.branch_id is not null and not public.pending_task_blocks_auto_create(
      'consignacion', r.id, NULL
    ) then
      insert into public.pending_tasks (
        branch_id, tenant_id, priority, title, description,
        action_type, action_label, entity_type, entity_id,
        assigned_to,
        metadata, source, due_at
      )
      values (
        r.branch_id, v_tenant, v_priority, v_title, v_desc,
        'otro', 'Ver consignación', 'consignacion', r.id,
        r.created_by,
        jsonb_build_object(
          'consignacion_id', r.id,
          'vehicle_make', r.vehicle_make,
          'vehicle_model', r.vehicle_model,
          'vehicle_year', r.vehicle_year,
          'patente', r.patente,
          'owner_name', r.owner_name,
          'branch_id', r.branch_id,
          'branch_name', r.branch_name,
          'dias_sin_publicar', v_dias,
          'threshold_dias', dias_sin_publicar,
          'created_by', r.created_by
        ),
        'rule',
        null
      );
      v_tasks_count := v_tasks_count + 1;
    end if;

    v_message := 'La consignación '
      || trim(coalesce(r.vehicle_make, '') || ' ' || coalesce(r.vehicle_model, ''))
      || ' lleva ' || v_dias || ' días sin publicarse'
      || case when r.branch_name is not null then ' — ' || r.branch_name else '' end;

    for a in
      select u.id as user_id
      from public.users u
      where u.tenant_id = v_tenant
        and u.role::text = 'admin'
        and coalesce(u.is_active, true) = true
        and (r.created_by is null or u.id = r.created_by)
    loop
      if not exists (
        select 1 from public.notifications n
        where n.type = 'consignacion_stale'
          and n.entity_type = 'consignacion'
          and n.entity_id = r.id
          and n.recipient_user_id = a.user_id
      ) then
        insert into public.notifications (
          tenant_id, branch_id, recipient_user_id, actor_user_id,
          type, title, message, entity_type, entity_id, action_url, metadata
        )
        values (
          v_tenant, r.branch_id, a.user_id, null,
          'consignacion_stale',
          'Consignación sin publicar',
          v_message,
          'consignacion', r.id,
          '/app/consignaciones',
          jsonb_build_object(
            'consignacion_id', r.id,
            'vehicle_make', r.vehicle_make,
            'vehicle_model', r.vehicle_model,
            'vehicle_year', r.vehicle_year,
            'patente', r.patente,
            'owner_name', r.owner_name,
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