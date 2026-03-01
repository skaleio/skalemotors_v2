-- Distribución de salarios por sucursal y mes (reemplaza localStorage en SalaryDistribution).
create table public.salary_distribution (
  id uuid primary key default extensions.uuid_generate_v4(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  year smallint not null,
  month smallint not null check (month >= 1 and month <= 12),
  profit numeric not null default 0,
  amounts jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint salary_distribution_branch_year_month_key unique (branch_id, year, month)
);

comment on table public.salary_distribution is 'Distribución de profit por mes y sucursal (Mike, Jota, Ahorro Empresa, etc.).';
comment on column public.salary_distribution.amounts is 'Objeto { "Mike": 123, "Jota": 456, ... } con montos por beneficiario.';

create index idx_salary_distribution_branch on public.salary_distribution(branch_id);
create index idx_salary_distribution_year_month on public.salary_distribution(year, month desc);

alter table public.salary_distribution enable row level security;

create policy "salary_distribution_select"
  on public.salary_distribution for select to authenticated
  using (
    branch_id in (select branch_id from public.users where id = auth.uid())
    or exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

create policy "salary_distribution_insert"
  on public.salary_distribution for insert to authenticated
  with check (
    branch_id in (select branch_id from public.users where id = auth.uid())
    or exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

create policy "salary_distribution_update"
  on public.salary_distribution for update to authenticated
  using (
    branch_id in (select branch_id from public.users where id = auth.uid())
    or exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  )
  with check (
    branch_id in (select branch_id from public.users where id = auth.uid())
    or exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

create or replace function public.set_updated_at_salary_distribution()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger salary_distribution_updated_at
  before update on public.salary_distribution
  for each row execute function public.set_updated_at_salary_distribution();
