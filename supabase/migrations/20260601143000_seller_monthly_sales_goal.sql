-- Meta mensual de ventas por tenant (default) y opcional por vendedor (branch_sales_staff).

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS default_monthly_sales_goal integer NOT NULL DEFAULT 5;

ALTER TABLE public.branch_sales_staff
  ADD COLUMN IF NOT EXISTS monthly_sales_goal integer;

ALTER TABLE public.branch_sales_staff
  DROP CONSTRAINT IF EXISTS branch_sales_staff_monthly_goal_positive;

ALTER TABLE public.branch_sales_staff
  ADD CONSTRAINT branch_sales_staff_monthly_goal_positive
  CHECK (monthly_sales_goal IS NULL OR monthly_sales_goal > 0);

ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_default_monthly_sales_goal_positive;

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_default_monthly_sales_goal_positive
  CHECK (default_monthly_sales_goal > 0);

COMMENT ON COLUMN public.tenants.default_monthly_sales_goal IS
  'Meta de ventas cerradas del mes para vendedores sin meta individual.';

COMMENT ON COLUMN public.branch_sales_staff.monthly_sales_goal IS
  'Meta mensual de ventas del vendedor; NULL usa default_monthly_sales_goal del tenant.';
