-- =====================================================
-- Meta WhatsApp Business Cloud API - Migración provider
-- =====================================================
-- Objetivo:
-- 1) Cambiar el DEFAULT de public.whatsapp_inboxes.provider a 'meta'
-- 2) Migrar registros existentes desde 'ycloud' a 'meta'

ALTER TABLE public.whatsapp_inboxes
  ALTER COLUMN provider SET DEFAULT 'meta';

UPDATE public.whatsapp_inboxes
SET provider = 'meta'
WHERE provider = 'ycloud';

