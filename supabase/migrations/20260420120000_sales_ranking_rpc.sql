-- ============================================================================
-- Ranking de vendedores (MVP).
-- Fuente de verdad: public.sales con status='completada' AND payment_status='realizado'
-- (misma definición usada por Dashboard/Finance).
-- Unifica vendedores con login (seller_id) y plantilla sin login (seller_name).
-- Expone SOLO agregados vía RPC SECURITY DEFINER → no debilita RLS de sales/leads
-- ni filtra PII de clientes a roles sin permiso.
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_sales_ranking_tenant_status_date
  ON public.sales (tenant_id, status, payment_status, sale_date);

CREATE INDEX IF NOT EXISTS idx_sales_ranking_branch_status_date
  ON public.sales (branch_id, status, payment_status, sale_date);

CREATE INDEX IF NOT EXISTS idx_sales_ranking_seller_id
  ON public.sales (seller_id)
  WHERE seller_id IS NOT NULL;

-- RPC: agrega ventas cerradas por vendedor dentro del rango solicitado.
-- Reglas:
--  - servicio / inventario → acceso denegado.
--  - vendedor / jefe_sucursal → se fuerza el branch del usuario; ignora p_branch_id.
--  - admin / gerente / financiero / jefe_jefe → tenant actual; p_branch_id opcional.
--  - legacy_protected se ignora aquí (este es un módulo SaaS nuevo); si la ventaja
--    hessen@test.io necesita ver todo tenant, su rol real ya debería ser admin.
DROP FUNCTION IF EXISTS public.get_sales_ranking(date, date, uuid);

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
  WITH filtered AS (
    SELECT s.seller_id, s.seller_name, s.branch_id, s.sale_price, s.margin
    FROM public.sales s
    WHERE s.tenant_id = v_tenant
      AND s.status = 'completada'
      AND s.payment_status = 'realizado'
      AND s.sale_date >= p_from
      AND s.sale_date <= p_to
      AND (v_effective_branch IS NULL OR s.branch_id = v_effective_branch)
  ),
  by_user AS (
    SELECT
      'uid:' || f.seller_id::text AS seller_key,
      f.seller_id AS seller_id,
      COALESCE(u.full_name, 'Usuario sin nombre') AS seller_name,
      (ARRAY_AGG(f.branch_id ORDER BY f.branch_id) FILTER (WHERE f.branch_id IS NOT NULL))[1] AS branch_id,
      COUNT(*)::bigint AS sales_count,
      COALESCE(SUM(f.sale_price), 0)::numeric AS total_amount,
      COALESCE(SUM(f.margin), 0)::numeric AS total_margin,
      TRUE AS is_linked_user
    FROM filtered f
    LEFT JOIN public.users u ON u.id = f.seller_id
    WHERE f.seller_id IS NOT NULL
    GROUP BY f.seller_id, u.full_name
  ),
  by_name AS (
    SELECT
      'name:' || lower(trim(f.seller_name)) || '|' || COALESCE(f.branch_id::text, '') AS seller_key,
      NULL::uuid AS seller_id,
      f.seller_name AS seller_name,
      f.branch_id AS branch_id,
      COUNT(*)::bigint AS sales_count,
      COALESCE(SUM(f.sale_price), 0)::numeric AS total_amount,
      COALESCE(SUM(f.margin), 0)::numeric AS total_margin,
      FALSE AS is_linked_user
    FROM filtered f
    WHERE f.seller_id IS NULL
      AND f.seller_name IS NOT NULL
      AND trim(f.seller_name) <> ''
    GROUP BY f.seller_name, f.branch_id
  ),
  combined AS (
    SELECT * FROM by_user
    UNION ALL
    SELECT * FROM by_name
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
  'Ranking de vendedores por ventas cerradas (sales.status=completada + payment_status=realizado). '
  'SECURITY DEFINER: expone solo agregados; vendedor/jefe_sucursal quedan forzados a su sucursal.';

REVOKE ALL ON FUNCTION public.get_sales_ranking(date, date, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_sales_ranking(date, date, uuid) TO authenticated;
