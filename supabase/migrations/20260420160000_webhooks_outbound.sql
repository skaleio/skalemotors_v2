-- Webhooks salientes (outbound) — arquitectura genérica
--
-- Objetivo:
--   Permitir disparar webhooks HTTP desde triggers de Postgres al ocurrir
--   eventos de negocio (lead vendido, consignación creada, etc.), usando
--   pg_net para hacer llamadas HTTP asíncronas sin bloquear la transacción.
--
-- Componentes:
--   1. Extensión pg_net (requerida para net.http_post).
--   2. public.webhook_endpoints — tabla de configuración (una fila por URL).
--   3. public.webhook_log — bitácora para debug / auditoría.
--   4. public.dispatch_webhook(event_key, tenant_id, payload) — dispatcher.
--   5. Trigger AFTER UPDATE en public.leads — dispara 'lead_sold'.
--
-- Eventos soportados (event_key):
--   - lead_sold            → lead pasa a status='vendido'   (implementado aquí)
--   - consignacion_created → INSERT en consignaciones       (reservado, listo para seed)
--   - consignacion_stale   → consignación sin publicar > N  (reservado, listo para seed)
--
-- Para agregar un evento nuevo:
--   a) Insertar fila en public.webhook_endpoints con event_key + url.
--   b) Crear trigger que arme payload y llame a dispatch_webhook(...).

-- ============================================================================
-- 1) Extensión pg_net
-- ============================================================================
create extension if not exists pg_net;

-- ============================================================================
-- 2) Tabla de configuración de endpoints
-- ============================================================================
create table if not exists public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  event_key text not null,
  url text not null,
  secret text,
  headers jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uniq_webhook_endpoints_event_url
    unique nulls not distinct (tenant_id, event_key, url)
);

create index if not exists idx_webhook_endpoints_event_active
  on public.webhook_endpoints (event_key)
  where is_active = true;

alter table public.webhook_endpoints enable row level security;

drop policy if exists webhook_endpoints_select on public.webhook_endpoints;
create policy webhook_endpoints_select
on public.webhook_endpoints
for select
to authenticated
using (
  public.current_user_role() = 'admin'
  and (tenant_id is null or tenant_id = public.current_tenant_id() or public.current_is_legacy_protected())
);

drop policy if exists webhook_endpoints_write on public.webhook_endpoints;
create policy webhook_endpoints_write
on public.webhook_endpoints
for all
to authenticated
using (
  public.current_user_role() = 'admin'
  and tenant_id is not null
  and (tenant_id = public.current_tenant_id() or public.current_is_legacy_protected())
)
with check (
  public.current_user_role() = 'admin'
  and tenant_id is not null
  and (tenant_id = public.current_tenant_id() or public.current_is_legacy_protected())
);
-- Nota: rows con tenant_id NULL (globales) solo se pueden modificar vía migrations / service_role.

-- ============================================================================
-- 3) Bitácora
-- ============================================================================
create table if not exists public.webhook_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  event_key text not null,
  endpoint_id uuid references public.webhook_endpoints(id) on delete set null,
  url text not null,
  payload jsonb,
  request_id bigint,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_webhook_log_event_created
  on public.webhook_log (event_key, created_at desc);

alter table public.webhook_log enable row level security;

drop policy if exists webhook_log_select_admin on public.webhook_log;
create policy webhook_log_select_admin
on public.webhook_log
for select
to authenticated
using (
  public.current_user_role() = 'admin'
  and (tenant_id is null or tenant_id = public.current_tenant_id() or public.current_is_legacy_protected())
);
-- INSERT bloqueado para authenticated: solo dispatcher (SECURITY DEFINER) y service_role.

