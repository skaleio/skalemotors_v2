import { useAuth } from "@/contexts/AuthContext";
import { formatLeadDelegationCaption, type LeadDelegationInput } from "@/lib/leadDelegation";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { UserCheck } from "lucide-react";
import { memo } from "react";

type LeadDelegationAdminBlockProps = {
  lead: LeadDelegationInput;
  className?: string;
  /** Tarjeta visible en el diálogo del lead; `inline` en la tarjeta Kanban. */
  variant?: "card" | "inline";
};

function formatDelegationParts(lead: LeadDelegationInput): {
  fecha: string;
  hora: string;
  vendedor: string;
} | null {
  const assigneeId = lead.assigned_to?.trim();
  const assignedAt = lead.assigned_at?.trim();
  if (!assigneeId || !assignedAt) return null;

  const vendedor =
    lead.assigned_user?.full_name?.trim()
    || lead.assigned_user?.email?.trim()
    || "Vendedor";

  try {
    const dt = parseISO(assignedAt);
    return {
      fecha: format(dt, "dd-MM-yyyy"),
      hora: format(dt, "HH:mm"),
      vendedor,
    };
  } catch {
    return null;
  }
}

function LeadDelegationAdminBlockBase({
  lead,
  className,
  variant = "card",
}: LeadDelegationAdminBlockProps) {
  const { user } = useAuth();
  if (user?.role !== "admin") return null;

  const parts = formatDelegationParts(lead);
  const caption = formatLeadDelegationCaption(lead);
  if (!parts || !caption) return null;

  if (variant === "inline") {
    return (
      <p
        className={cn(
          "text-[10px] font-medium uppercase leading-tight tracking-wide text-muted-foreground/90",
          className,
        )}
        title={caption}
      >
        {caption}
      </p>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2.5",
        className,
      )}
      title={caption}
    >
      <div className="flex items-start gap-2">
        <UserCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
            Lead delegado
          </p>
          <p className="text-sm text-foreground">
            <span className="text-muted-foreground">Fecha:</span>{" "}
            <span className="font-medium tabular-nums">{parts.fecha}</span>
            <span className="mx-1.5 text-muted-foreground">·</span>
            <span className="text-muted-foreground">Hora:</span>{" "}
            <span className="font-medium tabular-nums">{parts.hora}</span>
          </p>
          <p className="text-sm text-foreground">
            <span className="text-muted-foreground">A:</span>{" "}
            <span className="font-medium">{parts.vendedor}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export const LeadDelegationAdminBlock = memo(LeadDelegationAdminBlockBase);
