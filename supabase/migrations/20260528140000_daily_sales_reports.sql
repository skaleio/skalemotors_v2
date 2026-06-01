-- Informe diario equipo de ventas (digitalización del formulario físico Miami Motors).
-- Multi-tenant: tenant_id NOT NULL + RLS restrictiva.
-- Integración con pending_tasks para que vendedores vean la tarea y admins supervisen cumplimiento.

CREATE TABLE IF NOT EXISTS public.daily_sales_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  report_date date NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_sales_reports_user_date_unique UNIQUE (tenant_id, user_id, report_date)
);

COMMENT ON TABLE public.daily_sales_reports IS
  'Informe diario de ventas por ejecutivo (llamados, créditos, redes, plataformas, observaciones).';

CREATE INDEX IF NOT EXISTS idx_daily_sales_reports_tenant_date
  ON public.daily_sales_reports (tenant_id, report_date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_sales_reports_branch_date
  ON public.daily_sales_reports (branch_id, report_date DESC)
  WHERE branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_daily_sales_reports_user_date
  ON public.daily_sales_reports (user_id, report_date DESC);

ALTER TABLE public.daily_sales_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_restrict_daily_sales_reports ON public.daily_sales_reports;
CREATE POLICY tenant_restrict_daily_sales_reports ON public.daily_sales_reports
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR tenant_id = public.current_tenant_id()
  );

DROP POLICY IF EXISTS daily_sales_reports_select ON public.daily_sales_reports;
CREATE POLICY daily_sales_reports_select ON public.daily_sales_reports
  FOR SELECT TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (
      tenant_id = public.current_tenant_id()
      AND (
        user_id = auth.uid()
        OR public.current_user_role() IN ('admin', 'jefe_jefe')
        OR (
          public.current_user_role() IN ('gerente', 'jefe_sucursal')
          AND branch_id IS NOT DISTINCT FROM (
            SELECT u.branch_id FROM public.users u WHERE u.id = auth.uid() LIMIT 1
          )
        )
      )
    )
  );

DROP POLICY IF EXISTS daily_sales_reports_insert ON public.daily_sales_reports;
CREATE POLICY daily_sales_reports_insert ON public.daily_sales_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_is_legacy_protected()
    OR (
      tenant_id = public.current_tenant_id()
      AND user_id = auth.uid()
      AND public.current_user_role() IN ('vendedor', 'jefe_sucursal')
    )
  );

DROP POLICY IF EXISTS daily_sales_reports_update ON public.daily_sales_reports;
CREATE POLICY daily_sales_reports_update ON public.daily_sales_reports
  FOR UPDATE TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (
      tenant_id = public.current_tenant_id()
      AND user_id = auth.uid()
      AND public.current_user_role() IN ('vendedor', 'jefe_sucursal')
    )
  )
  WITH CHECK (
    public.current_is_legacy_protected()
    OR (
      tenant_id = public.current_tenant_id()
      AND user_id = auth.uid()
      AND public.current_user_role() IN ('vendedor', 'jefe_sucursal')
    )
  );

DROP TRIGGER IF EXISTS trg_daily_sales_reports_autofill_tenant ON public.daily_sales_reports;
CREATE TRIGGER trg_daily_sales_reports_autofill_tenant
  BEFORE INSERT ON public.daily_sales_reports
  FOR EACH ROW EXECUTE FUNCTION public.autofill_tenant_branch_from_user();

CREATE OR REPLACE FUNCTION public.chile_today_date()
RETURNS date
LANGUAGE sql
STABLE
AS $$
  SELECT (timezone('America/Santiago', now()))::date;
$$;

COMMENT ON FUNCTION public.chile_today_date() IS 'Fecha calendario actual en zona America/Santiago.';

