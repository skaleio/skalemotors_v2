-- Tareas descartadas por el usuario no se recrean al sincronizar alertas.
CREATE OR REPLACE FUNCTION public.pending_task_blocks_auto_create(
  p_entity_type text,
  p_entity_id uuid,
  p_metadata_contains jsonb DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pending_tasks pt
    WHERE pt.entity_type = p_entity_type
      AND pt.entity_id = p_entity_id
      AND (
        p_metadata_contains IS NULL
        OR pt.metadata @> p_metadata_contains
      )
      AND (
        pt.completed_at IS NULL
        OR COALESCE(pt.metadata->>'user_dismissed', 'false') = 'true'
      )
  );
$$;

COMMENT ON FUNCTION public.pending_task_blocks_auto_create(text, uuid, jsonb) IS
  'Bloquea crear otra tarea si hay una abierta o descartada (user_dismissed) para la misma entidad/alerta.';


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
