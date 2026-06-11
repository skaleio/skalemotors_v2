-- Sin urgencia retroactiva: solo se asigna al crear/editar explícitamente.
ALTER TABLE public.leads
  ALTER COLUMN contact_urgency DROP DEFAULT,
  ALTER COLUMN contact_urgency DROP NOT NULL;

UPDATE public.leads SET contact_urgency = NULL WHERE contact_urgency IS NOT NULL;

COMMENT ON COLUMN public.leads.contact_urgency IS
  'Urgencia de contacto (1-5). NULL = sin calificar.';
