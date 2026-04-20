-- ============================================================================
-- Ranking v2: incluir a todos los vendedores activos aunque no tengan ventas
-- en el período (filas con 0s). Así la lista motivacional siempre aparece.
--
-- Fuentes de vendedores:
--   1) public.users con role='vendedor' AND is_active (con login)
--   2) public.branch_sales_staff con is_active (plantilla sin login)
--   3) Nombres libres en sales.seller_name que no matcheen con (2) — histórico
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
  filtered AS (
    SELECT s.seller_id, s.seller_name, s.branch_id, s.sale_price, s.margin
    FROM public.sales s
    WHERE s.tenant_id = v_tenant
      AND s.status = 'completada'
      AND s.payment_status = 'realizado'
      AND s.sale_date >= p_from
      AND s.sale_date <= p_to
      AND (v_effective_branch IS NULL OR s.branch_id = v_effective_branch)
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
    SELECT s.id AS staff_id, s.full_name, s.branch_id
    FROM public.branch_sales_staff s
    WHERE s.tenant_id = v_tenant
      AND s.is_active = TRUE
      AND (v_effective_branch IS NULL OR s.branch_id = v_effective_branch)
  ),
  agg_by_user AS (
    SELECT f.seller_id,
           COUNT(*)::bigint AS sales_count,
           COALESCE(SUM(f.sale_price), 0)::numeric AS total_amount,
           COALESCE(SUM(f.margin), 0)::numeric AS total_margin
    FROM filtered f
    WHERE f.seller_id IS NOT NULL
    GROUP BY f.seller_id
  ),
  agg_by_name AS (
    SELECT lower(trim(f.seller_name)) AS name_norm,
           f.branch_id,
           MAX(f.seller_name) AS seller_name,
           COUNT(*)::bigint AS sales_count,
           COALESCE(SUM(f.sale_price), 0)::numeric AS total_amount,
           COALESCE(SUM(f.margin), 0)::numeric AS total_margin
    FROM filtered f
    WHERE f.seller_id IS NULL
      AND f.seller_name IS NOT NULL
      AND trim(f.seller_name) <> ''
    GROUP BY lower(trim(f.seller_name)), f.branch_id
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
    LEFT JOIN agg_by_user a ON a.seller_id = su.user_id
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
    LEFT JOIN agg_by_name a
      ON a.name_norm = lower(trim(ss.full_name))
     AND a.branch_id IS NOT DISTINCT FROM ss.branch_id
  ),
  rows_freename AS (
    -- Ventas con seller_name que no matchean con ningún staff activo
    -- (histórico o plantilla borrada). Se listan para no perder números reales.
    SELECT
      'name:' || a.name_norm || '|' || COALESCE(a.branch_id::text, '') AS seller_key,
      NULL::uuid AS seller_id,
      a.seller_name,
      a.branch_id,
      a.sales_count,
      a.total_amount,
      a.total_margin,
      FALSE AS is_linked_user
    FROM agg_by_name a
    WHERE NOT EXISTS (
      SELECT 1 FROM sellers_staff ss
      WHERE lower(trim(ss.full_name)) = a.name_norm
        AND ss.branch_id IS NOT DISTINCT FROM a.branch_id
    )
  ),
  combined AS (
    SELECT * FROM rows_users
    UNION ALL
    SELECT * FROM rows_staff
    UNION ALL
    SELECT * FROM rows_freename
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
  'Ranking de vendedores (v2): incluye a todos los vendedores activos del tenant/sucursal '
  'aunque no tengan ventas en el período (filas con 0). Fuentes: users rol=vendedor + '
  'branch_sales_staff + seller_name histórico. SECURITY DEFINER, solo agregados.';
