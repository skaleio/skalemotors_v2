-- El trigger function no debe ser invocable vía REST (/rest/v1/rpc). Quitar EXECUTE.
-- El trigger igual se dispara: corre con privilegios del owner, no por grant a roles API.
REVOKE ALL ON FUNCTION public.sync_branch_sales_staff_to_users() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_branch_sales_staff_to_users() FROM anon;
REVOKE ALL ON FUNCTION public.sync_branch_sales_staff_to_users() FROM authenticated;
