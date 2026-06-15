-- ============================================================================
-- Hardening seguridad (2026-06-14) — optimizar RLS (auth_rls_initplan)
-- Envuelve auth.uid() en (select auth.uid()) en 23 policies que lo reevaluaban
-- por fila (amplificación de carga / DoS a escala). Transformación quirúrgica:
-- solo los auth.uid() "desnudos"; los ya envueltos en SELECT se preservan.
-- Lee la definición en vivo y la recrea idéntica salvo ese wrap → cero cambio
-- semántico de aislamiento de tenant. Atómico (rollback si algo falla).
-- ============================================================================

DO $$
DECLARE
  r        record;
  v_using  text;
  v_check  text;
  v_ddl    text;
  pair     text;
  v_tbl    text;
  v_pol    text;
  pairs    text[] := ARRAY[
    'zernio_accounts|zernio_accounts_select',
    'zernio_accounts|zernio_accounts_insert',
    'zernio_accounts|zernio_accounts_update',
    'zernio_accounts|zernio_accounts_delete',
    'zernio_posts|zernio_posts_select',
    'zernio_posts|zernio_posts_insert',
    'zernio_posts|zernio_posts_update_own',
    'leads|leads_delete_auth',
    'leads|leads_select_auth',
    'leads|leads_update_auth',
    'appointments|appointments_rw_scope',
    'daily_sales_reports|daily_sales_reports_select',
    'daily_sales_reports|daily_sales_reports_insert',
    'daily_sales_reports|daily_sales_reports_update',
    'ai_conversations|ai_conversations_select',
    'ai_messages|ai_messages_select',
    'ai_usage_logs|ai_usage_logs_select',
    'ai_branch_brain|ai_branch_brain_select',
    'seller_app_presence|seller_app_presence_insert',
    'seller_app_presence|seller_app_presence_update',
    'user_privacy_acceptances|user_privacy_acceptances_own',
    'zernio_user_profiles|zernio_user_profiles_select_own',
    'zernio_user_profiles|zernio_user_profiles_mutate_own'
  ];
BEGIN
  FOREACH pair IN ARRAY pairs LOOP
    v_tbl := split_part(pair, '|', 1);
    v_pol := split_part(pair, '|', 2);

    SELECT * INTO r
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = v_tbl AND policyname = v_pol;

    IF NOT FOUND THEN
      RAISE NOTICE 'Policy % on % no existe, se omite', v_pol, v_tbl;
      CONTINUE;
    END IF;

    -- Proteger auth.uid() ya envueltos, envolver los desnudos, restaurar.
    v_using := replace(replace(replace(
      r.qual,       'SELECT auth.uid()', 'SELECT @@A@@'),
                    'auth.uid()',        '(select auth.uid())'),
                    'SELECT @@A@@',      'SELECT auth.uid()');
    v_check := replace(replace(replace(
      r.with_check, 'SELECT auth.uid()', 'SELECT @@A@@'),
                    'auth.uid()',        '(select auth.uid())'),
                    'SELECT @@A@@',      'SELECT auth.uid()');

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', v_pol, v_tbl);

    v_ddl := format('CREATE POLICY %I ON public.%I AS %s FOR %s TO %s',
      v_pol, v_tbl,
      CASE WHEN r.permissive = 'PERMISSIVE' THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
      r.cmd, array_to_string(r.roles, ', '));

    IF v_using IS NOT NULL THEN
      v_ddl := v_ddl || ' USING (' || v_using || ')';
    END IF;
    IF v_check IS NOT NULL THEN
      v_ddl := v_ddl || ' WITH CHECK (' || v_check || ')';
    END IF;

    EXECUTE v_ddl;
  END LOOP;
END $$;
