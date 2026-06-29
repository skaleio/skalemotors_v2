-- Alerta "lead sin movimiento" (campana): cuando un lead SE MUEVE (cambia de
-- estado, incluido pasar a 'cancelado'), la notificación lead_stale ya no aplica.
-- Hasta ahora el trigger solo cerraba la pending_task, dejando la notificación
-- colgada en la campana. Ahora también la archiva.
--
-- Caso del usuario: es normal que un lead 'cancelado' no se mueva, así que no debe
-- seguir apareciendo en la campana como "sin movimiento".

-- ============================================================================
-- 1) Trigger: al cambiar de estado, cerrar pending_task + archivar notificación
-- ============================================================================
create or replace function public.close_lead_stale_pending_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    update public.pending_tasks
    set completed_at = now(), updated_at = now()
    where entity_type = 'lead'
      and entity_id = new.id
      and completed_at is null
      and source = 'rule'
      and metadata->>'stale_reason' = 'no_movement';

    -- El lead se movió: la alerta de "sin movimiento" deja de tener sentido.
    update public.notifications
    set archived_at = now(), read_at = coalesce(read_at, now())
    where type = 'lead_stale'
      and entity_type = 'lead'
      and entity_id = new.id
      and archived_at is null;
  end if;
  return new;
end $$;

-- ============================================================================
-- 2) Backfill: archivar notificaciones lead_stale colgadas de leads que ya
--    salieron del pipeline activo (cancelado/vendido/perdido) o fueron borrados.
-- ============================================================================
update public.notifications n
set archived_at = now(), read_at = coalesce(n.read_at, now())
from public.leads l
where n.type = 'lead_stale'
  and n.entity_type = 'lead'
  and n.entity_id = l.id
  and n.archived_at is null
  and (
    l.deleted_at is not null
    or l.status in ('cancelado', 'vendido', 'perdido')
  );
