-- Horario de atención de la sucursal (ej. "Lun-Vie 9:00-18:00, Sáb 9:00-13:00")
ALTER TABLE public.branches
ADD COLUMN IF NOT EXISTS opening_hours text;

COMMENT ON COLUMN public.branches.opening_hours IS 'Horario de atención (texto libre o formato acordado)';
