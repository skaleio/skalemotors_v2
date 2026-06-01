-- Aislamiento multi-tenant en consignaciones: backfill, INSERT con tenant_id,
-- autofill defensivo y eliminación de policies peligrosas (p. ej. SELECT USING true).

-- ============================================================================
-- 1) Backfill tenant_id en filas legacy
-- ============================================================================
UPDATE public.consignaciones c
SET tenant_id = b.tenant_id
FROM public.branches b
WHERE c.branch_id = b.id
  AND c.tenant_id IS NULL;

UPDATE public.consignaciones c
SET tenant_id = u.tenant_id
FROM public.users u
WHERE c.tenant_id IS NULL
  AND c.created_by = u.id
  AND u.tenant_id IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.consignaciones WHERE tenant_id IS NULL) THEN
    RAISE EXCEPTION
      'consignaciones_tenant_hardening: quedaron filas sin tenant_id. Revisar manualmente antes de continuar.';
  END IF;
END $$;

ALTER TABLE public.consignaciones
  ALTER COLUMN tenant_id SET NOT NULL;

-- ============================================================================
-- 2) Eliminar policies permisivas peligrosas / legacy sin filtro tenant
-- ============================================================================
DROP POLICY IF EXISTS "consignaciones_select_authenticated" ON public.consignaciones;
DROP POLICY IF EXISTS consignaciones_select_tenant ON public.consignaciones;
DROP POLICY IF EXISTS "Consignaciones read" ON public.consignaciones;

DROP POLICY IF EXISTS "Consignaciones delete" ON public.consignaciones;
DROP POLICY IF EXISTS "Consignaciones delete sin sucursal" ON public.consignaciones;
DROP POLICY IF EXISTS consignaciones_delete ON public.consignaciones;

DROP POLICY IF EXISTS "Consignaciones update" ON public.consignaciones;
DROP POLICY IF EXISTS "Consignaciones update sin sucursal" ON public.consignaciones;
DROP POLICY IF EXISTS consignaciones_update ON public.consignaciones;

DROP POLICY IF EXISTS "Consignaciones insert" ON public.consignaciones;
DROP POLICY IF EXISTS "Consignaciones insert sin sucursal" ON public.consignaciones;
DROP POLICY IF EXISTS consignaciones_insert ON public.consignaciones;

-- Capa restrictiva tenant (idempotente)
DROP POLICY IF EXISTS tenant_restrict_consignaciones ON public.consignaciones;
CREATE POLICY tenant_restrict_consignaciones ON public.consignaciones
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR tenant_id = public.current_tenant_id()
  );

-- ============================================================================
-- 3) INSERT: solo en el tenant del JWT y branch del usuario (si aplica)
--    Las policies SELECT/UPDATE/DELETE scoped se mantienen (20260820180000).
-- ============================================================================
CREATE POLICY consignaciones_insert ON public.consignaciones
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_is_legacy_protected()
    OR (
      tenant_id = public.current_tenant_id()
      AND (
        branch_id IS NULL
        OR branch_id IN (
          SELECT u.branch_id
          FROM public.users u
          WHERE u.id = (SELECT auth.uid())
            AND u.branch_id IS NOT NULL
        )
      )
    )
  );

-- ============================================================================
-- 4) Autofill tenant/branch desde el usuario autenticado (defensa en profundidad)
-- ============================================================================
DROP TRIGGER IF EXISTS trg_consignaciones_autofill_tenant ON public.consignaciones;
CREATE TRIGGER trg_consignaciones_autofill_tenant
  BEFORE INSERT ON public.consignaciones
  FOR EACH ROW EXECUTE FUNCTION public.autofill_tenant_branch_from_user();

-- ============================================================================
-- 5) Validar coherencia branch_id ↔ tenant_id en INSERT/UPDATE
-- ============================================================================
CREATE OR REPLACE FUNCTION public.validate_consignacion_tenant_branch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.current_is_legacy_protected() THEN
    RETURN NEW;
  END IF;

  IF NEW.tenant_id IS NULL THEN
    RAISE EXCEPTION 'consignaciones.tenant_id es obligatorio';
  END IF;

  IF NEW.tenant_id IS DISTINCT FROM public.current_tenant_id()
     AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'consignaciones: tenant_id no coincide con tu organización';
  END IF;

  IF NEW.branch_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.branches b
    WHERE b.id = NEW.branch_id
      AND b.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'consignaciones: branch_id no pertenece al tenant';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.validate_consignacion_tenant_branch() IS
  'BEFORE INSERT/UPDATE en consignaciones: tenant_id obligatorio, coherente con JWT y branch del tenant.';

DROP TRIGGER IF EXISTS trg_consignaciones_validate_tenant_branch ON public.consignaciones;
CREATE TRIGGER trg_consignaciones_validate_tenant_branch
  BEFORE INSERT OR UPDATE OF tenant_id, branch_id ON public.consignaciones
  FOR EACH ROW EXECUTE FUNCTION public.validate_consignacion_tenant_branch();

CREATE INDEX IF NOT EXISTS idx_consignaciones_tenant_branch_created
  ON public.consignaciones (tenant_id, branch_id, created_at DESC);

COMMENT ON COLUMN public.consignaciones.tenant_id IS
  'Tenant dueño del registro. NOT NULL; RLS + trigger impiden mezcla entre automotoras.';
