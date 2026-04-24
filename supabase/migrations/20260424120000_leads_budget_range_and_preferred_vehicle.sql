-- Añade columnas que el tipo TS y el trigger notify_lead_sold_webhook ya
-- referencian, pero que ninguna migración previa creó. Al faltar, el trigger
-- falla con `record "new" has no field "budget_min" [42703]` cuando un lead
-- pasa a status='vendido' (flujo "Cerrar negocio" del CRM).
--
-- Idempotente: ADD COLUMN IF NOT EXISTS evita errores en proyectos donde ya
-- existan por algún hotfix manual.

alter table public.leads
  add column if not exists budget_min numeric,
  add column if not exists budget_max numeric,
  add column if not exists preferred_vehicle_id uuid;

-- FK suave a vehicles: on delete set null (no queremos bloquear la venta si
-- el vehículo de interés se borra después).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'leads_preferred_vehicle_id_fkey'
  ) then
    alter table public.leads
      add constraint leads_preferred_vehicle_id_fkey
      foreign key (preferred_vehicle_id)
      references public.vehicles(id)
      on delete set null;
  end if;
end $$;

create index if not exists idx_leads_preferred_vehicle_id
  on public.leads (preferred_vehicle_id)
  where preferred_vehicle_id is not null;

comment on column public.leads.budget_min is
  'Rango mínimo de presupuesto (CLP). Complementa leads.budget (texto libre).';
comment on column public.leads.budget_max is
  'Rango máximo de presupuesto (CLP). Complementa leads.budget (texto libre).';
comment on column public.leads.preferred_vehicle_id is
  'Vehículo de interés principal del lead (FK vehicles.id).';
