import type { SellerFollowUpActiveSeller } from "@/components/vendors/SellerFollowUpActiveList";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { resolveAssigneeBorderColor } from "@/lib/crmAssigneeColor";
import {
  CRM_PIPELINE_STATUS_LABELS,
  CRM_STAGE_DOT_CLASS,
  CRM_STAGE_PILL_CLASS,
  getLeadCrmStageKey,
} from "@/lib/crmPipeline";
import type { SellerFollowUpPeriod } from "@/lib/services/sellerFollowUp";
import { cn } from "@/lib/utils";
import {
  Briefcase,
  CheckCircle2,
  ChevronDown,
  Loader2,
  MessageSquareText,
  Search,
  Sun,
  Moon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type SellerWithLeads = SellerFollowUpActiveSeller;

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

type SellerFollowUpDayPanelProps = {
  followUpDateKey: string;
  followUpDateLabel: string;
  sellers: SellerWithLeads[];
  filteredSellers: SellerWithLeads[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
  loading: boolean;
  syncing: boolean;
  checkMap: Map<string, { am: boolean; pm: boolean }>;
  noteMap: Map<string, string>;
  pendingCheckKey: string | null;
  savingNoteSellerId: string | null;
  onToggleCheck: (sellerUserId: string, period: SellerFollowUpPeriod, checked: boolean) => void;
  onSaveNote: (sellerUserId: string, note: string) => void;
};

function SellerDayCard({
  seller,
  followUpDateKey,
  checks,
  savedNote,
  pendingCheckKey,
  savingNote,
  onToggleCheck,
  onSaveNote,
}: {
  seller: SellerWithLeads;
  followUpDateKey: string;
  checks: { am: boolean; pm: boolean };
  savedNote: string;
  pendingCheckKey: string | null;
  savingNote: boolean;
  onToggleCheck: (sellerUserId: string, period: SellerFollowUpPeriod, checked: boolean) => void;
  onSaveNote: (sellerUserId: string, note: string) => void;
}) {
  const [leadsOpen, setLeadsOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState(savedNote);
  const accent = resolveAssigneeBorderColor({
    userId: seller.id,
    crmColor: seller.crmColor,
  });
  const completedCount = Number(checks.am) + Number(checks.pm);
  const noteDirty = noteDraft.trim() !== savedNote.trim();

  useEffect(() => {
    setNoteDraft(savedNote);
  }, [seller.id, followUpDateKey]);

  useEffect(() => {
    if (!noteDirty) {
      setNoteDraft(savedNote);
    }
  }, [savedNote, noteDirty]);

  const handleSaveNote = () => {
    if (!noteDirty || savingNote) return;
    onSaveNote(seller.id, noteDraft);
  };

  return (
    <article
      className="overflow-hidden rounded-xl border bg-card shadow-sm"
      style={
        accent
          ? { borderLeftWidth: 4, borderLeftColor: accent }
          : { borderLeftWidth: 4, borderLeftColor: "hsl(var(--primary))" }
      }
    >
      <div className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
              style={{ backgroundColor: accent ?? "hsl(var(--primary))" }}
            >
              {sellerInitials(seller.name)}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold">{seller.name}</p>
              {seller.email ? (
                <p className="truncate text-xs text-muted-foreground">{seller.email}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1 tabular-nums">
                  <Briefcase className="h-3 w-3" />
                  {seller.leads.length} leads
                </Badge>
                {completedCount > 0 ? (
                  <Badge
                    variant="outline"
                    className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    {completedCount}/2 seguimientos
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            <label
              className={cn(
                "inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors",
                checks.am
                  ? "border-amber-500/40 bg-amber-500/15 text-amber-900 dark:text-amber-100"
                  : "border-muted bg-muted/30 hover:bg-muted/50",
              )}
            >
              <Checkbox
                checked={checks.am}
                disabled={pendingCheckKey === `${seller.id}-am`}
                onCheckedChange={(v) => onToggleCheck(seller.id, "am", v === true)}
              />
              <Sun className="h-4 w-4" />
              AM
            </label>
            <label
              className={cn(
                "inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors",
                checks.pm
                  ? "border-indigo-500/40 bg-indigo-500/15 text-indigo-900 dark:text-indigo-100"
                  : "border-muted bg-muted/30 hover:bg-muted/50",
              )}
            >
              <Checkbox
                checked={checks.pm}
                disabled={pendingCheckKey === `${seller.id}-pm`}
                onCheckedChange={(v) => onToggleCheck(seller.id, "pm", v === true)}
              />
              <Moon className="h-4 w-4" />
              PM
            </label>
          </div>
        </div>

        <Collapsible open={leadsOpen} onOpenChange={setLeadsOpen}>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-3 h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <ChevronDown
                className={cn("h-3.5 w-3.5 transition-transform", leadsOpen && "rotate-180")}
              />
              {leadsOpen ? "Ocultar leads" : `Ver ${seller.leads.length} leads`}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down data-[state=closed]:overflow-hidden data-[state=open]:overflow-visible">
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {seller.leads.map((lead) => {
                const stage = getLeadCrmStageKey(lead.status);
                return (
                  <li
                    key={lead.id}
                    className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-xs"
                  >
                    <span
                      className={cn(
                        "h-2 w-2 shrink-0 rounded-full",
                        stage ? CRM_STAGE_DOT_CLASS[stage] : "bg-muted-foreground",
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {lead.full_name || "Sin nombre"}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "shrink-0 text-[10px] font-semibold uppercase",
                        stage ? CRM_STAGE_PILL_CLASS[stage] : "",
                      )}
                    >
                      {leadStatusLabel(lead.status)}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          </CollapsibleContent>
        </Collapsible>

        <div className="mt-4 rounded-xl border bg-muted/15 p-3">
          <label
            htmlFor={`note-${seller.id}`}
            className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            <MessageSquareText className="h-3.5 w-3.5" />
            Nota de seguimiento
          </label>
          <Textarea
            id={`note-${seller.id}`}
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            onBlur={handleSaveNote}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                handleSaveNote();
              }
            }}
            placeholder="Ej: Llamó a 2 leads, falta retomar cotización de Juan…"
            className="min-h-[72px] resize-y bg-background text-sm"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              size="sm"
              variant={noteDirty ? "default" : "secondary"}
              disabled={savingNote || !noteDirty}
              onClick={handleSaveNote}
            >
              {savingNote ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Guardando…
                </>
              ) : savedNote.trim() ? (
                "Guardar cambios"
              ) : (
                "Guardar nota"
              )}
            </Button>
            <span className="text-[10px] text-muted-foreground">
              {noteDirty ? "Cambios sin guardar" : "Ctrl+Enter · editable"}
            </span>
          </div>
          {!savingNote && savedNote.trim() && !noteDirty ? (
            <p className="mt-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
              Nota guardada · puedes editarla cuando quieras
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function SellerFollowUpDayPanel({
  followUpDateKey,
  followUpDateLabel,
  sellers,
  filteredSellers,
  searchQuery,
  onSearchChange,
  loading,
  syncing,
  checkMap,
  noteMap,
  pendingCheckKey,
  savingNoteSellerId,
  onToggleCheck,
  onSaveNote,
}: SellerFollowUpDayPanelProps) {
  const stats = useMemo(() => {
    let amDone = 0;
    let pmDone = 0;
    for (const seller of sellers) {
      const c = checkMap.get(seller.id);
      if (c?.am) amDone += 1;
      if (c?.pm) pmDone += 1;
    }
    return { amDone, pmDone, total: sellers.length };
  }, [sellers, checkMap]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="shrink-0 rounded-xl border bg-gradient-to-r from-primary/10 via-background to-emerald-500/10 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Checklist del día
            </p>
            <p className="mt-1 text-lg font-semibold capitalize">{followUpDateLabel}</p>
          </div>
          {syncing ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="outline" className="gap-1 tabular-nums">
            {stats.total} vendedores
          </Badge>
          <Badge variant="outline" className="gap-1 border-amber-500/30 bg-amber-500/10 tabular-nums">
            <Sun className="h-3 w-3" />
            AM {stats.amDone}/{stats.total}
          </Badge>
          <Badge variant="outline" className="gap-1 border-indigo-500/30 bg-indigo-500/10 tabular-nums">
            <Moon className="h-3 w-3" />
            PM {stats.pmDone}/{stats.total}
          </Badge>
        </div>
      </div>

      <div className="relative shrink-0">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar vendedor o lead…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        ) : filteredSellers.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {sellers.length === 0
              ? "No hay vendedores con leads activos."
              : "Ningún resultado para tu búsqueda."}
          </p>
        ) : (
          <div className="space-y-3 pb-2">
            {filteredSellers.map((seller) => (
              <SellerDayCard
                key={seller.id}
                seller={seller}
                followUpDateKey={followUpDateKey}
                checks={checkMap.get(seller.id) ?? { am: false, pm: false }}
                savedNote={noteMap.get(seller.id) ?? ""}
                pendingCheckKey={pendingCheckKey}
                savingNote={savingNoteSellerId === seller.id}
                onToggleCheck={onToggleCheck}
                onSaveNote={onSaveNote}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
