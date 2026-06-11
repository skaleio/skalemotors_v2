import {
  LEAD_CONTACT_URGENCY_LABELS,
  parseLeadContactUrgency,
  type LeadContactUrgency,
} from "@/lib/leadContactUrgency";
import { cn } from "@/lib/utils";
import { LeadContactUrgencyStars } from "@/components/leads/LeadContactUrgencyStars";

export interface LeadContactUrgencyBadgeProps {
  value: number | null | undefined;
  size?: "xs" | "sm";
  className?: string;
}

export function LeadContactUrgencyBadge({
  value,
  size = "xs",
  className,
}: LeadContactUrgencyBadgeProps) {
  const level = parseLeadContactUrgency(value);
  if (level === null) return null;

  return (
    <span
      title={`${level}/5 — ${LEAD_CONTACT_URGENCY_LABELS[level as LeadContactUrgency]}`}
      className={cn("inline-flex shrink-0 items-center", className)}
    >
      <LeadContactUrgencyStars value={level} size={size} />
    </span>
  );
}
