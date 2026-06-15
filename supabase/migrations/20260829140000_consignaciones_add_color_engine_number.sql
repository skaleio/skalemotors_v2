-- Campos del vehículo necesarios para el Contrato de Consignación que el form
-- no capturaba: color y número de motor (serial). El N° de chasis ya existe en
-- vehicle_vin. GetAPI los devuelve por patente y se autocompletan en el alta.

alter table public.consignaciones
  add column if not exists color text,
  add column if not exists engine_number text;

comment on column public.consignaciones.color is 'Color del vehículo (autocompletable vía GetAPI por patente).';
comment on column public.consignaciones.engine_number is 'N° de motor (serial) del vehículo (autocompletable vía GetAPI por patente).';
