-- Tabla de gastos de la empresa (finanzas)
-- Permite registrar gastos con tipo, monto, inversor y sucursal
create table public.gastos_empresa (
  id uuid primary key default extensions.uuid_generate_v4(),
  branch_id uuid references public.branches(id) on delete restrict,
  amount numeric not null check (amount >= 0),
  description text,
  expense_type text not null check (expense_type in (
    'operacion', 'marketing', 'servicios', 'mantenimiento', 'combustible',
    'seguros', 'impuestos', 'personal', 'vehiculos', 'otros'
  )),
  inversor_id uuid references public.users(id) on delete set null,
  inversor_name text,
  expense_date date not null default current_date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.gastos_empresa is 'Gastos de la empresa para control por tipo e inversor.';

create index idx_gastos_empresa_branch_id on public.gastos_empresa(branch_id);
create index idx_gastos_empresa_expense_date on public.gastos_empresa(expense_date desc);
create index idx_gastos_empresa_expense_type on public.gastos_empresa(expense_type);
create index idx_gastos_empresa_inversor_id on public.gastos_empresa(inversor_id);

alter table public.gastos_empresa enable row level security;

-- SELECT: usuarios autenticados ven gastos de su sucursal (o todos si admin)
create policy "gastos_empresa_select"
  on public.gastos_empresa for select to authenticated
  using (
    branch_id is null
    or branch_id in (select branch_id from public.users where id = auth.uid())
    or exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- INSERT: usuarios con sucursal o admin pueden insertar
create policy "gastos_empresa_insert"
  on public.gastos_empresa for insert to authenticated
  with check (
    (branch_id is null or branch_id in (select branch_id from public.users where id = auth.uid()))
    or exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- UPDATE: mismos criterios que insert
create policy "gastos_empresa_update"
  on public.gastos_empresa for update to authenticated
  using (
    branch_id is null
    or branch_id in (select branch_id from public.users where id = auth.uid())
    or exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  )
  with check (
    (branch_id is null or branch_id in (select branch_id from public.users where id = auth.uid()))
    or exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- DELETE: mismos criterios
create policy "gastos_empresa_delete"
  on public.gastos_empresa for delete to authenticated
  using (
    branch_id is null
    or branch_id in (select branch_id from public.users where id = auth.uid())
    or exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- Trigger para updated_at
create or replace function public.set_updated_at_gastos_empresa()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger gastos_empresa_updated_at
  before update on public.gastos_empresa
  for each row execute function public.set_updated_at_gastos_empresa();
