-- Estados de calificación del lead (solo admin asigna; NULL = sin etiqueta).
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_contact_urgency_range;

ALTER TABLE public.leads
  ALTER COLUMN contact_urgency DROP DEFAULT;

ALTER TABLE public.leads
  ALTER COLUMN contact_urgency TYPE text USING NULL::text;

ALTER TABLE public.leads
  RENAME COLUMN contact_urgency TO contact_state;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_contact_state_check
  CHECK (contact_state IS NULL OR contact_state IN ('prioridad', 'interesado', 'filtrar'));

COMMENT ON COLUMN public.leads.contact_state IS
  'Etiqueta de calificación: prioridad | interesado | filtrar. NULL = sin etiqueta.';
