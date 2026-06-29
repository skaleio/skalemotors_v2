-- Permite API keys de ingesta scopeadas a TENANT (concesionario), no solo a sucursal.
-- Una key con branch_id NULL es "de tenant": el request debe indicar la sucursal,
-- y el endpoint valida que esa sucursal pertenezca al tenant de la key.
-- Las keys existentes (branch_id no nulo) siguen scopeadas a su sucursal (backwards-compat).
ALTER TABLE public.lead_ingest_keys
  ALTER COLUMN branch_id DROP NOT NULL;

COMMENT ON COLUMN public.lead_ingest_keys.branch_id IS
  'Sucursal de la key. NULL = key de tenant: la sucursal la define el request y se valida contra tenant_id.';
