-- Garantía dura: un lead SIN vendedor (assigned_to NULL, fuera de papelera) solo puede estar en estado 'nuevo'.
-- Vive en la BD para cubrir TODAS las vías de escritura: UI (CRM/Leads), bot n8n / Edge Fn lead-state-update,
-- lead-ingest y cualquier PATCH directo a PostgREST.
-- Mecanismo NO destructivo: si un lead sin vendedor intenta quedar en otra etapa, se devuelve a 'nuevo'
-- (no lanza error, así no rompe el flujo del bot/n8n; el lead simplemente espera delegación).
-- Al desasignar un lead (assigned_to -> NULL) también vuelve a 'nuevo' para reentrar al pool de delegación.

CREATE OR REPLACE FUNCTION public.leads_unassigned_force_nuevo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.deleted_at IS NULL
     AND NEW.assigned_to IS NULL
     AND NEW.status IS DISTINCT FROM 'nuevo' THEN
    NEW.status := 'nuevo';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.leads_unassigned_force_nuevo() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_leads_unassigned_force_nuevo ON public.leads;
CREATE TRIGGER trg_leads_unassigned_force_nuevo
  BEFORE INSERT OR UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.leads_unassigned_force_nuevo();

-- Backfill defensivo: normalizar cualquier huérfano existente (lead sin vendedor en etapa avanzada).
UPDATE public.leads
SET status = 'nuevo', updated_at = now()
WHERE deleted_at IS NULL
  AND assigned_to IS NULL
  AND status <> 'nuevo';

COMMENT ON FUNCTION public.leads_unassigned_force_nuevo() IS
  'Un lead sin vendedor (assigned_to NULL, no en papelera) solo puede estar en estado nuevo; si intenta avanzar, se devuelve a nuevo. Evita leads huerfanos en el pipeline.';
