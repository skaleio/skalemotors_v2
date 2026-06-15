-- ============================================================================
-- Hardening seguridad (2026-06-14) — infraestructura de rate limiting
-- Tabla + función fixed-window usada por Edge Functions (helper rateLimit.ts)
-- y por el RPC anon de booking (formula_book_appointment).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Tabla de contadores fixed-window. Solo service_role / funciones SECURITY
-- DEFINER acceden (RLS niega a authenticated/anon → limpia rls_enabled_no_policy).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.edge_rate_limits (
  identifier   text        NOT NULL,
  route        text        NOT NULL,
  window_start timestamptz NOT NULL,
  count        integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (identifier, route, window_start)
);

ALTER TABLE public.edge_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS edge_rate_limits_no_client_access ON public.edge_rate_limits;
CREATE POLICY edge_rate_limits_no_client_access ON public.edge_rate_limits
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.edge_rate_limits IS
  'Contadores fixed-window para rate limiting. Acceso exclusivo de service_role y funciones SECURITY DEFINER (check_rate_limit).';

-- ---------------------------------------------------------------------------
-- check_rate_limit: incrementa el contador de la ventana actual y devuelve
-- true si el request está dentro del límite (count <= p_max), false si excede.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_identifier text,
  p_route text,
  p_max integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_window timestamptz;
  v_count  integer;
BEGIN
  IF p_identifier IS NULL OR p_route IS NULL OR p_max IS NULL OR p_window_seconds IS NULL THEN
    RETURN true; -- fail-open ante parámetros inválidos (no bloquear tráfico legítimo)
  END IF;

  v_window := to_timestamp(
    floor(extract(epoch FROM clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  INSERT INTO public.edge_rate_limits (identifier, route, window_start, count)
  VALUES (p_identifier, p_route, v_window, 1)
  ON CONFLICT (identifier, route, window_start)
  DO UPDATE SET count = public.edge_rate_limits.count + 1
  RETURNING count INTO v_count;

  -- Limpieza oportunista de ventanas viejas (>1 día).
  DELETE FROM public.edge_rate_limits WHERE window_start < now() - interval '1 day';

  RETURN v_count <= p_max;
END;
$function$;

REVOKE ALL ON FUNCTION public.check_rate_limit(text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, text, integer, integer) TO service_role;

-- ---------------------------------------------------------------------------
-- formula_book_appointment: añade rate-limit anti-spam por email (5/hora).
-- Cuerpo idéntico al productivo + guard al inicio. El límite por IP se aplica
-- en el borde (proxy/Edge); acá cubrimos el abuso por reuso de email.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.formula_book_appointment(
  p_resource_slug text,
  p_starts_at timestamp with time zone,
  p_nombre text,
  p_email text,
  p_telefono text,
  p_automotora text DEFAULT NULL::text,
  p_mensaje text DEFAULT NULL::text,
  p_origen text DEFAULT 'landing-meta'::text,
  p_ingresos_mensuales text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_resource formula_calendar_resources%ROWTYPE;
  v_lead_id uuid;
  v_appointment_id uuid;
  v_ends_at timestamptz;
BEGIN
  IF p_ingresos_mensuales IS NULL
    OR p_ingresos_mensuales NOT IN ('500_1000', '1000_2000', '2000_3000')
  THEN
    RAISE EXCEPTION 'INVALID_INCOME_RANGE';
  END IF;

  -- Anti-spam: máx 5 reservas por email por hora.
  IF NOT public.check_rate_limit('booking:' || lower(trim(p_email)), 'formula_book_appointment', 5, 3600) THEN
    RAISE EXCEPTION 'RATE_LIMITED';
  END IF;

  SELECT * INTO v_resource
  FROM formula_calendar_resources
  WHERE slug = p_resource_slug;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RESOURCE_NOT_FOUND';
  END IF;

  v_ends_at := p_starts_at + make_interval(mins => v_resource.slot_duration_minutes);

  IF NOT EXISTS (
    SELECT 1
    FROM formula_get_available_slots(p_resource_slug, (p_starts_at AT TIME ZONE v_resource.timezone)::date) s
    WHERE s.starts_at = p_starts_at
      AND s.ends_at = v_ends_at
  ) THEN
    RAISE EXCEPTION 'SLOT_NOT_AVAILABLE';
  END IF;

  INSERT INTO formula_leads (
    nombre,
    email,
    telefono,
    automotora,
    mensaje,
    origen,
    ingresos_mensuales,
    stage
  )
  VALUES (
    trim(p_nombre),
    lower(trim(p_email)),
    trim(p_telefono),
    nullif(trim(p_automotora), ''),
    nullif(trim(p_mensaje), ''),
    p_origen,
    p_ingresos_mensuales,
    'nuevo'
  )
  RETURNING id INTO v_lead_id;

  BEGIN
    INSERT INTO formula_appointments (resource_id, lead_id, starts_at, ends_at, source)
    VALUES (v_resource.id, v_lead_id, p_starts_at, v_ends_at, p_origen)
    RETURNING id INTO v_appointment_id;
  EXCEPTION
    WHEN exclusion_violation THEN
      RAISE EXCEPTION 'SLOT_TAKEN';
  END;

  RETURN jsonb_build_object(
    'lead_id', v_lead_id,
    'appointment_id', v_appointment_id,
    'starts_at', p_starts_at,
    'ends_at', v_ends_at,
    'timezone', v_resource.timezone,
    'ingresos_mensuales', p_ingresos_mensuales,
    'stage', 'nuevo'
  );
END;
$function$;

-- Mantener grants existentes (booking público).
REVOKE ALL ON FUNCTION public.formula_book_appointment(text, timestamptz, text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.formula_book_appointment(text, timestamptz, text, text, text, text, text, text, text) TO anon, authenticated, service_role;
