-- Endurecimiento: funciones solo vía triggers, sin INSERT directo a eventos,
-- y revalidación del trigger de notificaciones (tenant + rol vendedor).

-- Bloquear mutaciones directas en bitácora (solo trigger SECURITY DEFINER inserta).
drop policy if exists vehicle_status_events_no_insert on public.vehicle_status_events;
create policy vehicle_status_events_no_insert on public.vehicle_status_events
  for insert to authenticated
  with check (false);

drop policy if exists vehicle_status_events_no_update on public.vehicle_status_events;
create policy vehicle_status_events_no_update on public.vehicle_status_events
  for update to authenticated
  using (false);

drop policy if exists vehicle_status_events_no_delete on public.vehicle_status_events;
create policy vehicle_status_events_no_delete on public.vehicle_status_events
  for delete to authenticated
  using (false);

revoke all on function public.vehicles_on_status_change() from public;
revoke all on function public.vehicles_on_status_change() from anon;
revoke all on function public.vehicles_on_status_change() from authenticated;

revoke all on function public.vehicles_sync_status_changed_at() from public;
revoke all on function public.vehicles_sync_status_changed_at() from anon;
revoke all on function public.vehicles_sync_status_changed_at() from authenticated;

grant execute on function public.vehicles_on_status_change() to service_role;
grant execute on function public.vehicles_sync_status_changed_at() to service_role;
