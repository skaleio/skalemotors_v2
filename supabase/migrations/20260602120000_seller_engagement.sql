-- Presencia en app + métricas de engagement por vendedor (notas, actividades, movimiento de leads).

CREATE TABLE IF NOT EXISTS public.seller_app_presence (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_path TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seller_app_presence_tenant ON public.seller_app_presence(tenant_id);
CREATE INDEX IF NOT EXISTS idx_seller_app_presence_last_seen ON public.seller_app_presence(tenant_id, last_seen_at DESC);

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS seller_inactivity_hours integer NOT NULL DEFAULT 24;

ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_seller_inactivity_hours_positive;

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_seller_inactivity_hours_positive
  CHECK (seller_inactivity_hours > 0 AND seller_inactivity_hours <= 168);

COMMENT ON TABLE public.seller_app_presence IS
  'Última actividad en la app (navegación) por usuario vendedor; alimenta el score de engagement.';

ALTER TABLE public.seller_app_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_restrict_seller_app_presence ON public.seller_app_presence;
CREATE POLICY tenant_restrict_seller_app_presence ON public.seller_app_presence
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR tenant_id = public.current_tenant_id()
  );

DROP POLICY IF EXISTS seller_app_presence_upsert_self ON public.seller_app_presence;
CREATE POLICY seller_app_presence_select ON public.seller_app_presence
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS seller_app_presence_insert ON public.seller_app_presence;
CREATE POLICY seller_app_presence_insert ON public.seller_app_presence
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS seller_app_presence_update ON public.seller_app_presence;
CREATE POLICY seller_app_presence_update ON public.seller_app_presence
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND tenant_id = public.current_tenant_id());

