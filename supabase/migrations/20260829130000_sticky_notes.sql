-- Notas flotantes tipo post-it (per-usuario, multi-tenant)
--  - Tabla public.sticky_notes: una fila por nota, dueña por usuario.
--  - RLS owner-only: cada usuario ve/edita/borra SOLO sus notas dentro de su tenant.
--  - Trigger SECURITY DEFINER fija user_id/tenant_id server-side (nunca confiar en el cliente).
--  - Trigger updated_at para autosave.

create extension if not exists "pgcrypto";

-- ============================================================================
-- Tabla
-- ============================================================================
create table if not exists public.sticky_notes (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  content    text not null default '',
  color      text not null default 'yellow'
             check (color in ('yellow', 'pink', 'blue', 'green', 'purple', 'orange')),
  pos_x      numeric not null default 24,
  pos_y      numeric not null default 96,
  z_index    integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sticky_notes_user on public.sticky_notes (user_id);
create index if not exists idx_sticky_notes_tenant on public.sticky_notes (tenant_id);

-- ============================================================================
-- RLS — owner-only (patrón notifications_select_own + tenant scoping)
-- ============================================================================
alter table public.sticky_notes enable row level security;

drop policy if exists sticky_notes_select_own on public.sticky_notes;
create policy sticky_notes_select_own
on public.sticky_notes
for select
to authenticated
using (
  user_id = (select auth.uid())
  and (tenant_id = public.current_tenant_id() or public.current_is_legacy_protected())
);

drop policy if exists sticky_notes_insert_own on public.sticky_notes;
create policy sticky_notes_insert_own
on public.sticky_notes
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (tenant_id = public.current_tenant_id() or public.current_is_legacy_protected())
);

drop policy if exists sticky_notes_update_own on public.sticky_notes;
create policy sticky_notes_update_own
on public.sticky_notes
for update
to authenticated
using (
  user_id = (select auth.uid())
  and (tenant_id = public.current_tenant_id() or public.current_is_legacy_protected())
)
with check (
  user_id = (select auth.uid())
  and (tenant_id = public.current_tenant_id() or public.current_is_legacy_protected())
);

drop policy if exists sticky_notes_delete_own on public.sticky_notes;
create policy sticky_notes_delete_own
on public.sticky_notes
for delete
to authenticated
using (
  user_id = (select auth.uid())
  and (tenant_id = public.current_tenant_id() or public.current_is_legacy_protected())
);

-- ============================================================================
-- Trigger: fija dueño y tenant server-side (patrón consignaciones_set_creator)
-- ============================================================================
create or replace function public.sticky_notes_set_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Ownership lo fija siempre el server; se ignora cualquier user_id/tenant_id del cliente.
  new.user_id := auth.uid();
  new.tenant_id := public.current_tenant_id();
  return new;
end;
$$;

drop trigger if exists trg_sticky_notes_set_owner on public.sticky_notes;
create trigger trg_sticky_notes_set_owner
before insert on public.sticky_notes
for each row
execute function public.sticky_notes_set_owner();

revoke execute on function public.sticky_notes_set_owner() from public;
revoke execute on function public.sticky_notes_set_owner() from anon;
revoke execute on function public.sticky_notes_set_owner() from authenticated;

-- ============================================================================
-- Trigger: updated_at en cada UPDATE (autosave)
-- ============================================================================
create or replace function public.sticky_notes_set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_sticky_notes_set_updated_at on public.sticky_notes;
create trigger trg_sticky_notes_set_updated_at
before update on public.sticky_notes
for each row
execute function public.sticky_notes_set_updated_at();

revoke execute on function public.sticky_notes_set_updated_at() from public;
revoke execute on function public.sticky_notes_set_updated_at() from anon;
revoke execute on function public.sticky_notes_set_updated_at() from authenticated;
