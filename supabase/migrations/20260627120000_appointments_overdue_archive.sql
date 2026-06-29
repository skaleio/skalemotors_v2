-- Citas vencidas no concretadas: limpieza automática del calendario activo.
-- Una cita que ya pasó y el vendedor cerró como 'no_asistio' o 'cancelada' (no se
-- concretó) deja de aportar al calendario. Tras un período de gracia se archiva
-- (soft-delete): se saca de las vistas activas pero la fila y su nota quedan para
-- historial y métricas. Las citas vencidas SIN resolver ('programada'/'confirmada')
-- NO se archivan: el vendedor está obligado a registrar qué pasó (modal bloqueante).

alter table public.appointments
  add column if not exists archived_at timestamptz;

comment on column public.appointments.archived_at is
  'Soft-delete: cita vencida no concretada. Excluida de vistas activas; se conserva para historial.';

-- Acelera el modal de citas vencidas sin resolver por vendedor.
create index if not exists appointments_overdue_unresolved_idx
  on public.appointments (user_id, scheduled_at)
  where archived_at is null and status in ('programada', 'confirmada');

create extension if not exists pg_cron;

create or replace function public.archive_unconcreted_appointments(grace_days int default 7)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  n integer;
begin
  update public.appointments
  set archived_at = now(), updated_at = now()
  where archived_at is null
    and status in ('no_asistio', 'cancelada')
    and scheduled_at < now() - (grace_days || ' days')::interval;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.archive_unconcreted_appointments(int) from public, anon, authenticated;

comment on function public.archive_unconcreted_appointments(int) is
  'Archiva (soft-delete) citas vencidas no concretadas (no_asistio/cancelada) tras N días de gracia. Llamada por pg_cron a diario.';

-- Job idempotente: re-aplicar la migración no duplica el schedule.
do $$
begin
  perform cron.unschedule('archive-unconcreted-appointments');
exception when others then
  null;
end;
$$;

select cron.schedule(
  'archive-unconcreted-appointments',
  '15 4 * * *',
  $$select public.archive_unconcreted_appointments();$$
);
