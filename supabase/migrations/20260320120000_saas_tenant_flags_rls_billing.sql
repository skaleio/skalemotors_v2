-- SaaS hardening: flags por tenant, billing stub, RLS coherente, provision idempotente
-- Regla: cuenta legacy hessen@test.io sigue con legacy_protected + mismas capacidades previas vía políticas existentes + restrictivas

-- ---------------------------------------------------------------------------
-- 1) Corregir políticas de finanzas: el enum de role no incluye 'jefe_jefe' aún
-- ---------------------------------------------------------------------------
drop policy if exists gastos_empresa_rw_finance on public.gastos_empresa;
drop policy if exists ingresos_empresa_rw_finance on public.ingresos_empresa;

create policy gastos_empresa_rw_finance
on public.gastos_empresa
for all
to authenticated
using (
  (tenant_id = public.current_tenant_id() or public.current_is_legacy_protected())
  and public.current_user_role() in ('admin', 'financiero')
)
with check (
  (tenant_id = public.current_tenant_id() or public.current_is_legacy_protected())
  and public.current_user_role() in ('admin', 'financiero')
);

create policy ingresos_empresa_rw_finance
on public.ingresos_empresa
for all
to authenticated
using (
  (tenant_id = public.current_tenant_id() or public.current_is_legacy_protected())
  and public.current_user_role() in ('admin', 'financiero')
)
with check (
  (tenant_id = public.current_tenant_id() or public.current_is_legacy_protected())
  and public.current_user_role() in ('admin', 'financiero')
);

-- ---------------------------------------------------------------------------
-- 2) Aislamiento restrictivo por tenant (AND con políticas permisivas existentes)
--    legacy_protected: no reduce capacidades; omite el filtro de tenant estricto
-- ---------------------------------------------------------------------------
drop policy if exists tenant_scope_restrict_gastos on public.gastos_empresa;
create policy tenant_scope_restrict_gastos
on public.gastos_empresa
as restrictive
for all
to authenticated
using (
  public.current_is_legacy_protected()
  or (tenant_id is not null and tenant_id = public.current_tenant_id())
)
with check (
  public.current_is_legacy_protected()
  or (tenant_id is not null and tenant_id = public.current_tenant_id())
);

drop policy if exists tenant_scope_restrict_ingresos on public.ingresos_empresa;
create policy tenant_scope_restrict_ingresos
on public.ingresos_empresa
as restrictive
for all
to authenticated
using (
  public.current_is_legacy_protected()
  or (tenant_id is not null and tenant_id = public.current_tenant_id())
)
with check (
  public.current_is_legacy_protected()
  or (tenant_id is not null and tenant_id = public.current_tenant_id())
);

-- ---------------------------------------------------------------------------
-- 3) Feature flags por tenant (lectura para usuarios del mismo tenant)
-- ---------------------------------------------------------------------------
alter table public.tenant_feature_flags enable row level security;

drop policy if exists tenant_feature_flags_select_same_tenant on public.tenant_feature_flags;
create policy tenant_feature_flags_select_same_tenant
on public.tenant_feature_flags
for select
to authenticated
using (tenant_id = public.current_tenant_id());

-- ---------------------------------------------------------------------------
-- 4) Stub de billing (Stripe / proveedor futuro; cobro manual hoy)
-- ---------------------------------------------------------------------------
create table if not exists public.tenant_billing (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  billing_mode text not null default 'manual' check (billing_mode in ('manual', 'stripe_pending', 'stripe_active')),
  provider text,
  external_customer_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.tenant_billing is 'Estado de facturación por tenant; manual hasta integración de pagos automáticos.';

alter table public.tenant_billing enable row level security;

drop policy if exists tenant_billing_select_same_tenant on public.tenant_billing;
create policy tenant_billing_select_same_tenant
on public.tenant_billing
for select
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in ('admin', 'financiero')
);

-- ---------------------------------------------------------------------------
-- 5) provision_tenant idempotente (re-ejecutar mismo slug no falla)
-- ---------------------------------------------------------------------------
create or replace function public.provision_tenant(
  p_slug text,
  p_name text,
  p_jefe_jefe_email text,
  p_jefe_jefe_full_name text,
  p_default_branch_name text default 'Sucursal Principal'
)
returns table (
  tenant_id uuid,
  branch_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_branch_id uuid;
  v_jefe_id uuid;
begin
  insert into public.tenants (slug, name, status, legacy_mode)
  values (p_slug, p_name, 'active', false)
  on conflict (slug) do update
  set
    name = excluded.name,
    updated_at = now()
  returning id into v_tenant_id;

  select id into v_branch_id
  from public.branches
  where tenant_id = v_tenant_id
  order by created_at asc
  limit 1;

  if v_branch_id is null then
    insert into public.branches (name, address, city, region, is_active, tenant_id)
    values (p_default_branch_name, 'Pendiente', 'Pendiente', 'Pendiente', true, v_tenant_id)
    returning id into v_branch_id;
  end if;

  select id into v_jefe_id
  from public.users
  where lower(email) = lower(p_jefe_jefe_email)
  limit 1;

  if v_jefe_id is not null then
    update public.users
    set
      full_name = coalesce(nullif(trim(p_jefe_jefe_full_name), ''), full_name),
      tenant_id = v_tenant_id,
      role = 'admin',
      branch_id = v_branch_id,
      is_active = true,
      updated_at = now()
    where id = v_jefe_id;
  end if;

  insert into public.tenant_feature_flags (tenant_id, flag_key, enabled, payload) values
    (v_tenant_id, 'investor_ready_security', false, '{}'),
    (v_tenant_id, 'tenant_rbac', true, '{}'),
    (v_tenant_id, 'automated_provisioning', true, '{}'),
    (v_tenant_id, 'strict_finance_access', true, '{}')
  on conflict (tenant_id, flag_key) do nothing;

  insert into public.tenant_billing (tenant_id, billing_mode)
  values (v_tenant_id, 'manual')
  on conflict (tenant_id) do nothing;

  return query
  select v_tenant_id, v_branch_id;
end;
$$;

revoke all on function public.provision_tenant(text, text, text, text, text) from public;
grant execute on function public.provision_tenant(text, text, text, text, text) to service_role;
