import type { BranchSeller } from "@/lib/delegatableSellersScope";
import {
  parseTimeInput,
  setTimeOnDate,
} from "@/lib/appointmentFormTime";

export const DEFAULT_APPOINTMENT_START_TIME = "10:00";
export const DEFAULT_APPOINTMENT_END_TIME = "11:00";

type AuthSlice = {
  id?: string;
  tenant_id?: string | null;
  branch_id?: string | null;
  role?: string;
};

export type AppointmentWritePayload = {
  title: string;
  description: string | null;
  type: string;
  status: string;
  scheduled_at: string;
  end_at: string;
  duration_minutes: number;
  lead_id: string | null;
  vehicle_id: string | null;
  client_phone: string | null;
  user_id: string | null;
  branch_id: string | null;
  tenant_id: string;
};

/** Horario laboral por defecto al elegir un día en el calendario (evita 00:00). */
export function defaultAppointmentTimesForDay(day: Date): { start: Date; end: Date } {
  const start = setTimeOnDate(day, DEFAULT_APPOINTMENT_START_TIME);
  const end = setTimeOnDate(day, DEFAULT_APPOINTMENT_END_TIME);
  return { start, end };
}

export function resolveAppointmentTimes(params: {
  day: Date;
  startTimeStr: string;
  endTimeStr: string;
  fallbackStart?: Date;
  fallbackEnd?: Date;
}): { start: Date; end: Date } {
  const { day, startTimeStr, endTimeStr, fallbackStart, fallbackEnd } = params;
  const defaults = defaultAppointmentTimesForDay(day);

  let start = fallbackStart && !Number.isNaN(fallbackStart.getTime()) ? fallbackStart : defaults.start;
  let end = fallbackEnd && !Number.isNaN(fallbackEnd.getTime()) ? fallbackEnd : defaults.end;

  const startParsed = parseTimeInput(startTimeStr) ?? DEFAULT_APPOINTMENT_START_TIME;
  const endParsed = parseTimeInput(endTimeStr) ?? DEFAULT_APPOINTMENT_END_TIME;

  start = setTimeOnDate(start, startParsed);
  end = setTimeOnDate(start, endParsed);

  if (end.getTime() <= start.getTime()) {
    end = new Date(start.getTime() + 60 * 60 * 1000);
  }

  return { start, end };
}

export function resolveAppointmentAssigneeId(params: {
  user: AuthSlice;
  isVendor: boolean;
  canDelegate: boolean;
  formUserId?: string | null;
}): string | null {
  const { user, isVendor, canDelegate, formUserId } = params;
  if (isVendor) return user.id ?? null;
  if (canDelegate) {
    const trimmed = formUserId?.trim() ?? "";
    return trimmed.length > 0 ? trimmed : user.id ?? null;
  }
  return user.id ?? null;
}

export function buildAppointmentWritePayload(params: {
  title: string;
  description?: string | null;
  type: string;
  status: string;
  start: Date;
  end: Date;
  leadId?: string | null;
  vehicleId?: string | null;
  clientPhone?: string | null;
  assigneeId: string | null;
  assigneeSeller?: BranchSeller | null;
  tenantId: string | null | undefined;
  fallbackBranchId?: string | null;
  leadBranchId?: string | null;
}): AppointmentWritePayload {
  const tenantId = params.tenantId?.trim();
  if (!tenantId) {
    throw new Error("No se pudo determinar la automotora (tenant). Vuelve a iniciar sesión.");
  }

  const durationMinutes = Math.max(
    15,
    Math.round((params.end.getTime() - params.start.getTime()) / 60_000),
  );

  return {
    title: params.title.trim(),
    description: params.description?.trim() || null,
    type: params.type || "meeting",
    status: params.status || "programada",
    scheduled_at: params.start.toISOString(),
    end_at: params.end.toISOString(),
    duration_minutes: durationMinutes,
    lead_id: params.leadId?.trim() || null,
    vehicle_id: params.vehicleId?.trim() || null,
    client_phone: params.clientPhone?.trim() || null,
    user_id: params.assigneeId,
    branch_id:
      params.assigneeSeller?.branch_id ??
      params.leadBranchId ??
      params.fallbackBranchId ??
      null,
    tenant_id: tenantId,
  };
}

/** Si el vendedor no es dueño de la cita existente, no intentar UPDATE (RLS lo bloquea). */
export function resolveWritableAppointmentId(params: {
  existingId: string | null;
  existingOwnerUserId: string | null | undefined;
  currentUserId: string | null | undefined;
  isVendor: boolean;
}): string | null {
  if (!params.existingId) return null;
  if (!params.isVendor) return params.existingId;
  if (!params.currentUserId) return null;
  if (params.existingOwnerUserId && params.existingOwnerUserId !== params.currentUserId) {
    return null;
  }
  return params.existingId;
}

export function formatAppointmentSaveError(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { code?: string; message?: string; details?: string; hint?: string };
    const msg = e.message ?? "";

    if (e.code === "42501" || msg.toLowerCase().includes("row-level security")) {
      return "No tienes permiso para guardar esta cita con el vendedor o calendario elegido.";
    }
    if (e.code === "23514") {
      return "Revisa tipo de evento, estado u horario de la cita.";
    }
    if (msg.includes("client_phone") || msg.includes("column")) {
      return "Error de configuración en el servidor. Avísale al administrador.";
    }
    if (msg.includes("leads_status_check") || msg.includes("agendado")) {
      return "La cita se guardó, pero no se pudo mover el lead a Agendado. Recarga el CRM.";
    }
    if (msg.trim()) return msg;
  }
  if (err instanceof Error && err.message.trim()) return err.message;
  return "Intenta de nuevo.";
}
