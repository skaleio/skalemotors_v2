-- Cerebro por sucursal: snapshot de todas las métricas e información del negocio
-- para que el agente IA tenga contexto completo sin consultar en cada mensaje.
-- Un cerebro por branch_id; los usuarios de esa sucursal comparten el mismo cerebro.

create table public.ai_branch_brain (
  id uuid primary key default extensions.uuid_generate_v4(),
  branch_id uuid references public.branches(id) on delete cascade,
  snapshot_text text not null,
  updated_at timestamptz not null default now(),
  constraint ai_branch_brain_branch_id_key unique (branch_id)
);

comment on table public.ai_branch_brain is 'Snapshot del negocio por sucursal para el agente IA (SKALEGPT). Incluye inventario, ventas, leads, consignaciones, finanzas. Se actualiza periódicamente o on-demand.';

create index idx_ai_branch_brain_branch_id on public.ai_branch_brain(branch_id);
create index idx_ai_branch_brain_updated_at on public.ai_branch_brain(updated_at desc);

alter table public.ai_branch_brain enable row level security;

-- SELECT: usuarios ven el cerebro de su sucursal; admin ve todos
create policy "ai_branch_brain_select"
  on public.ai_branch_brain for select to authenticated
  using (
    branch_id in (select branch_id from public.users where id = auth.uid())
    or exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- INSERT/UPDATE: solo vía service_role (Edge Functions). No exponer a authenticated para evitar sobrescrituras.
-- Si se necesita que el backend actualice, la Edge Function usa service_role y bypasea RLS.
create policy "ai_branch_brain_insert"
  on public.ai_branch_brain for insert to authenticated
  with check (false);

create policy "ai_branch_brain_update"
  on public.ai_branch_brain for update to authenticated
  using (false)
  with check (false);

-- Permitir que el backend (service_role) haga upsert sin políticas adicionales.
