create table if not exists public.vehicle_appraisals (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references public.branches(id) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  patente text not null,
  marca text,
  modelo text,
  anio integer,
  motor text,
  combustible text,
  precio_minimo bigint,
  precio_promedio bigint,
  precio_maximo bigint,
  precio_mediana bigint,
  total_muestras integer,
  confianza text,
  muestras jsonb,
  uf_valor numeric,
  created_at timestamptz not null default now()
);

create index if not exists idx_vehicle_appraisals_patente
  on public.vehicle_appraisals(patente);

create index if not exists idx_vehicle_appraisals_branch_id
  on public.vehicle_appraisals(branch_id);

create index if not exists idx_vehicle_appraisals_created_at
  on public.vehicle_appraisals(created_at desc);

alter table public.vehicle_appraisals enable row level security;

create policy "Usuarios autenticados pueden ver tasaciones de su sucursal o admin"
  on public.vehicle_appraisals
  for select
  to authenticated
  using (
    branch_id in (
      select branch_id
      from public.users
      where id = auth.uid()
    )
    or exists (
      select 1
      from public.users
      where id = auth.uid()
        and role = 'admin'
    )
  );

create policy "Usuarios autenticados pueden insertar tasaciones de su sucursal o admin"
  on public.vehicle_appraisals
  for insert
  to authenticated
  with check (
    branch_id in (
      select branch_id
      from public.users
      where id = auth.uid()
    )
    or exists (
      select 1
      from public.users
      where id = auth.uid()
        and role = 'admin'
    )
  );

create policy "Usuarios autenticados pueden actualizar tasaciones de su sucursal o admin"
  on public.vehicle_appraisals
  for update
  to authenticated
  using (
    branch_id in (
      select branch_id
      from public.users
      where id = auth.uid()
    )
    or exists (
      select 1
      from public.users
      where id = auth.uid()
        and role = 'admin'
    )
  )
  with check (
    branch_id in (
      select branch_id
      from public.users
      where id = auth.uid()
    )
    or exists (
      select 1
      from public.users
      where id = auth.uid()
        and role = 'admin'
    )
  );

create policy "Usuarios autenticados pueden eliminar tasaciones de su sucursal o admin"
  on public.vehicle_appraisals
  for delete
  to authenticated
  using (
    branch_id in (
      select branch_id
      from public.users
      where id = auth.uid()
    )
    or exists (
      select 1
      from public.users
      where id = auth.uid()
        and role = 'admin'
    )
  );

comment on table public.vehicle_appraisals is 'Cache de tasaciones vehiculares obtenidas desde fuentes externas para reducir scraping repetido.';
