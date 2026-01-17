-- =====================================================
-- WhatsApp (YCloud) - Centro de Mensajes por Teléfono
-- SKALE MOTORS
-- =====================================================
-- Objetivo:
-- 1) Crear "inboxes" de WhatsApp por sucursal para mapear webhooks entrantes
-- 2) Extender public.messages para soportar WhatsApp por teléfono (contact_phone)
-- 3) Agregar índices y políticas RLS mínimas para lectura segura
--
-- IMPORTANTE:
-- - Ejecuta este script en el SQL Editor de Supabase.
-- - Luego registra tu inbox (whatsapp_inboxes) con el provider_phone_number_id de YCloud.

-- =====================================================
-- 1) Inboxes de WhatsApp
-- =====================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_inboxes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'ycloud',
  provider_phone_number_id TEXT NOT NULL,
  display_number TEXT,
  branch_id UUID NOT NULL REFERENCES public.branches(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (provider, provider_phone_number_id)
);

ALTER TABLE public.whatsapp_inboxes ENABLE ROW LEVEL SECURITY;

-- Mantener updated_at en sync
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_whatsapp_inboxes_updated_at'
  ) THEN
    CREATE TRIGGER update_whatsapp_inboxes_updated_at
    BEFORE UPDATE ON public.whatsapp_inboxes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- =====================================================
-- 2) Extender public.messages para WhatsApp por teléfono
-- =====================================================

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id),
  ADD COLUMN IF NOT EXISTS inbox_id UUID REFERENCES public.whatsapp_inboxes(id),
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS contact_name TEXT,
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_status_id TEXT,
  ADD COLUMN IF NOT EXISTS raw_payload JSONB;

-- Índices útiles (conversaciones por teléfono)
CREATE INDEX IF NOT EXISTS idx_messages_whatsapp_branch_phone_sent_at
  ON public.messages (branch_id, contact_phone, sent_at DESC)
  WHERE type = 'whatsapp';

CREATE INDEX IF NOT EXISTS idx_messages_whatsapp_inbox_phone_sent_at
  ON public.messages (inbox_id, contact_phone, sent_at DESC)
  WHERE type = 'whatsapp';

-- Deduplicación de mensajes externos (si el proveedor entrega IDs estables)
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_provider_message_unique
  ON public.messages (provider, provider_message_id)
  WHERE provider IS NOT NULL AND provider_message_id IS NOT NULL;

-- =====================================================
-- 3) RLS: lectura por sucursal (admins/gerentes ven todo)
-- =====================================================

-- Nota: Webhooks/Edge Functions usarán SERVICE_ROLE y pueden escribir sin depender de estas políticas.

DROP POLICY IF EXISTS "messages_select_branch" ON public.messages;
CREATE POLICY "messages_select_branch" ON public.messages
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND (
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND u.role IN ('admin', 'gerente')
          AND u.is_active = true
      )
      OR (
        branch_id IS NOT NULL
        AND branch_id = (
          SELECT u.branch_id FROM public.users u
          WHERE u.id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "messages_insert_outgoing_self" ON public.messages;
CREATE POLICY "messages_insert_outgoing_self" ON public.messages
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND direction = 'saliente'
    AND user_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND u.role IN ('admin', 'gerente', 'vendedor')
          AND u.is_active = true
      )
    )
  );

-- =====================================================
-- 4) RLS: whatsapp_inboxes (solo admin/gerente)
-- =====================================================

DROP POLICY IF EXISTS "whatsapp_inboxes_select_admin_manager" ON public.whatsapp_inboxes;
CREATE POLICY "whatsapp_inboxes_select_admin_manager" ON public.whatsapp_inboxes
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'gerente')
        AND u.is_active = true
    )
  );

DROP POLICY IF EXISTS "whatsapp_inboxes_manage_admin" ON public.whatsapp_inboxes;
CREATE POLICY "whatsapp_inboxes_manage_admin" ON public.whatsapp_inboxes
  FOR ALL
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'admin'
        AND u.is_active = true
    )
  )
  WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'admin'
        AND u.is_active = true
    )
  );


