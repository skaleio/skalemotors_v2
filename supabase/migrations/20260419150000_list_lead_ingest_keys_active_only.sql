-- list_lead_ingest_keys: solo claves activas (las revocadas no se listan en la app).

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
        AND k.revoked_at IS NULL
    ),
    '[]'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.list_lead_ingest_keys(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_lead_ingest_keys(uuid) TO authenticated;

COMMENT ON FUNCTION public.list_lead_ingest_keys(uuid) IS
  'Lista metadatos de claves de ingesta activas por sucursal (sin secret_hash; excluye revocadas).';
