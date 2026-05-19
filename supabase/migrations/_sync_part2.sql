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


create or replace function public.sync_lead_reminders_to_pending_tasks(ventana_horas int default 48)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_lead_name text;
  v_title text;
  v_desc text;
  v_now timestamptz := now();
  v_limite timestamptz := v_now + (ventana_horas || ' hours')::interval;
begin
  -- Marcar como completadas las tareas cuyo recordatorio ya pasó
  update pending_tasks pt
  set completed_at = v_now, updated_at = v_now
  from lead_reminders lr
  where pt.metadata->>'lead_reminder_id' = lr.id::text
    and pt.completed_at is null
    and lr.reminder_at < v_now;

  -- Crear tareas para recordatorios que entran en ventana y aún no tienen tarea
  for r in
    select lr.id, lr.lead_id, lr.branch_id, lr.reminder_at, lr.note, lr.priority
    from lead_reminders lr
    where lr.reminder_at >= v_now
      and lr.reminder_at <= v_limite
      and not public.pending_task_blocks_auto_create(
        'lead', lr.lead_id, jsonb_build_object('lead_reminder_id', lr.id::text)
      )
  loop
    select coalesce(full_name, 'Sin nombre') into v_lead_name from leads where id = r.lead_id;
    v_title := 'Recordatorio: ' || v_lead_name;
    v_desc := coalesce(trim(r.note), '');
    if v_desc <> '' then
      v_desc := 'Nota: ' || left(v_desc, 200);
      if length(r.note) > 200 then
        v_desc := v_desc || '…';
      end if;
    else
      v_desc := 'Contactar a ' || v_lead_name || ' – ' || to_char(r.reminder_at at time zone 'America/Santiago', 'Dy DD Mon HH24:MI');
    end if;

    insert into pending_tasks (
      branch_id, priority, title, description,
      action_type, action_label, entity_type, entity_id,
      metadata, source, due_at
    )
    values (
      r.branch_id,
      r.priority,
      v_title,
      nullif(v_desc, ''),
      'otro',
      'Ver lead',
      'lead',
      r.lead_id,
      jsonb_build_object('lead_reminder_id', r.id),
      'rule',
      r.reminder_at
    );
  end loop;
end;
$$;

-- Tareas ya completadas antes de este cambio: tratarlas como descartadas para no recrearlas.
UPDATE public.pending_tasks
SET
  metadata = COALESCE(metadata, '{}'::jsonb)
    || jsonb_build_object('user_dismissed', true),
  updated_at = now()
WHERE completed_at IS NOT NULL
  AND COALESCE(metadata->>'user_dismissed', 'false') <> 'true';

-- Tareas ya completadas antes de este cambio: tratarlas como descartadas para no recrearlas.
UPDATE public.pending_tasks
SET
  metadata = COALESCE(metadata, '{}'::jsonb)
    || jsonb_build_object('user_dismissed', true),
  updated_at = now()
WHERE completed_at IS NOT NULL
  AND COALESCE(metadata->>'user_dismissed', 'false') <> 'true';
