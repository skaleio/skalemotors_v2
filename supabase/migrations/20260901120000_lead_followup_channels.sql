-- Seguimiento de leads por canal independiente (Llamadas / WhatsApp).
-- - lead_notes gana `channel` y `next_action_at`: cada nota pertenece a un canal
--   y declara la próxima acción fechada del vendedor.
-- - leads gana `whatsapp_attempts`: contador propio del canal WhatsApp
--   (Llamadas sigue usando `calls_made`).
-- Cambios aditivos. Las columnas nuevas heredan las políticas RLS existentes
-- de lead_notes y leads (no se crean policies nuevas).

alter table public.lead_notes
  add column if not exists channel text,
  add column if not exists next_action_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'lead_notes_channel_check'
  ) then
    alter table public.lead_notes
      add constraint lead_notes_channel_check
      check (channel is null or channel in ('llamada', 'whatsapp'));
  end if;
end $$;

create index if not exists idx_lead_notes_lead_channel
  on public.lead_notes (lead_id, channel);

alter table public.leads
  add column if not exists whatsapp_attempts integer not null default 0;
