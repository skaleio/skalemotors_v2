-- Ingesta n8n / service_role: validar assigned_to contra NEW.tenant_id (no JWT).
-- Permite asignar leads de agendamiento al admin/gerente del tenant (ej. miami@motors.cl).

CREATE OR REPLACE FUNCTION public.validate_lead_assigned_to()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignee public.users%ROWTYPE;
  v_caller_tenant UUID;
  v_caller_role TEXT;
  v_caller_branch UUID;
BEGIN
  IF NEW.assigned_to IS NOT DISTINCT FROM OLD.assigned_to THEN
    RETURN NEW;
  END IF;

  IF NEW.assigned_to IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_assignee FROM public.users WHERE id = NEW.assigned_to;

  IF NOT FOUND OR NOT COALESCE(v_assignee.is_active, false) THEN
    RAISE EXCEPTION 'assigned_to: usuario no válido o inactivo';
  END IF;

  IF public.current_is_legacy_protected() THEN
    RETURN NEW;
  END IF;

  -- Service role (n8n, appointment-ingest): sin auth.uid(), validar por fila.
  IF auth.uid() IS NULL THEN
    IF NEW.tenant_id IS NOT NULL
       AND v_assignee.tenant_id IS DISTINCT FROM NEW.tenant_id THEN
      RAISE EXCEPTION 'assigned_to: el vendedor no pertenece a tu organización';
    END IF;

    IF v_assignee.role NOT IN ('vendedor', 'jefe_sucursal', 'admin', 'gerente') THEN
      RAISE EXCEPTION 'assigned_to: rol no válido para asignación de lead';
    END IF;

    RETURN NEW;
  END IF;

  v_caller_tenant := public.current_tenant_id();
  v_caller_role := public.current_user_role();
  SELECT branch_id INTO v_caller_branch FROM public.users WHERE id = auth.uid();

  IF v_assignee.tenant_id IS DISTINCT FROM v_caller_tenant THEN
    RAISE EXCEPTION 'assigned_to: el vendedor no pertenece a tu organización';
  END IF;

  IF v_assignee.role NOT IN ('vendedor', 'jefe_sucursal') THEN
    RAISE EXCEPTION 'assigned_to: solo se puede asignar a vendedor o jefe de sucursal';
  END IF;

  IF v_caller_role IN ('admin', 'gerente') THEN
    IF v_assignee.created_by_user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'assigned_to: solo puedes asignar a vendedores de tu equipo';
    END IF;
  ELSIF v_caller_role = 'jefe_sucursal' THEN
    IF v_caller_branch IS NOT NULL
       AND v_assignee.branch_id IS DISTINCT FROM v_caller_branch THEN
      RAISE EXCEPTION 'assigned_to: solo vendedores de tu sucursal';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
