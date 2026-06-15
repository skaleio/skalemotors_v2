-- El admin (dueño del concesionario) debe enterarse de TODO lead entrante,
-- sin importar la sucursal. resolve_notification_recipients dejó a 'admin'
-- como branch-scoped, así que un admin multi-sucursal perdía los leads de
-- las sucursales que no son la suya. Resolvemos admins a nivel tenant
-- (p_branch_id => null) y conservamos la sucursal del lead en el mensaje.

create or replace function public.notify_lead_ingested()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_branch_name text;
  v_source_label text;
  v_title text;
  v_message text;
  v_interest text;
  r record;
begin
  if tg_op <> 'INSERT' then
    return new;
  end if;

  -- Solo ingestas con service role (n8n-lead-ingest, landing-booking, lead-create edge, etc.).
  if auth.uid() is not null then
    return new;
  end if;

  v_tenant_id := new.tenant_id;
  if v_tenant_id is null and new.branch_id is not null then
    select b.tenant_id into v_tenant_id from public.branches b where b.id = new.branch_id;
  end if;
  if v_tenant_id is null then
    return new;
  end if;

  if new.branch_id is not null then
    select b.name into v_branch_name from public.branches b where b.id = new.branch_id;
  end if;

  v_source_label := public.lead_source_display_label(new.source);
  v_title := 'Nuevo lead vía ' || v_source_label;

  v_interest := nullif(trim(coalesce(new.vehicle_interest, '')), '');

  v_message := coalesce(new.full_name, 'Sin nombre')
    || case when new.phone is not null and trim(new.phone) <> '' then ' · ' || trim(new.phone) else '' end
    || case when v_interest is not null then ' · ' || v_interest else '' end
    || case when v_branch_name is not null then ' — ' || v_branch_name else '' end;

  for r in
    select rn.user_id
    from public.resolve_notification_recipients(
      v_tenant_id,
      null,
      array['admin']::text[],
      null
    ) rn
  loop
    insert into public.notifications (
      tenant_id, branch_id, recipient_user_id, actor_user_id,
      type, title, message, entity_type, entity_id, action_url, metadata
    )
    values (
      v_tenant_id, new.branch_id, r.user_id, null,
      'lead_ingested', v_title, v_message,
      'lead', new.id,
      '/app/leads?openLead=' || new.id::text,
      jsonb_build_object(
        'lead_id', new.id,
        'lead_full_name', new.full_name,
        'lead_phone', new.phone,
        'source', new.source,
        'source_label', v_source_label,
        'vehicle_interest', v_interest,
        'branch_id', new.branch_id,
        'branch_name', v_branch_name,
        'ingest_channel', 'automation'
      )
    );
  end loop;

  return new;
end;
$$;

revoke all on function public.notify_lead_ingested() from public;
revoke execute on function public.notify_lead_ingested() from anon;
revoke execute on function public.notify_lead_ingested() from authenticated;
grant execute on function public.notify_lead_ingested() to service_role;
