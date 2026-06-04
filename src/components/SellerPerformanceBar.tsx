import { Progress } from "@/components/ui/progress";
import {
  engagementScoreLabel,
  formatEngagementBreakdown,
  type SellerEngagementRow,
} from "@/lib/sellerEngagement";
import { cn } from "@/lib/utils";

type SellerPerformanceBarProps = {
  engagement: Pick<
    SellerEngagementRow,
    | "engagement_score"
    | "notes_count"
    | "activities_count"
    | "lead_moves_count"
    | "is_inactive"
    | "stale_assigned_leads"
  >;
  className?: string;
  compact?: boolean;
  showMetaLabel?: boolean;
};

export function SellerPerformanceBar({
  engagement,
  className,
  compact = false,
  showMetaLabel = true,
}: SellerPerformanceBarProps) {
  const score = engagement.engagement_score;
  const label = engagementScoreLabel(score);
  const breakdown = formatEngagementBreakdown(engagement);

  return (
    <div className={cn("space-y-1.5", className)}>
      {showMetaLabel && (
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="text-muted-foreground">Desempeño (actividad)</span>
          <span
            className={cn(
              "font-medium tabular-nums",
              score >= 55
                ? "text-emerald-600 dark:text-emerald-400"
                : score >= 30
                  ? "text-foreground"
                  : "text-amber-600 dark:text-amber-400",
            )}
          >
            {score}% · {label}
          </span>
        </div>
      )}
      <Progress
        value={score}
        className={cn(
          compact ? "h-2" : "h-2.5",
          score >= 80 && "[&>div]:bg-emerald-500",
          score < 30 && "[&>div]:bg-amber-500",
          engagement.is_inactive && "[&>div]:bg-rose-500",
        )}
        aria-label={`Desempeño por actividad: ${score}%`}
      />
      {!compact && (
        <p className="text-[10px] text-muted-foreground leading-snug">
          {breakdown}
          {engagement.is_inactive ? (
            <span className="block text-rose-600 dark:text-rose-400 font-medium mt-0.5">
              Sin actividad reciente · {engagement.stale_assigned_leads} lead(s) estancado(s)
            </span>
          ) : (
            <span className="block mt-0.5">Últimos 7 días: notas, actividades, movimientos y uso de la app.</span>
          )}
        </p>
      )}
    </div>
  );
}
