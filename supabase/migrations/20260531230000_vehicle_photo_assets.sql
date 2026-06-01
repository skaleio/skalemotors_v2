-- Álbumes de fotos por vehículo (fotógrafo/admin).
-- Mantiene `vehicles.images` como flatten para compatibilidad con vitrina pública.

CREATE TABLE IF NOT EXISTS public.vehicle_photo_assets (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  album      text NOT NULL,
  url        text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_cover   boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vehicle_photo_assets_vehicle_idx
  ON public.vehicle_photo_assets (vehicle_id);

CREATE INDEX IF NOT EXISTS vehicle_photo_assets_tenant_vehicle_album_idx
  ON public.vehicle_photo_assets (tenant_id, vehicle_id, album);

ALTER TABLE public.vehicle_photo_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_restrict_vehicle_photo_assets ON public.vehicle_photo_assets
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.current_is_legacy_protected() OR tenant_id = public.current_tenant_id());

CREATE POLICY vehicle_photo_assets_select ON public.vehicle_photo_assets
  FOR SELECT TO authenticated
  USING (public.current_is_legacy_protected() OR tenant_id = public.current_tenant_id());

CREATE POLICY vehicle_photo_assets_insert ON public.vehicle_photo_assets
  FOR INSERT TO authenticated
  WITH CHECK (public.current_is_legacy_protected() OR tenant_id = public.current_tenant_id());

CREATE POLICY vehicle_photo_assets_update ON public.vehicle_photo_assets
  FOR UPDATE TO authenticated
  USING (public.current_is_legacy_protected() OR tenant_id = public.current_tenant_id())
  WITH CHECK (public.current_is_legacy_protected() OR tenant_id = public.current_tenant_id());

CREATE POLICY vehicle_photo_assets_delete ON public.vehicle_photo_assets
  FOR DELETE TO authenticated
  USING (public.current_is_legacy_protected() OR tenant_id = public.current_tenant_id());

CREATE TRIGGER trg_vehicle_photo_assets_autofill_tenant
  BEFORE INSERT ON public.vehicle_photo_assets
  FOR EACH ROW EXECUTE FUNCTION public.autofill_tenant_branch_from_user();

CREATE TRIGGER trg_vehicle_photo_assets_updated_at
  BEFORE UPDATE ON public.vehicle_photo_assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.vehicle_photo_assets IS
  'Fotos por vehículo organizadas por álbum. Se usa para UI interna; la vitrina pública consume vehicles.images (flatten).';

