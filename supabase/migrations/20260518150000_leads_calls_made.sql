-- ============================================================================
-- leads.calls_made: contador de llamadas realizadas al lead (semáforo CRM/Leads).
-- Misma convención que contact_attempts: KPI UI = 3, techo defensivo = 20.
-- ============================================================================

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS calls_made integer NOT NULL DEFAULT 0;

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_calls_made_range;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_calls_made_range
  CHECK (calls_made >= 0 AND calls_made <= 20);

COMMENT ON COLUMN public.leads.calls_made IS
  'Número de llamadas realizadas al lead. KPI UI: objetivo 3.';
