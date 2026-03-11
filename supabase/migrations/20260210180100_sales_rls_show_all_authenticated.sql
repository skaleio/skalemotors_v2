-- Mostrar todas las ventas a usuarios autenticados (sin filtrar por sucursal).
-- Así se vuelven a ver todas las ventas de febrero (y de cualquier mes) aunque tengan otra sucursal.
alter table if exists public.sales enable row level security;

drop policy if exists "sales_select_include_null" on public.sales;
drop policy if exists "sales_select" on public.sales;
drop policy if exists "Users can view sales of their branch" on public.sales;

create policy "sales_select"
  on public.sales for select to authenticated
  using (true);
