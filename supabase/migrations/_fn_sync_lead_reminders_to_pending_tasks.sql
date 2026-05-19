create or replace function public.sync_lead_reminders_to_pending_tasks(ventana_horas int default 48)
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
      and not public.pending_task_blocks_auto_create(
        'lead', lr.lead_id, jsonb_build_object('lead_reminder_id', lr.id::text)
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

-- Tareas ya completadas antes de este cambio: tratarlas como descartadas para no recrearlas.
UPDATE public.pending_tasks
SET
  metadata = COALESCE(metadata, '{}'::jsonb)
    || jsonb_build_object('user_dismissed', true),
  updated_at = now()
WHERE completed_at IS NOT NULL
  AND COALESCE(metadata->>'user_dismissed', 'false') <> 'true';

-- Tareas ya completadas antes de este cambio: tratarlas como descartadas para no recrearlas.
UPDATE public.pending_tasks
SET
  metadata = COALESCE(metadata, '{}'::jsonb)
    || jsonb_build_object('user_dismissed', true),
  updated_at = now()
WHERE completed_at IS NOT NULL
  AND COALESCE(metadata->>'user_dismissed', 'false') <> 'true';