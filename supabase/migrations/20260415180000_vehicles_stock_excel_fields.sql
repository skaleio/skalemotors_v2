-- Campos alineados con planilla STOCK ON LINE (carrocería, texto libre transmisión/combustible, publicado).
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS carroceria text,
  ADD COLUMN IF NOT EXISTS transmision_display text,
  ADD COLUMN IF NOT EXISTS combustible_display text,
  ADD COLUMN IF NOT EXISTS publicado boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.vehicles.carroceria IS 'Tipo de carrocería (planilla Excel)';
COMMENT ON COLUMN public.vehicles.transmision_display IS 'Transmisión como en planilla (MECANICO, AUTOMATICO, etc.)';
COMMENT ON COLUMN public.vehicles.combustible_display IS 'Combustible como en planilla (DIESEL, BENCINA, etc.)';
COMMENT ON COLUMN public.vehicles.publicado IS 'Vehículo publicado / visible en oferta';
