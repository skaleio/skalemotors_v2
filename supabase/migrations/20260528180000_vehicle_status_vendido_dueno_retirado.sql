-- Nuevos estados de inventario: vendido por dueño (salida sin venta por la automotora) y retirado.

UPDATE public.vehicles
SET status = 'disponible'
WHERE status IS NULL
   OR status NOT IN (
     'disponible',
     'reservado',
     'vendido',
     'vendido_por_dueno',
     'retirado',
     'en_reparacion',
     'fuera_de_servicio'
   );

ALTER TABLE public.vehicles
  DROP CONSTRAINT IF EXISTS vehicles_status_check;

ALTER TABLE public.vehicles
  ADD CONSTRAINT vehicles_status_check
  CHECK (
    status IN (
      'disponible',
      'reservado',
      'vendido',
      'vendido_por_dueno',
      'retirado',
      'en_reparacion',
      'fuera_de_servicio'
    )
  );

COMMENT ON CONSTRAINT vehicles_status_check ON public.vehicles IS
  'Estados de stock: disponible, reservado, vendido, vendido_por_dueno, retirado, en_reparacion, fuera_de_servicio';
