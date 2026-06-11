import { format, parseISO } from "date-fns";

import type { Database } from "@/lib/types/database";

export type AppointmentRow = Database["public"]["Tables"]["appointments"]["Row"];

/** Título fijo para el recordatorio del lead en modal CRM/Leads (upsert por lead). */
export const CRM_LEAD_QUICK_APPOINTMENT_TITLE = "Seguimiento lead · CRM";

/** Títulos anteriores (migración suave). */
const CRM_LEAD_QUICK_APPOINTMENT_LEGACY_TITLES = [
  "Cita CRM · seguimiento",
  CRM_LEAD_QUICK_APPOINTMENT_TITLE,
] as const;

const LEGACY_DESCRIPTION_PREFIX = /^Seguimiento CRM · /i;
const AUTO_DESCRIPTION_PREFIX = /^Seguimiento · /i;

function isCrmLeadQuickAppointmentTitle(title: string | null | undefined): boolean {
  const t = title?.trim() ?? "";
  return (CRM_LEAD_QUICK_APPOINTMENT_LEGACY_TITLES as readonly string[]).includes(t);
}

const ACTIVE: ReadonlySet<AppointmentRow["status"]> = new Set(["programada", "confirmada"]);

export function pickActiveCrmLeadQuickAppointment(rows: AppointmentRow[]): AppointmentRow | null {
  const candidates = rows.filter(
    (r) => isCrmLeadQuickAppointmentTitle(r.title) && ACTIVE.has(r.status),
  );
  if (!candidates.length) return null;
  candidates.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  return candidates[0];
}

/** Cita activa del lead (cualquier título), p. ej. al reabrir AGENDADO desde CRM. */
export function pickActiveLeadAppointment(rows: AppointmentRow[]): AppointmentRow | null {
  const candidates = rows.filter((r) => ACTIVE.has(r.status));
  if (!candidates.length) return null;
  candidates.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  return candidates[0];
}

/** Motivo escrito por el usuario en `appointments.description` (formatos legacy sin motivo → ""). */
export function parseCrmLeadQuickAppointmentMotive(description: string | null | undefined): string {
  const trimmed = description?.trim() ?? "";
  if (!trimmed || LEGACY_DESCRIPTION_PREFIX.test(trimmed) || AUTO_DESCRIPTION_PREFIX.test(trimmed)) {
    return "";
  }
  return trimmed;
}

/** Ej. `27/07/26 · Volver a llamar` o solo `27/07/26` */
export function formatLeadScheduleDisplayLine(
  scheduledAtIso: string,
  motive?: string | null,
): string {
  const d = parseISO(scheduledAtIso);
  if (Number.isNaN(d.getTime())) return "";
  const datePart = format(d, "dd/MM/yy");
  const m = motive?.trim();
  return m ? `${datePart} · ${m}` : datePart;
}

/** @deprecated Usar formatLeadScheduleDisplayLine */
export function formatLeadCitaDisplayLine(scheduledAtIso: string, motive?: string | null): string {
  return formatLeadScheduleDisplayLine(scheduledAtIso, motive);
}

/** Hora local por defecto para citas solo-fecha desde CRM (ajustable después en Citas). */
export const CRM_LEAD_QUICK_APPOINTMENT_START_HOUR = 10;
export const CRM_LEAD_QUICK_APPOINTMENT_DURATION_MIN = 45;
