import { Button } from "@/components/ui/button";
import {
  aggregateLeadsByCrmStage,
  CRM_STAGE_DOT_CLASS,
  type CrmStageKey,
} from "@/lib/crmPipeline";
import { cn } from "@/lib/utils";
import { ChevronRight, Users } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";

const STAGE_BAR_CLASS: Record<CrmStageKey, string> = {
  nuevo: "from-cyan-500 to-cyan-400",
  contactado: "from-blue-500 to-blue-400",
  agendado: "from-sky-500 to-sky-400",
  negociando: "from-orange-500 to-amber-400",
  en_espera: "from-violet-500 to-violet-400",
  para_cierre: "from-emerald-500 to-emerald-400",
  negocio_cerrado: "from-red-600 to-rose-500",
  cancelado: "from-rose-500 to-rose-400",
};

function friendlyStageLabel(label: string): string {
  return label
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

type SalesPipelineChartProps = {
  leadsByStatus: ReadonlyArray<{ status: string; count: number }>;
};

export function SalesPipelineChart({ leadsByStatus }: SalesPipelineChartProps) {
  const { stages, perdidos, totalInPipeline } = useMemo(
    () => aggregateLeadsByCrmStage(leadsByStatus),
    [leadsByStatus],
  );

  const totalLeads = useMemo(
    () => stages.reduce((sum, s) => sum + s.count, 0) + perdidos,
    [stages, perdidos],
  );

  const maxCount = useMemo(
    () => Math.max(1, ...stages.map((s) => s.count)),
    [stages],
  );

  const cerrados = stages.find((s) => s.stageKey === "negocio_cerrado")?.count ?? 0;

  if (totalLeads === 0) {
    return (
      <div className="flex h-[320px] flex-col items-center justify-center text-muted-foreground">
        <Users className="mb-3 h-12 w-12 opacity-20" />
        <p className="text-sm font-medium">No hay leads registrados</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[320px] flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs font-medium text-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          {totalInPipeline} en pipeline
        </span>
        {cerrados > 0 && (
          <span className="inline-flex items-center rounded-full border border-red-200/60 bg-red-50 px-3 py-1 text-xs font-medium text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
            {cerrados} cerrados
          </span>
        )}
        {perdidos > 0 && (
          <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-xs font-medium text-muted-foreground">
            {perdidos} perdidos
          </span>
        )}
      </div>

      <ol className="flex-1 space-y-3.5" aria-label="Embudo de ventas por etapa">
        {stages.map((stage) => {
          const pct = totalLeads > 0 ? Math.round((stage.count / totalLeads) * 100) : 0;
          const barWidth = stage.count > 0 ? Math.max(8, (stage.count / maxCount) * 100) : 0;

          return (
            <li key={stage.stageKey} className="group">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full ring-2 ring-background",
                      CRM_STAGE_DOT_CLASS[stage.stageKey],
                    )}
                    aria-hidden
                  />
                  <span className="truncate text-sm font-medium text-foreground">
                    {friendlyStageLabel(stage.label)}
                  </span>
                </div>
                <div className="flex shrink-0 items-baseline gap-2 tabular-nums">
                  <span className="text-sm font-semibold text-foreground">{stage.count}</span>
                  <span className="w-9 text-right text-xs text-muted-foreground">{pct}%</span>
                </div>
              </div>
              <div className="relative h-2.5 overflow-hidden rounded-full bg-muted/50">
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full bg-gradient-to-r shadow-sm transition-[width] duration-500 ease-out",
                    STAGE_BAR_CLASS[stage.stageKey],
                    stage.count === 0 && "opacity-0",
                  )}
                  style={{ width: `${barWidth}%` }}
                  role="presentation"
                />
              </div>
            </li>
          );
        })}
      </ol>

      <div className="flex justify-end border-t border-border/50 pt-3">
        <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs text-muted-foreground" asChild>
          <Link to="/app/crm">
            Ver pipeline completo
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
