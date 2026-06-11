import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { leadService } from "@/lib/services/leads";
import {
  contactUrgencyToPriority,
  LEAD_CONTACT_URGENCY_LABELS,
  LEAD_CONTACT_URGENCY_MAX,
  parseLeadContactUrgency,
  type LeadContactUrgency,
} from "@/lib/leadContactUrgency";
import { useQueryClient } from "@tanstack/react-query";
import { LeadContactUrgencyStars } from "@/components/leads/LeadContactUrgencyStars";

export interface LeadContactUrgencyPickerProps {
  leadId?: string;
  value: number | null | undefined;
  size?: "sm" | "md";
  showLabel?: boolean;
  showHint?: boolean;
  disabled?: boolean;
  /** Solo actualiza estado local; persiste al guardar el formulario. */
  localOnly?: boolean;
  onChange?: (next: LeadContactUrgency) => void;
}

export function LeadContactUrgencyPicker({
  leadId,
  value,
  size = "md",
  showLabel = true,
  showHint = true,
  disabled = false,
  localOnly = false,
  onChange,
}: LeadContactUrgencyPickerProps) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const current = parseLeadContactUrgency(value);

  const commit = async (next: LeadContactUrgency) => {
    if (!leadId || pending || next === current) return;
    setPending(true);

    queryClient.setQueriesData({ queryKey: ["leads"] }, (data: unknown) => {
      if (!Array.isArray(data)) return data;
      return data.map((l: { id: string } & Record<string, unknown>) =>
        l.id === leadId
          ? { ...l, contact_urgency: next, priority: contactUrgencyToPriority(next) }
          : l,
      );
    });

    try {
      await leadService.update(leadId, {
        contact_urgency: next,
        priority: contactUrgencyToPriority(next),
      });
      onChange?.(next);
    } catch (err) {
      console.error("[LeadContactUrgencyPicker] update falló", err);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast({
        title: "No se pudo actualizar la urgencia",
        description: err instanceof Error ? err.message : "Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setPending(false);
    }
  };

  const handleSelect = (next: LeadContactUrgency) => {
    if (disabled || (!localOnly && pending)) return;
    if (localOnly) {
      onChange?.(next);
      return;
    }
    void commit(next);
  };

  const starSize = size === "sm" ? "sm" : "md";

  return (
    <div className="grid gap-1.5 select-none" onClick={(e) => e.stopPropagation()}>
      {showLabel && (
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium">Urgencia de contacto</span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {current === null
              ? "Sin calificar"
              : `${current}/${LEAD_CONTACT_URGENCY_MAX} · ${LEAD_CONTACT_URGENCY_LABELS[current]}`}
          </span>
        </div>
      )}
      <LeadContactUrgencyStars
        value={value}
        size={starSize}
        interactive
        disabled={disabled || (!localOnly && pending)}
        onSelect={handleSelect}
      />
      {showHint && (
        <p className="text-[11px] text-muted-foreground">
          Califica con estrellas qué tan pronto debes contactar al lead (1 = muy baja, 5 = urgente).
        </p>
      )}
    </div>
  );
}
