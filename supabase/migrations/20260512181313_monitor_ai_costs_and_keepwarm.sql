-- ============================================================================
-- Monitor de costos AI + cold-start keep-warm (2026-05-13).
--
-- 1. Tabla `ai_model_pricing`: catálogo de precios por modelo (USD por 1k tokens).
-- 2. RPC `super_admin_ai_cost_summary`: agregados de uso/costo para super-admin
--    (hessen@test.io). Sólo callable por ese email.
-- 3. pg_cron job: cada 5 min hace un OPTIONS request a las edge functions
--    críticas via pg_net para mantenerlas warm (cold-start mitigation).
-- ============================================================================

-- ============================================================================
-- 1) Tabla de precios por modelo
-- ============================================================================
create table if not exists public.ai_model_pricing (
  model text primary key,
  provider text not null check (provider in ('openai', 'anthropic', 'other')),
  input_per_1k_usd numeric(10, 6) not null,
  output_per_1k_usd numeric(10, 6) not null,
  updated_at timestamptz not null default now(),
  notes text
);

comment on table public.ai_model_pricing is
  'Catálogo de precios USD por 1000 tokens, por modelo. Usado por super_admin_ai_cost_summary para calcular costo total.';

-- Seed con precios al 2026-05-13 (verificar contra pricing pages oficiales).
-- OpenAI: https://openai.com/api/pricing/
-- Anthropic: https://www.anthropic.com/pricing
insert into public.ai_model_pricing (model, provider, input_per_1k_usd, output_per_1k_usd, notes) values
  ('gpt-4o', 'openai', 0.005, 0.015, 'GPT-4o standard'),
  ('gpt-4o-mini', 'openai', 0.00015, 0.0006, 'GPT-4o mini'),
  ('gpt-4-turbo-preview', 'openai', 0.01, 0.03, 'GPT-4 Turbo'),
  ('gpt-4-turbo', 'openai', 0.01, 0.03, 'GPT-4 Turbo'),
  ('gpt-3.5-turbo', 'openai', 0.0005, 0.0015, 'GPT-3.5 Turbo'),
  ('claude-sonnet-4-20250514', 'anthropic', 0.003, 0.015, 'Claude Sonnet 4'),
  ('claude-opus-4', 'anthropic', 0.015, 0.075, 'Claude Opus 4'),
  ('claude-haiku-4', 'anthropic', 0.001, 0.005, 'Claude Haiku 4'),
  ('claude-3-5-sonnet-20241022', 'anthropic', 0.003, 0.015, 'Claude 3.5 Sonnet')
on conflict (model) do update
  set input_per_1k_usd = excluded.input_per_1k_usd,
      output_per_1k_usd = excluded.output_per_1k_usd,
      updated_at = now(),
      notes = excluded.notes;

alter table public.ai_model_pricing enable row level security;

-- Sólo lectura a authenticated (catalog público dentro del SaaS).
create policy ai_model_pricing_read on public.ai_model_pricing
  for select to authenticated using (true);

