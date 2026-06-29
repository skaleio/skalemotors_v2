-- Retención de notificaciones: la tabla public.notifications solo crece (nada se
-- borra). La campana muestra a lo sumo las últimas 30 por usuario, así que las
-- viejas no aportan valor y solo ocupan espacio. Job pg_cron diario que purga:
--   - archivadas  > 30 días (archived_at)
--   - leídas      > 60 días (read_at)
--   - cualquiera  > 90 días (created_at)  ← acota las sin-leer que se acumulan
--                                            (ej. lead_assigned que nadie lee)

create extension if not exists pg_cron;

create or replace function public.purge_old_notifications(
  archived_days int default 30,
  read_days int default 60,
  any_days int default 90
)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  n integer;
begin
  delete from public.notifications
  where (archived_at is not null and archived_at < now() - (archived_days || ' days')::interval)
     or (read_at is not null and read_at < now() - (read_days || ' days')::interval)
     or (created_at < now() - (any_days || ' days')::interval);
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.purge_old_notifications(int, int, int) from public, anon, authenticated;

comment on function public.purge_old_notifications(int, int, int) is
  'Retención de notificaciones: borra archivadas >30d, leídas >60d y cualquiera >90d. Llamada por pg_cron a diario.';

-- Job idempotente: re-aplicar la migración no duplica el schedule.
do $$
begin
  perform cron.unschedule('purge-old-notifications');
exception when others then
  null;
end;
$$;

select cron.schedule(
  'purge-old-notifications',
  '30 4 * * *',
  $$select public.purge_old_notifications();$$
);
