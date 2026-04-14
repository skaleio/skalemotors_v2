-- mint_lead_ingest_key usa gen_random_bytes() y digest() (extensión pgcrypto).
-- En Supabase, pgcrypto está en el schema "extensions"; con SET search_path = public
-- la función no ve esas rutinas y falla con:
--   function gen_random_bytes(integer) does not exist

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.mint_lead_ingest_key(p_branch_id uuid, p_label text DEFAULT '')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_tenant_id uuid;
  v_plain text;
  v_hash text;
  v_id uuid;
  v_label text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF NOT public.lead_ingest_user_may_manage_branch(p_branch_id) THEN
    RAISE EXCEPTION 'No tienes permiso para gestionar claves de esta sucursal';
  END IF;

  SELECT b.tenant_id INTO v_tenant_id
  FROM public.branches b
  WHERE b.id = p_branch_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'La sucursal no tiene tenant asignado; no se puede crear la clave';
  END IF;

  v_label := COALESCE(NULLIF(trim(p_label), ''), 'n8n');
  v_plain := encode(gen_random_bytes(32), 'hex');
  v_hash := encode(digest(convert_to(v_plain, 'UTF8'), 'sha256'), 'hex');

  INSERT INTO public.lead_ingest_keys (tenant_id, branch_id, label, secret_hash)
  VALUES (v_tenant_id, p_branch_id, v_label, v_hash)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'api_key', v_plain);
END;
$$;

REVOKE ALL ON FUNCTION public.mint_lead_ingest_key(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mint_lead_ingest_key(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.mint_lead_ingest_key(uuid, text) IS
  'Genera una API key para x-api-key (n8n); devuelve el secreto en claro una sola vez.';
