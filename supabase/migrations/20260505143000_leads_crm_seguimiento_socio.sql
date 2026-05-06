-- Encargado de seguimiento tipo socio (Mike / Antonio / Jota) — etiqueta discreta en pipeline.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS crm_seguimiento_socio text;

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_crm_seguimiento_socio_check;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_crm_seguimiento_socio_check
  CHECK (
    crm_seguimiento_socio IS NULL
    OR crm_seguimiento_socio IN ('Mike', 'Antonio', 'Jota')
  );

COMMENT ON COLUMN public.leads.crm_seguimiento_socio IS
  'Socio a cargo del seguimiento comercial (Mike, Antonio, Jota). Visual en tarjetas del CRM.';
