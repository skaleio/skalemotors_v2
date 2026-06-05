-- Nuevos tipos de cita: compra, parte de pago y consignación
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_type_check;

ALTER TABLE public.appointments ADD CONSTRAINT appointments_type_check
  CHECK (type = ANY (ARRAY[
    'test_drive'::text,
    'reunion'::text,
    'entrega'::text,
    'servicio'::text,
    'otro'::text,
    'compra_vehiculo'::text,
    'vehiculo_en_parte'::text,
    'consignacion'::text
  ]));
