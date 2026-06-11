-- Notificar a fotógrafos del tenant/sucursal cuando se agrega una consignación.
-- Formato campana: título «{nombre} agregó una nueva consignación», mensaje = modelo del vehículo.
-- Mantiene aviso a admin solo cuando la crea un vendedor.

create or replace function public.notify_consignacion_created()
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
  v_admin_message text;
  v_fotografo_title text;
  r record;
begin
  v_tenant_id := new.tenant_id;
  if v_tenant_id is null and new.branch_id is not null then
    select b.tenant_id into v_tenant_id from public.branches b where b.id = new.branch_id;
  end if;
  if v_tenant_id is null then
    return new;
  end if;

  v_actor_id := coalesce(new.created_by, auth.uid());

  if v_actor_id is not null then
    select u.role::text, u.full_name
    into v_actor_role, v_actor_name
    from public.users u
    where u.id = v_actor_id
      and u.tenant_id = v_tenant_id
      and coalesce(u.is_active, true) = true
    limit 1;
  end if;

  if new.branch_id is not null then
    select b.name into v_branch_name from public.branches b where b.id = new.branch_id;
  end if;

  v_vehicle_desc := trim(
    coalesce(new.vehicle_make, '') || ' ' ||
    coalesce(new.vehicle_model, '') ||
    case when new.vehicle_year is not null then ' ' || new.vehicle_year::text else '' end
  );
  if v_vehicle_desc = '' then
    v_vehicle_desc := coalesce(new.patente, 'Vehículo en consignación');
  end if;

  -- Admin: solo cuando un vendedor registra la consignación (comportamiento previo).
  if v_actor_role = 'vendedor' then
    v_admin_message := coalesce(v_actor_name, 'Un vendedor')
      || ' registró una consignación: ' || v_vehicle_desc
      || ' (' || coalesce(new.owner_name, 'propietario s/d') || ')'
      || case when v_branch_name is not null then ' — ' || v_branch_name else '' end;

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
        'consignacion_created',
        'Nueva consignación',
        v_admin_message,
        'consignacion',
        new.id,
        '/app/consignaciones',
        jsonb_build_object(
          'consignacion_id', new.id,
          'vehicle_make', new.vehicle_make,
          'vehicle_model', new.vehicle_model,
          'vehicle_year', new.vehicle_year,
          'owner_name', new.owner_name,
          'patente', new.patente,
          'branch_id', new.branch_id,
          'branch_name', v_branch_name,
          'actor_id', v_actor_id,
          'actor_name', v_actor_name,
          'seller_id', v_actor_id,
          'seller_name', v_actor_name,
          'audience', 'admin'
        )
      );
    end loop;
  end if;

  -- Fotógrafo: cualquier alta de consignación (excepto auto-notificación).
  v_fotografo_title := coalesce(v_actor_name, 'Alguien') || ' agregó una nueva consignación';

  for r in
    select rn.user_id
    from public.resolve_notification_recipients(
      v_tenant_id,
      new.branch_id,
      array['fotografo']::text[],
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
      'consignacion_created',
      v_fotografo_title,
      v_vehicle_desc,
      'consignacion',
      new.id,
      '/app/consignaciones',
      jsonb_build_object(
        'consignacion_id', new.id,
        'vehicle_make', new.vehicle_make,
        'vehicle_model', new.vehicle_model,
        'vehicle_year', new.vehicle_year,
        'owner_name', new.owner_name,
        'patente', new.patente,
        'branch_id', new.branch_id,
        'branch_name', v_branch_name,
        'actor_id', v_actor_id,
        'actor_name', v_actor_name,
        'audience', 'fotografo'
      )
    );
  end loop;

  return new;
end $$;

comment on function public.notify_consignacion_created() is
  'Consignación nueva: admins si la crea un vendedor; fotógrafos de la sucursal en cualquier alta (título con nombre del actor, mensaje = vehículo).';

revoke all on function public.notify_consignacion_created() from public;
revoke execute on function public.notify_consignacion_created() from anon;
revoke execute on function public.notify_consignacion_created() from authenticated;
grant execute on function public.notify_consignacion_created() to service_role;
