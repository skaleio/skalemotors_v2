-- WhatsApp SaaS: credenciales por sucursal (multi-tenant), sin token en lecturas cliente.
-- Reemplaza el piloto de META_ACCESS_TOKEN global por inbox + tabla de secretos.

-- ---------------------------------------------------------------------------
-- 1) Estado de conexión en whatsapp_inboxes (metadatos públicos)
-- ---------------------------------------------------------------------------
ALTER TABLE public.whatsapp_inboxes
  ADD COLUMN IF NOT EXISTS waba_id text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'disconnected',
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS connected_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS connected_at timestamptz;

ALTER TABLE public.whatsapp_inboxes
  DROP CONSTRAINT IF EXISTS whatsapp_inboxes_status_check;

ALTER TABLE public.whatsapp_inboxes
  ADD CONSTRAINT whatsapp_inboxes_status_check
  CHECK (status IN ('disconnected', 'pending', 'active', 'error'));

COMMENT ON COLUMN public.whatsapp_inboxes.status IS
  'Estado de conexión Meta: disconnected | pending | active | error';

-- Un solo inbox activo por sucursal
CREATE UNIQUE INDEX IF NOT EXISTS uq_whatsapp_inboxes_active_branch
  ON public.whatsapp_inboxes (branch_id)
  WHERE is_active = true;

-- ---------------------------------------------------------------------------
-- 2) Secretos (solo Edge Functions / service_role)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_inbox_credentials (
  inbox_id uuid PRIMARY KEY REFERENCES public.whatsapp_inboxes(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  token_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.whatsapp_inbox_credentials IS
  'Token Meta por inbox. Sin políticas para authenticated: solo service_role.';

ALTER TABLE public.whatsapp_inbox_credentials ENABLE ROW LEVEL SECURITY;

-- Sin políticas TO authenticated → el cliente no puede leer tokens.

CREATE OR REPLACE FUNCTION public.trg_whatsapp_inbox_credentials_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_whatsapp_inbox_credentials_updated_at ON public.whatsapp_inbox_credentials;
CREATE TRIGGER trg_whatsapp_inbox_credentials_updated_at
  BEFORE UPDATE ON public.whatsapp_inbox_credentials
  FOR EACH ROW EXECUTE FUNCTION public.trg_whatsapp_inbox_credentials_updated_at();

-- ---------------------------------------------------------------------------
-- 3) Vista segura para UI (sin access_token)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.whatsapp_inboxes_public
WITH (security_invoker = true)
AS
SELECT
  id,
  tenant_id,
  branch_id,
  provider,
  provider_phone_number_id,
  display_number,
  waba_id,
  status,
  last_error,
  connected_by,
  connected_at,
  is_active,
  created_at,
  updated_at
FROM public.whatsapp_inboxes;

COMMENT ON VIEW public.whatsapp_inboxes_public IS
  'Inbox WhatsApp sin secretos; usar en lecturas desde el cliente.';

GRANT SELECT ON public.whatsapp_inboxes_public TO authenticated;

-- ---------------------------------------------------------------------------
-- 4) Permisos de gestión: gerente puede insertar/actualizar inboxes (connect vía Edge)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS whatsapp_inboxes_insert_auth ON public.whatsapp_inboxes;
CREATE POLICY whatsapp_inboxes_insert_auth ON public.whatsapp_inboxes
  FOR INSERT TO authenticated
  WITH CHECK (
    (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected())
    AND public.current_user_role() IN ('admin', 'gerente', 'jefe_sucursal')
  );

DROP POLICY IF EXISTS whatsapp_inboxes_update_auth ON public.whatsapp_inboxes;
CREATE POLICY whatsapp_inboxes_update_auth ON public.whatsapp_inboxes
  FOR UPDATE TO authenticated
  USING (
    (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected())
    AND public.current_user_role() IN ('admin', 'gerente', 'jefe_sucursal')
  );

DROP POLICY IF EXISTS whatsapp_inboxes_select_auth ON public.whatsapp_inboxes;
CREATE POLICY whatsapp_inboxes_select_auth ON public.whatsapp_inboxes
  FOR SELECT TO authenticated
  USING (
    (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected())
    AND public.current_user_role() IN ('admin', 'gerente', 'jefe_sucursal', 'financiero', 'vendedor', 'jefe_jefe')
  );

UPDATE public.whatsapp_inboxes
SET status = 'active'
WHERE is_active = true AND status = 'disconnected';
