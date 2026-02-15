-- Recordatorios de leads: se muestran en Tareas pendientes solo cuando falta poco tiempo
-- Tabla fuente; la sincronización a pending_tasks la hace sync_lead_reminders_to_pending_tasks()

create table if not exists public.lead_reminders (
  id uuid primary key default extensions.uuid_generate_v4(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  reminder_at timestamptz not null,
  note text,
  priority text not null default 'today' check (priority in ('urgent', 'today', 'later')),
  created_at timestamptz not null default now()
);

comment on table public.lead_reminders is 'Recordatorios creados desde Leads; aparecen en Tareas pendientes solo cuando falta poco (ventana en horas)';

create index if not exists idx_lead_reminders_reminder_at on public.lead_reminders(reminder_at);
create index if not exists idx_lead_reminders_branch on public.lead_reminders(branch_id);

alter table public.lead_reminders enable row level security;

create policy "Users can view lead_reminders of their branch"
  on public.lead_reminders for select
  using (branch_id in (select branch_id from public.users where id = auth.uid()));

create policy "Users can insert lead_reminders for their branch"
  on public.lead_reminders for insert
  with check (branch_id in (select branch_id from public.users where id = auth.uid()));

create policy "Users can update lead_reminders of their branch"
  on public.lead_reminders for update
  using (branch_id in (select branch_id from public.users where id = auth.uid()));

create policy "Users can delete lead_reminders of their branch"
  on public.lead_reminders for delete
  using (branch_id in (select branch_id from public.users where id = auth.uid()));

-- Sincroniza recordatorios a pending_tasks: solo cuando falta poco (ventana_horas antes de reminder_at)
-- Crea tarea si reminder_at está en [now(), now() + ventana] y aún no hay tarea para ese recordatorio
-- Marca completada la tarea si reminder_at ya pasó
create or replace function public.sync_lead_reminders_to_pending_tasks(ventana_horas int default 24)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_lead_name text;
  v_title text;
  v_desc text;
  v_now timestamptz := now();
  v_limite timestamptz := v_now + (ventana_horas || ' hours')::interval;
begin
  -- Marcar como completadas las tareas cuyo recordatorio ya pasó
  update pending_tasks pt
  set completed_at = v_now, updated_at = v_now
  from lead_reminders lr
  where pt.metadata->>'lead_reminder_id' = lr.id::text
    and pt.completed_at is null
    and lr.reminder_at < v_now;

  -- Crear tareas para recordatorios que entran en ventana y aún no tienen tarea
  for r in
    select lr.id, lr.lead_id, lr.branch_id, lr.reminder_at, lr.note, lr.priority
    from lead_reminders lr
    where lr.reminder_at >= v_now
      and lr.reminder_at <= v_limite
      and not exists (
        select 1 from pending_tasks pt
        where pt.metadata->>'lead_reminder_id' = lr.id::text and pt.completed_at is null
      )
  loop
    select coalesce(full_name, 'Sin nombre') into v_lead_name from leads where id = r.lead_id;
    v_title := 'Recordatorio: ' || v_lead_name;
    v_desc := coalesce(trim(r.note), '');
    if v_desc <> '' then
      v_desc := 'Nota: ' || left(v_desc, 200);
      if length(r.note) > 200 then
        v_desc := v_desc || '…';
      end if;
    else
      v_desc := 'Contactar a ' || v_lead_name || ' – ' || to_char(r.reminder_at at time zone 'America/Santiago', 'Dy DD Mon HH24:MI');
    end if;

    insert into pending_tasks (
      branch_id, priority, title, description,
      action_type, action_label, entity_type, entity_id,
      metadata, source, due_at
    )
    values (
      r.branch_id,
      r.priority,
      v_title,
      nullif(v_desc, ''),
      'otro',
      'Ver lead',
      'lead',
      r.lead_id,
      jsonb_build_object('lead_reminder_id', r.id),
      'rule',
      r.reminder_at
    );
  end loop;
end;
$$;

comment on function public.sync_lead_reminders_to_pending_tasks(int) is 'Crea pending_tasks desde lead_reminders cuando reminder_at está dentro de la ventana (horas); marca completadas las ya pasadas';

-- Permitir que la app llame la sync al cargar el Dashboard (y opcionalmente pg_cron)
grant execute on function public.sync_lead_reminders_to_pending_tasks(int) to authenticated;
grant execute on function public.sync_lead_reminders_to_pending_tasks(int) to service_role;