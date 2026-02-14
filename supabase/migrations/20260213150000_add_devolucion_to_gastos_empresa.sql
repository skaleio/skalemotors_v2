-- Etiqueta Devolución: Sí / No para cada gasto
alter table public.gastos_empresa
  add column if not exists devolucion boolean not null default false;

comment on column public.gastos_empresa.devolucion is 'Si el gasto es una devolución: true = Sí, false = No';
