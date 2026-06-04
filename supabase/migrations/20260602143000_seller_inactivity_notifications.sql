-- Notificaciones in-app: vendedor inactivo (> seller_inactivity_hours) → admin + jefe_sucursal
-- del mismo tenant/sucursal (resolve_notification_recipients).

CREATE OR REPLACE FUNCTION public.sync_seller_inactivity_notifications()
RETURNS TABLE (notifications_created integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_tenant uuid := public.current_tenant_id();
  v_role text := public.current_user_role();
  v_notif_count int := 0;
  r record;
  a record;
  v_entity_id uuid;
  v_hours int;
  v_message text;
BEGIN
  IF v_role NOT IN ('admin', 'jefe_jefe', 'gerente', 'jefe_sucursal') OR v_tenant IS NULL THEN
    notifications_created := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT COALESCE(t.seller_inactivity_hours, 24)
  INTO v_hours
  FROM public.tenants t
  WHERE t.id = v_tenant;

  -- Archivar avisos de vendedores que ya no están inactivos.
  UPDATE public.notifications n
  SET archived_at = v_now
  WHERE n.tenant_id = v_tenant
    AND n.type = 'seller_inactive'
    AND n.archived_at IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.get_seller_engagement_metrics(NULL, 7, NULL) m
      WHERE m.is_inactive
        AND COALESCE(m.user_id, m.staff_id) = n.entity_id
    );

  FOR r IN
    SELECT
      m.seller_key,
      m.user_id,
      m.staff_id,
      m.seller_name,
      m.stale_assigned_leads,
      m.last_engagement_at,
      COALESCE(u.branch_id, s.branch_id) AS branch_id,
      b.name AS branch_name
    FROM public.get_seller_engagement_metrics(NULL, 7, NULL) m
    LEFT JOIN public.users u ON u.id = m.user_id
    LEFT JOIN public.branch_sales_staff s ON s.id = m.staff_id
    LEFT JOIN public.branches b ON b.id = COALESCE(u.branch_id, s.branch_id)
    WHERE m.is_inactive
  LOOP
    v_entity_id := COALESCE(r.user_id, r.staff_id);
    IF v_entity_id IS NULL THEN
      CONTINUE;
    END IF;

    v_message := 'El vendedor "' || COALESCE(r.seller_name, 's/n') || '" lleva más de '
      || v_hours || ' h sin actividad en la plataforma'
      || CASE
           WHEN r.stale_assigned_leads > 0 THEN
             ' y tiene ' || r.stale_assigned_leads::text || ' lead(s) asignado(s) sin movimiento'
           ELSE ''
         END
      || CASE WHEN r.branch_name IS NOT NULL THEN ' — ' || r.branch_name ELSE '' END;

    FOR a IN
      SELECT rn.user_id
      FROM public.resolve_notification_recipients(
        v_tenant,
        r.branch_id,
        ARRAY['admin', 'jefe_sucursal']::text[],
        r.user_id
      ) rn
    LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM public.notifications n
        WHERE n.tenant_id = v_tenant
          AND n.type = 'seller_inactive'
          AND n.entity_type = 'seller'
          AND n.entity_id = v_entity_id
          AND n.recipient_user_id = a.user_id
          AND n.archived_at IS NULL
      ) THEN
        INSERT INTO public.notifications (
          tenant_id,
          branch_id,
          recipient_user_id,
          actor_user_id,
          type,
          title,
          message,
          entity_type,
          entity_id,
          action_url,
          metadata
        )
        VALUES (
          v_tenant,
          r.branch_id,
          a.user_id,
          r.user_id,
          'seller_inactive',
          'Vendedor sin actividad',
          v_message,
          'seller',
          v_entity_id,
          '/app/vendors',
          jsonb_build_object(
            'seller_key', r.seller_key,
            'seller_name', r.seller_name,
            'user_id', r.user_id,
            'staff_id', r.staff_id,
            'branch_id', r.branch_id,
            'branch_name', r.branch_name,
            'stale_assigned_leads', r.stale_assigned_leads,
            'inactivity_hours', v_hours,
            'last_engagement_at', r.last_engagement_at
          )
        );
        v_notif_count := v_notif_count + 1;
      END IF;
    END LOOP;
  END LOOP;

  notifications_created := v_notif_count;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.sync_seller_inactivity_notifications() IS
  'Crea notificaciones seller_inactive para admin y jefe_sucursal (mismo tenant/sucursal). '
  'Idempotente por (recipient, entity_id) mientras no estén archivadas.';

REVOKE ALL ON FUNCTION public.sync_seller_inactivity_notifications() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_seller_inactivity_notifications() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_seller_inactivity_notifications() TO service_role;
