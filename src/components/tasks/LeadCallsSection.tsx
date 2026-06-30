import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Car, Loader2, Phone } from "lucide-react";

import {
  CRM_PIPELINE_STATUS_LABELS,
  CRM_STAGE_PILL_CLASS,
  getLeadCrmStageKey,
} from "@/lib/crmPipeline";
import { useLeadsCallsForDay } from "@/hooks/useDailySalesReports";
import { cn } from "@/lib/utils";

function LeadStatusPill({ status }: { status: string }) {
  const key = getLeadCrmStageKey(status);
  if (!key) return null;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        CRM_STAGE_PILL_CLASS[key],
      )}
    >
      {CRM_PIPELINE_STATUS_LABELS[key]}
    </span>
  );
}

/**
 * Llamadas a leads del día, derivadas del CRM. Solo lectura: se llena sola con las
 * llamadas que el vendedor registra en el CRM. No edita ni persiste nada.
 */
export function LeadCallsSection({
  userId,
  reportDate,
  enabled = true,
}: {
  userId: string | undefined;
  reportDate: string;
  enabled?: boolean;
}) {
  const { data: calls = [], isLoading, isError } = useLeadsCallsForDay(
    userId,
    reportDate,
    enabled,
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando llamadas a leads…
      </div>
    );
  }

  if (isError) {
    return (
      <p className="py-6 text-sm text-destructive">
        No se pudieron cargar las llamadas a leads del CRM.
      </p>
    );
  }

  if (calls.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
        Aún no hay llamadas a leads registradas este día. Esta sección se completa sola
        cuando registras una llamada en el CRM.
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {calls.map((call) => (
        <article key={call.note_id} className="rounded-lg border bg-card p-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-300">
                <Phone className="h-3.5 w-3.5" aria-hidden />
              </span>
              <p className="truncate font-medium">{call.customer_name}</p>
              {call.lead_status ? <LeadStatusPill status={call.lead_status} /> : null}
            </div>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {format(new Date(call.created_at), "HH:mm", { locale: es })}
            </span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {call.phone ? (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3" aria-hidden />
                {call.phone}
              </span>
            ) : null}
            {call.vehicle_interest ? (
              <span className="inline-flex items-center gap-1">
                <Car className="h-3 w-3" aria-hidden />
                {call.vehicle_interest}
              </span>
            ) : null}
          </div>

          {call.note ? (
            <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/90">{call.note}</p>
          ) : null}
        </article>
      ))}
    </div>
  );
}
