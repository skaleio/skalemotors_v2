-- Sucursal del vendedor: fuente de verdad en branch_sales_staff (Finanzas → Vendedores).
-- Vínculo explícito users.sales_staff_id (FK) en vez de match por nombre.
-- branch_sales_staff.branch_id manda; un trigger lo propaga a users/auth por ID.

-- 1. Schema: FK explícita user → staff.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS sales_staff_id uuid
  REFERENCES public.branch_sales_staff(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_sales_staff
  ON public.users(sales_staff_id) WHERE sales_staff_id IS NOT NULL;

COMMENT ON COLUMN public.users.sales_staff_id IS
  'Vínculo a la plantilla comercial (branch_sales_staff). La sucursal del vendedor se hereda desde ahí vía trigger.';

-- 2. Backfill (una vez): enlazar pares existentes por nombre, 1 staff por user,
--    preferir misma sucursal, luego el staff más antiguo. No mueve branch_id.
WITH matches AS (
  SELECT DISTINCT ON (u.id)
    u.id AS user_id,
    s.id AS staff_id
  FROM public.users u
  JOIN public.branch_sales_staff s
    ON s.tenant_id = u.tenant_id
   AND s.is_active = true
   AND lower(trim(s.full_name)) = lower(trim(u.full_name))
  WHERE u.role = 'vendedor'
    AND u.is_active = true
    AND u.sales_staff_id IS NULL
  ORDER BY
    u.id,
    (s.branch_id IS NOT DISTINCT FROM u.branch_id) DESC,
    s.created_at ASC
)
UPDATE public.users u
SET sales_staff_id = m.staff_id
FROM matches m
WHERE u.id = m.user_id;

-- 3. Trigger: branch_sales_staff es la fuente de verdad. Al cambiar sucursal o nombre,
--    propaga a todos los users enlazados por sales_staff_id (no por nombre) + auth.
CREATE OR REPLACE FUNCTION public.sync_branch_sales_staff_to_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NEW.branch_id IS DISTINCT FROM OLD.branch_id
     OR lower(trim(NEW.full_name)) IS DISTINCT FROM lower(trim(OLD.full_name)) THEN

    UPDATE public.users u
    SET
      full_name = NEW.full_name,
      branch_id = NEW.branch_id,
      updated_at = now()
    WHERE u.sales_staff_id = NEW.id
      AND u.is_active;

    UPDATE auth.users au
    SET raw_user_meta_data = jsonb_set(
      COALESCE(au.raw_user_meta_data, '{}'::jsonb),
      '{full_name}',
      to_jsonb(NEW.full_name::text),
      true
    )
    WHERE au.id IN (
      SELECT u.id
      FROM public.users u
      WHERE u.sales_staff_id = NEW.id
        AND u.is_active
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_branch_sales_staff_to_users ON public.branch_sales_staff;
CREATE TRIGGER trg_sync_branch_sales_staff_to_users
  AFTER UPDATE ON public.branch_sales_staff
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_branch_sales_staff_to_users();

COMMENT ON FUNCTION public.sync_branch_sales_staff_to_users() IS
  'Propaga branch_id y full_name de branch_sales_staff a los users enlazados por sales_staff_id (y a auth.users).';

-- 4. RPC: deja la sincronización a users/auth al trigger; sincroniza por ID, no por nombre.
CREATE OR REPLACE FUNCTION public.update_branch_sales_staff_profile(
  p_staff_id uuid,
  p_full_name text,
  p_branch_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role text := public.current_user_role();
  v_tenant uuid := public.current_tenant_id();
  v_old public.branch_sales_staff%ROWTYPE;
  v_new_name text;
  v_users_updated int := 0;
BEGIN
  IF v_role IS DISTINCT FROM 'admin' OR v_tenant IS NULL THEN
    RAISE EXCEPTION 'Solo administradores pueden editar vendedores de plantilla';
  END IF;

  v_new_name := nullif(trim(p_full_name), '');
  IF v_new_name IS NULL THEN
    RAISE EXCEPTION 'El nombre no puede estar vacío';
  END IF;

  IF char_length(v_new_name) > 120 THEN
    RAISE EXCEPTION 'El nombre es demasiado largo (máx. 120 caracteres)';
  END IF;

  SELECT *
  INTO v_old
  FROM public.branch_sales_staff s
  WHERE s.id = p_staff_id
    AND s.tenant_id = v_tenant;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vendedor no encontrado';
  END IF;

  IF NOT v_old.is_active THEN
    RAISE EXCEPTION 'No se puede editar un vendedor inactivo';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.branch_sales_staff s
    WHERE s.tenant_id = v_tenant
      AND s.is_active
      AND s.id <> p_staff_id
      AND lower(trim(s.full_name)) = lower(trim(v_new_name))
  ) THEN
    RAISE EXCEPTION 'Ya existe otro vendedor activo con ese nombre en la plantilla';
  END IF;

  -- Dispara trg_sync_branch_sales_staff_to_users, que propaga a users/auth por sales_staff_id.
  UPDATE public.branch_sales_staff
  SET
    full_name = v_new_name,
    branch_id = p_branch_id,
    updated_at = now()
  WHERE id = p_staff_id;

  SELECT count(*)::int
  INTO v_users_updated
  FROM public.users u
  WHERE u.sales_staff_id = p_staff_id
    AND u.is_active;

  RETURN jsonb_build_object(
    'staff_id', p_staff_id,
    'full_name', v_new_name,
    'branch_id', p_branch_id,
    'users_synced', v_users_updated
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_branch_sales_staff_profile(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_branch_sales_staff_profile(uuid, text, uuid) TO authenticated;

COMMENT ON FUNCTION public.update_branch_sales_staff_profile(uuid, text, uuid) IS
  'Admin: actualiza nombre y sucursal en branch_sales_staff; el trigger sincroniza users/auth por sales_staff_id.';
