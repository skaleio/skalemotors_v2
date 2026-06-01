-- M12: idempotencia para n8n-lead-ingest (replay-safe). Solo service_role escribe.

CREATE TABLE IF NOT EXISTS public.lead_ingest_idempotency (
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  status_code int NOT NULL,
  response_body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (branch_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS lead_ingest_idempotency_created_at_idx
  ON public.lead_ingest_idempotency (created_at);

COMMENT ON TABLE public.lead_ingest_idempotency IS
  'Cache de respuestas por Idempotency-Key + branch. Solo acceso vía service_role (API Vercel).';

ALTER TABLE public.lead_ingest_idempotency ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lead_ingest_idempotency_deny_all ON public.lead_ingest_idempotency;
CREATE POLICY lead_ingest_idempotency_deny_all ON public.lead_ingest_idempotency
  FOR ALL TO authenticated, anon
  USING (false) WITH CHECK (false);
