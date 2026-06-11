import { useAuth } from "@/contexts/AuthContext";
import {
  formatLeadDelegationCaption,
  formatLeadDelegationRelative,
  getLeadDelegationDetail,
  type LeadDelegationInput,
} from "@/lib/leadDelegation";
import { cn } from "@/lib/utils";
import { UserCheck } from "lucide-react";
import { memo } from "react";

type LeadDelegationAdminBlockProps = {
  lead: LeadDelegationInput;
  className?: string;
  /** Tarjeta visible en el diálogo del lead; `inline` en la tarjeta Kanban. */
  variant?: "card" | "inline";
};

function LeadDelegationAdminBlockBase({
  lead,
  className,
  variant = "card",
}: LeadDelegationAdminBlockProps) {
  const { user } = useAuth();
  if (user?.role !== "admin") return null;

  const parts = getLeadDelegationDetail(lead);
  const caption = formatLeadDelegationCaption(lead);
  if (!parts || !caption) return null;

  if (variant === "inline") {
    const relative = formatLeadDelegationRelative(lead);
    if (!relative) return null;

    return (
      <p
        className={cn(
          "text-[10px] leading-snug text-muted-foreground/70",
          className,
        )}
        title={caption}
      >
        {relative}
      </p>
    );
  }

  return (
    <div
      className={cn(
        "rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <UserCheck
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600/80 dark:text-amber-400/90"
          aria-hidden
        />
        <div className="min-w-0 space-y-0.5">
          <p className="text-xs font-medium text-foreground">Delegación</p>
          <p className="text-sm font-medium leading-tight">{parts.vendedor}</p>
          <p className="text-xs tabular-nums text-muted-foreground">
            {parts.fecha} · {parts.hora}
          </p>
        </div>
      </div>
    </div>
  );
}

export const LeadDelegationAdminBlock = memo(LeadDelegationAdminBlockBase);
