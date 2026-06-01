import { leadSchedulePanelClass } from "@/components/crm/leadScheduleCalendarStyles";
import { parseCrmLeadQuickAppointmentMotive } from "@/lib/crmLeadQuickAppointment";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";

type LeadScheduleEventTagProps = {
  scheduledAtIso: string;
  description?: string | null;
  footnote?: string;
  className?: string;
};

/** Chip estilo evento del calendario (fecha + motivo) para vista lectura. */
export function LeadScheduleEventTag({
  scheduledAtIso,
  description,
  footnote,
  className,
}: LeadScheduleEventTagProps) {
  const d = parseISO(scheduledAtIso);
  if (Number.isNaN(d.getTime())) return null;

  const motive = parseCrmLeadQuickAppointmentMotive(description);

  return (
    <div className={cn(leadSchedulePanelClass, "space-y-2 p-3", className)}>
      <div className="flex items-stretch overflow-hidden rounded-xl border border-zinc-700/70 bg-zinc-900/90">
        <span className="w-1 shrink-0 bg-emerald-500" aria-hidden />
        <div className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5">
          <span className="shrink-0 text-xs font-bold tabular-nums text-zinc-200">
            {format(d, "dd/MM/yy")}
          </span>
          <span className="h-3 w-px shrink-0 bg-zinc-600" aria-hidden />
          <span className="truncate text-xs text-zinc-400">{motive || "Sin motivo"}</span>
        </div>
      </div>
      {footnote ? <p className="text-[11px] text-zinc-500">{footnote}</p> : null}
    </div>
  );
}
