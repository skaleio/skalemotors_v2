-- Ejecutar en Supabase SQL Editor si sigues viendo errores de CHECK en leads.
-- Lista todos los CHECK de public.leads para ver si queda alguno duplicado.

select
  c.conname,
  pg_get_constraintdef(c.oid) as definition
from pg_constraint c
join pg_class t on c.conrelid = t.oid
join pg_namespace n on t.relnamespace = n.oid
where n.nspname = 'public'
  and t.relname = 'leads'
  and c.contype = 'c'
order by c.conname;
