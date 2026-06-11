-- Timestamp de la última delegación (cambio de assigned_to a un vendedor).

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz;

UPDATE public.leads
SET assigned_at = COALESCE(updated_at, created_at)
WHERE assigned_to IS NOT NULL
  AND assigned_at IS NULL;

CREATE OR REPLACE FUNCTION public.leads_sync_assigned_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF tg_op = 'INSERT' THEN
    IF new.assigned_to IS NOT NULL AND new.assigned_at IS NULL THEN
      new.assigned_at := now();
    END IF;
    RETURN new;
  END IF;

  IF new.assigned_to IS DISTINCT FROM old.assigned_to THEN
    IF new.assigned_to IS NULL THEN
      new.assigned_at := NULL;
    ELSE
      new.assigned_at := now();
    END IF;
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_leads_sync_assigned_at ON public.leads;
CREATE TRIGGER trg_leads_sync_assigned_at
  BEFORE INSERT OR UPDATE OF assigned_to ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.leads_sync_assigned_at();

CREATE INDEX IF NOT EXISTS idx_leads_assigned_at
  ON public.leads (tenant_id, assigned_at DESC)
  WHERE assigned_to IS NOT NULL AND deleted_at IS NULL;

COMMENT ON COLUMN public.leads.assigned_at IS
  'Momento de la última asignación/delegación a assigned_to (vendedor).';
