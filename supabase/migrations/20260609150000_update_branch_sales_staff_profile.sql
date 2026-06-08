-- Edición admin de plantilla comercial: nombre + sucursal, con sync a usuario CRM vinculado.

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

  UPDATE public.branch_sales_staff
  SET
    full_name = v_new_name,
    branch_id = p_branch_id,
    updated_at = now()
  WHERE id = p_staff_id;

  WITH updated AS (
    UPDATE public.users u
    SET
      full_name = v_new_name,
      branch_id = p_branch_id,
      updated_at = now()
    WHERE u.tenant_id = v_tenant
      AND u.role IN ('vendedor', 'jefe_sucursal')
      AND u.is_active
      AND lower(trim(u.full_name)) = lower(trim(v_old.full_name))
      AND u.branch_id IS NOT DISTINCT FROM v_old.branch_id
    RETURNING u.id
  )
  SELECT count(*)::int INTO v_users_updated FROM updated;

  UPDATE auth.users au
  SET raw_user_meta_data = jsonb_set(
    COALESCE(au.raw_user_meta_data, '{}'::jsonb),
    '{full_name}',
    to_jsonb(v_new_name::text),
    true
  )
  WHERE au.id IN (
    SELECT u.id
    FROM public.users u
    WHERE u.tenant_id = v_tenant
      AND u.role IN ('vendedor', 'jefe_sucursal')
      AND u.is_active
      AND lower(trim(u.full_name)) = lower(trim(v_new_name))
      AND u.branch_id IS NOT DISTINCT FROM p_branch_id
  );

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
  'Admin: actualiza nombre y sucursal en branch_sales_staff y sincroniza usuario CRM/auth vinculado por nombre+sucursal previos.';
