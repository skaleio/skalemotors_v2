-- Patente (PPU) y vendedor/consignatario asignado al vehículo (sin borrar datos).
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS patente text,
  ADD COLUMN IF NOT EXISTS consignatario_staff_id uuid REFERENCES public.branch_sales_staff(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vehicles_patente ON public.vehicles(patente) WHERE patente IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vehicles_consignatario_staff ON public.vehicles(consignatario_staff_id) WHERE consignatario_staff_id IS NOT NULL;

COMMENT ON COLUMN public.vehicles.patente IS 'Patente (PPU) u otra placa';
COMMENT ON COLUMN public.vehicles.consignatario_staff_id IS 'Vendedor asignado (tabla branch_sales_staff / Gestión de vendedores)';
