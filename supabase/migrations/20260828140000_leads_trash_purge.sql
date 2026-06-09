-- Vaciar papelera: al borrar leads en deleted_at, desvincular hijos en vez de bloquear por FK RESTRICT.

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_lead_id_fkey,
  ADD CONSTRAINT messages_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;

ALTER TABLE public.whatsapp_calls
  DROP CONSTRAINT IF EXISTS whatsapp_calls_lead_id_fkey,
  ADD CONSTRAINT whatsapp_calls_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_lead_id_fkey,
  ADD CONSTRAINT appointments_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;

ALTER TABLE public.sales
  DROP CONSTRAINT IF EXISTS sales_lead_id_fkey,
  ADD CONSTRAINT sales_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;

ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_lead_id_fkey,
  ADD CONSTRAINT documents_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.purge_leads_from_trash(p_lead_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_ids uuid[];
  n integer := 0;
BEGIN
  IF p_lead_ids IS NULL OR cardinality(p_lead_ids) = 0 THEN
    RETURN 0;
  END IF;

  SELECT coalesce(array_agg(l.id), '{}')
  INTO v_ids
  FROM public.leads l
  WHERE l.id = ANY(p_lead_ids)
    AND l.deleted_at IS NOT NULL;

  IF cardinality(v_ids) = 0 THEN
    RETURN 0;
  END IF;

  DELETE FROM public.leads l
  WHERE l.id = ANY(v_ids)
    AND l.deleted_at IS NOT NULL;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_leads_from_trash(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_leads_from_trash(uuid[]) TO authenticated;
