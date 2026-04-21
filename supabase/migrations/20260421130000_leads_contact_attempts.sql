-- ============================================================================
-- leads.contact_attempts: contador de veces que se contactó al lead.
-- UI objetivo: 3 contactos (barrita en CRM y Leads).
-- Acotado a [0, 20] para evitar abuso; 3 es el KPI, 20 es techo defensivo.
-- ============================================================================

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS contact_attempts integer NOT NULL DEFAULT 0;

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_contact_attempts_range;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_contact_attempts_range
  CHECK (contact_attempts >= 0 AND contact_attempts <= 20);

COMMENT ON COLUMN public.leads.contact_attempts IS
  'Número de intentos de contacto realizados al lead. KPI UI: objetivo 3.';