-- Heartbeat desde el cliente (throttle en frontend).
CREATE OR REPLACE FUNCTION public.upsert_seller_app_presence(p_path text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tenant uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  SELECT u.tenant_id INTO v_tenant FROM public.users u WHERE u.id = v_uid;
  IF v_tenant IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.seller_app_presence (user_id, tenant_id, last_seen_at, last_path, updated_at)
  VALUES (v_uid, v_tenant, NOW(), NULLIF(TRIM(p_path), ''), NOW())
  ON CONFLICT (user_id) DO UPDATE
  SET
    last_seen_at = NOW(),
    last_path = COALESCE(NULLIF(TRIM(EXCLUDED.last_path), ''), public.seller_app_presence.last_path),
    updated_at = NOW();
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_seller_app_presence(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_seller_app_presence(text) TO authenticated;

-- Métricas agregadas por vendedor (usuario auth y/o plantilla staff).
CREATE OR REPLACE FUNCTION public.get_seller_engagement_metrics(
  p_branch_id uuid DEFAULT NULL,
  p_window_days integer DEFAULT 7,
  p_inactivity_hours integer DEFAULT NULL
)
RETURNS TABLE (
  seller_key text,
  user_id uuid,
  staff_id uuid,
  seller_name text,
  notes_count bigint,
  activities_count bigint,
  lead_moves_count bigint,
  last_seen_at timestamptz,
  last_engagement_at timestamptz,
  engagement_score integer,
  is_inactive boolean,
  stale_assigned_leads integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid := public.current_tenant_id();
  v_role text := public.current_user_role();
  v_user uuid := auth.uid();
  v_user_branch uuid;
  v_effective_branch uuid := p_branch_id;
  v_window_days integer := GREATEST(1, LEAST(COALESCE(p_window_days, 7), 30));
  v_inactivity_hours integer;
  v_window_start timestamptz;
  v_inactivity_start timestamptz;
BEGIN
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'No tenant context' USING ERRCODE = '42501';
  END IF;

  IF v_role IN ('servicio', 'inventario', 'fotografo') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT u.branch_id INTO v_user_branch FROM public.users u WHERE u.id = v_user;

  IF v_role IN ('vendedor', 'jefe_sucursal') THEN
    v_effective_branch := v_user_branch;
    IF v_effective_branch IS NULL THEN
      RETURN;
    END IF;
  END IF;

  SELECT COALESCE(
    NULLIF(p_inactivity_hours, 0),
    t.seller_inactivity_hours,
    24
  )
  INTO v_inactivity_hours
  FROM public.tenants t
  WHERE t.id = v_tenant;

  v_inactivity_hours := GREATEST(1, LEAST(v_inactivity_hours, 168));
  v_window_start := NOW() - (v_window_days || ' days')::interval;
  v_inactivity_start := NOW() - (v_inactivity_hours || ' hours')::interval;

  RETURN QUERY
  WITH
  staff_user_map AS (
    SELECT DISTINCT ON (s.id)
      s.id AS staff_id,
      u.id AS user_id
    FROM public.branch_sales_staff s
    JOIN public.users u
      ON u.tenant_id = s.tenant_id
     AND u.role = 'vendedor'
     AND u.is_active = TRUE
     AND lower(trim(u.full_name)) = lower(trim(s.full_name))
    WHERE s.tenant_id = v_tenant
      AND s.is_active = TRUE
    ORDER BY
      s.id,
      (u.branch_id IS NOT DISTINCT FROM s.branch_id) DESC,
      u.created_at ASC
  ),
  sellers_users AS (
    SELECT u.id AS user_id, u.full_name, u.branch_id
    FROM public.users u
    WHERE u.tenant_id = v_tenant
      AND u.role = 'vendedor'
      AND u.is_active = TRUE
      AND (v_effective_branch IS NULL OR u.branch_id = v_effective_branch)
  ),
  sellers_staff AS (
    SELECT s.id AS staff_id, s.full_name, s.branch_id, m.user_id AS mapped_user_id
    FROM public.branch_sales_staff s
    LEFT JOIN staff_user_map m ON m.staff_id = s.id
    WHERE s.tenant_id = v_tenant
      AND s.is_active = TRUE
      AND (v_effective_branch IS NULL OR s.branch_id = v_effective_branch)
      AND m.staff_id IS NULL
  ),
  notes_agg AS (
    SELECT n.created_by AS user_id, COUNT(*)::bigint AS cnt, MAX(n.created_at) AS last_at
    FROM public.lead_notes n
    WHERE n.tenant_id = v_tenant
      AND n.created_by IS NOT NULL
      AND n.created_at >= v_window_start
    GROUP BY n.created_by
  ),
  activities_agg AS (
    SELECT a.user_id, COUNT(*)::bigint AS cnt, MAX(a.created_at) AS last_at
    FROM public.lead_activities a
    JOIN public.leads l ON l.id = a.lead_id AND l.tenant_id = v_tenant
    WHERE a.user_id IS NOT NULL
      AND a.created_at >= v_window_start
      AND (v_effective_branch IS NULL OR l.branch_id = v_effective_branch)
    GROUP BY a.user_id
  ),
  lead_moves_agg AS (
    SELECT l.assigned_to AS user_id,
           COUNT(*)::bigint AS cnt,
           MAX(GREATEST(COALESCE(l.status_changed_at, l.updated_at), l.updated_at)) AS last_at
    FROM public.leads l
    WHERE l.tenant_id = v_tenant
      AND l.deleted_at IS NULL
      AND l.assigned_to IS NOT NULL
      AND GREATEST(COALESCE(l.status_changed_at, l.updated_at), l.updated_at) >= v_window_start
      AND (v_effective_branch IS NULL OR l.branch_id = v_effective_branch)
    GROUP BY l.assigned_to
  ),
  stale_leads_agg AS (
    SELECT l.assigned_to AS user_id, COUNT(*)::bigint AS cnt
    FROM public.leads l
    WHERE l.tenant_id = v_tenant
      AND l.deleted_at IS NULL
      AND l.assigned_to IS NOT NULL
      AND l.status NOT IN ('vendido', 'perdido')
      AND GREATEST(COALESCE(l.status_changed_at, l.updated_at), l.updated_at) < v_inactivity_start
      AND (v_effective_branch IS NULL OR l.branch_id = v_effective_branch)
    GROUP BY l.assigned_to
  ),
  user_rows AS (
    SELECT
      'uid:' || su.user_id::text AS seller_key,
      su.user_id,
      NULL::uuid AS staff_id,
      su.full_name AS seller_name,
      COALESCE(n.cnt, 0)::bigint AS notes_count,
      COALESCE(ac.cnt, 0)::bigint AS activities_count,
      COALESCE(lm.cnt, 0)::bigint AS lead_moves_count,
      p.last_seen_at,
      GREATEST(
        n.last_at,
        ac.last_at,
        lm.last_at,
        p.last_seen_at
      ) AS last_engagement_at,
      COALESCE(sl.cnt, 0)::bigint AS stale_assigned_leads
    FROM sellers_users su
    LEFT JOIN notes_agg n ON n.user_id = su.user_id
    LEFT JOIN activities_agg ac ON ac.user_id = su.user_id
    LEFT JOIN lead_moves_agg lm ON lm.user_id = su.user_id
    LEFT JOIN public.seller_app_presence p ON p.user_id = su.user_id
    LEFT JOIN stale_leads_agg sl ON sl.user_id = su.user_id
  ),
  staff_rows AS (
    SELECT
      'staff:' || ss.staff_id::text AS seller_key,
      NULL::uuid AS user_id,
      ss.staff_id,
      ss.full_name AS seller_name,
      0::bigint AS notes_count,
      0::bigint AS activities_count,
      COALESCE((
        SELECT COUNT(*)::bigint
        FROM public.leads l
        WHERE l.tenant_id = v_tenant
          AND l.deleted_at IS NULL
          AND l.closed_by_staff_id = ss.staff_id
          AND GREATEST(COALESCE(l.status_changed_at, l.updated_at), l.updated_at) >= v_window_start
      ), 0) AS lead_moves_count,
      NULL::timestamptz AS last_seen_at,
      (
        SELECT MAX(GREATEST(COALESCE(l.status_changed_at, l.updated_at), l.updated_at))
        FROM public.leads l
        WHERE l.tenant_id = v_tenant
          AND l.deleted_at IS NULL
          AND l.closed_by_staff_id = ss.staff_id
      ) AS last_engagement_at,
      0::bigint AS stale_assigned_leads
    FROM sellers_staff ss
  ),
  combined AS (
    SELECT * FROM user_rows
    UNION ALL
    SELECT * FROM staff_rows
  )
  SELECT
    c.seller_key,
    c.user_id,
    c.staff_id,
    c.seller_name,
    c.notes_count,
    c.activities_count,
    c.lead_moves_count,
    c.last_seen_at,
    c.last_engagement_at,
    LEAST(
      100,
      LEAST(c.notes_count * 12, 36)::integer
      + LEAST(c.activities_count * 10, 30)::integer
      + LEAST(c.lead_moves_count * 8, 24)::integer
      + CASE
          WHEN c.last_seen_at >= NOW() - INTERVAL '24 hours' THEN 10
          WHEN c.last_seen_at >= v_window_start THEN 5
          ELSE 0
        END
    )::integer AS engagement_score,
    (
      c.stale_assigned_leads > 0
      AND (c.last_engagement_at IS NULL OR c.last_engagement_at < v_inactivity_start)
    ) AS is_inactive,
    c.stale_assigned_leads::integer AS stale_assigned_leads
  FROM combined c
  ORDER BY engagement_score DESC, c.seller_name ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_seller_engagement_metrics(uuid, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_seller_engagement_metrics(uuid, integer, integer) TO authenticated;

COMMENT ON FUNCTION public.get_seller_engagement_metrics(uuid, integer, integer) IS
  'Score 0-100 por notas, actividades CRM, movimiento de leads asignados y presencia en app. '
  'is_inactive=true si tiene leads abiertos sin movimiento > p_inactivity_hours y sin engagement reciente.';
