-- Scope per-creator de consignaciones.
--
-- Modelo de visibilidad (SELECT):
--   - jefe_jefe         → todo el tenant
--   - creador (any rol) → su propia consignación
--   - no-admins         → consignaciones de su mismo branch creadas por algún admin
--                          de ese branch (acceso operativo del branch)
--   - consignaciones huérfanas (created_by NULL) → solo jefe_jefe
--
-- UPDATE/DELETE: misma lógica que SELECT (no se puede tocar lo que no se ve).
-- INSERT: se mantiene por branch y un trigger fija created_by = auth.uid()
--         si el cliente no lo manda.
--
-- Además: la RPC sync_stale_consignaciones_to_pending_tasks pasa a poblar
-- pending_tasks.assigned_to con el created_by de la consignación, y notifica
-- únicamente al admin dueño. Backfill al final actualiza tareas pre-existentes.

-- ============================================================================
-- 1) Helper: el user dado es admin del branch dado y está activo
-- ============================================================================
create or replace function public.is_admin_of_branch(p_user_id uuid, p_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = p_user_id
      and u.branch_id = p_branch_id
      and u.role::text = 'admin'
      and coalesce(u.is_active, true) = true
  )
$$;

revoke all on function public.is_admin_of_branch(uuid, uuid) from public;
grant execute on function public.is_admin_of_branch(uuid, uuid) to authenticated;
grant execute on function public.is_admin_of_branch(uuid, uuid) to service_role;

comment on function public.is_admin_of_branch(uuid, uuid) is
  'True si el user es admin activo del branch indicado. Usada por RLS de consignaciones.';

-- ============================================================================
-- 2) Reemplazar policy SELECT por la versión scoped
-- ============================================================================
drop policy if exists consignaciones_select_tenant on public.consignaciones;
drop policy if exists consignaciones_select_scoped on public.consignaciones;

create policy consignaciones_select_scoped
on public.consignaciones
for select
using (
  current_is_legacy_protected()
  or (
    tenant_id = current_tenant_id()
    and (
      current_user_role() = 'jefe_jefe'
      or created_by = (select auth.uid())
      or (
        current_user_role() not in ('admin', 'jefe_jefe')
        and consignaciones.branch_id = (
          select u.branch_id from public.users u
          where u.id = (select auth.uid()) limit 1
        )
        and consignaciones.created_by is not null
        and public.is_admin_of_branch(consignaciones.created_by, consignaciones.branch_id)
      )
    )
  )
);

-- ============================================================================
-- 3) UPDATE/DELETE alineadas con SELECT
-- ============================================================================
drop policy if exists consignaciones_update on public.consignaciones;
drop policy if exists consignaciones_delete on public.consignaciones;
drop policy if exists consignaciones_update_scoped on public.consignaciones;
drop policy if exists consignaciones_delete_scoped on public.consignaciones;

create policy consignaciones_update_scoped
on public.consignaciones
for update
using (
  current_is_legacy_protected()
  or (
    tenant_id = current_tenant_id()
    and (
      current_user_role() = 'jefe_jefe'
      or created_by = (select auth.uid())
      or (
        current_user_role() not in ('admin', 'jefe_jefe')
        and consignaciones.branch_id = (
          select u.branch_id from public.users u
          where u.id = (select auth.uid()) limit 1
        )
        and consignaciones.created_by is not null
        and public.is_admin_of_branch(consignaciones.created_by, consignaciones.branch_id)
      )
    )
  )
)
with check (
  current_is_legacy_protected()
  or (
    tenant_id = current_tenant_id()
    and (
      current_user_role() = 'jefe_jefe'
      or created_by = (select auth.uid())
      or (
        current_user_role() not in ('admin', 'jefe_jefe')
        and consignaciones.branch_id = (
          select u.branch_id from public.users u
          where u.id = (select auth.uid()) limit 1
        )
        and consignaciones.created_by is not null
        and public.is_admin_of_branch(consignaciones.created_by, consignaciones.branch_id)
      )
    )
  )
);

create policy consignaciones_delete_scoped
on public.consignaciones
for delete
using (
  current_is_legacy_protected()
  or (
    tenant_id = current_tenant_id()
    and (
      current_user_role() = 'jefe_jefe'
      or created_by = (select auth.uid())
    )
  )
);

-- INSERT policy se mantiene como estaba (consignaciones_insert): cualquier
-- user del branch puede insertar; created_by se completa con el trigger.

-- ============================================================================
-- 4) Trigger defensivo: created_by = auth.uid() si el cliente no lo manda
-- ============================================================================
create or replace function public.consignaciones_set_creator()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_consignaciones_set_creator on public.consignaciones;
create trigger trg_consignaciones_set_creator
before insert on public.consignaciones
for each row
execute function public.consignaciones_set_creator();

-- Hardening: la función solo se invoca desde el trigger, no por API.
revoke execute on function public.consignaciones_set_creator() from public;
revoke execute on function public.consignaciones_set_creator() from anon;
revoke execute on function public.consignaciones_set_creator() from authenticated;

-- ============================================================================
-- 5) RPC sync_stale_consignaciones_to_pending_tasks → pasa a poblar
--    pending_tasks.assigned_to con el dueño de la consignación.
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
begin
  -- Gate: solo admin/jefe_jefe disparan este sync.
  if v_role not in ('admin','jefe_jefe') or v_tenant is null then
    pending_tasks_created := 0;
    notifications_created := 0;
    return next;
    return;
  end if;

  -- (a) Cerrar tareas de consignaciones publicadas/cerradas.
  update public.pending_tasks pt
  set completed_at = v_now, updated_at = v_now
  from public.consignaciones c
  where pt.entity_type = 'consignacion'
    and pt.entity_id = c.id
    and pt.completed_at is null
    and c.tenant_id = v_tenant
    and (c.publicado = true or c.status in ('vendido', 'devuelto'));

  -- (b) Crear pendientes + notificaciones por cada consignación stale.
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

    -- Notificación SOLO al admin dueño (si lo hay) — antes era todos los admin del tenant.
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

revoke all on function public.sync_stale_consignaciones_to_pending_tasks(int) from public;
grant execute on function public.sync_stale_consignaciones_to_pending_tasks(int) to authenticated;
grant execute on function public.sync_stale_consignaciones_to_pending_tasks(int) to service_role;

-- ============================================================================
-- 6) Backfill: pending_tasks pre-existentes de consignacion sin assigned_to
-- ============================================================================
update public.pending_tasks pt
set assigned_to = c.created_by, updated_at = now()
from public.consignaciones c
where pt.entity_type = 'consignacion'
  and pt.entity_id = c.id
  and pt.assigned_to is null
  and c.created_by is not null;
