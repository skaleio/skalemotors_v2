import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { useSellerEngagement } from "@/hooks/useSellerEngagement";
import {
  buildCrmVendorTeamPerformance,
  type CrmVendorPerformanceRow,
} from "@/lib/crmVendorTeamPerformance";
import { engagementScoreLabel, formatEngagementBreakdown } from "@/lib/sellerEngagement";
import { cn } from "@/lib/utils";
import { BarChart3, ChevronDown, Loader2 } from "lucide-react";
import { useMemo } from "react";

type VendorOption = { id: string; full_name?: string | null; email?: string | null };

type LeadLike = {
  assigned_to: string | null;
  tags: unknown;
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
  return (
    <button
      type="button"
      onClick={() => onSelect?.(row.vendorId)}
      className={cn(
        "w-full rounded-md border border-transparent px-2.5 py-2 text-left transition-colors",
        "hover:border-border hover:bg-muted/50",
        row.isInactive && "border-rose-500/20 bg-rose-500/5",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium truncate">{row.name}</span>
        <span className="text-xs font-semibold tabular-nums shrink-0">
          {row.leadMovesCount} mov.
        </span>
      </div>
      <Progress
        value={row.engagementScore}
        className={cn(
          "h-1.5 mt-1.5",
          row.engagementScore >= 55 && "[&>div]:bg-emerald-500",
          row.engagementScore < 30 && "[&>div]:bg-amber-500",
          row.isInactive && "[&>div]:bg-rose-500",
        )}
      />
      <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
        {row.leadCount} lead{row.leadCount === 1 ? "" : "s"} ·{" "}
        {formatEngagementBreakdown({
          notes_count: row.notesCount,
          activities_count: row.activitiesCount,
          lead_moves_count: row.leadMovesCount,
        })}{" "}
        · {engagementScoreLabel(row.engagementScore)}
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
    windowDays: 7,
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
          aria-label="Movimientos de vendedores en CRM"
        >
          <BarChart3 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1 text-left">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="font-medium truncate">Actividad CRM</span>
              {loadingEngagement ? (
                <Loader2 className="h-3 w-3 animate-spin shrink-0 text-muted-foreground" />
              ) : (
                <span className="tabular-nums font-semibold shrink-0">
                  {stats.activeVendorCount > 0 ? stats.teamMoveCount : "—"}
                </span>
              )}
            </div>
            {!loadingEngagement && stats.activeVendorCount > 0 ? (
              <Progress
                value={stats.teamEngagementAvg}
                className={cn(
                  "h-1.5 mt-1",
                  stats.teamEngagementAvg >= 55 && "[&>div]:bg-emerald-500",
                  stats.teamEngagementAvg < 30 && "[&>div]:bg-amber-500",
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
          <p className="text-sm font-semibold">Movimientos en CRM</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
            Últimos 7 días: cambios de estado, arrastres de columna, notas y actividad sobre leads
            asignados.
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
                <span className="text-muted-foreground">Equipo (7 días)</span>
                <span className="font-semibold tabular-nums">
                  {stats.teamMoveCount} movimientos
                </span>
              </div>
              <Progress
                value={stats.teamEngagementAvg}
                className={cn(
                  "h-2",
                  stats.teamEngagementAvg >= 55 && "[&>div]:bg-emerald-500",
                  stats.teamEngagementAvg < 30 && "[&>div]:bg-amber-500",
                )}
              />
              <p className="text-[10px] text-muted-foreground">
                {stats.activeVendorCount} vendedor{stats.activeVendorCount === 1 ? "" : "es"} ·{" "}
                {stats.totalLeads} leads · actividad promedio {stats.teamEngagementAvg}% (
                {engagementScoreLabel(stats.teamEngagementAvg).toLowerCase()})
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
