-- El fotógrafo puede VER (no conectar) las cuentas y posts de redes de la automotora,
-- para publicar autos del inventario desde Skale. Alinea el RLS con el RBAC de app/edge.
-- INSERT/UPDATE/DELETE de cuentas org siguen restringidos a admin/gerente/jefe_jefe.
-- El alta de posts la hace la Edge Function con service_role (bypassa RLS).

drop policy if exists zernio_accounts_select on public.zernio_accounts;
create policy zernio_accounts_select on public.zernio_accounts
  for select to authenticated
  using (
    public.current_is_legacy_protected()
    or (
      tenant_id = public.current_tenant_id()
      and (
        (scope = 'personal' and user_id = auth.uid())
        or (
          scope = 'org'
          and public.current_user_role() in ('admin', 'gerente', 'jefe_jefe', 'jefe_sucursal', 'fotografo')
        )
      )
    )
  );

drop policy if exists zernio_posts_select on public.zernio_posts;
create policy zernio_posts_select on public.zernio_posts
  for select to authenticated
  using (
    public.current_is_legacy_protected()
    or (
      tenant_id = public.current_tenant_id()
      and (
        (scope = 'personal' and created_by = auth.uid())
        or (
          scope = 'org'
          and public.current_user_role() in ('admin', 'gerente', 'jefe_jefe', 'jefe_sucursal', 'fotografo')
        )
      )
    )
  );
