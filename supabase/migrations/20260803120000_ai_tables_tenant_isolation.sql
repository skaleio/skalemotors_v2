-- ============================================================================
-- MIGRACION: Recrear tablas AI + ChileAutos con tenant_id nativo + RLS restrictivo
-- Las migraciones originales (20260801, 20260802, 20260602) se subsumen aquí
-- para proyectos donde las tablas no existían previamente en producción.
-- Regla ABSOLUTA: no tocar datos de hessen@test.io (legacy_protected)
-- ============================================================================

-- === ai_conversations ===
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  tenant_id uuid REFERENCES public.tenants(id),
  title text NOT NULL DEFAULT 'Nueva conversación',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON public.ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_branch_id ON public.ai_conversations(branch_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_tenant_id ON public.ai_conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_updated_at ON public.ai_conversations(updated_at DESC);

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_conversations_select ON public.ai_conversations;
CREATE POLICY ai_conversations_select ON public.ai_conversations FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR exists (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS ai_conversations_insert ON public.ai_conversations;
CREATE POLICY ai_conversations_insert ON public.ai_conversations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS ai_conversations_update ON public.ai_conversations;
CREATE POLICY ai_conversations_update ON public.ai_conversations FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS ai_conversations_delete ON public.ai_conversations;
CREATE POLICY ai_conversations_delete ON public.ai_conversations FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS tenant_restrict_ai_conversations ON public.ai_conversations;
CREATE POLICY tenant_restrict_ai_conversations ON public.ai_conversations
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR tenant_id = public.current_tenant_id()
    OR (tenant_id IS NULL AND branch_id IN (SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id()))
  );

CREATE OR REPLACE FUNCTION public.set_updated_at_ai_conversations()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS ai_conversations_updated_at ON public.ai_conversations;
CREATE TRIGGER ai_conversations_updated_at
  BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_ai_conversations();

-- === ai_messages ===
CREATE TABLE IF NOT EXISTS public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id),
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  tokens_used int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id ON public.ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_tenant_id ON public.ai_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_created_at ON public.ai_messages(created_at);

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_messages_select ON public.ai_messages;
CREATE POLICY ai_messages_select ON public.ai_messages FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.ai_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS ai_messages_insert ON public.ai_messages;
CREATE POLICY ai_messages_insert ON public.ai_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.ai_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS tenant_restrict_ai_messages ON public.ai_messages;
CREATE POLICY tenant_restrict_ai_messages ON public.ai_messages
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR tenant_id = public.current_tenant_id()
    OR (tenant_id IS NULL AND conversation_id IN (SELECT id FROM public.ai_conversations WHERE tenant_id = public.current_tenant_id()))
  );

-- === ai_usage_logs ===
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  tenant_id uuid REFERENCES public.tenants(id),
  feature text NOT NULL,
  tokens_input int,
  tokens_output int,
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_id ON public.ai_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_branch_id ON public.ai_usage_logs(branch_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_tenant_id ON public.ai_usage_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at ON public.ai_usage_logs(created_at DESC);

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_usage_logs_select ON public.ai_usage_logs;
CREATE POLICY ai_usage_logs_select ON public.ai_usage_logs FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR branch_id IN (SELECT branch_id FROM public.users WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS ai_usage_logs_insert ON public.ai_usage_logs;
CREATE POLICY ai_usage_logs_insert ON public.ai_usage_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS tenant_restrict_ai_usage_logs ON public.ai_usage_logs;
CREATE POLICY tenant_restrict_ai_usage_logs ON public.ai_usage_logs
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR tenant_id = public.current_tenant_id()
    OR (tenant_id IS NULL AND branch_id IN (SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id()))
  );

-- === ai_branch_brain ===
CREATE TABLE IF NOT EXISTS public.ai_branch_brain (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id),
  snapshot_text text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_branch_brain_branch_id_key UNIQUE (branch_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_branch_brain_branch_id ON public.ai_branch_brain(branch_id);
CREATE INDEX IF NOT EXISTS idx_ai_branch_brain_tenant_id ON public.ai_branch_brain(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_branch_brain_updated_at ON public.ai_branch_brain(updated_at DESC);

ALTER TABLE public.ai_branch_brain ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_branch_brain_select ON public.ai_branch_brain;
CREATE POLICY ai_branch_brain_select ON public.ai_branch_brain FOR SELECT TO authenticated
  USING (
    branch_id IN (SELECT branch_id FROM public.users WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS ai_branch_brain_insert ON public.ai_branch_brain;
CREATE POLICY ai_branch_brain_insert ON public.ai_branch_brain FOR INSERT TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS ai_branch_brain_update ON public.ai_branch_brain;
CREATE POLICY ai_branch_brain_update ON public.ai_branch_brain FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS tenant_restrict_ai_branch_brain ON public.ai_branch_brain;
CREATE POLICY tenant_restrict_ai_branch_brain ON public.ai_branch_brain
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR tenant_id = public.current_tenant_id()
    OR (tenant_id IS NULL AND branch_id IN (SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id()))
  );

-- === chileautos_saved_listings ===
CREATE TABLE IF NOT EXISTS public.chileautos_saved_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_id uuid REFERENCES public.tenants(id),
  source text NOT NULL DEFAULT 'chileautos',
  listing_id text,
  listing_url text,
  title text,
  make text,
  model text,
  price_text text,
  state text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chileautos_saved_branch ON public.chileautos_saved_listings(branch_id);
CREATE INDEX IF NOT EXISTS idx_chileautos_saved_user ON public.chileautos_saved_listings(user_id);
CREATE INDEX IF NOT EXISTS idx_chileautos_saved_tenant_id ON public.chileautos_saved_listings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chileautos_saved_created ON public.chileautos_saved_listings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chileautos_saved_make_model ON public.chileautos_saved_listings(make, model);

ALTER TABLE public.chileautos_saved_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios autenticados pueden ver guardados de su sucursal" ON public.chileautos_saved_listings;
DROP POLICY IF EXISTS "Usuarios autenticados pueden insertar guardados" ON public.chileautos_saved_listings;
DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar sus guardados" ON public.chileautos_saved_listings;
DROP POLICY IF EXISTS chileautos_saved_select ON public.chileautos_saved_listings;
DROP POLICY IF EXISTS chileautos_saved_insert ON public.chileautos_saved_listings;
DROP POLICY IF EXISTS chileautos_saved_delete ON public.chileautos_saved_listings;

CREATE POLICY chileautos_saved_select ON public.chileautos_saved_listings FOR SELECT TO authenticated
  USING (branch_id IS NULL OR branch_id IN (SELECT branch_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY chileautos_saved_insert ON public.chileautos_saved_listings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY chileautos_saved_delete ON public.chileautos_saved_listings FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS tenant_restrict_chileautos_saved ON public.chileautos_saved_listings;
CREATE POLICY tenant_restrict_chileautos_saved ON public.chileautos_saved_listings
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR tenant_id = public.current_tenant_id()
    OR (tenant_id IS NULL AND (branch_id IS NULL OR branch_id IN (SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id())))
  );
