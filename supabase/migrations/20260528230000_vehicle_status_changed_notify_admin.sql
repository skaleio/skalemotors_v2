-- Notificar al admin cuando un vendedor cambia el estado de cualquier vehículo
-- (no solo vendido / vendido_por_dueno). Mantiene vehicle_sold para esos dos estados.

create or replace function public.vehicle_status_display_label(p_status text)
returns text
language sql
immutable
as $$
  select case p_status
    when 'disponible' then 'Disponible'
    when 'reservado' then 'Reservado'
    when 'vendido' then 'Vendido'
    when 'vendido_por_dueno' then 'Vendido por dueño'
    when 'retirado' then 'Retirado'
    when 'en_reparacion' then 'En reparación'
    when 'fuera_de_servicio' then 'Fuera de servicio'
    else coalesce(p_status, '—')
  end;
$$;

comment on function public.vehicle_status_display_label(text) is
  'Etiqueta legible (es-CL) para status de vehicles.status';

create or replace function public.vehicles_on_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_actor_id uuid;
  v_actor_role text;
  v_actor_name text;
  v_branch_name text;
  v_vehicle_desc text;
  v_message text;
  v_title text;
  v_notif_type text;
  v_from_status text;
  r record;
begin
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;

  v_tenant_id := new.tenant_id;
  if v_tenant_id is null and new.branch_id is not null then
    select b.tenant_id into v_tenant_id from public.branches b where b.id = new.branch_id;
  end if;
  if v_tenant_id is null then
    return new;
  end if;

  v_actor_id := auth.uid();
  v_from_status := case when tg_op = 'INSERT' then null else old.status end;

  insert into public.vehicle_status_events (
    tenant_id,
    branch_id,
    vehicle_id,
    from_status,
    to_status,
    changed_by,
    metadata
  )
  values (
    v_tenant_id,
    new.branch_id,
    new.id,
    v_from_status,
    new.status,
    v_actor_id,
    jsonb_build_object(
      'make', new.make,
      'model', new.model,
      'year', new.year,
      'patente', new.patente,
      'vin', new.vin
    )
  );

  -- Notificaciones solo en UPDATE real de status (no alta inicial del vehículo)
  if tg_op is distinct from 'UPDATE' then
    return new;
  end if;

  if v_actor_id is null then
    return new;
  end if;

  select u.role::text, u.full_name
  into v_actor_role, v_actor_name
  from public.users u
  where u.id = v_actor_id
    and u.tenant_id = v_tenant_id
    and coalesce(u.is_active, true) = true
  limit 1;

  if v_actor_role is distinct from 'vendedor' then
    return new;
  end if;

  if new.branch_id is not null then
    select b.name into v_branch_name from public.branches b where b.id = new.branch_id;
  end if;

  v_vehicle_desc := trim(
    coalesce(new.make, '') || ' ' ||
    coalesce(new.model, '') || ' ' ||
    coalesce(new.year::text, '')
  );
  if v_vehicle_desc = '' then
    v_vehicle_desc := coalesce(new.patente, new.vin, 'vehículo');
  end if;

  v_message := coalesce(v_actor_name, 'Un vendedor')
    || ' cambió el estado de ' || v_vehicle_desc
    || ' de ' || public.vehicle_status_display_label(v_from_status)
    || ' a ' || public.vehicle_status_display_label(new.status)
    || case when v_branch_name is not null then ' — ' || v_branch_name else '' end;

  if new.status = 'vendido' then
    v_title := 'Vehículo vendido';
    v_notif_type := 'vehicle_sold';
  elsif new.status = 'vendido_por_dueno' then
    v_title := 'Vendido por dueño';
    v_notif_type := 'vehicle_sold';
  else
    v_title := 'Cambio de estado en inventario';
    v_notif_type := 'vehicle_status_changed';
  end if;

  for r in
    select rn.user_id
    from public.resolve_notification_recipients(
      v_tenant_id,
      new.branch_id,
      array['admin']::text[],
      v_actor_id
    ) rn
  loop
    insert into public.notifications (
      tenant_id,
      branch_id,
      recipient_user_id,
      actor_user_id,
      type,
      title,
      message,
      entity_type,
      entity_id,
      action_url,
      metadata
    )
    values (
      v_tenant_id,
      new.branch_id,
      r.user_id,
      v_actor_id,
      v_notif_type,
      v_title,
      v_message,
      'vehicle',
      new.id,
      '/app/inventory?vehicle=' || new.id::text,
      jsonb_build_object(
        'vehicle_id', new.id,
        'make', new.make,
        'model', new.model,
        'year', new.year,
        'patente', new.patente,
        'from_status', v_from_status,
        'from_status_label', public.vehicle_status_display_label(v_from_status),
        'to_status', new.status,
        'to_status_label', public.vehicle_status_display_label(new.status),
        'seller_id', v_actor_id,
        'seller_name', v_actor_name,
        'branch_id', new.branch_id,
        'branch_name', v_branch_name
      )
    );
  end loop;

  return new;
end $$;

comment on function public.vehicles_on_status_change() is
  'Registra vehicle_status_events en cada cambio de status. Notifica admins cuando un vendedor cambia el estado de un vehículo (cualquier transición).';

revoke all on function public.vehicle_status_display_label(text) from public;
revoke all on function public.vehicle_status_display_label(text) from anon;
revoke all on function public.vehicle_status_display_label(text) from authenticated;
grant execute on function public.vehicle_status_display_label(text) to service_role;
