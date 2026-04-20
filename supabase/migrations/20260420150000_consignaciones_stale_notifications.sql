-- Staleness de consignaciones:
--   - Crea tareas en public.pending_tasks (visibles en el Dashboard) cuando una
--     consignación lleva N días sin ser marcada como publicada (y no está
--     vendida/devuelta).
--   - Crea notificaciones in-app SOLO para usuarios con rol 'admin' del mismo
--     tenant, con deduplicación por (recipient, entity_id).
--   - RPC idempotente: cierra tareas de consignaciones ya publicadas/vendidas y
--     evita duplicar pendientes/notificaciones en ejecuciones repetidas.

-- ============================================================================
-- 1) Extender el CHECK de pending_tasks.entity_type para incluir 'consignacion'
-- ============================================================================
alter table public.pending_tasks
  drop constraint if exists pending_tasks_entity_type_check;

alter table public.pending_tasks
  add constraint pending_tasks_entity_type_check
  check (entity_type in ('lead', 'appointment', 'custom', 'vehicle', 'consignacion'));

-- ============================================================================
-- 2) RPC: sync_stale_consignaciones_to_pending_tasks
-- ============================================================================
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
  v_branch_name text;
begin
  -- Gate: solo admin dispara este sync (la RPC es segura de llamar por otros, pero no hace nada).
  if v_role is distinct from 'admin' or v_tenant is null then
    pending_tasks_created := 0;
    notifications_created := 0;
    return next;
    return;
  end if;

  -- (a) Cerrar tareas de consignaciones que ya fueron publicadas o salieron del flujo.
  update public.pending_tasks pt
  set completed_at = v_now, updated_at = v_now
  from public.consignaciones c
  where pt.entity_type = 'consignacion'
    and pt.entity_id = c.id
    and pt.completed_at is null
    and c.tenant_id = v_tenant
    and (c.publicado = true or c.status in ('vendido', 'devuelto'));

  -- (b) Crear pendientes + notificaciones por cada consignación stale sin tarea activa.
  for r in
    select
      c.id, c.branch_id, c.tenant_id, c.owner_name,
      c.vehicle_make, c.vehicle_model, c.vehicle_year, c.patente,
      c.created_at, c.status, c.publicado,
      b.name as branch_name
    from public.consignaciones c
    left join public.branches b on b.id = c.branch_id
    where c.tenant_id = v_tenant
      and coalesce(c.publicado, false) = false
      and c.status not in ('vendido', 'devuelto')
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

    -- Pending task a nivel sucursal (visible a todo el branch vía RLS)
    if r.branch_id is not null and not exists (
      select 1 from public.pending_tasks pt
      where pt.entity_type = 'consignacion'
        and pt.entity_id = r.id
        and pt.completed_at is null
    ) then
      insert into public.pending_tasks (
        branch_id, tenant_id, priority, title, description,
        action_type, action_label, entity_type, entity_id,
        metadata, source, due_at
      )
      values (
        r.branch_id, v_tenant, v_priority, v_title, v_desc,
        'otro', 'Ver consignación', 'consignacion', r.id,
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
        ),
        'rule',
        null
      );
      v_tasks_count := v_tasks_count + 1;
    end if;

    -- Notificaciones admin-only, fan-out + dedup por (recipient, entity_id, type)
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

comment on function public.sync_stale_consignaciones_to_pending_tasks(int) is
  'Staleness de consignaciones: crea pending_tasks por branch y notificaciones admin-only para las consignaciones no publicadas con más de N días. Idempotente por entity_id + recipient.';

revoke all on function public.sync_stale_consignaciones_to_pending_tasks(int) from public;
grant execute on function public.sync_stale_consignaciones_to_pending_tasks(int) to authenticated;
grant execute on function public.sync_stale_consignaciones_to_pending_tasks(int) to service_role;

-- ============================================================================
-- 3) Trigger: al publicar o marcar vendida/devuelta la consignación, cerrar
--    automáticamente su pending_task activa (sin esperar al próximo sync).
-- ============================================================================
create or replace function public.close_consignacion_pending_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.publicado = true and coalesce(old.publicado, false) = false)
     or (new.status in ('vendido', 'devuelto') and old.status is distinct from new.status) then
    update public.pending_tasks
    set completed_at = now(), updated_at = now()
    where entity_type = 'consignacion'
      and entity_id = new.id
      and completed_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_close_consignacion_pending_task on public.consignaciones;
create trigger trg_close_consignacion_pending_task
after update on public.consignaciones
for each row
execute function public.close_consignacion_pending_task();
