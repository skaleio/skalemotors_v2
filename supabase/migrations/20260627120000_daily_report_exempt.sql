-- Exceptúa vendedores específicos del informe diario (no aparecen en supervisión
-- ni reciben la tarea pendiente diaria). Siguen siendo vendedores normales en el CRM.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS daily_report_exempt boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.daily_report_exempt IS
  'Si es true, el vendedor no participa del informe diario de ventas (sin tarea ni supervisión).';

-- Antonia Soto y Benjamin Moreno: no realizan la rutina del informe diario.
UPDATE public.users
SET daily_report_exempt = true
WHERE id IN (
  '74c6a3bf-48a8-4da0-a01b-8b1c1b3acf22',
  'b032737b-664c-44f4-a79c-430f28f261f1'
);

-- Recrea la sincronización de tareas excluyendo a los vendedores exentos.
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
      AND u.daily_report_exempt = false
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
