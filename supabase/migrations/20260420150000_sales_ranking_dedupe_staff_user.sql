-- ============================================================================
-- Ranking v4: dedupe entre users (con login) y branch_sales_staff (plantilla).
--
-- Caso real: un admin crea "Antonio" en Vendedores (plantilla) y también le da
-- login como user rol='vendedor'. Sin dedupe, aparecían 2 filas en el ranking.
--
-- Regla de match (mismo tenant):
--   lower(trim(user.full_name)) = lower(trim(staff.full_name))
--   AND user.role = 'vendedor' AND user.is_active = true
--   AND user.branch_id IS NOT DISTINCT FROM staff.branch_id
--
-- Cuando matchean:
--   - Solo se muestra la fila del user (tiene login → prioritario).
--   - Las ventas con closed_by_staff_id de ese staff se suman al user.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_sales_ranking(
  p_from date,
  p_to date,
  p_branch_id uuid DEFAULT NULL
)
RETURNS TABLE (
  seller_key text,
  seller_id uuid,
  seller_name text,
  branch_id uuid,
  branch_name text,
  sales_count bigint,
  total_amount numeric,
  total_margin numeric,
  is_linked_user boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := public.current_user_role();
  v_tenant uuid := public.current_tenant_id();
  v_user uuid := auth.uid();
  v_user_branch uuid;
  v_effective_branch uuid := p_branch_id;
BEGIN
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'No tenant context' USING ERRCODE = '42501';
  END IF;

  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to THEN
    RAISE EXCEPTION 'Invalid date range' USING ERRCODE = '22023';
  END IF;

  IF v_role IN ('servicio', 'inventario') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT u.branch_id INTO v_user_branch FROM public.users u WHERE u.id = v_user;

  IF v_role IN ('vendedor', 'jefe_sucursal') THEN
    v_effective_branch := v_user_branch;
    IF v_effective_branch IS NULL THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  WITH
  -- Mapa staff_id → user_id cuando hay match por nombre+branch+tenant.
  -- DISTINCT ON garantiza 1 user por staff (si hay nombres duplicados entre
  -- users, se toma el más antiguo).
  staff_user_map AS (
    SELECT DISTINCT ON (s.id)
      s.id  AS staff_id,
      u.id  AS user_id
    FROM public.branch_sales_staff s
    JOIN public.users u
      ON u.tenant_id = s.tenant_id
     AND u.role = 'vendedor'
     AND u.is_active = TRUE
     AND lower(trim(u.full_name)) = lower(trim(s.full_name))
     AND u.branch_id IS NOT DISTINCT FROM s.branch_id
    WHERE s.tenant_id = v_tenant
    ORDER BY s.id, u.created_at ASC
  ),
  closed_leads AS (
    SELECT
      l.id                 AS lead_id,
      l.assigned_to,
      l.closed_by_staff_id,
      l.branch_id,
      COALESCE(sx.total_amount, 0)::numeric AS amount,
      COALESCE(sx.total_margin, 0)::numeric AS margin
    FROM public.leads l
    LEFT JOIN LATERAL (
      SELECT SUM(s.sale_price)::numeric AS total_amount,
             SUM(s.margin)::numeric     AS total_margin
      FROM public.sales s
      WHERE s.lead_id = l.id
    ) sx ON TRUE
    WHERE l.tenant_id = v_tenant
      AND l.status = 'vendido'
      AND l.deleted_at IS NULL
      AND l.closed_at IS NOT NULL
      AND l.closed_at::date >= p_from
      AND l.closed_at::date <= p_to
      AND (v_effective_branch IS NULL OR l.branch_id = v_effective_branch)
  ),
  sellers_users AS (
    SELECT u.id AS user_id, u.full_name, u.branch_id
    FROM public.users u
    WHERE u.tenant_id = v_tenant
      AND u.role = 'vendedor'
      AND u.is_active = TRUE
      AND (v_effective_branch IS NULL OR u.branch_id = v_effective_branch)
  ),
  -- Staff a mostrar: solo los NO vinculados a un user (los vinculados se consolidan).
  sellers_staff AS (
    SELECT s.id AS staff_id, s.full_name, s.branch_id
    FROM public.branch_sales_staff s
    WHERE s.tenant_id = v_tenant
      AND s.is_active = TRUE
      AND (v_effective_branch IS NULL OR s.branch_id = v_effective_branch)
      AND NOT EXISTS (SELECT 1 FROM staff_user_map m WHERE m.staff_id = s.id)
  ),
  -- Ventas directas al user (por assigned_to, sin closed_by_staff_id).
  agg_direct_user AS (
    SELECT cl.assigned_to AS user_id,
           COUNT(*)::bigint AS sales_count,
           COALESCE(SUM(cl.amount), 0)::numeric AS total_amount,
           COALESCE(SUM(cl.margin), 0)::numeric AS total_margin
    FROM closed_leads cl
    WHERE cl.closed_by_staff_id IS NULL
      AND cl.assigned_to IS NOT NULL
    GROUP BY cl.assigned_to
  ),
  -- Ventas por staff, bruto (antes de redirigir las vinculadas al user).
  agg_staff_raw AS (
    SELECT cl.closed_by_staff_id AS staff_id,
           COUNT(*)::bigint AS sales_count,
           COALESCE(SUM(cl.amount), 0)::numeric AS total_amount,
           COALESCE(SUM(cl.margin), 0)::numeric AS total_margin
    FROM closed_leads cl
    WHERE cl.closed_by_staff_id IS NOT NULL
    GROUP BY cl.closed_by_staff_id
  ),
  -- Las del staff vinculado se redirigen al user linkeado.
  agg_staff_to_user AS (
    SELECT m.user_id,
           a.sales_count,
           a.total_amount,
           a.total_margin
    FROM agg_staff_raw a
    JOIN staff_user_map m ON m.staff_id = a.staff_id
  ),
  -- Las del staff SIN user linkeado se quedan como staff.
  agg_staff_final AS (
    SELECT a.staff_id,
           a.sales_count,
           a.total_amount,
           a.total_margin
    FROM agg_staff_raw a
    WHERE NOT EXISTS (SELECT 1 FROM staff_user_map m WHERE m.staff_id = a.staff_id)
  ),
  -- Consolidado por user: directas + redirigidas desde staff.
  agg_by_user AS (
    SELECT user_id,
           SUM(sales_count)::bigint AS sales_count,
           SUM(total_amount)::numeric AS total_amount,
           SUM(total_margin)::numeric AS total_margin
    FROM (
      SELECT user_id, sales_count, total_amount, total_margin FROM agg_direct_user
      UNION ALL
      SELECT user_id, sales_count, total_amount, total_margin FROM agg_staff_to_user
    ) t
    GROUP BY user_id
  ),
  rows_users AS (
    SELECT
      'uid:' || su.user_id::text AS seller_key,
      su.user_id AS seller_id,
      su.full_name AS seller_name,
      su.branch_id,
      COALESCE(a.sales_count, 0)::bigint AS sales_count,
      COALESCE(a.total_amount, 0)::numeric AS total_amount,
      COALESCE(a.total_margin, 0)::numeric AS total_margin,
      TRUE AS is_linked_user
    FROM sellers_users su
    LEFT JOIN agg_by_user a ON a.user_id = su.user_id
  ),
  rows_staff AS (
    SELECT
      'staff:' || ss.staff_id::text AS seller_key,
      NULL::uuid AS seller_id,
      ss.full_name AS seller_name,
      ss.branch_id,
      COALESCE(a.sales_count, 0)::bigint AS sales_count,
      COALESCE(a.total_amount, 0)::numeric AS total_amount,
      COALESCE(a.total_margin, 0)::numeric AS total_margin,
      FALSE AS is_linked_user
    FROM sellers_staff ss
    LEFT JOIN agg_staff_final a ON a.staff_id = ss.staff_id
  ),
  -- Histórico: users/staff que cerraron pero ya no son activos/visibles en la lista.
  rows_orphan_users AS (
    SELECT
      'uid:' || a.user_id::text AS seller_key,
      a.user_id AS seller_id,
      COALESCE(u.full_name, 'Usuario sin nombre') AS seller_name,
      u.branch_id,
      a.sales_count,
      a.total_amount,
      a.total_margin,
      TRUE AS is_linked_user
    FROM agg_by_user a
    LEFT JOIN public.users u ON u.id = a.user_id
    WHERE NOT EXISTS (SELECT 1 FROM sellers_users su WHERE su.user_id = a.user_id)
  ),
  rows_orphan_staff AS (
    SELECT
      'staff:' || a.staff_id::text AS seller_key,
      NULL::uuid AS seller_id,
      COALESCE(s.full_name, 'Plantilla sin nombre') AS seller_name,
      s.branch_id,
      a.sales_count,
      a.total_amount,
      a.total_margin,
      FALSE AS is_linked_user
    FROM agg_staff_final a
    LEFT JOIN public.branch_sales_staff s ON s.id = a.staff_id
    WHERE NOT EXISTS (SELECT 1 FROM sellers_staff ss WHERE ss.staff_id = a.staff_id)
  ),
  combined AS (
    SELECT * FROM rows_users
    UNION ALL SELECT * FROM rows_staff
    UNION ALL SELECT * FROM rows_orphan_users
    UNION ALL SELECT * FROM rows_orphan_staff
  )
  SELECT
    c.seller_key,
    c.seller_id,
    c.seller_name,
    c.branch_id,
    b.name AS branch_name,
    c.sales_count,
    c.total_amount,
    c.total_margin,
    c.is_linked_user
  FROM combined c
  LEFT JOIN public.branches b ON b.id = c.branch_id
  ORDER BY c.sales_count DESC, c.total_amount DESC, c.seller_name ASC;
END;
$$;

COMMENT ON FUNCTION public.get_sales_ranking(date, date, uuid) IS
  'Ranking v4: dedupe user/staff por nombre+branch+tenant. User con login '
  'absorbe las ventas del staff homónimo. Fuente: leads.status=vendido+closed_at.';
