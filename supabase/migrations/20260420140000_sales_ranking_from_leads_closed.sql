-- ============================================================================
-- Ranking v3: la fuente de verdad ahora son los LEADS con status='vendido'.
-- Cada lead que pasa a "vendido" incrementa 1 en el contador del vendedor.
-- Atribución híbrida (igual que el flujo del CRM en closeDeal):
--   - closed_by_staff_id → cuenta a staff (plantilla sin login).
--   - else assigned_to    → cuenta a user (vendedor con login).
--
-- Para poder filtrar por período necesitamos saber CUÁNDO se cerró. Se agrega
-- leads.closed_at con trigger que lo setea al pasar a 'vendido' (y lo limpia
-- si el estado vuelve a otro). Monto/margen se toma por LEFT JOIN con sales
-- (si existe una venta asociada al lead vía sales.lead_id); si no hay venta
-- aún, el contador sube igual pero monto/margen quedan en 0.
-- ============================================================================

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

COMMENT ON COLUMN public.leads.closed_at IS
  'Timestamp del momento en que el lead pasó a status=vendido. Se setea por trigger.';

-- Backfill: para leads ya vendidos previos al trigger usamos updated_at como proxy.
UPDATE public.leads
SET closed_at = updated_at
WHERE status = 'vendido' AND closed_at IS NULL;

CREATE OR REPLACE FUNCTION public.leads_sync_closed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'vendido' AND NEW.closed_at IS NULL THEN
      NEW.closed_at := NOW();
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.status = 'vendido' AND (OLD.status IS DISTINCT FROM 'vendido') THEN
    -- Respeta un closed_at ya provisto por el caller; si no, usa ahora.
    NEW.closed_at := COALESCE(NEW.closed_at, NOW());
  ELSIF NEW.status <> 'vendido' AND OLD.status = 'vendido' THEN
    -- Si se sale del estado vendido, limpiar la marca.
    NEW.closed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leads_sync_closed_at ON public.leads;
CREATE TRIGGER trg_leads_sync_closed_at
  BEFORE INSERT OR UPDATE OF status ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.leads_sync_closed_at();

CREATE INDEX IF NOT EXISTS idx_leads_closed_vendido
  ON public.leads (tenant_id, branch_id, closed_at)
  WHERE status = 'vendido';

CREATE INDEX IF NOT EXISTS idx_leads_vendido_assigned_to
  ON public.leads (assigned_to)
  WHERE status = 'vendido' AND closed_by_staff_id IS NULL AND assigned_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_vendido_closed_by_staff
  ON public.leads (closed_by_staff_id)
  WHERE status = 'vendido' AND closed_by_staff_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- RPC get_sales_ranking v3
-- ----------------------------------------------------------------------------
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
  -- Leads cerrados dentro del período, con métricas monetarias vía LEFT JOIN sales.
  -- Rango por closed_at::date para alinearse con los date pickers de la UI.
  closed_leads AS (
    SELECT
      l.id               AS lead_id,
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
  sellers_staff AS (
    SELECT s.id AS staff_id, s.full_name, s.branch_id
    FROM public.branch_sales_staff s
    WHERE s.tenant_id = v_tenant
      AND s.is_active = TRUE
      AND (v_effective_branch IS NULL OR s.branch_id = v_effective_branch)
  ),
  -- Atribución híbrida: si hay closed_by_staff_id, va al staff; si no, al assigned_to.
  agg_by_user AS (
    SELECT cl.assigned_to AS user_id,
           COUNT(*)::bigint AS sales_count,
           COALESCE(SUM(cl.amount), 0)::numeric AS total_amount,
           COALESCE(SUM(cl.margin), 0)::numeric AS total_margin
    FROM closed_leads cl
    WHERE cl.closed_by_staff_id IS NULL
      AND cl.assigned_to IS NOT NULL
    GROUP BY cl.assigned_to
  ),
  agg_by_staff AS (
    SELECT cl.closed_by_staff_id AS staff_id,
           COUNT(*)::bigint AS sales_count,
           COALESCE(SUM(cl.amount), 0)::numeric AS total_amount,
           COALESCE(SUM(cl.margin), 0)::numeric AS total_margin
    FROM closed_leads cl
    WHERE cl.closed_by_staff_id IS NOT NULL
    GROUP BY cl.closed_by_staff_id
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
    LEFT JOIN agg_by_staff a ON a.staff_id = ss.staff_id
  ),
  -- Users no activos / staff no activos que igualmente cerraron (histórico).
  -- Importante: no perder números reales aunque el vendedor ya no esté activo.
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
    FROM agg_by_staff a
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
  'Ranking v3: cuenta leads con status=vendido en el período (closed_at). '
  'Atribución híbrida (closed_by_staff_id > assigned_to). Monto/margen desde sales.lead_id si existe.';
