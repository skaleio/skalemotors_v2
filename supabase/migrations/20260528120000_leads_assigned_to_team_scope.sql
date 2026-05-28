-- Valida que assigned_to respete tenant y equipo (admin/gerente → created_by_user_id).

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

  v_caller_tenant := public.current_tenant_id();
  v_caller_role := public.current_user_role();
  SELECT branch_id INTO v_caller_branch FROM public.users WHERE id = auth.uid();

  SELECT * INTO v_assignee FROM public.users WHERE id = NEW.assigned_to;

  IF NOT FOUND OR NOT COALESCE(v_assignee.is_active, false) THEN
    RAISE EXCEPTION 'assigned_to: usuario no válido o inactivo';
  END IF;

  IF public.current_is_legacy_protected() THEN
    RETURN NEW;
  END IF;

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

DROP TRIGGER IF EXISTS trg_leads_validate_assigned_to ON public.leads;
CREATE TRIGGER trg_leads_validate_assigned_to
  BEFORE INSERT OR UPDATE OF assigned_to ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_lead_assigned_to();
