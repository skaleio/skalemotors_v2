-- Notificar a admins cuando un vendedor agrega una nota a un lead (lead_notes).

create or replace function public.notify_lead_note_added()
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
  v_branch_id uuid;
  v_branch_name text;
  v_lead_name text;
  v_note_preview text;
  v_message text;
  r record;
begin
  v_tenant_id := new.tenant_id;
  if v_tenant_id is null then
    return new;
  end if;

  v_actor_id := coalesce(new.created_by, auth.uid());
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

  select l.full_name, l.branch_id
  into v_lead_name, v_branch_id
  from public.leads l
  where l.id = new.lead_id
    and l.tenant_id = v_tenant_id
    and l.deleted_at is null
  limit 1;

  if v_lead_name is null then
    return new;
  end if;

  v_branch_id := coalesce(v_branch_id, new.branch_id);

  if v_branch_id is not null then
    select b.name into v_branch_name from public.branches b where b.id = v_branch_id;
  end if;

  v_note_preview := left(regexp_replace(trim(new.body), E'[\\s\\n\\r]+', ' ', 'g'), 120);
  if char_length(v_note_preview) >= 120 then
    v_note_preview := v_note_preview || '…';
  end if;

  v_message := coalesce(v_actor_name, 'Un vendedor')
    || ' agregó una nota al lead "' || v_lead_name || '"'
    || case when v_note_preview <> '' then ': «' || v_note_preview || '»' else '' end
    || case when v_branch_name is not null then ' — ' || v_branch_name else '' end;

  for r in
    select rn.user_id
    from public.resolve_notification_recipients(
      v_tenant_id,
      v_branch_id,
      array['admin']::text[],
      v_actor_id
    ) rn
  loop
    insert into public.notifications (
      tenant_id, branch_id, recipient_user_id, actor_user_id,
      type, title, message, entity_type, entity_id, action_url, metadata
    )
    values (
      v_tenant_id, v_branch_id, r.user_id, v_actor_id,
      'lead_note_added', 'Nueva nota en lead', v_message,
      'lead', new.lead_id,
      '/app/leads?openLead=' || new.lead_id::text,
      jsonb_build_object(
        'lead_id', new.lead_id,
        'lead_full_name', v_lead_name,
        'note_id', new.id,
        'note_preview', v_note_preview,
        'actor_id', v_actor_id,
        'actor_name', v_actor_name,
        'branch_id', v_branch_id,
        'branch_name', v_branch_name
      )
    );
  end loop;

  return new;
end;
$$;

comment on function public.notify_lead_note_added() is
  'Notifica admins (scope por sucursal) cuando un vendedor inserta una fila en lead_notes.';

drop trigger if exists trg_notify_lead_note_added on public.lead_notes;
create trigger trg_notify_lead_note_added
  after insert on public.lead_notes
  for each row
  execute function public.notify_lead_note_added();

revoke all on function public.notify_lead_note_added() from public;
revoke execute on function public.notify_lead_note_added() from anon;
revoke execute on function public.notify_lead_note_added() from authenticated;
grant execute on function public.notify_lead_note_added() to service_role;
