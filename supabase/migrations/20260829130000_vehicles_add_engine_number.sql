-- Agrega el número de motor del vehículo (distinto de engine_size, que es la cilindrada).
-- Necesario para los documentos oficiales (Nota de Venta / Contrato de Consignación),
-- que requieren N° MOTOR junto a N° CHASIS (vin). GetAPI ya devuelve engineNumber por patente.

alter table public.vehicles
  add column if not exists engine_number text;

comment on column public.vehicles.engine_number is
  'N° de motor del vehículo (serial). Distinto de engine_size (cilindrada). Autocompletable vía GetAPI por patente.';
