-- Tablas para IA: conversaciones, mensajes y logs de uso.
-- RLS: usuario ve sus conversaciones de su sucursal; admin ve todo.

-- Conversaciones del chat IA por usuario y sucursal
create table public.ai_conversations (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  title text not null default 'Nueva conversación',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ai_conversations is 'Historial de conversaciones del chat IA por usuario y sucursal.';

create index idx_ai_conversations_user_id on public.ai_conversations(user_id);
create index idx_ai_conversations_branch_id on public.ai_conversations(branch_id);
create index idx_ai_conversations_updated_at on public.ai_conversations(updated_at desc);

alter table public.ai_conversations enable row level security;

-- SELECT: el usuario ve sus propias conversaciones; admin ve todas
create policy "ai_conversations_select"
  on public.ai_conversations for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- INSERT: solo el propio usuario
create policy "ai_conversations_insert"
  on public.ai_conversations for insert to authenticated
  with check (user_id = auth.uid());

-- UPDATE: solo el propio usuario (ej. cambiar título)
create policy "ai_conversations_update"
  on public.ai_conversations for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- DELETE: solo el propio usuario
create policy "ai_conversations_delete"
  on public.ai_conversations for delete to authenticated
  using (user_id = auth.uid());

-- Trigger updated_at
create or replace function public.set_updated_at_ai_conversations()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger ai_conversations_updated_at
  before update on public.ai_conversations
  for each row execute function public.set_updated_at_ai_conversations();


-- Mensajes individuales de cada conversación
create table public.ai_messages (
  id uuid primary key default extensions.uuid_generate_v4(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  tokens_used int,
  created_at timestamptz not null default now()
);

comment on table public.ai_messages is 'Mensajes del chat IA por conversación.';

create index idx_ai_messages_conversation_id on public.ai_messages(conversation_id);
create index idx_ai_messages_created_at on public.ai_messages(created_at);

alter table public.ai_messages enable row level security;

-- SELECT: usuario ve mensajes de sus conversaciones; admin ve todo
create policy "ai_messages_select"
  on public.ai_messages for select to authenticated
  using (
    exists (
      select 1 from public.ai_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
    or exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- INSERT: solo en conversaciones propias
create policy "ai_messages_insert"
  on public.ai_messages for insert to authenticated
  with check (
    exists (
      select 1 from public.ai_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

-- No UPDATE/DELETE de mensajes (historial inmutable); si se necesita, añadir políticas después.


-- Logs de uso por tenant (billing / límites futuros)
create table public.ai_usage_logs (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  branch_id uuid references public.branches(id) on delete set null,
  feature text not null,
  tokens_input int,
  tokens_output int,
  model text,
  created_at timestamptz not null default now()
);

comment on table public.ai_usage_logs is 'Uso de IA por usuario/sucursal para facturación o límites.';

create index idx_ai_usage_logs_user_id on public.ai_usage_logs(user_id);
create index idx_ai_usage_logs_branch_id on public.ai_usage_logs(branch_id);
create index idx_ai_usage_logs_created_at on public.ai_usage_logs(created_at desc);

alter table public.ai_usage_logs enable row level security;

-- SELECT: usuario ve sus logs o los de su sucursal; admin ve todo
create policy "ai_usage_logs_select"
  on public.ai_usage_logs for select to authenticated
  using (
    user_id = auth.uid()
    or branch_id in (select branch_id from public.users where id = auth.uid())
    or exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- INSERT: solo para el propio usuario (los logs desde Edge Function usan service_role y no pasan por RLS)
create policy "ai_usage_logs_insert"
  on public.ai_usage_logs for insert to authenticated
  with check (user_id = auth.uid());
