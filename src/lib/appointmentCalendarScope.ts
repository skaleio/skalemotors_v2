import type { DelegatableSellersScope } from "@/lib/delegatableSellersScope";
import { resolveDelegatableSellersScope } from "@/lib/delegatableSellersScope";

export type AppointmentCalendarScope = "self" | "branch" | "tenant";

/** Mismos roles que el selector «Ver CRM de vendedor» en `CRM.tsx`. */
export const CAN_SUPERVISE_APPOINTMENTS = new Set([
  "admin",
  "gerente",
  "jefe_jefe",
  "jefe_sucursal",
  "financiero",
]);

const TENANT_WIDE_SUPERVISION_ROLES = new Set(["admin", "jefe_jefe"]);

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

/**
 * Vendedores que un supervisor puede elegir en el calendario.
 * - admin / jefe_jefe: todos los vendedores del tenant.
 * - gerente / jefe_sucursal / financiero: mismo alcance delegable que CRM (equipo, sucursal o tenant).
 */
export function resolveAppointmentSupervisionVendorScope(
  user: ScopeUser,
): DelegatableSellersScope | null {
  if (!user?.tenant_id || !user.role || !CAN_SUPERVISE_APPOINTMENTS.has(user.role)) {
    return null;
  }

  if (TENANT_WIDE_SUPERVISION_ROLES.has(user.role)) {
    return { tenantId: user.tenant_id, scope: "tenant", roles: ["vendedor"] };
  }

  if (user.role === "financiero" && !user.branch_id) {
    return { tenantId: user.tenant_id, scope: "tenant", roles: ["vendedor"] };
  }

  return resolveDelegatableSellersScope(user, ["vendedor"]);
}

export interface AppointmentQueryFilters {
  userId?: string;
  tenantId?: string;
  branchId?: string;
}

/** Filtros de query: vista global del rol o calendario de un vendedor supervisado (validado). */
export function resolveSupervisedAppointmentQueryFilters(
  calendarScope: AppointmentCalendarScopeResult | null,
  supervisedVendorId: string | null | undefined,
  allowedVendorIds: readonly string[],
): AppointmentQueryFilters {
  const allowed = new Set(allowedVendorIds);
  const effectiveVendorId =
    supervisedVendorId && allowed.has(supervisedVendorId) ? supervisedVendorId : null;

  if (effectiveVendorId) {
    return { userId: effectiveVendorId };
  }

  return {
    userId: calendarScope?.userId,
    tenantId: calendarScope?.tenantId,
    branchId: calendarScope?.branchId,
  };
}

/** Defensa en profundidad: solo filas del tenant actual y, si aplica, del vendedor supervisado. */
export function filterAppointmentsForCalendarView<
  T extends { tenant_id?: string | null; user_id?: string | null },
>(
  rows: T[],
  tenantId: string | undefined,
  supervisedVendorId: string | null,
): T[] {
  let out = rows;
  if (tenantId) {
    out = out.filter((row) => row.tenant_id === tenantId);
  }
  if (supervisedVendorId) {
    out = out.filter((row) => row.user_id === supervisedVendorId);
  }
  return out;
}
