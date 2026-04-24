-- Fix: notify_lead_sold violaba notifications_actor_user_id_fkey cuando el
-- cierre se atribuía a un vendedor de plantilla (closed_by_staff_id). Ese ID
-- pertenece a public.branch_sales_staff, NO a auth.users, por lo que el
-- INSERT en public.notifications fallaba con 23503 (FK violation).
--
-- Reglas nuevas:
--   - actor_user_id := auth.uid() (o assigned_to si auth.uid() es null) —
--     siempre apuntando a auth.users, jamás a branch_sales_staff.
--   - El nombre del vendedor atribuido (staff plantilla o usuario con login)
--     se resuelve por lookup independiente y va al mensaje + metadata.
--   - closed_by_staff_id se guarda en metadata para trazabilidad.

create or replace function public.notify_lead_sold()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_actor_id uuid;
  v_actor_name text;
  v_seller_name text;
  v_branch_name text;
  v_message text;
  r record;
begin
  if new.status is distinct from 'vendido' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'vendido' then return new; end if;

  v_tenant_id := new.tenant_id;
  if v_tenant_id is null and new.branch_id is not null then
    select b.tenant_id into v_tenant_id from public.branches b where b.id = new.branch_id;
  end if;
  if v_tenant_id is null then return new; end if;

  -- actor_user_id DEBE ser FK válido a auth.users. Nunca un staff plantilla.
  v_actor_id := auth.uid();
  if v_actor_id is null and new.assigned_to is not null then
    -- Validar que assigned_to exista como usuario antes de asumirlo como actor.
    if exists (select 1 from public.users u where u.id = new.assigned_to) then
      v_actor_id := new.assigned_to;
    end if;
  end if;

  -- Nombre del usuario que hizo el cierre (si hay)
  if v_actor_id is not null then
    select u.full_name into v_actor_name from public.users u where u.id = v_actor_id;
  end if;

  -- Nombre del vendedor atribuido: staff plantilla > assigned_to > actor
  if new.closed_by_staff_id is not null then
    select s.full_name into v_seller_name
      from public.branch_sales_staff s
      where s.id = new.closed_by_staff_id;
  end if;
  if v_seller_name is null and new.assigned_to is not null then
    select u.full_name into v_seller_name
      from public.users u
      where u.id = new.assigned_to;
  end if;
  if v_seller_name is null then
    v_seller_name := v_actor_name;
  end if;

  if new.branch_id is not null then
    select b.name into v_branch_name from public.branches b where b.id = new.branch_id;
  end if;

  v_message := coalesce(v_seller_name, 'Un vendedor')
               || ' cerró el lead "' || coalesce(new.full_name, 's/n') || '"'
               || case when v_branch_name is not null then ' — ' || v_branch_name else '' end;

  for r in
    select rn.user_id
    from public.resolve_notification_recipients(
      v_tenant_id,
      new.branch_id,
      array['admin','gerente','jefe_jefe','jefe_sucursal']::text[],
      v_actor_id
    ) rn
  loop
    insert into public.notifications (
      tenant_id, branch_id, recipient_user_id, actor_user_id,
      type, title, message, entity_type, entity_id, action_url, metadata
    ) values (
      v_tenant_id, new.branch_id, r.user_id, v_actor_id,
      'lead_sold', 'Negocio cerrado', v_message,
      'lead', new.id,
      '/app/leads?openLead=' || new.id::text,
      jsonb_build_object(
        'lead_id', new.id,
        'lead_full_name', new.full_name,
        'seller_name', v_seller_name,
        'assigned_to', new.assigned_to,
        'closed_by_staff_id', new.closed_by_staff_id,
        'actor_id', v_actor_id,
        'actor_name', v_actor_name,
        'branch_id', new.branch_id,
        'branch_name', v_branch_name
      )
    );
  end loop;

  return new;
end $$;
