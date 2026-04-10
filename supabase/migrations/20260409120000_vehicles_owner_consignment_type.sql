-- Dueño y tipo de consignación (física / digital) en vehículos
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS owner_name text,
  ADD COLUMN IF NOT EXISTS owner_phone text,
  ADD COLUMN IF NOT EXISTS consignment_type text NOT NULL DEFAULT 'fisica';

ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_consignment_type_check;
ALTER TABLE public.vehicles
  ADD CONSTRAINT vehicles_consignment_type_check
  CHECK (consignment_type IN ('fisica', 'digital'));

COMMENT ON COLUMN public.vehicles.owner_name IS 'Nombre del dueño del vehículo en consignación';
COMMENT ON COLUMN public.vehicles.owner_phone IS 'Teléfono del dueño';
COMMENT ON COLUMN public.vehicles.consignment_type IS 'fisica | digital';
