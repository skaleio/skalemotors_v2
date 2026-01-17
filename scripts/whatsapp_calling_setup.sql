-- Script para configurar WhatsApp Calling API en SKALE MOTORS
-- Ejecuta este script en Supabase Dashboard → SQL Editor

-- Tabla para almacenar llamadas de WhatsApp
CREATE TABLE IF NOT EXISTS public.whatsapp_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id TEXT UNIQUE NOT NULL, -- ID único de la llamada del proveedor
  contact_phone TEXT NOT NULL,
  contact_name TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('entrante', 'saliente')),
  status TEXT NOT NULL CHECK (status IN ('iniciando', 'en_curso', 'completada', 'fallida', 'cancelada', 'no_contestada')),
  duration_seconds INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  recording_url TEXT,
  transcript TEXT,
  user_id UUID REFERENCES auth.users(id),
  branch_id UUID REFERENCES public.branches(id),
  inbox_id UUID REFERENCES public.whatsapp_inboxes(id),
  lead_id UUID REFERENCES public.leads(id),
  notes TEXT,
  provider_call_id TEXT, -- ID del proveedor (YCloud, Twilio, etc.)
  raw_payload JSONB, -- Payload completo del webhook
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_whatsapp_calls_contact_phone ON public.whatsapp_calls(contact_phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_calls_branch_id ON public.whatsapp_calls(branch_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_calls_user_id ON public.whatsapp_calls(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_calls_status ON public.whatsapp_calls(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_calls_created_at ON public.whatsapp_calls(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_calls_call_id ON public.whatsapp_calls(call_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_calls_provider_call_id ON public.whatsapp_calls(provider_call_id);

-- RLS Policies
ALTER TABLE public.whatsapp_calls ENABLE ROW LEVEL SECURITY;

-- Policy: Los usuarios solo ven llamadas de su sucursal
CREATE POLICY "Users can view calls from their branch"
  ON public.whatsapp_calls FOR SELECT
  USING (
    branch_id IN (
      SELECT branch_id FROM public.users WHERE id = auth.uid()
    )
    OR branch_id IS NULL
  );

-- Policy: Los usuarios pueden crear llamadas
CREATE POLICY "Users can create calls"
  ON public.whatsapp_calls FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Los usuarios pueden actualizar llamadas de su sucursal
CREATE POLICY "Users can update calls from their branch"
  ON public.whatsapp_calls FOR UPDATE
  USING (
    branch_id IN (
      SELECT branch_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_whatsapp_calls_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_whatsapp_calls_updated_at ON public.whatsapp_calls;
CREATE TRIGGER update_whatsapp_calls_updated_at
  BEFORE UPDATE ON public.whatsapp_calls
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_calls_updated_at();

-- Comentarios para documentación
COMMENT ON TABLE public.whatsapp_calls IS 'Almacena todas las llamadas realizadas y recibidas a través de WhatsApp Business Calling API';
COMMENT ON COLUMN public.whatsapp_calls.call_id IS 'ID único de la llamada proporcionado por el proveedor (YCloud, Twilio, etc.)';
COMMENT ON COLUMN public.whatsapp_calls.provider_call_id IS 'ID adicional del proveedor para referencia';
COMMENT ON COLUMN public.whatsapp_calls.raw_payload IS 'Payload completo del webhook para auditoría y debugging';
