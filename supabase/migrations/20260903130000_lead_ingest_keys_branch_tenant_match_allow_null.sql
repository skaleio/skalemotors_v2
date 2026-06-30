-- Fix: el trigger de validación branch↔tenant en lead_ingest_keys tiraba excepción
-- para claves de TENANT (branch_id NULL), porque `b.id = NULL` nunca matchea y el
-- EXISTS daba falso. La migración de tenant-scope (branch_id nullable) no actualizó
-- este trigger, así que mint_lead_ingest_key_tenant fallaba con
-- "lead_ingest_keys: branch_id must belong to tenant_id".
-- Las claves de tenant no tienen sucursal que validar.
CREATE OR REPLACE FUNCTION public.lead_ingest_keys_branch_tenant_match()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Clave de tenant (branch_id NULL): no hay sucursal que validar.
  IF NEW.branch_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.branches b
    WHERE b.id = NEW.branch_id AND b.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'lead_ingest_keys: branch_id must belong to tenant_id';
  END IF;
  RETURN NEW;
END;
$function$;
