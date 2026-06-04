import { Progress } from "@/components/ui/progress";
import { computeSellerPerformance } from "@/lib/sellerPerformance";
import { cn } from "@/lib/utils";

type SellerSalesGoalBarProps = {
  salesCount: number;
  goal: number;
  className?: string;
  compact?: boolean;
};

export function SellerSalesGoalBar({
  salesCount,
  goal,
  className,
  compact = false,
}: SellerSalesGoalBarProps) {
  const { percent, label, exceeded } = computeSellerPerformance(salesCount, goal);

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="text-muted-foreground">Meta de ventas (mes)</span>
        <span
          className={cn(
            "font-medium tabular-nums",
            exceeded
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-foreground",
          )}
        >
          {percent}% · {label}
        </span>
      </div>
      <Progress
        value={percent}
        className={cn(compact ? "h-2" : "h-2.5", exceeded && "[&>div]:bg-emerald-500")}
        aria-label={`Meta de ventas: ${percent}%`}
      />
    </div>
  );
}
