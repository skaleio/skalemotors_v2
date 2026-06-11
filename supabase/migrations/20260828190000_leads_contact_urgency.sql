-- Prioridad de contacto / calidad del lead (1=muy baja, 5=urgente)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS contact_urgency smallint NOT NULL DEFAULT 3
    CONSTRAINT leads_contact_urgency_range CHECK (contact_urgency >= 1 AND contact_urgency <= 5);

COMMENT ON COLUMN public.leads.contact_urgency IS
  'Urgencia de contacto y calidad del lead: 1=muy baja, 5=urgente.';
