-- RPCs seguras para gestionar claves de ingesta de leads (n8n) sin exponer secret_hash al cliente.
-- El hash coincide con api/n8n-lead-ingest.ts: SHA-256 UTF-8 del secreto en hex.

CREATE OR REPLACE FUNCTION public.lead_ingest_user_may_manage_branch(p_branch_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.branches b
    WHERE b.id = p_branch_id
      AND (
        public.current_is_legacy_protected()
        OR (b.tenant_id IS NOT NULL AND b.tenant_id = public.current_tenant_id())
      )
  )
  AND (
    public.current_user_role() IN ('admin', 'financiero', 'jefe_jefe')
    OR (
      public.current_user_role() IN (
        'gerente', 'servicio', 'inventario', 'vendedor', 'jefe_sucursal'
      )
      AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() AND u.branch_id = p_branch_id
      )
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.mint_lead_ingest_key(p_branch_id uuid, p_label text DEFAULT '')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.list_lead_ingest_keys(p_branch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF NOT public.lead_ingest_user_may_manage_branch(p_branch_id) THEN
    RAISE EXCEPTION 'No tienes permiso para ver claves de esta sucursal';
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', k.id,
          'label', k.label,
          'created_at', k.created_at,
          'revoked_at', k.revoked_at,
          'last_used_at', k.last_used_at
        )
        ORDER BY k.created_at DESC
      )
      FROM public.lead_ingest_keys k
      WHERE k.branch_id = p_branch_id
    ),
    '[]'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_lead_ingest_key(p_key_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branch_id uuid;
  v_updated int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT k.branch_id INTO v_branch_id
  FROM public.lead_ingest_keys k
  WHERE k.id = p_key_id;

  IF v_branch_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF NOT public.lead_ingest_user_may_manage_branch(v_branch_id) THEN
    RAISE EXCEPTION 'No tienes permiso para revocar esta clave';
  END IF;

  UPDATE public.lead_ingest_keys k
  SET revoked_at = NOW()
  WHERE k.id = p_key_id AND k.revoked_at IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RETURN jsonb_build_object('ok', true, 'already_revoked', true);
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.lead_ingest_user_may_manage_branch(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mint_lead_ingest_key(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_lead_ingest_keys(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_lead_ingest_key(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.mint_lead_ingest_key(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_lead_ingest_keys(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_lead_ingest_key(uuid) TO authenticated;

COMMENT ON FUNCTION public.mint_lead_ingest_key(uuid, text) IS
  'Genera una API key para x-api-key (n8n); devuelve el secreto en claro una sola vez.';
COMMENT ON FUNCTION public.list_lead_ingest_keys(uuid) IS
  'Lista metadatos de claves de ingesta por sucursal (sin secret_hash).';
COMMENT ON FUNCTION public.revoke_lead_ingest_key(uuid) IS
  'Marca una clave de ingesta como revocada.';
