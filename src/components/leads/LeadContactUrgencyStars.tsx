import {
  LEAD_CONTACT_URGENCY_HINTS,
  LEAD_CONTACT_URGENCY_LABELS,
  LEAD_CONTACT_URGENCY_MAX,
  LEAD_CONTACT_URGENCY_MIN,
  parseLeadContactUrgency,
  type LeadContactUrgency,
} from "@/lib/leadContactUrgency";
import { cn } from "@/lib/utils";
import { Star } from "lucide-react";

const STAR_SIZE: Record<"xs" | "sm" | "md", string> = {
  xs: "h-3 w-3",
  sm: "h-3.5 w-3.5",
  md: "h-5 w-5",
};

const STAR_GAP: Record<"xs" | "sm" | "md", string> = {
  xs: "gap-0",
  sm: "gap-0.5",
  md: "gap-1",
};

export interface LeadContactUrgencyStarsProps {
  value: number | null | undefined;
  size?: "xs" | "sm" | "md";
  interactive?: boolean;
  disabled?: boolean;
  className?: string;
  onSelect?: (level: LeadContactUrgency) => void;
}

export function LeadContactUrgencyStars({
  value,
  size = "md",
  interactive = false,
  disabled = false,
  className,
  onSelect,
}: LeadContactUrgencyStarsProps) {
  const current = parseLeadContactUrgency(value);
  const starClass = STAR_SIZE[size];

  return (
    <div
      className={cn("inline-flex items-center", STAR_GAP[size], className)}
      onClick={interactive ? (e) => e.stopPropagation() : undefined}
      role={interactive ? "group" : undefined}
      aria-label={
        current === null
          ? "Sin calificar"
          : `${current} de ${LEAD_CONTACT_URGENCY_MAX} estrellas — ${LEAD_CONTACT_URGENCY_LABELS[current]}`
      }
    >
      {Array.from({ length: LEAD_CONTACT_URGENCY_MAX - LEAD_CONTACT_URGENCY_MIN + 1 }, (_, i) => {
        const n = (i + LEAD_CONTACT_URGENCY_MIN) as LeadContactUrgency;
        const filled = current !== null && n <= current;

        if (interactive) {
          return (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                onSelect?.(n);
              }}
              aria-label={`${n} estrella${n > 1 ? "s" : ""}: ${LEAD_CONTACT_URGENCY_LABELS[n]}`}
              aria-pressed={filled}
              title={`${n} — ${LEAD_CONTACT_URGENCY_LABELS[n]}: ${LEAD_CONTACT_URGENCY_HINTS[n]}`}
              className={cn(
                "rounded-sm transition-transform duration-150 ease-out",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                !disabled && "hover:scale-110 active:scale-95",
                disabled && "cursor-not-allowed opacity-60",
              )}
            >
              <Star
                className={cn(
                  starClass,
                  filled
                    ? "fill-amber-400 text-amber-400"
                    : "fill-none text-muted-foreground/45 hover:text-amber-300/80",
                )}
                strokeWidth={filled ? 1.5 : 2}
              />
            </button>
          );
        }

        return (
          <Star
            key={n}
            aria-hidden
            className={cn(
              starClass,
              filled ? "fill-amber-400 text-amber-400" : "fill-none text-muted-foreground/30",
            )}
            strokeWidth={filled ? 1.5 : 2}
          />
        );
      })}
    </div>
  );
}
