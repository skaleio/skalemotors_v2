-- Pipeline CRM: permite estado "para_cierre" en leads.
alter table public.leads drop constraint if exists leads_status_check;

alter table public.leads
  add constraint leads_status_check check (
    status in (
      'nuevo',
      'contactado',
      'interesado',
      'cotizando',
      'negociando',
      'vendido',
      'perdido',
      'para_cierre'
    )
  );
