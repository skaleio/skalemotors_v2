import { format, parseISO } from "date-fns";

import type { Database } from "@/lib/types/database";

export type AppointmentRow = Database["public"]["Tables"]["appointments"]["Row"];

/** Título fijo para la cita rápida del modal CRM (upsert por lead). */
export const CRM_LEAD_QUICK_APPOINTMENT_TITLE = "Cita CRM · seguimiento";

const ACTIVE: ReadonlySet<AppointmentRow["status"]> = new Set(["programada", "confirmada"]);

export function pickActiveCrmLeadQuickAppointment(rows: AppointmentRow[]): AppointmentRow | null {
  const candidates = rows.filter(
    (r) => r.title === CRM_LEAD_QUICK_APPOINTMENT_TITLE && ACTIVE.has(r.status),
  );
  if (!candidates.length) return null;
  candidates.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  return candidates[0];
}

/** Ej. `CITA: 27/07/26` */
export function formatLeadCitaDisplayLine(scheduledAtIso: string): string {
  const d = parseISO(scheduledAtIso);
  if (Number.isNaN(d.getTime())) return "";
  return `CITA: ${format(d, "dd/MM/yy")}`;
}

/** Hora local por defecto para citas solo-fecha desde CRM (ajustable después en Citas). */
export const CRM_LEAD_QUICK_APPOINTMENT_START_HOUR = 10;
export const CRM_LEAD_QUICK_APPOINTMENT_DURATION_MIN = 45;