-- ============================================================================
-- 4) Dispatcher
-- ============================================================================
create or replace function public.dispatch_webhook(
  p_event_key text,
  p_tenant_id uuid,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_request_id bigint;
  v_headers jsonb;
begin
  for r in
    select id, url, headers, secret
    from public.webhook_endpoints
    where is_active = true
      and event_key = p_event_key
      and (tenant_id is null or tenant_id = p_tenant_id)
  loop
    begin
      v_headers := jsonb_build_object('Content-Type', 'application/json')
                   || coalesce(r.headers, '{}'::jsonb);
      if r.secret is not null then
        v_headers := v_headers || jsonb_build_object('X-Webhook-Secret', r.secret);
      end if;

      select id into v_request_id
      from net.http_post(
        url := r.url,
        body := p_payload,
        headers := v_headers,
        timeout_milliseconds := 5000
      ) as id;

      insert into public.webhook_log (tenant_id, event_key, endpoint_id, url, payload, request_id)
      values (p_tenant_id, p_event_key, r.id, r.url, p_payload, v_request_id);
    exception when others then
      insert into public.webhook_log (tenant_id, event_key, endpoint_id, url, payload, error)
      values (p_tenant_id, p_event_key, r.id, r.url, p_payload, SQLERRM);
      raise warning 'dispatch_webhook[%] -> % failed: %', p_event_key, r.url, SQLERRM;
    end;
  end loop;
end $$;

revoke all on function public.dispatch_webhook(text, uuid, jsonb) from public;
grant execute on function public.dispatch_webhook(text, uuid, jsonb) to service_role;
-- authenticated NO tiene execute: solo se invoca desde triggers SECURITY DEFINER.

-- ============================================================================
-- 5) Trigger: lead_sold webhook
-- ============================================================================
create or replace function public.notify_lead_sold_webhook()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_prev_status text;
  v_seller record;
  v_branch_name text;
  v_payload jsonb;
begin
  if new.status is distinct from 'vendido' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'vendido' then
    return new;
  end if;

  v_tenant_id := new.tenant_id;
  if v_tenant_id is null and new.branch_id is not null then
    select b.tenant_id into v_tenant_id from public.branches b where b.id = new.branch_id;
  end if;
  if v_tenant_id is null then
    return new;
  end if;

  v_prev_status := case when tg_op = 'UPDATE' then old.status else null end;

  if new.branch_id is not null then
    select b.name into v_branch_name from public.branches b where b.id = new.branch_id;
  end if;

  if coalesce(new.closed_by_staff_id, new.assigned_to) is not null then
    select u.id, u.full_name, u.email
      into v_seller
    from public.users u
    where u.id = coalesce(new.closed_by_staff_id, new.assigned_to);
  end if;

  v_payload := jsonb_build_object(
    'event', 'lead_sold',
    'fecha_iso', now(),
    'tenant_id', v_tenant_id,
    'branch_id', new.branch_id,
    'branch_name', v_branch_name,
    'lead_id', new.id,
    'status_anterior', v_prev_status,
    'status_actual', new.status,
    'closed_at', new.closed_at,
    'cliente', jsonb_build_object(
      'nombre', new.full_name,
      'telefono', new.phone,
      'email', new.email,
      'rut', new.rut
    ),
    'vendedor', jsonb_build_object(
      'user_id', new.assigned_to,
      'closed_by_staff_id', new.closed_by_staff_id,
      'full_name', v_seller.full_name,
      'email', v_seller.email
    ),
    'origen', new.source,
    'forma_pago', new.payment_type,
    'presupuesto', jsonb_build_object(
      'budget', new.budget,
      'min', new.budget_min,
      'max', new.budget_max
    ),
    'vehiculo_interes', new.vehicle_interest,
    'preferred_vehicle_id', new.preferred_vehicle_id,
    'notas', new.notes,
    'tags', new.tags
  );

  perform public.dispatch_webhook('lead_sold', v_tenant_id, v_payload);
  return new;
end $$;

drop trigger if exists trg_lead_sold_webhook on public.leads;
create trigger trg_lead_sold_webhook
after insert or update of status on public.leads
for each row
execute function public.notify_lead_sold_webhook();

-- ============================================================================
-- 6) Seed: endpoint global de n8n para negocio cerrado
-- ============================================================================
insert into public.webhook_endpoints (tenant_id, event_key, url, description, is_active)
select
  null,
  'lead_sold',
  'https://n8n-n8n.obmrlq.easypanel.host/webhook-test/negocio-cerrado',
  'n8n workflow negocio-cerrado (global)',
  true
where not exists (
  select 1 from public.webhook_endpoints
  where event_key = 'lead_sold'
    and url = 'https://n8n-n8n.obmrlq.easypanel.host/webhook-test/negocio-cerrado'
    and tenant_id is null
);
