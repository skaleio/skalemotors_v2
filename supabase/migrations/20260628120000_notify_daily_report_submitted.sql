-- Notificación campanita al enviarse un informe diario.
-- Destinatarios: rol admin (tenant) + jefe_sucursal de la sucursal del informe.
-- Solo dispara en el PRIMER envío (submitted_at pasa de null a no-null), no en ediciones.

create or replace function public.notify_daily_report_submitted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_actor_id uuid;
  v_actor_name text;
  v_branch_name text;
  v_message text;
  r record;
begin
  if new.submitted_at is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.submitted_at is not null then
    return new;
  end if;

  v_tenant_id := new.tenant_id;
  if v_tenant_id is null and new.branch_id is not null then
    select b.tenant_id into v_tenant_id from public.branches b where b.id = new.branch_id;
  end if;
  if v_tenant_id is null then
    return new;
  end if;

  v_actor_id := new.user_id;
  if v_actor_id is not null then
    select u.full_name into v_actor_name from public.users u where u.id = v_actor_id;
  end if;
  if new.branch_id is not null then
    select b.name into v_branch_name from public.branches b where b.id = new.branch_id;
  end if;

  v_message := coalesce(v_actor_name, 'Un vendedor')
               || ' envió su informe diario'
               || case when v_branch_name is not null then ' — ' || v_branch_name else '' end;

  for r in
    select rn.user_id
    from public.resolve_notification_recipients(
      v_tenant_id,
      new.branch_id,
      array['admin','jefe_sucursal']::text[],
      v_actor_id
    ) rn
  loop
    insert into public.notifications (
      tenant_id, branch_id, recipient_user_id, actor_user_id,
      type, title, message, entity_type, entity_id, action_url, metadata
    ) values (
      v_tenant_id, new.branch_id, r.user_id, v_actor_id,
      'daily_report_submitted', 'Informe diario enviado', v_message,
      'daily_sales_report', new.id,
      '/app/tasks',
      jsonb_build_object(
        'report_id', new.id,
        'report_date', new.report_date,
        'seller_id', v_actor_id,
        'seller_name', v_actor_name,
        'branch_id', new.branch_id,
        'branch_name', v_branch_name
      )
    );
  end loop;

  return new;
end $$;

drop trigger if exists trg_notify_daily_report_submitted on public.daily_sales_reports;
create trigger trg_notify_daily_report_submitted
after insert or update of submitted_at on public.daily_sales_reports
for each row
execute function public.notify_daily_report_submitted();
