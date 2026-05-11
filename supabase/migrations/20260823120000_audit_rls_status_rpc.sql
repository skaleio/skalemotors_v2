-- ============================================================================
-- RPC `audit_rls_status` — herramienta de auditoría de RLS para tablas críticas.
--
-- Devuelve por tabla:
--   - rls_enabled: bool
--   - policy_count: número de policies activas
--   - has_tenant_filter: alguna policy referencia tenant_id o current_tenant_id()
--   - has_branch_filter: alguna policy referencia branch_id
--   - policies: array con detalle (nombre, cmd, qual, with_check)
--
-- Sólo callable por service_role (no anon, no authenticated). Pensada para correr
-- desde `scripts/check-rls.mjs` o desde el SQL Editor de Supabase con privilegios admin.
-- ============================================================================

create or replace function public.audit_rls_status(p_tables text[] default null)
returns jsonb
language sql
security definer
set search_path = public, pg_catalog
as $$
  with critical as (
    select unnest(coalesce(
      p_tables,
      array[
        'leads', 'vehicles', 'sales', 'consignaciones', 'appointments',
        'pending_tasks', 'gastos_empresa', 'ingresos_empresa', 'sale_expenses',
        'salary_distribution', 'notifications', 'documents', 'tramites',
        'vehicle_appraisals', 'ai_conversations', 'ai_messages', 'ai_usage_logs',
        'ai_branch_brain', 'studio_prompts', 'studio_ia_description_examples',
        'whatsapp_inboxes', 'messages', 'whatsapp_calls', 'meta_ads_connections',
        'marketplace_connections', 'vehicle_listings', 'n8n_workspaces',
        'n8n_workflow_executions', 'branch_sales_staff', 'lead_ingest_keys',
        'users', 'branches', 'tenants', 'tenant_feature_flags',
        'tenant_billing', 'tenant_invitations'
      ]
    )) as table_name
  )
  select jsonb_agg(
    jsonb_build_object(
      'table', c.table_name,
      'rls_enabled', coalesce(t.relrowsecurity, false),
      'policy_count', coalesce(p.policy_count, 0),
      'has_tenant_filter', coalesce(p.has_tenant_filter, false),
      'has_branch_filter', coalesce(p.has_branch_filter, false),
      'policies', coalesce(p.policy_details, '[]'::jsonb)
    )
    order by c.table_name
  )
  from critical c
  left join pg_class t
    on t.relname = c.table_name
   and t.relnamespace = 'public'::regnamespace
  left join lateral (
    select
      count(*) as policy_count,
      bool_or(
        coalesce(qual, '') ilike '%tenant_id%'
        or coalesce(with_check, '') ilike '%tenant_id%'
        or coalesce(qual, '') ilike '%current_tenant_id%'
        or coalesce(with_check, '') ilike '%current_tenant_id%'
      ) as has_tenant_filter,
      bool_or(
        coalesce(qual, '') ilike '%branch_id%'
        or coalesce(with_check, '') ilike '%branch_id%'
      ) as has_branch_filter,
      jsonb_agg(
        jsonb_build_object(
          'name', policyname,
          'cmd', cmd,
          'qual', qual,
          'check', with_check
        )
      ) as policy_details
    from pg_policies
    where schemaname = 'public'
      and tablename = c.table_name
  ) p on true;
$$;

-- Solo service_role puede llamarla (revoke a roles públicos por seguridad).
revoke execute on function public.audit_rls_status(text[]) from public, anon, authenticated;

comment on function public.audit_rls_status(text[]) is
  'Auditoría on-demand de RLS en tablas críticas. Devuelve por tabla: rls_enabled, '
  'policy_count, has_tenant_filter, has_branch_filter, policies[]. Sólo service_role. '
  'Uso desde `npm run check:rls` o SQL Editor.';
