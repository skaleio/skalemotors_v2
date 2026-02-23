-- Avisos: vehículos mucho tiempo en inventario sin ser modificados (aparecen en Tareas pendientes)
-- Permitir entity_type 'vehicle' en pending_tasks
alter table public.pending_tasks
  drop constraint if exists pending_tasks_entity_type_check;

alter table public.pending_tasks
  add constraint pending_tasks_entity_type_check
  check (entity_type in ('lead', 'appointment', 'custom', 'vehicle'));

-- Sincroniza avisos de vehículos: crea tarea si lleva muchos días en inventario y sin actualizar
-- dias_inventario: mínimo días desde arrival_date/created_at para considerar "mucho tiempo"
-- dias_sin_modificar: mínimo días desde updated_at para considerar "sin modificar"
create or replace function public.sync_old_inventory_vehicles_to_pending_tasks(
  dias_inventario int default 45,
  dias_sin_modificar int default 30
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_limite_inventario timestamptz := v_now - (dias_inventario || ' days')::interval;
  v_limite_modif timestamptz := v_now - (dias_sin_modificar || ' days')::interval;
  r record;
  v_desc text;
begin
  -- Marcar como completadas las tareas de vehículos que ya se actualizaron o ya no están disponibles
  update pending_tasks pt
  set completed_at = v_now, updated_at = v_now
  from vehicles v
  where pt.entity_type = 'vehicle' and pt.entity_id = v.id
    and pt.completed_at is null
    and (v.updated_at > v_limite_modif or v.status <> 'disponible');

  -- Crear aviso por cada vehículo que cumple: disponible, mucho tiempo en inventario, sin modificar
  for r in
    select v.id, v.branch_id, v.make, v.model, v.year, v.arrival_date, v.created_at, v.updated_at
    from vehicles v
    where v.branch_id is not null
      and v.status = 'disponible'
      and coalesce(v.arrival_date, v.created_at) < v_limite_inventario
      and v.updated_at < v_limite_modif
      and not exists (
        select 1 from pending_tasks pt
        where pt.entity_type = 'vehicle' and pt.entity_id = v.id and pt.completed_at is null
      )
  loop
    v_desc := r.make || ' ' || r.model || ' ' || r.year
      || ' – en inventario desde '
      || to_char(coalesce(r.arrival_date, r.created_at) at time zone 'America/Santiago', 'DD Mon YYYY')
      || ', sin cambios hace ' || dias_sin_modificar || ' días';

    insert into pending_tasks (
      branch_id, priority, title, description,
      action_type, action_label, entity_type, entity_id,
      metadata, source, due_at
    )
    values (
      r.branch_id,
      'later',
      'Revisar vehículo en inventario: ' || r.make || ' ' || r.model || ' ' || r.year,
      v_desc,
      'otro',
      'Ver vehículo',
      'vehicle',
      r.id,
      jsonb_build_object('vehicle_id', r.id, 'make', r.make, 'model', r.model, 'year', r.year),
      'rule',
      null
    );
  end loop;
end;
$$;

comment on function public.sync_old_inventory_vehicles_to_pending_tasks(int, int) is 'Avisos: crea tareas en Tareas pendientes por vehículos disponibles que llevan muchos días en inventario sin ser modificados';

grant execute on function public.sync_old_inventory_vehicles_to_pending_tasks(int, int) to authenticated;
grant execute on function public.sync_old_inventory_vehicles_to_pending_tasks(int, int) to service_role;