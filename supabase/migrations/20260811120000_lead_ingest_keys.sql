-- API keys for n8n / external HTTP lead ingest (hashed at rest).
-- Vercel function resolves x-api-key against this table; each row pins branch_id + tenant_id.

CREATE TABLE IF NOT EXISTS public.lead_ingest_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT '',
  secret_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS lead_ingest_keys_secret_hash_active_idx
  ON public.lead_ingest_keys (secret_hash)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS lead_ingest_keys_tenant_idx ON public.lead_ingest_keys (tenant_id);
CREATE INDEX IF NOT EXISTS lead_ingest_keys_branch_idx ON public.lead_ingest_keys (branch_id);

CREATE OR REPLACE FUNCTION public.lead_ingest_keys_branch_tenant_match()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.branches b
    WHERE b.id = NEW.branch_id AND b.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'lead_ingest_keys: branch_id must belong to tenant_id';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lead_ingest_keys_branch_tenant_match_trg ON public.lead_ingest_keys;
CREATE TRIGGER lead_ingest_keys_branch_tenant_match_trg
  BEFORE INSERT OR UPDATE OF branch_id, tenant_id ON public.lead_ingest_keys
  FOR EACH ROW
  EXECUTE FUNCTION public.lead_ingest_keys_branch_tenant_match();

ALTER TABLE public.lead_ingest_keys ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.lead_ingest_keys IS
  'Hashed secrets for POST /api/n8n-lead-ingest; service role resolves key to branch/tenant.';
