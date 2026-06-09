import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { resolveAssigneeBorderColor } from "@/lib/crmAssigneeColor";
import {
  CRM_PIPELINE_STATUS_LABELS,
  CRM_STAGE_DOT_CLASS,
  getLeadCrmStageKey,
} from "@/lib/crmPipeline";
import { cn } from "@/lib/utils";
import { Briefcase, CheckCircle2, ChevronDown, Mail, Moon, Sun, UserRound } from "lucide-react";
import { useState } from "react";

export type SellerFollowUpLeadPreview = {
  id: string;
  full_name: string | null;
  status: string | null;
};

export type SellerFollowUpActiveSeller = {
  id: string;
  name: string;
  email: string | null;
  crmColor: string | null;
  leads: SellerFollowUpLeadPreview[];
};

const PREVIEW_LEAD_COUNT = 3;

function sellerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function leadStatusLabel(status: string | null | undefined): string {
  const stage = getLeadCrmStageKey(status);
  if (stage) return CRM_PIPELINE_STATUS_LABELS[stage];
  return (status || "Sin estado").replace(/_/g, " ");
}

function leadStatusDotClass(status: string | null | undefined): string {
  const stage = getLeadCrmStageKey(status);
  if (stage) return CRM_STAGE_DOT_CLASS[stage];
  return "bg-muted-foreground";
}

function LeadPreviewRow({ lead }: { lead: SellerFollowUpLeadPreview }) {
  return (
    <li className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1 text-xs">
      <span
        className={cn("h-2 w-2 shrink-0 rounded-full", leadStatusDotClass(lead.status))}
      />
      <span className="min-w-0 flex-1 truncate font-medium">
        {lead.full_name || "Sin nombre"}
      </span>
      <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
        {leadStatusLabel(lead.status)}
      </span>
    </li>
  );
}

export type SellerFollowUpCheckState = { am: boolean; pm: boolean };

function FollowUpStatusBadge({ checks }: { checks: SellerFollowUpCheckState }) {
  if (checks.am && checks.pm) {
    return (
      <Badge
        variant="outline"
        className="shrink-0 gap-1 border-emerald-500/40 bg-emerald-500/15 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300"
      >
        <CheckCircle2 className="h-3 w-3" />
        Seguimiento list
      </Badge>
    );
  }
  if (checks.am) {
    return (
      <Badge
        variant="outline"
        className="shrink-0 gap-1 border-amber-500/30 bg-amber-500/10 text-[10px] font-semibold text-amber-800 dark:text-amber-200"
      >
        <Sun className="h-3 w-3" />
        AM ✓
      </Badge>
    );
  }
  if (checks.pm) {
    return (
      <Badge
        variant="outline"
        className="shrink-0 gap-1 border-indigo-500/30 bg-indigo-500/10 text-[10px] font-semibold text-indigo-800 dark:text-indigo-200"
      >
        <Moon className="h-3 w-3" />
        PM ✓
      </Badge>
    );
  }
  return null;
}

function SellerFollowUpSellerCard({
  seller,
  checks,
}: {
  seller: SellerFollowUpActiveSeller;
  checks?: SellerFollowUpCheckState;
}) {
  const [expanded, setExpanded] = useState(false);
  const accent = resolveAssigneeBorderColor({
    userId: seller.id,
    crmColor: seller.crmColor,
  });
  const hasHiddenLeads = seller.leads.length > PREVIEW_LEAD_COUNT;
  const previewLeads = seller.leads.slice(0, PREVIEW_LEAD_COUNT);
  const hiddenCount = seller.leads.length - PREVIEW_LEAD_COUNT;
  const extraLeads = seller.leads.slice(PREVIEW_LEAD_COUNT);

  return (
    <li
      className="group relative overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
      style={
        accent
          ? { borderLeftWidth: 4, borderLeftColor: accent }
          : { borderLeftWidth: 4, borderLeftColor: "hsl(var(--primary))" }
      }
    >
      <div className="flex items-start gap-3 p-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white shadow-sm"
          style={{ backgroundColor: accent ?? "hsl(var(--primary))" }}
        >
          {sellerInitials(seller.name)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-semibold leading-tight">{seller.name}</p>
              {seller.email ? (
                <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                  <Mail className="h-3 w-3 shrink-0" />
                  {seller.email}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {checks ? <FollowUpStatusBadge checks={checks} /> : null}
              <Badge
                variant="secondary"
                className="gap-1 tabular-nums bg-primary/10 text-primary hover:bg-primary/10"
              >
                <Briefcase className="h-3 w-3" />
                {seller.leads.length}
              </Badge>
            </div>
          </div>

          <ul className="mt-2.5 space-y-1.5">
            {previewLeads.map((lead) => (
              <LeadPreviewRow key={lead.id} lead={lead} />
            ))}
          </ul>

          {hasHiddenLeads ? (
            <Collapsible open={expanded} onOpenChange={setExpanded}>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "mt-2 h-8 w-full gap-1.5 rounded-lg border border-dashed text-xs font-medium",
                    expanded
                      ? "border-muted-foreground/20 bg-muted/30 text-muted-foreground hover:bg-muted/50"
                      : "border-primary/25 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary",
                  )}
                >
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 transition-transform duration-200",
                      expanded && "rotate-180",
                    )}
                  />
                  {expanded
                    ? "Ver menos"
                    : `Ver ${hiddenCount} lead${hiddenCount === 1 ? "" : "s"} más`}
                </Button>
              </CollapsibleTrigger>

              <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                <ul className="mt-1.5 space-y-1.5 border-t border-dashed border-muted-foreground/20 pt-2">
                  {extraLeads.map((lead) => (
                    <LeadPreviewRow key={lead.id} lead={lead} />
                  ))}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          ) : null}
        </div>
      </div>
    </li>
  );
}

type SellerFollowUpActiveListProps = {
  sellers: SellerFollowUpActiveSeller[];
  loading?: boolean;
  maxHeightClass?: string;
  /** Checks del día seleccionado en calendario (seller id → AM/PM). */
  checkMap?: Map<string, SellerFollowUpCheckState> | null;
  followUpDateLabel?: string | null;
};

export function SellerFollowUpActiveList({
  sellers,
  loading = false,
  maxHeightClass = "max-h-[min(520px,60vh)]",
  checkMap = null,
  followUpDateLabel = null,
}: SellerFollowUpActiveListProps) {
  const totalLeads = sellers.reduce((sum, s) => sum + s.leads.length, 0);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  if (sellers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 py-10 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <UserRound className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">Sin vendedores con leads activos</p>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          Cuando delegues leads en el CRM, los vendedores asignados aparecerán aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-3 py-2.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Vendedores
          </p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums">{sellers.length}</p>
        </div>
        <div className="rounded-xl border bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent px-3 py-2.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Leads activos
          </p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
            {totalLeads}
          </p>
        </div>
      </div>

      {followUpDateLabel ? (
        <p className="text-xs text-muted-foreground capitalize">
          Estado de seguimiento · {followUpDateLabel}
        </p>
      ) : null}

      <div
        className={cn(
          "overflow-y-auto overscroll-contain pr-2",
          maxHeightClass,
        )}
      >
        <ul className="space-y-2.5 pb-1">
          {sellers.map((seller) => (
            <SellerFollowUpSellerCard
              key={seller.id}
              seller={seller}
              checks={checkMap?.get(seller.id)}
            />
          ))}
        </ul>
      </div>

      {sellers.length > 3 ? (
        <p className="text-center text-[11px] text-muted-foreground">
          Desplázate para ver más vendedores
        </p>
      ) : null}
    </div>
  );
}
