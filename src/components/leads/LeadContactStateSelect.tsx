import { useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { leadService } from "@/lib/services/leads";
import {
  contactStateToPriority,
  LEAD_CONTACT_STATE_HINTS,
  LEAD_CONTACT_STATE_LABELS,
  LEAD_CONTACT_STATE_OPTIONS,
  parseLeadContactState,
  type LeadContactState,
} from "@/lib/leadContactState";
import { useQueryClient } from "@tanstack/react-query";

const NONE_VALUE = "__none__";

export interface LeadContactStateSelectProps {
  leadId?: string;
  value: string | null | undefined;
  disabled?: boolean;
  /** Solo actualiza estado local; persiste al guardar el formulario. */
  localOnly?: boolean;
  onChange?: (next: LeadContactState | null) => void;
}

export function LeadContactStateSelect({
  leadId,
  value,
  disabled = false,
  localOnly = false,
  onChange,
}: LeadContactStateSelectProps) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const current = parseLeadContactState(value);

  const commit = async (next: LeadContactState | null) => {
    if (!leadId || pending || next === current) return;
    setPending(true);

    queryClient.setQueriesData({ queryKey: ["leads"] }, (data: unknown) => {
      if (!Array.isArray(data)) return data;
      return data.map((l: { id: string } & Record<string, unknown>) => {
        if (l.id !== leadId) return l;
        const patch: Record<string, unknown> = { contact_state: next };
        if (next) patch.priority = contactStateToPriority(next);
        return { ...l, ...patch };
      });
    });

    try {
      const updates: Record<string, unknown> = { contact_state: next };
      if (next) updates.priority = contactStateToPriority(next);
      await leadService.update(leadId, updates);
      onChange?.(next);
    } catch (err) {
      console.error("[LeadContactStateSelect] update falló", err);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast({
        title: "No se pudo actualizar la etiqueta",
        description: err instanceof Error ? err.message : "Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setPending(false);
    }
  };

  const handleChange = (raw: string) => {
    const next = raw === NONE_VALUE ? null : (parseLeadContactState(raw) as LeadContactState);
    if (disabled || (!localOnly && pending)) return;
    if (localOnly) {
      onChange?.(next);
      return;
    }
    void commit(next);
  };

  return (
    <div className="grid gap-2" onClick={(e) => e.stopPropagation()}>
      <Label htmlFor="lead-contact-state">Etiqueta de calificación</Label>
      <Select
        value={current ?? NONE_VALUE}
        onValueChange={handleChange}
        disabled={disabled || (!localOnly && pending)}
      >
        <SelectTrigger id="lead-contact-state">
          <SelectValue placeholder="Sin etiqueta" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_VALUE}>Sin etiqueta</SelectItem>
          {LEAD_CONTACT_STATE_OPTIONS.map((key) => (
            <SelectItem key={key} value={key}>
              {LEAD_CONTACT_STATE_LABELS[key]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-[11px] text-muted-foreground">
        {current
          ? LEAD_CONTACT_STATE_HINTS[current]
          : "Opcional. Solo visible en el CRM cuando asignas una etiqueta."}
      </p>
    </div>
  );
}
