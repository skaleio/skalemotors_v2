-- Calendario (appointments) por alcance + multi-tenant real
-- Regla: nunca mezclar datos entre tenant/equipos no autorizados
-- Regla legacy: hessen@test.io mantiene comportamiento vía legacy_protected=true

alter table public.appointments enable row level security;

-- No se crea si ya existe (evita duplicados al re-ejecutar migrations manuales)
drop policy if exists appointments_rw_scope on public.appointments;

create policy appointments_rw_scope
on public.appointments
for all
to authenticated
using (
  public.current_is_legacy_protected()
  or (
    -- Alcance por rol (mapeo actual DB -> plan SaaS)
    (
      (
        public.current_user_role() = 'vendedor'
        and user_id = auth.uid()
        and (
          tenant_id = public.current_tenant_id()
          or tenant_id is null
        )
      )
      or
      (
        public.current_user_role() in ('gerente', 'servicio', 'inventario')
        and branch_id = (select u.branch_id from public.users u where u.id = auth.uid())
        and (
          tenant_id = public.current_tenant_id()
          or tenant_id is null
        )
      )
      or
      (
        public.current_user_role() in ('admin', 'financiero')
        and (
          tenant_id = public.current_tenant_id()
          or (tenant_id is null and branch_id = (select u.branch_id from public.users u where u.id = auth.uid()))
        )
      )
    )
    -- Validar referencias (lead/vehicle) pertenecen al mismo tenant/equipo
    and (
      lead_id is null
      or exists (
        select 1
        from public.leads l
        where l.id = appointments.lead_id
          and (
            public.current_is_legacy_protected()
            or l.tenant_id = public.current_tenant_id()
            or (l.tenant_id is null and l.branch_id = (select u.branch_id from public.users u where u.id = auth.uid()))
          )
      )
    )
    and (
      vehicle_id is null
      or exists (
        select 1
        from public.vehicles v
        where v.id = appointments.vehicle_id
          and (
            public.current_is_legacy_protected()
            or v.tenant_id = public.current_tenant_id()
            or (v.tenant_id is null and v.branch_id = (select u.branch_id from public.users u where u.id = auth.uid()))
          )
      )
    )
  )
)
with check (
  public.current_is_legacy_protected()
  or (
    (
      (
        public.current_user_role() = 'vendedor'
        and user_id = auth.uid()
        and (
          tenant_id = public.current_tenant_id()
          or tenant_id is null
        )
      )
      or
      (
        public.current_user_role() in ('gerente', 'servicio', 'inventario')
        and branch_id = (select u.branch_id from public.users u where u.id = auth.uid())
        and (
          tenant_id = public.current_tenant_id()
          or tenant_id is null
        )
      )
      or
      (
        public.current_user_role() in ('admin', 'financiero')
        and (
          tenant_id = public.current_tenant_id()
          or (tenant_id is null and branch_id = (select u.branch_id from public.users u where u.id = auth.uid()))
        )
      )
    )
    and (
      lead_id is null
      or exists (
        select 1
        from public.leads l
        where l.id = appointments.lead_id
          and (
            public.current_is_legacy_protected()
            or l.tenant_id = public.current_tenant_id()
            or (l.tenant_id is null and l.branch_id = (select u.branch_id from public.users u where u.id = auth.uid()))
          )
      )
    )
    and (
      vehicle_id is null
      or exists (
        select 1
        from public.vehicles v
        where v.id = appointments.vehicle_id
          and (
            public.current_is_legacy_protected()
            or v.tenant_id = public.current_tenant_id()
            or (v.tenant_id is null and v.branch_id = (select u.branch_id from public.users u where u.id = auth.uid()))
          )
      )
    )
  )
);

