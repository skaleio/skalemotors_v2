import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { useSellerEngagement } from "@/hooks/useSellerEngagement";
import {
  CRM_ACTIVITY_WINDOW_DAYS,
  formatCrmActivityBreakdown,
} from "@/lib/crmVendorActivityScore";
import {
  buildCrmVendorTeamPerformance,
  type CrmVendorPerformanceRow,
} from "@/lib/crmVendorTeamPerformance";
import { cn } from "@/lib/utils";
import { BarChart3, ChevronDown, Loader2 } from "lucide-react";
import { useMemo } from "react";

type VendorOption = { id: string; full_name?: string | null; email?: string | null };

type LeadLike = {
  assigned_to: string | null;
  status: string | null;
  tags: unknown;
  updated_at?: string | null;
  status_changed_at?: string | null;
  contact_attempts?: number | null;
  last_contact_at?: string | null;
};

export interface CrmTeamPerformanceBarProps {
  leads: LeadLike[];
  vendors: VendorOption[];
  enabled?: boolean;
  onSelectVendor?: (vendorId: string) => void;
  className?: string;
}

function VendorPerformanceRow({
  row,
  onSelect,
}: {
  row: CrmVendorPerformanceRow;
  onSelect?: (vendorId: string) => void;
}) {
  const { activity } = row;
  return (
    <button
      type="button"
      onClick={() => onSelect?.(row.vendorId)}
      className={cn(
        "w-full rounded-md border border-transparent px-2.5 py-2 text-left transition-colors",
        "hover:border-border hover:bg-muted/50",
        activity.isInactive && "border-rose-500/20 bg-rose-500/5",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium truncate">{row.name}</span>
        <span
          className={cn(
            "text-xs font-semibold tabular-nums shrink-0",
            activity.activityScore >= 55 && "text-emerald-600 dark:text-emerald-400",
            activity.activityScore < 30 && "text-amber-600 dark:text-amber-400",
            activity.isInactive && "text-rose-600 dark:text-rose-400",
          )}
        >
          {activity.activityScore}%
        </span>
      </div>
      <Progress
        value={activity.activityScore}
        className={cn(
          "h-1.5 mt-1.5 transition-all duration-300",
          activity.activityScore >= 55 && "[&>div]:bg-emerald-500",
          activity.activityScore < 30 && "[&>div]:bg-amber-500",
          activity.isInactive && "[&>div]:bg-rose-500",
        )}
      />
      <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
        {activity.totalLeads} lead{activity.totalLeads === 1 ? "" : "s"} ·{" "}
        {formatCrmActivityBreakdown(activity)} · {activity.activityLabel}
        {activity.staleOpenLeads > 0 ? (
          <span className="text-rose-600 dark:text-rose-400">
            {" "}
            · {activity.staleOpenLeads} estancado{activity.staleOpenLeads === 1 ? "" : "s"}
          </span>
        ) : null}
      </p>
    </button>
  );
}

export function CrmTeamPerformanceBar({
  leads,
  vendors,
  enabled = true,
  onSelectVendor,
  className,
}: CrmTeamPerformanceBarProps) {
  const { user } = useAuth();
  const { data: engagementRows = [], isLoading: loadingEngagement } = useSellerEngagement({
    enabled,
    branchId: user?.branch_id ?? null,
    windowDays: CRM_ACTIVITY_WINDOW_DAYS,
  });

  const stats = useMemo(
    () =>
      buildCrmVendorTeamPerformance({
        leads,
        vendors,
        engagementRows,
      }),
    [leads, vendors, engagementRows],
  );

  if (!enabled) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-auto min-h-10 w-full sm:w-auto sm:min-w-[220px] sm:max-w-[320px] justify-start gap-2 px-3 py-2",
            className,
          )}
          aria-label="Desempeño por actividad en CRM"
        >
          <BarChart3 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1 text-left">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="font-medium truncate">Desempeño CRM</span>
              {loadingEngagement ? (
                <Loader2 className="h-3 w-3 animate-spin shrink-0 text-muted-foreground" />
              ) : (
                <span
                  className={cn(
                    "tabular-nums font-semibold shrink-0",
                    stats.teamActivityAvg >= 55 && "text-emerald-600 dark:text-emerald-400",
                    stats.teamActivityAvg < 30 && "text-amber-600 dark:text-amber-400",
                  )}
                >
                  {stats.activeVendorCount > 0 ? `${stats.teamActivityAvg}%` : "—"}
                </span>
              )}
            </div>
            {!loadingEngagement && stats.activeVendorCount > 0 ? (
              <Progress
                value={stats.teamActivityAvg}
                className={cn(
                  "h-1.5 mt-1 transition-all duration-300",
                  stats.teamActivityAvg >= 55 && "[&>div]:bg-emerald-500",
                  stats.teamActivityAvg < 30 && "[&>div]:bg-amber-500",
                  stats.teamStaleLeads > 0 && stats.teamActivityAvg < 55 && "[&>div]:bg-amber-500",
                )}
              />
            ) : (
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                {loadingEngagement ? "Calculando…" : "Sin vendedores con leads"}
              </p>
            )}
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(100vw-2rem,22rem)] p-0">
        <div className="border-b px-3 py-2.5">
          <p className="text-sm font-semibold">Actividad en CRM</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
            La barra sube al mover leads, agregar notas o marcar contactos. Baja si hay leads
            abiertos sin movimiento hace más de 48 h (últimos {CRM_ACTIVITY_WINDOW_DAYS} días).
          </p>
        </div>
        {loadingEngagement ? (
          <div className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando actividad…
          </div>
        ) : stats.activeVendorCount === 0 ? (
          <p className="px-3 py-6 text-sm text-muted-foreground text-center">
            Ningún vendedor tiene leads asignados en el CRM.
          </p>
        ) : (
          <>
            <div className="px-3 py-2.5 space-y-2 border-b bg-muted/20">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Promedio equipo</span>
                <span className="font-semibold tabular-nums">{stats.teamActivityAvg}%</span>
              </div>
              <Progress
                value={stats.teamActivityAvg}
                className={cn(
                  "h-2 transition-all duration-300",
                  stats.teamActivityAvg >= 55 && "[&>div]:bg-emerald-500",
                  stats.teamActivityAvg < 30 && "[&>div]:bg-amber-500",
                )}
              />
              <p className="text-[10px] text-muted-foreground">
                {stats.activeVendorCount} vendedor{stats.activeVendorCount === 1 ? "" : "es"} ·{" "}
                {stats.totalLeads} leads · {stats.teamPipelineMoves} movimientos ·{" "}
                {stats.teamStaleLeads > 0
                  ? `${stats.teamStaleLeads} lead(s) estancado(s) bajan el score`
                  : "sin leads estancados"}
              </p>
            </div>
            <div className="max-h-[min(50vh,320px)] overflow-y-auto p-2 space-y-1">
              {stats.vendors.map((row) => (
                <VendorPerformanceRow key={row.vendorId} row={row} onSelect={onSelectVendor} />
              ))}
            </div>
            {onSelectVendor ? (
              <p className="border-t px-3 py-2 text-[10px] text-muted-foreground">
                Toca un vendedor para ver su CRM.
              </p>
            ) : null}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
