-- Alertas inteligentes en /app/tasks
-- Tres reglas nuevas que alimentan public.pending_tasks (visible en el panel de
-- Tareas y consumido por usePendingTasks):
--
--   1. Vehículos sin publicar:    vehicles.status='disponible' AND publicado=false
--                                  por más de N días.
--   2. Leads contactados sin intento: leads.status='contactado' AND
--                                  contact_attempts=0 por más de N horas.
--   3. Cliente buscando auto:     leads con preferred_vehicle_id NOT NULL,
--                                  status activo, creado hace más de N días
--                                  (JOIN a vehicles para mostrar el auto).
--
-- Cada RPC sigue el patrón de sync_stale_consignaciones_to_pending_tasks:
--   - Admin-only (gate por current_user_role()).
--   - Idempotente: cierra tareas cuando la condición ya no aplica + evita
--     duplicar insertando solo si no existe pending activa para el entity.
--   - Triggers de auto-cierre cuando la entidad cambia para no esperar al
--     próximo sync.

-- ============================================================================
-- 1) RPC: sync_unpublished_vehicles_to_pending_tasks
-- ============================================================================
create or replace function public.sync_unpublished_vehicles_to_pending_tasks(
  dias_sin_publicar int default 3
)
returns table (pending_tasks_created int)
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
  r record;
  v_dias int;
  v_priority text;
  v_title text;
  v_desc text;
  v_branch_name text;
begin
  if v_role is distinct from 'admin' or v_tenant is null then
    pending_tasks_created := 0;
    return next;
    return;
  end if;

  -- (a) Cerrar tareas de vehículos que se publicaron o salieron de 'disponible'.
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

  -- (b) Crear pending_tasks por cada vehículo stale sin tarea activa.
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

    if r.branch_id is not null and not exists (
      select 1 from public.pending_tasks pt
      where pt.entity_type = 'vehicle'
        and pt.entity_id = r.id
        and pt.completed_at is null
        and pt.metadata->>'alert_reason' = 'unpublished'
    ) then
      insert into public.pending_tasks (
        branch_id, tenant_id, priority, title, description,
        action_type, action_label, entity_type, entity_id,
        metadata, source, due_at
      )
      values (
        r.branch_id, v_tenant, v_priority, v_title, v_desc,
        'otro', 'Ver vehículo', 'vehicle', r.id,
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
  end loop;

  pending_tasks_created := v_tasks_count;
  return next;
end $$;

comment on function public.sync_unpublished_vehicles_to_pending_tasks(int) is
  'Alerta: vehículos en inventario (status=disponible) con publicado=false por más de N días. Admin-only, idempotente por (entity_id, alert_reason=unpublished).';

revoke all on function public.sync_unpublished_vehicles_to_pending_tasks(int) from public;
grant execute on function public.sync_unpublished_vehicles_to_pending_tasks(int) to authenticated;
grant execute on function public.sync_unpublished_vehicles_to_pending_tasks(int) to service_role;

-- Trigger auto-cierre: al publicar o cambiar de status, cerrar la tarea activa.
create or replace function public.close_vehicle_unpublished_pending_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (coalesce(new.publicado, false) = true and coalesce(old.publicado, false) = false)
     or (new.status is distinct from old.status and new.status <> 'disponible') then
    update public.pending_tasks
    set completed_at = now(), updated_at = now()
    where entity_type = 'vehicle'
      and entity_id = new.id
      and completed_at is null
      and source = 'rule'
      and metadata->>'alert_reason' = 'unpublished';
  end if;
  return new;
end $$;

drop trigger if exists trg_close_vehicle_unpublished_pending_task on public.vehicles;
create trigger trg_close_vehicle_unpublished_pending_task
after update on public.vehicles
for each row
execute function public.close_vehicle_unpublished_pending_task();

-- ============================================================================
-- 2) RPC: sync_leads_contacted_no_attempts_to_pending_tasks
-- ============================================================================
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

    if r.branch_id is not null and not exists (
      select 1 from public.pending_tasks pt
      where pt.entity_type = 'lead'
        and pt.entity_id = r.id
        and pt.completed_at is null
        and pt.metadata->>'alert_reason' = 'contacted_no_attempts'
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

comment on function public.sync_leads_contacted_no_attempts_to_pending_tasks(int) is
  'Alerta urgente: leads en status=contactado con contact_attempts=0 por más de N horas. Admin-only, idempotente por (entity_id, alert_reason=contacted_no_attempts).';

revoke all on function public.sync_leads_contacted_no_attempts_to_pending_tasks(int) from public;
grant execute on function public.sync_leads_contacted_no_attempts_to_pending_tasks(int) to authenticated;
grant execute on function public.sync_leads_contacted_no_attempts_to_pending_tasks(int) to service_role;

-- Trigger auto-cierre: al registrar intento o cambiar de status, cerrar la tarea activa.
create or replace function public.close_lead_contacted_no_attempts_pending_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (coalesce(new.contact_attempts, 0) > 0 and coalesce(old.contact_attempts, 0) = 0)
     or (new.status is distinct from old.status and new.status <> 'contactado') then
    update public.pending_tasks
    set completed_at = now(), updated_at = now()
    where entity_type = 'lead'
      and entity_id = new.id
      and completed_at is null
      and source = 'rule'
      and metadata->>'alert_reason' = 'contacted_no_attempts';
  end if;
  return new;
end $$;

drop trigger if exists trg_close_lead_contacted_no_attempts on public.leads;
create trigger trg_close_lead_contacted_no_attempts
after update of status, contact_attempts on public.leads
for each row
execute function public.close_lead_contacted_no_attempts_pending_task();

-- ============================================================================
-- 3) RPC: sync_leads_searching_car_to_pending_tasks
-- ============================================================================
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

    if r.branch_id is not null and not exists (
      select 1 from public.pending_tasks pt
      where pt.entity_type = 'lead'
        and pt.entity_id = r.id
        and pt.completed_at is null
        and pt.metadata->>'alert_reason' = 'searching_car'
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

comment on function public.sync_leads_searching_car_to_pending_tasks(int) is
  'Alerta: leads con preferred_vehicle_id en status activo creados hace más de N días. Admin-only, idempotente por (entity_id, alert_reason=searching_car).';

revoke all on function public.sync_leads_searching_car_to_pending_tasks(int) from public;
grant execute on function public.sync_leads_searching_car_to_pending_tasks(int) to authenticated;
grant execute on function public.sync_leads_searching_car_to_pending_tasks(int) to service_role;

-- Trigger auto-cierre: al cerrar el lead o limpiar preferred_vehicle_id.
create or replace function public.close_lead_searching_car_pending_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.status is distinct from old.status and new.status in ('vendido', 'perdido'))
     or (new.preferred_vehicle_id is null and old.preferred_vehicle_id is not null) then
    update public.pending_tasks
    set completed_at = now(), updated_at = now()
    where entity_type = 'lead'
      and entity_id = new.id
      and completed_at is null
      and source = 'rule'
      and metadata->>'alert_reason' = 'searching_car';
  end if;
  return new;
end $$;

drop trigger if exists trg_close_lead_searching_car on public.leads;
create trigger trg_close_lead_searching_car
after update of status, preferred_vehicle_id on public.leads
for each row
execute function public.close_lead_searching_car_pending_task();