-- Cierra la pending_task del informe diario al enviar el reporte.
CREATE OR REPLACE FUNCTION public.complete_daily_sales_report_pending_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.submitted_at IS NOT NULL THEN
    UPDATE public.pending_tasks pt
    SET completed_at = NEW.submitted_at,
        updated_at = NEW.submitted_at,
        entity_id = NEW.id
    WHERE pt.tenant_id = NEW.tenant_id
      AND pt.assigned_to = NEW.user_id
      AND pt.completed_at IS NULL
      AND pt.entity_type = 'custom'
      AND pt.metadata->>'alert_reason' = 'daily_sales_report'
      AND (pt.metadata->>'report_date')::date = NEW.report_date;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_daily_sales_reports_complete_pending ON public.daily_sales_reports;
CREATE TRIGGER trg_daily_sales_reports_complete_pending
  BEFORE INSERT OR UPDATE ON public.daily_sales_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.complete_daily_sales_report_pending_task();

-- Crea (idempotente) tareas diarias para vendedores sin informe del día.
CREATE OR REPLACE FUNCTION public.sync_daily_sales_report_tasks(
  p_report_date date DEFAULT public.chile_today_date()
)
RETURNS TABLE (pending_tasks_created int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid := public.current_tenant_id();
  v_role text := public.current_user_role();
  v_branch uuid;
  v_now timestamptz := now();
  v_end_of_day timestamptz;
  v_count int := 0;
  r record;
BEGIN
  IF v_tenant IS NULL THEN
    pending_tasks_created := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_role NOT IN ('admin', 'jefe_jefe', 'gerente', 'jefe_sucursal', 'vendedor') THEN
    pending_tasks_created := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT u.branch_id INTO v_branch FROM public.users u WHERE u.id = auth.uid() LIMIT 1;

  v_end_of_day := (p_report_date + 1)::timestamptz AT TIME ZONE 'America/Santiago';

  FOR r IN
    SELECT u.id AS user_id, u.branch_id, u.full_name
    FROM public.users u
    WHERE u.tenant_id = v_tenant
      AND u.is_active = true
      AND u.role IN ('vendedor', 'jefe_sucursal')
      AND (
        v_role IN ('admin', 'jefe_jefe')
        OR (v_role IN ('gerente', 'jefe_sucursal') AND u.branch_id IS NOT DISTINCT FROM v_branch)
        OR u.id = auth.uid()
      )
  LOOP
    IF r.branch_id IS NULL THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.daily_sales_reports dsr
      WHERE dsr.tenant_id = v_tenant
        AND dsr.user_id = r.user_id
        AND dsr.report_date = p_report_date
        AND dsr.submitted_at IS NOT NULL
    ) THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.pending_tasks pt
      WHERE pt.tenant_id = v_tenant
        AND pt.assigned_to = r.user_id
        AND pt.completed_at IS NULL
        AND pt.entity_type = 'custom'
        AND pt.metadata->>'alert_reason' = 'daily_sales_report'
        AND (pt.metadata->>'report_date')::date = p_report_date
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.pending_tasks (
      tenant_id,
      branch_id,
      assigned_to,
      priority,
      title,
      description,
      action_type,
      action_label,
      entity_type,
      entity_id,
      metadata,
      source,
      due_at
    ) VALUES (
      v_tenant,
      r.branch_id,
      r.user_id,
      'today',
      'Informe diario de ventas',
      'Completar el informe del día (' || to_char(p_report_date, 'DD-MM-YYYY') || ')',
      'otro',
      'Completar informe',
      'custom',
      NULL,
      jsonb_build_object(
        'alert_reason', 'daily_sales_report',
        'report_date', p_report_date::text,
        'seller_name', r.full_name
      ),
      'rule',
      v_end_of_day
    );

    v_count := v_count + 1;
  END LOOP;

  pending_tasks_created := v_count;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.sync_daily_sales_report_tasks(date) IS
  'Crea pending_tasks para vendedores sin informe enviado en la fecha (Chile). Idempotente.';

REVOKE ALL ON FUNCTION public.sync_daily_sales_report_tasks(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_daily_sales_report_tasks(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_daily_sales_report_tasks(date) TO service_role;
