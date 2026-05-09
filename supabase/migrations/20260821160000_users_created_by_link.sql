-- Vínculo "creador del user" + scope de consignaciones por equipo creado
-- (no por sucursal). Cierra issue #9 a nivel modelo.
--
-- Cambios:
-- 1. Nueva columna users.created_by_user_id (FK a users) para identificar al
--    admin que invitó/creó cada user.
-- 2. Backfill: a cada user no-admin / no-jefe_jefe se le asigna el admin más
--    antiguo de su mismo branch como creador.
-- 3. accept_invitation guarda created_by_user_id = invitations.invited_by.
-- 4. RLS de consignaciones reescrita: admin ve solo los users que él creó +
--    las suyas. jefe_jefe sigue viendo todo el tenant. Resto solo lo suyo.

-- ============================================================================
-- 1) Columna + index
-- ============================================================================
alter table public.users
  add column if not exists created_by_user_id uuid references public.users(id) on delete set null;

create index if not exists users_created_by_user_id_idx
  on public.users(created_by_user_id)
  where created_by_user_id is not null;

comment on column public.users.created_by_user_id is
  'Admin que invitó/creó este user. Define el equipo en RLS de consignaciones.';

-- ============================================================================
-- 2) Backfill: vendedor / financiero / jefe_sucursal / inventario / servicio
--    sin creador → el admin más antiguo de su mismo branch
-- ============================================================================
update public.users u
set created_by_user_id = (
  select admin_u.id
  from public.users admin_u
  where admin_u.tenant_id = u.tenant_id
    and admin_u.branch_id = u.branch_id
    and admin_u.role = 'admin'
    and coalesce(admin_u.is_active, true) = true
  order by admin_u.created_at asc nulls last
  limit 1
)
where u.role not in ('admin', 'jefe_jefe')
  and u.created_by_user_id is null
  and u.branch_id is not null
  and u.tenant_id is not null;

-- ============================================================================
-- 3) accept_invitation: persiste invited_by → created_by_user_id
-- ============================================================================
create or replace function public.accept_invitation(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_invitation record;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_invitation
  from public.tenant_invitations
  where token = p_token and status = 'pending' and expires_at > now();

  if not found then
    raise exception 'Invitation not found, expired, or already used';
  end if;

  update public.users
  set tenant_id = v_invitation.tenant_id,
      branch_id = coalesce(v_invitation.branch_id, branch_id),
      role = v_invitation.role,
      full_name = coalesce(nullif(v_invitation.full_name, ''), full_name),
      created_by_user_id = coalesce(created_by_user_id, v_invitation.invited_by),
      onboarding_completed = true,
      updated_at = now()
  where id = v_user_id;

  update public.tenant_invitations
  set status = 'accepted', updated_at = now()
  where id = v_invitation.id;

  return jsonb_build_object(
    'success', true,
    'tenant_id', v_invitation.tenant_id,
    'role', v_invitation.role
  );
end;
$$;

-- ============================================================================
-- 4) RLS de consignaciones — scope por equipo creado
-- ============================================================================
drop policy if exists consignaciones_select_scoped on public.consignaciones;

create policy consignaciones_select_scoped
on public.consignaciones
for select
using (
  current_is_legacy_protected()
  or (
    tenant_id = current_tenant_id()
    and (
      current_user_role() = 'jefe_jefe'
      or created_by = (select auth.uid())
      or exists (
        select 1 from public.users team_user
        where team_user.id = consignaciones.created_by
          and team_user.created_by_user_id = (select auth.uid())
      )
    )
  )
);

drop policy if exists consignaciones_update_scoped on public.consignaciones;

create policy consignaciones_update_scoped
on public.consignaciones
for update
using (
  current_is_legacy_protected()
  or (
    tenant_id = current_tenant_id()
    and (
      current_user_role() = 'jefe_jefe'
      or created_by = (select auth.uid())
      or exists (
        select 1 from public.users team_user
        where team_user.id = consignaciones.created_by
          and team_user.created_by_user_id = (select auth.uid())
      )
    )
  )
)
with check (
  current_is_legacy_protected()
  or (
    tenant_id = current_tenant_id()
    and (
      current_user_role() = 'jefe_jefe'
      or created_by = (select auth.uid())
      or exists (
        select 1 from public.users team_user
        where team_user.id = consignaciones.created_by
          and team_user.created_by_user_id = (select auth.uid())
      )
    )
  )
);

drop policy if exists consignaciones_delete_scoped on public.consignaciones;

create policy consignaciones_delete_scoped
on public.consignaciones
for delete
using (
  current_is_legacy_protected()
  or (
    tenant_id = current_tenant_id()
    and (
      current_user_role() = 'jefe_jefe'
      or created_by = (select auth.uid())
      or exists (
        select 1 from public.users team_user
        where team_user.id = consignaciones.created_by
          and team_user.created_by_user_id = (select auth.uid())
      )
    )
  )
);
