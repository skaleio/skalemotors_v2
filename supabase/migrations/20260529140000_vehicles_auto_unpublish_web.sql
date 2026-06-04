-- Al pasar a un estado terminal, el vehículo deja de estar publicado en la vitrina.

CREATE OR REPLACE FUNCTION public.vehicles_clear_publicado_web_on_terminal_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IN (
    'vendido',
    'vendido_por_dueno',
    'retirado',
    'en_reparacion',
    'fuera_de_servicio'
  ) THEN
    NEW.publicado_web := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vehicles_clear_publicado_web_on_status ON public.vehicles;

CREATE TRIGGER trg_vehicles_clear_publicado_web_on_status
  BEFORE INSERT OR UPDATE OF status ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.vehicles_clear_publicado_web_on_terminal_status();

COMMENT ON FUNCTION public.vehicles_clear_publicado_web_on_terminal_status() IS
  'Si el vehículo pasa a vendido/retirado/reparación/fuera de servicio, publicado_web queda en false.';
