import {
  LEAD_CONTACT_STATE_BADGE_CLASS,
  LEAD_CONTACT_STATE_HINTS,
  LEAD_CONTACT_STATE_LABELS,
  parseLeadContactState,
  type LeadContactState,
} from "@/lib/leadContactState";
import { cn } from "@/lib/utils";

export interface LeadContactStateBadgeProps {
  value: string | null | undefined;
  /** Esquina absoluta en tarjeta Kanban (como vendedor asignado). */
  variant?: "corner" | "inline";
  className?: string;
}

export function LeadContactStateBadge({
  value,
  variant = "inline",
  className,
}: LeadContactStateBadgeProps) {
  const state = parseLeadContactState(value);
  if (state === null) return null;

  const label = LEAD_CONTACT_STATE_LABELS[state];

  if (variant === "corner") {
    return (
      <span
        title={`${label}: ${LEAD_CONTACT_STATE_HINTS[state]}`}
        className={cn(
          "pointer-events-none absolute left-1 top-1 z-[1] max-w-[5.5rem] truncate rounded-md border px-1.5 py-0.5 text-[9px] font-semibold leading-tight shadow-sm",
          LEAD_CONTACT_STATE_BADGE_CLASS[state],
          className,
        )}
      >
        {label}
      </span>
    );
  }

  return (
    <span
      title={`${label}: ${LEAD_CONTACT_STATE_HINTS[state]}`}
      className={cn(
        "inline-flex max-w-full truncate rounded-md border px-2 py-0.5 text-xs font-medium",
        LEAD_CONTACT_STATE_BADGE_CLASS[state],
        className,
      )}
    >
      {label}
    </span>
  );
}
