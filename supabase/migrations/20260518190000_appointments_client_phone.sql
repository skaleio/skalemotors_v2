-- Teléfono de contacto del cliente/lead en la cita (independiente de lead_id)
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS client_phone text;

COMMENT ON COLUMN public.appointments.client_phone IS
  'Teléfono de contacto del cliente para la cita; puede guardarse sin lead vinculado.';
