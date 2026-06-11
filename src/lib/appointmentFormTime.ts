import { format } from "date-fns";
import { es } from "date-fns/locale";

/** Formato HH:mm para mostrar/editar hora (24h). */
export function safeFormatTime(d: Date | undefined | null): string {
  if (!d || Number.isNaN(d.getTime())) return "";
  return format(d, "HH:mm");
}

/** Parsea texto escrito por el usuario a "HH:mm" (24h). */
export function parseTimeInput(input: string): string | null {
  const t = input.trim().replace(/,/, ".");
  if (!t) return null;
  const withColon = t.includes(":")
    ? t
    : t.replace(/(\d{1,2})(\d{2})?$/, (_, h, m) => (m ? `${h}:${m}` : `${h}:00`));
  const [hStr, mStr] = withColon.split(":");
  const h = parseInt(hStr ?? "0", 10);
  const m = Math.min(59, parseInt(mStr ?? "0", 10) || 0);
  if (h < 0 || h > 23 || Number.isNaN(h)) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Actualiza solo la hora de una fecha (mantiene el día). */
export function setTimeOnDate(date: Date, timeStr: string): Date {
  const parsed = parseTimeInput(timeStr) ?? "00:00";
  const [h = 0, m = 0] = parsed.split(":").map(Number);
  const out = new Date(date);
  out.setHours(h, m, 0, 0);
  return out;
}

export function formatAppointmentDayLabel(date: Date): string {
  return format(date, "EEEE d 'de' MMMM yyyy", { locale: es });
}
