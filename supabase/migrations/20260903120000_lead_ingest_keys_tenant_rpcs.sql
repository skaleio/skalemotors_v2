-- RPCs para claves de ingesta scopeadas a TENANT (branch_id NULL), usadas por el
-- conector MCP de Claude. Una sola clave por concesionario sirve para todas las
-- sucursales; la sucursal por defecto la fija la URL del conector (?b=...).
--
-- Reusa el modelo de hash existente (SHA-256 UTF-8 hex, igual que api/n8n-lead-ingest.ts)
-- y la tabla public.lead_ingest_keys. La clave de tenant es más poderosa que la de
-- sucursal (cubre todas), por eso se restringe a admin / jefe_jefe.

-- Helper: ¿el usuario puede gestionar claves de ingesta a nivel TENANT?
CREATE OR REPLACE FUNCTION public.lead_ingest_user_may_manage_tenant(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_tenant_id IS NOT NULL
    AND (
      public.current_is_legacy_protected()
      OR (
        p_tenant_id = public.current_tenant_id()
        AND public.current_user_role() IN ('admin', 'jefe_jefe')
      )
    );
$$;

REVOKE ALL ON FUNCTION public.lead_ingest_user_may_manage_tenant(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lead_ingest_user_may_manage_tenant(uuid) TO service_role;

COMMENT ON FUNCTION public.lead_ingest_user_may_manage_tenant(uuid) IS
  'TRUE si el usuario actual (admin/jefe_jefe del tenant, o legacy protegido) puede gestionar claves de ingesta de tenant.';

-- Emite una clave de tenant (branch_id NULL). Devuelve el secreto en claro una sola vez.
CREATE OR REPLACE FUNCTION public.mint_lead_ingest_key_tenant(p_label text DEFAULT '')
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

  v_tenant_id := public.current_tenant_id();
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tu usuario no tiene tenant asignado; no se puede crear la clave';
  END IF;

  IF NOT public.lead_ingest_user_may_manage_tenant(v_tenant_id) THEN
    RAISE EXCEPTION 'Solo un administrador puede crear la clave MCP del concesionario';
  END IF;

  v_label := COALESCE(NULLIF(trim(p_label), ''), 'MCP Claude');
  v_plain := encode(gen_random_bytes(32), 'hex');
  v_hash := encode(digest(convert_to(v_plain, 'UTF8'), 'sha256'), 'hex');

  INSERT INTO public.lead_ingest_keys (tenant_id, branch_id, label, secret_hash)
  VALUES (v_tenant_id, NULL, v_label, v_hash)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'api_key', v_plain);
END;
$$;

REVOKE ALL ON FUNCTION public.mint_lead_ingest_key_tenant(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mint_lead_ingest_key_tenant(text) TO authenticated;

COMMENT ON FUNCTION public.mint_lead_ingest_key_tenant(text) IS
  'Genera una API key de tenant (branch_id NULL) para el conector MCP; devuelve el secreto en claro una sola vez.';

-- Lista las claves de tenant activas del concesionario del usuario (sin secret_hash).
CREATE OR REPLACE FUNCTION public.list_lead_ingest_keys_tenant()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  v_tenant_id := public.current_tenant_id();
  IF v_tenant_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF NOT public.lead_ingest_user_may_manage_tenant(v_tenant_id) THEN
    RAISE EXCEPTION 'Solo un administrador puede ver la clave MCP del concesionario';
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
      WHERE k.tenant_id = v_tenant_id
        AND k.branch_id IS NULL
        AND k.revoked_at IS NULL
    ),
    '[]'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.list_lead_ingest_keys_tenant() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_lead_ingest_keys_tenant() TO authenticated;

COMMENT ON FUNCTION public.list_lead_ingest_keys_tenant() IS
  'Lista metadatos de claves de ingesta de tenant activas (branch_id NULL) del concesionario del usuario.';

-- Arregla revoke_lead_ingest_key para soportar claves de tenant (branch_id NULL):
-- antes trataba branch_id NULL como "not_found" y nunca podía revocarlas.
CREATE OR REPLACE FUNCTION public.revoke_lead_ingest_key(p_key_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_found boolean;
  v_branch_id uuid;
  v_tenant_id uuid;
  v_updated int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT TRUE, k.branch_id, k.tenant_id
    INTO v_found, v_branch_id, v_tenant_id
  FROM public.lead_ingest_keys k
  WHERE k.id = p_key_id;

  IF NOT COALESCE(v_found, FALSE) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_branch_id IS NOT NULL THEN
    IF NOT public.lead_ingest_user_may_manage_branch(v_branch_id) THEN
      RAISE EXCEPTION 'No tienes permiso para revocar esta clave';
    END IF;
  ELSE
    IF NOT public.lead_ingest_user_may_manage_tenant(v_tenant_id) THEN
      RAISE EXCEPTION 'No tienes permiso para revocar esta clave';
    END IF;
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

REVOKE ALL ON FUNCTION public.revoke_lead_ingest_key(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_lead_ingest_key(uuid) TO authenticated;
