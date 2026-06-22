import { ArrowDownRight, ArrowUpRight, HelpCircle, type LucideIcon } from "lucide-react";
import { useId } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface KPICardProps {
  label: string;
  value: React.ReactNode;
  delta?: { value: number };
  subtitle?: React.ReactNode;
  icon?: LucideIcon;
  onClick?: () => void;
  loading?: boolean;
  loadingWidth?: "sm" | "md" | "lg";
  valueTone?: "default" | "positive" | "negative";
  /** Tooltip contextual al lado del label. */
  info?: React.ReactNode;
  /** Mini AreaChart a la derecha del valor — útil para mostrar tendencia rápida. */
  sparkline?: number[];
  /** Color custom para la sparkline. Por defecto usa --chart-1 (azul). */
  sparklineColor?: string;
  className?: string;
}

const SKELETON_WIDTHS = { sm: "w-16", md: "w-28", lg: "w-36" };

export function KPICard({
  label,
  value,
  delta,
  subtitle,
  icon: Icon,
  onClick,
  loading,
  loadingWidth = "md",
  valueTone = "default",
  info,
  sparkline,
  sparklineColor = "hsl(var(--chart-1))",
  className,
}: KPICardProps) {
  const isClickable = !!onClick;
  const valueColorCls = {
    default: "text-foreground",
    positive: "text-success",
    negative: "text-destructive",
  }[valueTone];

  return (
    <Card
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={cn(
        "p-5 flex flex-col gap-3 transition-colors",
        isClickable &&
          "cursor-pointer hover:bg-accent/30 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] font-medium tracking-wider uppercase text-muted-foreground line-clamp-2">
            {label}
          </span>
          {info ? (
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="shrink-0 text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-help"
                    aria-label="Más información"
                  >
                    <HelpCircle className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs">
                  {info}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
        </div>
        {Icon ? <Icon className="h-4 w-4 text-muted-foreground shrink-0" /> : null}
      </div>

      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="flex items-end gap-2 flex-wrap min-w-0">
          {loading ? (
            <Skeleton className={cn("h-8", SKELETON_WIDTHS[loadingWidth])} />
          ) : (
            <div className={cn("skale-num text-3xl font-semibold leading-none", valueColorCls)}>
              {value}
            </div>
          )}
          {delta !== undefined && !loading && delta.value !== 0 ? <DeltaPill value={delta.value} /> : null}
        </div>
        {sparkline && sparkline.length > 1 && !loading ? (
          <Sparkline data={sparkline} color={sparklineColor} />
        ) : null}
      </div>

      {loading ? (
        <Skeleton className="h-3 w-24" />
      ) : subtitle ? (
        <div className="text-xs text-muted-foreground truncate">{subtitle}</div>
      ) : null}
    </Card>
  );
}

function DeltaPill({ value }: { value: number }) {
  const positive = value > 0;
  return (
    <span
      className={cn(
        "skale-num inline-flex items-center gap-0.5 text-xs font-medium leading-none",
        positive ? "text-success" : "text-destructive",
      )}
    >
      {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const id = useId().replace(/:/g, "");
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <div className="h-9 w-[72px] shrink-0 self-end pointer-events-none" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
          <defs>
            <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#spark-${id})`}
            isAnimationActive={false}
            dot={false}
            activeDot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
