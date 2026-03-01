-- Nuevas etiquetas para gastos desde marzo: limpieza, uber, comida, regalos, propinas
-- Quitar el CHECK anterior y agregar uno que incluya los nuevos tipos (los viejos se mantienen por historial)
do $$
declare
  conname text;
begin
  select c.conname into conname
  from pg_constraint c
  join pg_class t on c.conrelid = t.oid
  join pg_namespace n on t.relnamespace = n.oid
  where n.nspname = 'public' and t.relname = 'gastos_empresa'
    and c.contype = 'c' and pg_get_constraintdef(c.oid) like '%expense_type%';
  if conname is not null then
    execute format('alter table public.gastos_empresa drop constraint %I', conname);
  end if;
end $$;

alter table public.gastos_empresa
  add constraint gastos_empresa_expense_type_check check (expense_type in (
    'operacion', 'marketing', 'servicios', 'mantenimiento', 'combustible',
    'seguros', 'impuestos', 'personal', 'vehiculos', 'otros',
    'limpieza', 'uber', 'comida', 'regalos', 'propinas'
  ));

-- Asegurar que expense_types exista y tenga las nuevas etiquetas (para Gastos/Ingresos)
create table if not exists public.expense_types (
  id uuid primary key default extensions.uuid_generate_v4(),
  code text not null unique,
  label text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.expense_types is 'Tipos/etiquetas de gasto para Gastos/Ingresos.';

insert into public.expense_types (code, label, sort_order)
values
  ('limpieza', 'Limpieza', 10),
  ('uber', 'Uber', 20),
  ('comida', 'Comida', 30),
  ('regalos', 'Regalos', 40),
  ('propinas', 'Propinas', 50),
  ('otros', 'Otros', 99)
on conflict (code) do update set
  label = excluded.label,
  sort_order = excluded.sort_order,
  updated_at = now();
