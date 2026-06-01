-- Plantillas de documentos por tenant (cláusulas legales y configuración de layout)

CREATE TABLE IF NOT EXISTS public.document_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id     UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  type          TEXT NOT NULL CHECK (type IN ('contrato_venta', 'contrato_consignacion')),
  name          TEXT NOT NULL,
  is_default    BOOLEAN NOT NULL DEFAULT false,
  clauses       JSONB NOT NULL DEFAULT '[]'::jsonb,
  settings      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_restrict_document_templates ON public.document_templates
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.current_is_legacy_protected() OR tenant_id = public.current_tenant_id());

CREATE POLICY document_templates_select ON public.document_templates
  FOR SELECT TO authenticated
  USING (public.current_is_legacy_protected() OR tenant_id = public.current_tenant_id());

CREATE POLICY document_templates_insert ON public.document_templates
  FOR INSERT TO authenticated
  WITH CHECK (public.current_is_legacy_protected() OR tenant_id = public.current_tenant_id());

CREATE POLICY document_templates_update ON public.document_templates
  FOR UPDATE TO authenticated
  USING (public.current_is_legacy_protected() OR tenant_id = public.current_tenant_id());

CREATE POLICY document_templates_delete ON public.document_templates
  FOR DELETE TO authenticated
  USING (
    (public.current_is_legacy_protected() OR tenant_id = public.current_tenant_id())
    AND public.current_user_role() IN ('admin', 'gerente', 'jefe_jefe')
  );

CREATE INDEX IF NOT EXISTS idx_document_templates_tenant_type
  ON public.document_templates(tenant_id, type);

CREATE UNIQUE INDEX IF NOT EXISTS idx_document_templates_default_per_type
  ON public.document_templates(tenant_id, type)
  WHERE is_default = true AND branch_id IS NULL;

CREATE TRIGGER trg_document_templates_updated_at
  BEFORE UPDATE ON public.document_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_documents_updated_at();

-- Campos extra en documents + vínculo a plantilla
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.document_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS layout_settings JSONB,
  ADD COLUMN IF NOT EXISTS min_sale_price NUMERIC,
  ADD COLUMN IF NOT EXISTS vehicle_motor TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_chasis TEXT;

CREATE INDEX IF NOT EXISTS idx_documents_vehicle_id_type
  ON public.documents(vehicle_id, type)
  WHERE vehicle_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documents_template_id
  ON public.documents(template_id);
