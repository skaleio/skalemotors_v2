-- WhatsApp / mensajes: aislamiento por tenant + alcance por rol
-- Objetivo: que `Messages` (frontend) no pueda mezclar datos entre tenants/sucursales.
-- Regla legacy: `hessen@test.io` mantiene comportamiento vía `legacy_protected=true`.

alter table public.messages enable row level security;

-- Si se ejecutó el script manual anterior de WhatsApp (ahora configurado para Meta) (`scripts/whatsapp_ycloud_messages_setup.sql`),
-- existe una política broad de lectura `messages_select_branch`. La removemos para evitar cruces entre tenants.
drop policy if exists "messages_select_branch" on public.messages;
drop policy if exists messages_select_whatsapp_tenant_scope on public.messages;

create policy messages_select_whatsapp_tenant_scope
on public.messages
for select
to authenticated
using (
  public.current_is_legacy_protected()
  or (
    type = 'whatsapp'
    and branch_id is not null
    and (
      -- Aislamiento por tenant: validar pertenencia del branch a tu tenant
      exists (
        select 1
        from public.branches b
        where b.id = messages.branch_id
          and b.tenant_id = public.current_tenant_id()
      )
      or exists (
        -- Backfill defensivo: si branch.tenant_id quedó null, inferimos desde users del mismo branch
        select 1
        from public.users u
        where u.branch_id = messages.branch_id
          and u.tenant_id = public.current_tenant_id()
      )
    )
    and (
      -- Alcance por rol: admin/financiero ve todo el tenant; otros solo su sucursal
      public.current_user_role() in ('admin', 'financiero')
      or messages.branch_id = (select u.branch_id from public.users u where u.id = auth.uid() limit 1)
    )
  )
);

