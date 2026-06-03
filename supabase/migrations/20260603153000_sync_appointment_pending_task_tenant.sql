-- pending_tasks.tenant_id es NOT NULL; el trigger de citas no lo rellenaba.

CREATE OR REPLACE FUNCTION public.sync_appointment_to_pending_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_lead_name text;
  v_title text;
  v_desc text;
  v_priority text;
  v_action_type text;
  v_action_label text;
  v_scheduled date;
  v_today date := current_date;
  v_type_label text;
begin
  v_type_label := case new.type
    when 'test_drive' then 'Test drive'
    when 'reunion' then 'Reunión'
    when 'entrega' then 'Entrega'
    when 'servicio' then 'Servicio'
    else 'Cita'
  end;

  if new.lead_id is not null then
    select coalesce(full_name, 'Sin nombre') into v_lead_name from leads where id = new.lead_id;
  else
    v_lead_name := coalesce(new.title, 'Sin asignar');
  end if;

  v_title := v_type_label || ': ' || v_lead_name;
  v_scheduled := (new.scheduled_at at time zone 'America/Santiago')::date;
  v_desc := to_char(new.scheduled_at at time zone 'America/Santiago', 'Dy DD Mon HH24:MI');
  if new.location is not null and new.location <> '' then
    v_desc := v_desc || ' · ' || new.location;
  end if;

  if v_scheduled = v_today then
    v_priority := 'urgent';
  elsif v_scheduled = v_today + 1 then
    v_priority := 'today';
  else
    v_priority := 'later';
  end if;

  if new.status = 'programada' then
    v_action_type := 'confirmar';
    v_action_label := 'Confirmar';
  else
    v_action_type := 'otro';
    v_action_label := 'Ver cita';
  end if;

  if new.scheduled_at < now() or new.status in ('completada', 'cancelada', 'no_asistio') then
    update pending_tasks
    set completed_at = now(), updated_at = now()
    where entity_type = 'appointment' and entity_id = new.id;
    return new;
  end if;

  if new.branch_id is null then
    return new;
  end if;

  update pending_tasks
  set
    tenant_id = new.tenant_id,
    priority = v_priority,
    title = v_title,
    description = v_desc,
    action_type = v_action_type,
    action_label = v_action_label,
    due_at = new.scheduled_at,
    assigned_to = new.user_id,
    metadata = jsonb_build_object(
      'appointment_type', new.type,
      'scheduled_at', new.scheduled_at,
      'lead_id', new.lead_id,
      'vehicle_id', new.vehicle_id
    ),
    updated_at = now(),
    completed_at = null
  where entity_type = 'appointment' and entity_id = new.id;

  if not found then
    insert into pending_tasks (
      tenant_id,
      branch_id,
      assigned_to,
      priority,
      title,
      description,
      action_type,
      action_label,
      entity_type,
      entity_id,
      metadata,
      source,
      due_at
    )
    values (
      new.tenant_id,
      new.branch_id,
      new.user_id,
      v_priority,
      v_title,
      v_desc,
      v_action_type,
      v_action_label,
      'appointment',
      new.id,
      jsonb_build_object(
        'appointment_type', new.type,
        'scheduled_at', new.scheduled_at,
        'lead_id', new.lead_id,
        'vehicle_id', new.vehicle_id
      ),
      'rule',
      new.scheduled_at
    );
  end if;

  return new;
end;
$function$;
