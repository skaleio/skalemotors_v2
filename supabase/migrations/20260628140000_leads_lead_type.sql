-- Tipo de lead: distingue oportunidades de venta vs. consignación.
-- Default 'venta' para no romper leads existentes; el usuario corrige los de consignación.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS lead_type text NOT NULL DEFAULT 'venta'
    CHECK (lead_type IN ('venta', 'consignacion'));

COMMENT ON COLUMN public.leads.lead_type IS 'Tipo de lead: venta | consignacion';
