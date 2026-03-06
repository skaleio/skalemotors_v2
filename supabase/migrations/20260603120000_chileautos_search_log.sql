-- Registro de búsquedas en Búsqueda de Autos para métricas "modelos más buscados" = más comerciales
create table if not exists public.chileautos_search_log (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references public.branches(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  search_keyword text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_chileautos_search_log_branch on public.chileautos_search_log(branch_id);
create index if not exists idx_chileautos_search_log_created on public.chileautos_search_log(created_at desc);
create index if not exists idx_chileautos_search_log_keyword on public.chileautos_search_log(search_keyword);

alter table public.chileautos_search_log enable row level security;

create policy "Usuarios autenticados pueden ver búsquedas de su sucursal"
  on public.chileautos_search_log for select
  to authenticated
  using (
    branch_id is null or branch_id in (
      select branch_id from public.users where id = auth.uid()
    )
  );

create policy "Usuarios autenticados pueden insertar búsquedas"
  on public.chileautos_search_log for insert
  to authenticated
  with check (auth.uid() is not null);

comment on table public.chileautos_search_log is 'Log de búsquedas en Búsqueda de Autos; métricas por modelo más buscado (más comercial).';
