-- ============================================================================
-- RPC `verify_lead_ingest_key` — validación de api keys per-branch de lead ingest.
--
-- Permite que las Edge Functions `lead-state-update` y `lead-create` migren del
-- env var global `LEAD_STATE_API_KEY` / `LEAD_INGEST_API_KEY` a la tabla
-- `lead_ingest_keys` que ya existe con keys per-branch hasheadas en sha256.
--
-- Comportamiento:
--   - Hashea p_key con sha256 (mismo algoritmo que mint_lead_ingest_key)
--   - Busca row activo (revoked_at IS NULL) con secret_hash + branch_id
--   - Si match: actualiza last_used_at y devuelve { ok, key_id, tenant_id }
--   - Si no match: devuelve { ok: false, error }
--
-- Sólo callable por service_role (revoke a anon/authenticated/public).
-- ============================================================================

create or replace function public.verify_lead_ingest_key(
  p_key text,
  p_branch_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_catalog
as $$
declare
  v_hash text;
  v_row record;
begin
  if p_key is null or length(trim(p_key)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'empty_key');
  end if;
  if p_branch_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_branch');
  end if;

  v_hash := encode(digest(convert_to(p_key, 'UTF8'), 'sha256'), 'hex');

  select id, tenant_id, branch_id
    into v_row
  from public.lead_ingest_keys
  where secret_hash = v_hash
    and branch_id = p_branch_id
    and revoked_at is null
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_or_revoked');
  end if;

  update public.lead_ingest_keys
     set last_used_at = now()
   where id = v_row.id;

  return jsonb_build_object(
    'ok', true,
    'key_id', v_row.id,
    'tenant_id', v_row.tenant_id,
    'branch_id', v_row.branch_id
  );
end;
$$;

revoke execute on function public.verify_lead_ingest_key(text, uuid)
  from public, anon, authenticated;

comment on function public.verify_lead_ingest_key(text, uuid) is
  'Valida una api key plaintext contra lead_ingest_keys (sha256 hashed) para un branch específico. '
  'Devuelve {ok, key_id, tenant_id, branch_id} si match activo, {ok:false, error} si no. '
  'Sólo service_role. Usada por Edge Functions lead-state-update y lead-create.';
