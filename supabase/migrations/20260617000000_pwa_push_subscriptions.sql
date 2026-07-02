-- PWA Push (v1) — backend
--
-- 1. Tabla public.push_subscriptions: una fila por device suscrito (multi-device).
-- 2. RLS: cada usuario maneja SOLO sus propias suscripciones. El service_role
--    (Edge Function push-send) lee/borra todas (bypassa RLS).
-- 3. Dispatcher + trigger AFTER INSERT en public.notifications: cada notificación
--    nueva dispara (fire-and-forget vía pg_net) la Edge Function push-send, que
--    envía el Web Push al/los device(s) del recipient. El fallo del push NUNCA
--    bloquea el INSERT de la notificación.
--
-- Requisitos de despliegue (humano):
--   - Secret en Vault: select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');
--   - Edge Function push-send desplegada con verify_jwt = false y los secrets VAPID.

-- ============================================================================
-- 0) Extensión pg_net (idempotente; ya usada por webhooks_outbound)
-- ============================================================================
create extension if not exists pg_net;

-- ============================================================================
-- 1) Tabla de suscripciones push
-- ============================================================================
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device_label text,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_user
  on public.push_subscriptions (user_id);

-- ============================================================================
-- 2) RLS — el usuario es dueño de sus suscripciones
-- ============================================================================
alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_select_own on public.push_subscriptions;
create policy push_subscriptions_select_own
on public.push_subscriptions
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists push_subscriptions_insert_own on public.push_subscriptions;
create policy push_subscriptions_insert_own
on public.push_subscriptions
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists push_subscriptions_update_own on public.push_subscriptions;
create policy push_subscriptions_update_own
on public.push_subscriptions
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists push_subscriptions_delete_own on public.push_subscriptions;
create policy push_subscriptions_delete_own
on public.push_subscriptions
for delete
to authenticated
using (user_id = auth.uid());
-- service_role bypassa RLS: la Edge Function lee todas las suscripciones del
-- recipient y borra las muertas (404/410).

-- ============================================================================
-- 3) Dispatcher: notifications INSERT -> Edge Function push-send (fire-and-forget)
-- ============================================================================
create or replace function public.dispatch_push_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service_key text;
  v_url text := 'https://qszfkwshuhmedmzufalh.supabase.co/functions/v1/push-send';
  v_payload jsonb;
begin
  -- service_role key desde Vault para autenticar el POST a la Edge Function.
  select decrypted_secret into v_service_key
  from vault.decrypted_secrets
  where name = 'service_role_key'
  limit 1;

  if v_service_key is null then
    raise warning 'dispatch_push_notification: falta el secret service_role_key en Vault';
    return new;
  end if;

  v_payload := jsonb_build_object(
    'notification_id', new.id,
    'recipient_user_id', new.recipient_user_id,
    'title', new.title,
    'message', new.message,
    'action_url', new.action_url,
    'type', new.type
  );

  begin
    perform net.http_post(
      url := v_url,
      body := v_payload,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key
      ),
      timeout_milliseconds := 5000
    );
  exception when others then
    -- Nunca abortar el INSERT de la notificación por un fallo de push.
    raise warning 'dispatch_push_notification -> push-send falló: %', SQLERRM;
  end;

  return new;
end $$;

revoke all on function public.dispatch_push_notification() from public;
-- authenticated NO ejecuta esta función directamente: solo el trigger (SECURITY DEFINER).

drop trigger if exists trg_push_on_notification on public.notifications;
create trigger trg_push_on_notification
after insert on public.notifications
for each row
execute function public.dispatch_push_notification();
