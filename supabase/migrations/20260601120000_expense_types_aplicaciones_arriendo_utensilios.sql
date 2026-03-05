-- Nuevas etiquetas para gastos: aplicaciones, Arriendo Oficina, Utensilios
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
    'limpieza', 'uber', 'comida', 'regalos', 'propinas',
    'aplicaciones', 'arriendo_oficina', 'utensilios'
  ));

insert into public.expense_types (code, label, sort_order)
values
  ('aplicaciones', 'Aplicaciones', 60),
  ('arriendo_oficina', 'Arriendo Oficina', 61),
  ('utensilios', 'Utensilios', 62)
on conflict (code) do update set
  label = excluded.label,
  sort_order = excluded.sort_order,
  updated_at = now();
