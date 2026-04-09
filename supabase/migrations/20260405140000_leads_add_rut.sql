-- RUT del contacto (opcional), para CRM e importaciones.
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS rut text;

COMMENT ON COLUMN public.leads.rut IS 'RUT chileno del contacto (texto libre, opcional).';
