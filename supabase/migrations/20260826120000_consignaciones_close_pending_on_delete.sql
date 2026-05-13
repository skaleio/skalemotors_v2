-- Cleanup defensivo: cerrar pending_tasks asociadas cuando se borra la
-- consignación.
--
-- Hoy `pending_tasks.entity_id` es polimórfico (refiere a leads, vehicles,
-- consignaciones, appointments...) y por lo tanto NO tiene FK. Eso significa
-- que un `delete from consignaciones where id = X` deja huérfana cualquier
-- pending_task con entity_type='consignacion' y entity_id=X. La RPC actual
-- sync_stale_consignaciones_to_pending_tasks no las limpia porque su update
-- de cierre joinea contra consignaciones (las huérfanas no matchean).
--
-- Hoy no hay huérfanas en remoto (verificado), pero es una bomba a futuro.
-- Lo prevenimos con un trigger AFTER DELETE.

create or replace function public.close_consignacion_pending_task_on_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.pending_tasks
  set completed_at = now(), updated_at = now()
  where entity_type = 'consignacion'
    and entity_id = old.id
    and completed_at is null;
  return old;
end;
$$;

revoke execute on function public.close_consignacion_pending_task_on_delete() from public;
revoke execute on function public.close_consignacion_pending_task_on_delete() from anon;
revoke execute on function public.close_consignacion_pending_task_on_delete() from authenticated;

drop trigger if exists trg_close_consignacion_pending_task_on_delete on public.consignaciones;
create trigger trg_close_consignacion_pending_task_on_delete
after delete on public.consignaciones
for each row
execute function public.close_consignacion_pending_task_on_delete();

-- Limpieza histórica: si hubiera huérfanas existentes (hoy: 0), las cerramos.
update public.pending_tasks pt
set completed_at = now(), updated_at = now()
where pt.entity_type = 'consignacion'
  and pt.completed_at is null
  and not exists (
    select 1 from public.consignaciones c where c.id = pt.entity_id
  );