-- ============================================================================
-- 2) RPC super-admin para Monitor de costos
-- ============================================================================
-- Sólo callable por hessen@test.io. Valida via auth.jwt() ->> 'email'.
create or replace function public.super_admin_ai_cost_summary(
  p_from date default (current_date - interval '30 days')::date,
  p_to date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_email text;
  v_result jsonb;
begin
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if v_email <> 'hessen@test.io' then
    return jsonb_build_object(
      'authorized', false,
      'error', 'super-admin access required'
    );
  end if;

  with logs as (
    select
      l.feature,
      l.model,
      l.tenant_id,
      l.created_at::date as day,
      coalesce(l.tokens_input, 0) as t_in,
      coalesce(l.tokens_output, 0) as t_out,
      coalesce(p.input_per_1k_usd, 0) as p_in,
      coalesce(p.output_per_1k_usd, 0) as p_out
    from public.ai_usage_logs l
    left join public.ai_model_pricing p on p.model = l.model
    where l.created_at::date between p_from and p_to
  ),
  totals as (
    select
      count(*) as call_count,
      sum(t_in) as tokens_input,
      sum(t_out) as tokens_output,
      sum((t_in * p_in / 1000) + (t_out * p_out / 1000)) as cost_usd
    from logs
  ),
  by_tenant as (
    select jsonb_agg(t order by t->>'cost_usd' desc) as data from (
      select jsonb_build_object(
        'tenant_id', tenant_id,
        'call_count', count(*),
        'tokens_input', sum(t_in),
        'tokens_output', sum(t_out),
        'cost_usd', round(sum((t_in * p_in / 1000) + (t_out * p_out / 1000))::numeric, 4)
      ) as t
      from logs
      group by tenant_id
    ) sub
  ),
  by_feature as (
    select jsonb_agg(t order by t->>'cost_usd' desc) as data from (
      select jsonb_build_object(
        'feature', feature,
        'call_count', count(*),
        'cost_usd', round(sum((t_in * p_in / 1000) + (t_out * p_out / 1000))::numeric, 4)
      ) as t
      from logs
      group by feature
    ) sub
  ),
  by_model as (
    select jsonb_agg(t order by t->>'cost_usd' desc) as data from (
      select jsonb_build_object(
        'model', model,
        'call_count', count(*),
        'tokens_input', sum(t_in),
        'tokens_output', sum(t_out),
        'cost_usd', round(sum((t_in * p_in / 1000) + (t_out * p_out / 1000))::numeric, 4)
      ) as t
      from logs
      group by model
    ) sub
  ),
  by_day as (
    select jsonb_agg(t order by t->>'day') as data from (
      select jsonb_build_object(
        'day', day,
        'call_count', count(*),
        'cost_usd', round(sum((t_in * p_in / 1000) + (t_out * p_out / 1000))::numeric, 4)
      ) as t
      from logs
      group by day
    ) sub
  )
  select jsonb_build_object(
    'authorized', true,
    'range', jsonb_build_object('from', p_from, 'to', p_to),
    'totals', (select to_jsonb(t) from totals t),
    'by_tenant', coalesce((select data from by_tenant), '[]'::jsonb),
    'by_feature', coalesce((select data from by_feature), '[]'::jsonb),
    'by_model', coalesce((select data from by_model), '[]'::jsonb),
    'by_day', coalesce((select data from by_day), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function public.super_admin_ai_cost_summary(date, date) from public, anon;

comment on function public.super_admin_ai_cost_summary(date, date) is
  'Super-admin only (hessen@test.io). Devuelve agregados de costo/uso de AI cross-tenant para el Monitor de Configuración. Valida email del JWT.';

-- ============================================================================
-- 3) Cold-start keep-warm: pg_cron + pg_net
-- ============================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.warm_edge_functions()
returns void
language plpgsql
security definer
set search_path = public, extensions, net, pg_catalog
as $$
declare
  v_base text;
  v_function text;
  v_functions text[] := array[
    'lead-create',
    'lead-state-update',
    'support-chat',
    'ai-chat',
    'studio-ia-generate',
    'getapi-appraisal',
    'vehicle-appraisal'
  ];
begin
  v_base := 'https://qszfkwshuhmedmzufalh.supabase.co/functions/v1/';
  foreach v_function in array v_functions loop
    perform net.http_get(
      url := v_base || v_function,
      headers := jsonb_build_object('Origin', 'https://app.skalemotors.cl'),
      timeout_milliseconds := 2000
    );
  end loop;
end;
$$;

revoke execute on function public.warm_edge_functions() from public, anon, authenticated;

comment on function public.warm_edge_functions() is
  'Keep-warm cron: hace HTTP request a las edge functions críticas para evitar cold starts. Llamado por pg_cron cada 5 min.';

select cron.schedule(
  'edge-functions-keep-warm',
  '*/5 * * * *',
  $$select public.warm_edge_functions();$$
);
