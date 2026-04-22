-- ============================================================================
-- LOGIN PERF: sincronizar public.users.role → auth.users.raw_app_meta_data.role
-- para que el JWT incluya el rol y el cliente pueda hacer "optimistic navigate"
-- sin esperar un SELECT a public.users (ahorro: ~100-200ms por login).
--
-- Dos partes:
--   1) Backfill de usuarios existentes (admins, gerentes, legacy).
--   2) Trigger en public.users que mantiene en sync futuros cambios de rol.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Backfill
-- ----------------------------------------------------------------------------
UPDATE auth.users au
SET raw_app_meta_data =
  COALESCE(au.raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('role', pu.role::text)
FROM public.users pu
WHERE pu.id = au.id
  AND pu.role IS NOT NULL
  AND (
    au.raw_app_meta_data IS NULL
    OR au.raw_app_meta_data->>'role' IS DISTINCT FROM pu.role::text
  );

-- ----------------------------------------------------------------------------
-- 2. Función SECURITY DEFINER que escribe en auth.users (cross-schema).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_user_role_to_auth_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role) THEN
    UPDATE auth.users
    SET raw_app_meta_data =
      COALESCE(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('role', NEW.role::text)
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Trigger en public.users
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_users_sync_role_metadata ON public.users;
CREATE TRIGGER trg_users_sync_role_metadata
  AFTER INSERT OR UPDATE OF role ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_role_to_auth_metadata();

COMMENT ON FUNCTION public.sync_user_role_to_auth_metadata() IS
  'Mantiene auth.users.raw_app_meta_data.role al día con public.users.role '
  'para permitir routing optimista post-login sin query extra a public.users.';
