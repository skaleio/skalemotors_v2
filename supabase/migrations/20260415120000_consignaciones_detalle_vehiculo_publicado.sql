-- Detalle de vehículo y flag de publicación en consignaciones (additive; no borra filas).
ALTER TABLE public.consignaciones
  ADD COLUMN IF NOT EXISTS carroceria text,
  ADD COLUMN IF NOT EXISTS motor text,
  ADD COLUMN IF NOT EXISTS transmision text,
  ADD COLUMN IF NOT EXISTS combustible text,
  ADD COLUMN IF NOT EXISTS publicado boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.consignaciones.carroceria IS 'Tipo de carrocería (SUV, sedán, etc.)';
COMMENT ON COLUMN public.consignaciones.motor IS 'Motor o cilindrada';
COMMENT ON COLUMN public.consignaciones.transmision IS 'Tipo de transmisión';
COMMENT ON COLUMN public.consignaciones.combustible IS 'Tipo de combustible';
COMMENT ON COLUMN public.consignaciones.publicado IS 'Vehículo publicado en portales u oferta';

-- Alinear filas que ya tenían etiqueta "Publicado"
UPDATE public.consignaciones
SET publicado = true
WHERE label = 'Publicado' AND publicado = false;
