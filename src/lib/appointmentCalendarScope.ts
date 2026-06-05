export type AppointmentCalendarScope = "self" | "branch" | "tenant";

export interface AppointmentCalendarScopeResult {
  scope: AppointmentCalendarScope;
  userId?: string;
  tenantId?: string;
  branchId?: string;
  /** Copy para UI del dashboard / sidebar de citas */
  listDescription: string;
}

type ScopeUser = {
  role?: string;
  id?: string;
  tenant_id?: string;
  branch_id?: string;
} | null | undefined;

/** Misma lógica de visibilidad que `Appointments.tsx` (calendar:self | team | tenant). */
export function resolveAppointmentCalendarScope(user: ScopeUser): AppointmentCalendarScopeResult | null {
  if (!user?.role) return null;

  const role = user.role;

  if (role === "vendedor") {
    return {
      scope: "self",
      userId: user.id,
      listDescription: "Tus citas programadas",
    };
  }

  if (role === "admin" || role === "financiero" || role === "jefe_jefe") {
    return {
      scope: "tenant",
      tenantId: user.tenant_id,
      listDescription: "Calendario de la automotora",
    };
  }

  if (
    role === "gerente" ||
    role === "servicio" ||
    role === "inventario" ||
    role === "jefe_sucursal"
  ) {
    return {
      scope: "branch",
      branchId: user.branch_id,
      listDescription: "Citas de tu sucursal",
    };
  }

  return null;
}

export function isAppointmentCalendarQueryEnabled(
  scope: AppointmentCalendarScopeResult | null,
): boolean {
  if (!scope) return false;
  if (scope.scope === "self") return !!scope.userId;
  if (scope.scope === "tenant") return !!scope.tenantId;
  return !!scope.branchId;
}
