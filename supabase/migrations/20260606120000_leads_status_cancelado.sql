-- Estado cancelado: lead sigue en Leads; CRM muestra solo los 5 más recientes (lógica en app).

do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'public'
      and t.relname = 'leads'
      and c.contype = 'c'
      and (
        c.conname = 'leads_status_check'
        or pg_get_constraintdef(c.oid) ilike '%status%in (%'
        or pg_get_constraintdef(c.oid) ilike '%(status in (%'
        or pg_get_constraintdef(c.oid) ilike '%status = any%'
      )
  loop
    execute format('alter table public.leads drop constraint if exists %I', r.conname);
  end loop;
end $$;

alter table public.leads
  add constraint leads_status_check check (
    status in (
      'nuevo',
      'contactado',
      'interesado',
      'cotizando',
      'negociando',
      'en_espera',
      'vendido',
      'perdido',
      'para_cierre',
      'cancelado'
    )
  );
