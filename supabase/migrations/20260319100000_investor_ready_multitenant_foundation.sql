-- Investor-ready multi-tenant foundation (backwards compatible)
-- Regla: no romper cuenta legacy hessen@test.io

create extension if not exists pgcrypto;

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  status text not null default 'active',
  legacy_mode boolean not null default false,
  protected_account_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tenant_feature_flags (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  flag_key text not null,
  enabled boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, flag_key)
);

do $$
declare
  legacy_tenant_id uuid;
begin
  insert into public.tenants (slug, name, legacy_mode, protected_account_email)
  values ('legacy-skale', 'Legacy Skale', true, 'hessen@test.io')
  on conflict (slug) do update
  set updated_at = now()
  returning id into legacy_tenant_id;

  alter table public.users add column if not exists tenant_id uuid;
  alter table public.users add column if not exists legacy_protected boolean not null default false;
  alter table public.branches add column if not exists tenant_id uuid;
  alter table public.sales add column if not exists tenant_id uuid;
  alter table public.vehicles add column if not exists tenant_id uuid;
  alter table public.leads add column if not exists tenant_id uuid;
  alter table public.appointments add column if not exists tenant_id uuid;
  alter table public.consignaciones add column if not exists tenant_id uuid;
  alter table public.tramites add column if not exists tenant_id uuid;
  alter table public.gastos_empresa add column if not exists tenant_id uuid;
  alter table public.ingresos_empresa add column if not exists tenant_id uuid;
  alter table public.vehicle_appraisals add column if not exists tenant_id uuid;

  update public.users
  set tenant_id = legacy_tenant_id
  where tenant_id is null;

  update public.users
  set legacy_protected = true
  where lower(email) = 'hessen@test.io';

  update public.branches b
  set tenant_id = u.tenant_id
  from public.users u
  where b.manager_id = u.id
    and b.tenant_id is null;

  update public.branches
  set tenant_id = legacy_tenant_id
  where tenant_id is null;

  update public.sales s
  set tenant_id = b.tenant_id
  from public.branches b
  where s.branch_id = b.id
    and s.tenant_id is null;

  update public.vehicles v
  set tenant_id = b.tenant_id
  from public.branches b
  where v.branch_id = b.id
    and v.tenant_id is null;

  update public.leads l
  set tenant_id = b.tenant_id
  from public.branches b
  where l.branch_id = b.id
    and l.tenant_id is null;

  update public.appointments a
  set tenant_id = b.tenant_id
  from public.branches b
  where a.branch_id = b.id
    and a.tenant_id is null;

  update public.consignaciones c
  set tenant_id = b.tenant_id
  from public.branches b
  where c.branch_id = b.id
    and c.tenant_id is null;

  update public.tramites t
  set tenant_id = b.tenant_id
  from public.branches b
  where t.branch_id = b.id
    and t.tenant_id is null;

  update public.gastos_empresa g
  set tenant_id = b.tenant_id
  from public.branches b
  where g.branch_id = b.id
    and g.tenant_id is null;

  update public.ingresos_empresa i
  set tenant_id = b.tenant_id
  from public.branches b
  where i.branch_id = b.id
    and i.tenant_id is null;

  update public.vehicle_appraisals va
  set tenant_id = b.tenant_id
  from public.branches b
  where va.branch_id = b.id
    and va.tenant_id is null;
end $$;

create or replace function public.current_user_role()
returns text
language sql
stable
as $$
  select role::text from public.users where id = auth.uid() limit 1
$$;

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
as $$
  select tenant_id from public.users where id = auth.uid() limit 1
$$;

create or replace function public.current_is_legacy_protected()
returns boolean
language sql
stable
as $$
  select coalesce(legacy_protected, false) from public.users where id = auth.uid() limit 1
$$;

alter table public.users enable row level security;
alter table public.sales enable row level security;
alter table public.vehicles enable row level security;
alter table public.gastos_empresa enable row level security;
alter table public.ingresos_empresa enable row level security;
alter table public.consignaciones enable row level security;
alter table public.tramites enable row level security;

create policy if not exists users_select_same_tenant
on public.users
for select
to authenticated
using (
  tenant_id = public.current_tenant_id()
  or public.current_is_legacy_protected()
);

create policy if not exists users_update_self_same_tenant
on public.users
for update
to authenticated
using (
  id = auth.uid()
  and (tenant_id = public.current_tenant_id() or public.current_is_legacy_protected())
)
with check (
  id = auth.uid()
  and (tenant_id = public.current_tenant_id() or public.current_is_legacy_protected())
);

create policy if not exists sales_rw_same_tenant
on public.sales
for all
to authenticated
using (tenant_id = public.current_tenant_id() or public.current_is_legacy_protected())
with check (tenant_id = public.current_tenant_id() or public.current_is_legacy_protected());

create policy if not exists vehicles_rw_same_tenant
on public.vehicles
for all
to authenticated
using (tenant_id = public.current_tenant_id() or public.current_is_legacy_protected())
with check (tenant_id = public.current_tenant_id() or public.current_is_legacy_protected());

create policy if not exists gastos_empresa_rw_finance
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

create policy if not exists ingresos_empresa_rw_finance
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

create policy if not exists consignaciones_rw_sales
on public.consignaciones
for all
to authenticated
using (tenant_id = public.current_tenant_id() or public.current_is_legacy_protected())
with check (tenant_id = public.current_tenant_id() or public.current_is_legacy_protected());

create policy if not exists tramites_rw_sales
on public.tramites
for all
to authenticated
using (tenant_id = public.current_tenant_id() or public.current_is_legacy_protected())
with check (tenant_id = public.current_tenant_id() or public.current_is_legacy_protected());

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
as $$
declare
  v_tenant_id uuid;
  v_branch_id uuid;
  v_jefe_id uuid;
begin
  insert into public.tenants(slug, name, status, legacy_mode)
  values (p_slug, p_name, 'active', false)
  returning id into v_tenant_id;

  insert into public.branches(name, address, city, region, is_active, tenant_id)
  values (p_default_branch_name, 'Pendiente', 'Pendiente', 'Pendiente', true, v_tenant_id)
  returning id into v_branch_id;

  select id into v_jefe_id
  from public.users
  where lower(email) = lower(p_jefe_jefe_email)
  limit 1;

  if v_jefe_id is not null then
    update public.users
    set
      full_name = coalesce(nullif(trim(p_jefe_jefe_full_name), ''), full_name),
      tenant_id = v_tenant_id,
      -- Mantiene compatibilidad con enum/roles actuales; el mapeo a JefeJefe se hace por permisos.
      role = 'admin',
      branch_id = v_branch_id,
      is_active = true,
      updated_at = now()
    where id = v_jefe_id;
  end if;

  return query
  select v_tenant_id, v_branch_id;
end;
$$;
