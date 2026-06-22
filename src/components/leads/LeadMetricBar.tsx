import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { leadService } from "@/lib/services/leads";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

export const LEAD_METRIC_MAX = 3;

const PILL_COLORS: Record<number, { filled: string; hover: string }> = {
  1: { filled: "bg-emerald-500", hover: "hover:bg-emerald-600" },
  2: { filled: "bg-amber-400", hover: "hover:bg-amber-500" },
  3: { filled: "bg-red-500", hover: "hover:bg-red-600" },
};

export type LeadMetricField = "contact_attempts" | "calls_made" | "whatsapp_attempts";

const FIELD_META: Record<
  LeadMetricField,
  {
    defaultLabel: string;
    maxToastTitle: string;
    maxToastDescription: string;
    reorderOnMax: boolean;
    touchLastContactAt: boolean;
  }
> = {
  contact_attempts: {
    defaultLabel: "Contactos",
    maxToastTitle: "Contactos agotados",
    maxToastDescription: "El lead se mueve al final de su columna.",
    reorderOnMax: true,
    touchLastContactAt: true,
  },
  calls_made: {
    defaultLabel: "Llamadas realizadas",
    maxToastTitle: "Meta de llamadas",
    maxToastDescription: "Completaste las 3 llamadas registradas para este lead.",
    reorderOnMax: false,
    touchLastContactAt: true,
  },
  whatsapp_attempts: {
    defaultLabel: "WhatsApp enviados",
    maxToastTitle: "Meta de WhatsApp",
    maxToastDescription: "Completaste los 3 WhatsApp registrados para este lead.",
    reorderOnMax: false,
    touchLastContactAt: true,
  },
};

export interface LeadMetricBarProps {
  leadId: string;
  field: LeadMetricField;
  value: number;
  label?: string;
  size?: "sm" | "md";
  showLabel?: boolean;
  /** Solo actualiza estado local (modo edición del diálogo); persiste al guardar el formulario. */
  localOnly?: boolean;
  /** Contorno negro en cada segmento (mejor contraste en el diálogo del lead). */
  bordered?: boolean;
  onChange?: (next: number) => void;
}

export function LeadMetricBar({
  leadId,
  field,
  value,
  label,
  size = "md",
  showLabel = true,
  localOnly = false,
  bordered = false,
  onChange,
}: LeadMetricBarProps) {
  const meta = FIELD_META[field];
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const current = Math.max(0, Math.min(value ?? 0, LEAD_METRIC_MAX));
  const displayLabel = label ?? meta.defaultLabel;

  const commit = async (next: number) => {
    if (pending || next === current) return;
    setPending(true);

    const reachedMax = next >= LEAD_METRIC_MAX && current < LEAD_METRIC_MAX;

    queryClient.setQueriesData({ queryKey: ["leads"] }, (data: unknown) => {
      if (!Array.isArray(data)) return data;
      return data.map((l: { id: string; last_contact_at?: string | null } & Record<string, unknown>) => {
        if (l.id !== leadId) return l;
        const patch: Record<string, unknown> = { [field]: next };
        if (meta.touchLastContactAt && next > current) {
          patch.last_contact_at = new Date().toISOString();
        }
        return { ...l, ...patch };
      });
    });

    try {
      const updates: Record<string, unknown> = { [field]: next };
      if (meta.touchLastContactAt && next > current) {
        updates.last_contact_at = new Date().toISOString();
      }
      await leadService.update(leadId, updates);
      onChange?.(next);
      if (reachedMax) {
        if (meta.reorderOnMax) {
          queryClient.invalidateQueries({ queryKey: ["leads"] });
        }
        toast({
          title: meta.maxToastTitle,
          description: meta.maxToastDescription,
        });
      }
    } catch (err) {
      console.error("[LeadMetricBar] update falló", { field, err });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast({
        title: `No se pudo actualizar ${displayLabel.toLowerCase()}`,
        description: err instanceof Error ? err.message : "Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setPending(false);
    }
  };

  const handleClick = (n: number) => {
    const next = n <= current ? n - 1 : n;
    if (localOnly) {
      onChange?.(next);
      return;
    }
    void commit(next);
  };

  const pillHeight = size === "sm" ? "h-1.5" : "h-2";
  const pillWidth = size === "sm" ? "w-6" : "w-10";

  return (
    <div className="flex items-center gap-2 select-none" onClick={(e) => e.stopPropagation()}>
      {showLabel && (
        <span className="text-xs text-muted-foreground whitespace-nowrap">{displayLabel}</span>
      )}
      <div className="flex items-center gap-1">
        {Array.from({ length: LEAD_METRIC_MAX }, (_, i) => i + 1).map((n) => {
          const filled = n <= current;
          const color = PILL_COLORS[n];
          return (
            <button
              key={n}
              type="button"
              disabled={!localOnly && pending}
              onClick={(e) => {
                e.stopPropagation();
                handleClick(n);
              }}
              aria-label={`${filled ? "Quitar" : "Marcar"} ${displayLabel.toLowerCase()} ${n}`}
              title={
                n === LEAD_METRIC_MAX && !filled
                  ? `Al marcar la 3.ª barra completas la meta de ${displayLabel.toLowerCase()}`
                  : `${n} de ${LEAD_METRIC_MAX}`
              }
              className={cn(
                pillHeight,
                pillWidth,
                "rounded-full transition-all duration-200 ease-out box-border",
                bordered && "border-2 border-black",
                filled ? `${color.filled} ${color.hover} scale-100` : "bg-muted hover:bg-muted-foreground/40 scale-95",
                !localOnly && pending && "opacity-60 cursor-wait",
              )}
            />
          );
        })}
      </div>
      <span className="text-xs font-medium tabular-nums text-muted-foreground">
        {current}/{LEAD_METRIC_MAX}
      </span>
    </div>
  );
}
