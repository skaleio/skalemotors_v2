-- Permitir ver ventas con branch_id NULL además de las de la sucursal del usuario.
-- Así las ventas que quedaron sin sucursal vuelven a listarse.
alter table if exists public.sales enable row level security;

-- Reemplazar política de SELECT para incluir ventas sin sucursal (branch_id null).
drop policy if exists "sales_select_include_null" on public.sales;
drop policy if exists "sales_select" on public.sales;
drop policy if exists "Users can view sales of their branch" on public.sales;
create policy "sales_select"
  on public.sales for select to authenticated
  using (
    branch_id is null
    or branch_id in (select branch_id from public.users where id = auth.uid())
    or exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );
