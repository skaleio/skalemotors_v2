-- Resúmenes de cierre de mes por sucursal (finanzas).
-- No elimina ni mueve datos: ingresos/gastos siguen en sus tablas; aquí solo se guarda el snapshot del balance del mes.
create table public.finance_month_summary (
  id uuid primary key default extensions.uuid_generate_v4(),
  branch_id uuid references public.branches(id) on delete restrict,
  year smallint not null,
  month smallint not null check (month >= 1 and month <= 12),
  total_income numeric not null default 0,
  total_expenses numeric not null default 0,
  balance numeric not null default 0,
  closed_at timestamptz not null default now(),
  constraint finance_month_summary_branch_year_month_key unique (branch_id, year, month)
);

comment on table public.finance_month_summary is 'Resumen de cierre de mes por sucursal: total ingresos, gastos y balance. Solo lectura histórica.';

create index idx_finance_month_summary_branch on public.finance_month_summary(branch_id);
create index idx_finance_month_summary_year_month on public.finance_month_summary(year, month desc);

alter table public.finance_month_summary enable row level security;

-- SELECT: mismos criterios que gastos_empresa (sucursal del usuario o admin)
create policy "finance_month_summary_select"
  on public.finance_month_summary for select to authenticated
  using (
    branch_id is null
    or branch_id in (select branch_id from public.users where id = auth.uid())
    or exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- INSERT: solo vía función (service role o función con security definer)
create policy "finance_month_summary_insert"
  on public.finance_month_summary for insert to authenticated
  with check (true);

-- No UPDATE ni DELETE: los cierres son inmutables.

-- RPC: cierra el mes anterior para una sucursal si aún no tiene resumen.
-- Criterio de balance: igual que Gastos/Ingresos (ingresos_empresa payment_status=realizado, gastos_empresa todos).
-- Se puede llamar al cargar Finanzas para asegurar que el mes pasado quede cerrado.
create or replace function public.close_previous_month_for_branch(p_branch_id uuid)
returns public.finance_month_summary
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev_year smallint;
  v_prev_month smallint;
  v_from date;
  v_to date;
  v_total_income numeric;
  v_total_expenses numeric;
  v_balance numeric;
  v_row public.finance_month_summary;
begin
  v_prev_year := extract(year from (date_trunc('month', current_date) - interval '1 month'))::smallint;
  v_prev_month := extract(month from (date_trunc('month', current_date) - interval '1 month'))::smallint;
  v_from := make_date(v_prev_year::int, v_prev_month::int, 1);
  v_to := (date_trunc('month', (v_from + interval '1 month')::date) - interval '1 day')::date;

  if exists (
    select 1 from public.finance_month_summary
    where (branch_id is not distinct from p_branch_id) and year = v_prev_year and month = v_prev_month
  ) then
    select * into v_row from public.finance_month_summary
    where (branch_id is not distinct from p_branch_id) and year = v_prev_year and month = v_prev_month
    limit 1;
    return v_row;
  end if;

  select coalesce(sum(amount), 0) into v_total_income
  from public.ingresos_empresa
  where (branch_id is not distinct from p_branch_id)
    and income_date >= v_from and income_date <= v_to
    and (payment_status = 'realizado' or payment_status is null);

  select coalesce(sum(amount), 0) into v_total_expenses
  from public.gastos_empresa
  where (branch_id is not distinct from p_branch_id)
    and expense_date >= v_from and expense_date <= v_to;

  v_balance := v_total_income - v_total_expenses;

  insert into public.finance_month_summary (branch_id, year, month, total_income, total_expenses, balance)
  values (p_branch_id, v_prev_year, v_prev_month, v_total_income, v_total_expenses, v_balance)
  returning * into v_row;
  return v_row;
end;
$$;

comment on function public.close_previous_month_for_branch(uuid) is 'Cierra el mes anterior para la sucursal: calcula totales e inserta resumen si no existe. Idempotente.';

-- Permitir a usuarios autenticados ejecutar el cierre para su sucursal (o cualquier si admin)
create or replace function public.ensure_previous_month_closed()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch_id uuid;
  v_user_branch uuid;
  v_is_admin boolean;
begin
  select u.branch_id, exists(select 1 from public.users u2 where u2.id = auth.uid() and u2.role = 'admin')
  into v_user_branch, v_is_admin
  from public.users u where u.id = auth.uid() limit 1;

  if v_user_branch is not null then
    perform public.close_previous_month_for_branch(v_user_branch);
  end if;

  if v_is_admin then
    for v_branch_id in select id from public.branches
    loop
      perform public.close_previous_month_for_branch(v_branch_id);
    end loop;
  end if;
end;
$$;

comment on function public.ensure_previous_month_closed() is 'Cierra el mes anterior para la sucursal del usuario (y todas si es admin). Llamar al cargar Finanzas.';
