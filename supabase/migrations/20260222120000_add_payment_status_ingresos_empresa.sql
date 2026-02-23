-- Estado de pago para ingresos manuales (HessenMotors): solo los "realizado" suman al balance
alter table public.ingresos_empresa
  add column if not exists payment_status text;

-- Registros existentes se consideran realizados; nuevos por defecto pendiente
update public.ingresos_empresa set payment_status = 'realizado' where payment_status is null or payment_status = '';

alter table public.ingresos_empresa
  alter column payment_status set default 'pendiente';

alter table public.ingresos_empresa
  alter column payment_status set not null;

alter table public.ingresos_empresa
  add constraint ingresos_empresa_payment_status_check
  check (payment_status in ('pendiente', 'realizado'));

comment on column public.ingresos_empresa.payment_status is 'pendiente = no suma al balance; realizado = suma al balance';