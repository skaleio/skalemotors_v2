-- Fix: aislar notificaciones por sucursal.
--
-- Problema: el fan-out anterior trataba a 'admin' como tenant-wide, por lo que
-- un admin de branch A recibía avisos de eventos ocurridos en branch B del
-- mismo tenant. La intención del producto es que admin esté scopeado a su
-- propia sucursal (salvo que no tenga branch asignada → umbrella admin).
--
-- Nueva regla de scope por rol:
--   - tenant-wide  : jefe_jefe, gerente, financiero
--   - branch-scoped: admin, jefe_sucursal, inventario, vendedor, servicio
--   - usuario sin branch asignada: recibe todo (umbrella)
--   - evento sin branch asignada: lo reciben todos los del rol permitido

-- ============================================================================
-- 1) Helper resolve_notification_recipients (usado por lead_sold y consignacion_created)
-- ============================================================================
create or replace function public.resolve_notification_recipients(
  p_tenant_id uuid,
  p_branch_id uuid,
  p_roles text[],
  p_exclude_user_id uuid
)
returns table (user_id uuid, user_branch_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.branch_id
  from public.users u
  where u.tenant_id = p_tenant_id
    and coalesce(u.is_active, true) = true
    and u.role::text = any (p_roles)
    and (p_exclude_user_id is null or u.id <> p_exclude_user_id)
    and (
      -- Roles ejecutivos: siempre tenant-wide
      u.role::text in ('jefe_jefe', 'gerente', 'financiero')
      -- Usuario sin branch asignada: umbrella, recibe todo
      or u.branch_id is null
      -- Evento sin branch asignada: todos lo reciben
      or p_branch_id is null
      -- Roles branch-scoped (admin, jefe_sucursal, inventario, vendedor, servicio): solo su sucursal
      or u.branch_id = p_branch_id
    )
$$;

revoke all on function public.resolve_notification_recipients(uuid, uuid, text[], uuid) from public;
grant execute on function public.resolve_notification_recipients(uuid, uuid, text[], uuid)
  to authenticated, service_role;

-- ============================================================================
-- 2) notify_lead_contactado — admin scopeado por branch
-- ============================================================================
create or replace function public.notify_lead_contactado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_actor_id uuid;
  v_actor_name text;
  v_branch_name text;
  v_message text;
  r record;
begin
  if new.status is distinct from 'contactado' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'contactado' then return new; end if;

  v_tenant_id := new.tenant_id;
  if v_tenant_id is null and new.branch_id is not null then
    select b.tenant_id into v_tenant_id from public.branches b where b.id = new.branch_id;
  end if;
  if v_tenant_id is null then return new; end if;

  v_actor_id := coalesce(new.assigned_to, auth.uid());
  if v_actor_id is not null then
    select u.full_name into v_actor_name from public.users u where u.id = v_actor_id;
  end if;
  if new.branch_id is not null then
    select b.name into v_branch_name from public.branches b where b.id = new.branch_id;
  end if;

  v_message := 'Lead "' || new.full_name || '" marcado como contactado'
               || case when v_actor_name is not null then ' por ' || v_actor_name else '' end
               || case when v_branch_name is not null then ' — ' || v_branch_name else '' end;

  for r in
    select rn.user_id
    from public.resolve_notification_recipients(
      v_tenant_id,
      new.branch_id,
      array['admin']::text[],
      v_actor_id
    ) rn
  loop
    insert into public.notifications (
      tenant_id, branch_id, recipient_user_id, actor_user_id,
      type, title, message, entity_type, entity_id, action_url, metadata
    )
    values (
      v_tenant_id, new.branch_id, r.user_id, v_actor_id,
      'lead_contactado', 'Lead contactado', v_message,
      'lead', new.id,
      '/app/leads?openLead=' || new.id::text,
      jsonb_build_object(
        'lead_id', new.id,
        'lead_full_name', new.full_name,
        'actor_id', v_actor_id,
        'actor_name', v_actor_name,
        'branch_id', new.branch_id,
        'branch_name', v_branch_name,
        'source', new.source
      )
    );
  end loop;

  return new;
end $$;

-- ============================================================================
-- 3) sync_stale_consignaciones_to_pending_tasks — admin scopeado por branch
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
  if v_role is distinct from 'admin' or v_tenant is null then
    pending_tasks_created := 0;
    notifications_created := 0;
    return next;
    return;
  end if;

  update public.pending_tasks pt
  set completed_at = v_now, updated_at = v_now
  from public.consignaciones c
  where pt.entity_type = 'consignacion'
    and pt.entity_id = c.id
    and pt.completed_at is null
    and c.tenant_id = v_tenant
    and (c.publicado = true or c.status in ('vendido', 'devuelto'));

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
        'rule', null
      );
      v_tasks_count := v_tasks_count + 1;
    end if;

    v_message := 'La consignación '
      || trim(coalesce(r.vehicle_make, '') || ' ' || coalesce(r.vehicle_model, ''))
      || ' lleva ' || v_dias || ' días sin publicarse'
      || case when r.branch_name is not null then ' — ' || r.branch_name else '' end;

    -- Fan-out SOLO a admins de la misma branch (o umbrella sin branch).
    for a in
      select u.id as user_id
      from public.users u
      where u.tenant_id = v_tenant
        and u.role::text = 'admin'
        and coalesce(u.is_active, true) = true
        and (
          u.branch_id is null
          or r.branch_id is null
          or u.branch_id = r.branch_id
        )
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
end $$;

-- ============================================================================
-- 4) sync_stale_leads_to_pending_tasks — admin scopeado por branch
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

    -- Fan-out SOLO a admins de la misma branch (o umbrella sin branch).
    for a in
      select u.id as user_id
      from public.users u
      where u.tenant_id = v_tenant
        and u.role::text = 'admin'
        and coalesce(u.is_active, true) = true
        and (
          u.branch_id is null
          or r.branch_id is null
          or u.branch_id = r.branch_id
        )
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

-- ============================================================================
-- 5) Limpieza de notificaciones ya sembradas con scope incorrecto
--    Archiva (soft-delete) las notificaciones de un admin donde su branch no
--    coincide con la branch de la notificación. Conserva las enviadas a
--    jefe_jefe/gerente/financiero (tenant-wide) y a usuarios sin branch.
-- ============================================================================
update public.notifications n
set archived_at = now()
from public.users u
where n.recipient_user_id = u.id
  and n.archived_at is null
  and u.role::text = 'admin'
  and u.branch_id is not null
  and n.branch_id is not null
  and n.branch_id is distinct from u.branch_id;
