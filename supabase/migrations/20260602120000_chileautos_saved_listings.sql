-- Tabla para guardar listados de ChileAutos como posibles consignaciones / dueños
-- Permite métricas de "autos más comerciales" (marca/modelo más guardados)
create table if not exists public.chileautos_saved_listings (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references public.branches(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  source text not null default 'chileautos',
  listing_id text,
  listing_url text,
  title text,
  make text,
  model text,
  price_text text,
  state text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_chileautos_saved_branch on public.chileautos_saved_listings(branch_id);
create index if not exists idx_chileautos_saved_user on public.chileautos_saved_listings(user_id);
create index if not exists idx_chileautos_saved_created on public.chileautos_saved_listings(created_at desc);
create index if not exists idx_chileautos_saved_make_model on public.chileautos_saved_listings(make, model);

alter table public.chileautos_saved_listings enable row level security;

create policy "Usuarios autenticados pueden ver guardados de su sucursal"
  on public.chileautos_saved_listings for select
  to authenticated
  using (
    branch_id is null or branch_id in (
      select branch_id from public.users where id = auth.uid()
    )
  );

create policy "Usuarios autenticados pueden insertar guardados"
  on public.chileautos_saved_listings for insert
  to authenticated
  with check (auth.uid() is not null);

create policy "Usuarios autenticados pueden eliminar sus guardados"
  on public.chileautos_saved_listings for delete
  to authenticated
  using (user_id = auth.uid());

comment on table public.chileautos_saved_listings is 'Listados de ChileAutos guardados como posibles consignaciones; base para métricas de autos más comerciales.';
