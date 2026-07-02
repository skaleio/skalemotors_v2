-- Auth del dispatcher de push desacoplada del service_role key. El formato del
-- SUPABASE_SERVICE_ROLE_KEY inyectado en la Edge Function varía con el sistema
-- de llaves nuevo de Supabase (JWT legacy vs sb_secret), y no siempre coincide
-- con el service_role revelado en el dashboard.
--
-- Solución: el trigger manda como Bearer un token guardado en Vault
-- ('service_role_key', que ahora contiene un token random, no el service_role),
-- y la Edge Function push-send lee ESE MISMO token vía esta RPC. Ambos leen del
-- mismo Vault → siempre coinciden. La RPC solo es ejecutable por service_role.
create or replace function public.get_push_dispatch_secret()
returns text
language sql
security definer
set search_path = public, vault
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'service_role_key'
  limit 1;
$$;

revoke all on function public.get_push_dispatch_secret() from public;
revoke all on function public.get_push_dispatch_secret() from anon;
revoke all on function public.get_push_dispatch_secret() from authenticated;
grant execute on function public.get_push_dispatch_secret() to service_role;
