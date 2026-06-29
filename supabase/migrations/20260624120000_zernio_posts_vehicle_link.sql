-- Vincula cada post de Zernio con el vehículo del inventario publicado (opcional).
-- Permite filtrar "autos disponibles aún no posteados" en el selector del fotógrafo.

alter table public.zernio_posts
  add column if not exists vehicle_id uuid references public.vehicles(id) on delete set null;

-- Acelera el filtro de "ya posteados" por tenant/scope.
create index if not exists idx_zernio_posts_vehicle
  on public.zernio_posts (tenant_id, scope, vehicle_id)
  where vehicle_id is not null;
