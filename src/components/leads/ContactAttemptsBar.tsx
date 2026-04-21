import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { leadService } from "@/lib/services/leads";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

const MAX_ATTEMPTS = 3;

const PILL_COLORS: Record<number, { filled: string; hover: string }> = {
  1: { filled: "bg-emerald-500", hover: "hover:bg-emerald-600" },
  2: { filled: "bg-amber-400", hover: "hover:bg-amber-500" },
  3: { filled: "bg-red-500", hover: "hover:bg-red-600" },
};

export interface ContactAttemptsBarProps {
  leadId: string;
  value: number;
  size?: "sm" | "md";
  showLabel?: boolean;
  onChange?: (next: number) => void;
}

export function ContactAttemptsBar({
  leadId,
  value,
  size = "md",
  showLabel = true,
  onChange,
}: ContactAttemptsBarProps) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const current = Math.max(0, Math.min(value ?? 0, MAX_ATTEMPTS));

  const commit = async (next: number) => {
    if (pending || next === current) return;
    setPending(true);

    const reachedMax = next >= MAX_ATTEMPTS && current < MAX_ATTEMPTS;

    queryClient.setQueriesData({ queryKey: ["leads"] }, (data: unknown) => {
      if (!Array.isArray(data)) return data;
      return data.map((l: { id: string } & Record<string, unknown>) =>
        l.id === leadId
          ? {
              ...l,
              contact_attempts: next,
              last_contact_at: next > current ? new Date().toISOString() : l.last_contact_at,
            }
          : l,
      );
    });

    try {
      const updates: { contact_attempts: number; last_contact_at?: string } = {
        contact_attempts: next,
      };
      if (next > current) updates.last_contact_at = new Date().toISOString();
      await leadService.update(leadId, updates);
      onChange?.(next);
      if (reachedMax) {
        queryClient.invalidateQueries({ queryKey: ["leads"] });
        toast({
          title: "Contactos agotados",
          description: "El lead se mueve al final de su columna.",
        });
      }
    } catch (err) {
      console.error("[ContactAttemptsBar] update falló", err);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast({
        title: "No se pudo actualizar contactos",
        description: err instanceof Error ? err.message : "Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setPending(false);
    }
  };

  const handleClick = (n: number) => {
    const next = n <= current ? n - 1 : n;
    void commit(next);
  };

  const pillHeight = size === "sm" ? "h-1.5" : "h-2";
  const pillWidth = size === "sm" ? "w-6" : "w-10";

  return (
    <div className="flex items-center gap-2 select-none" onClick={(e) => e.stopPropagation()}>
      {showLabel && (
        <span className="text-xs text-muted-foreground whitespace-nowrap">Contactos</span>
      )}
      <div className="flex items-center gap-1">
        {Array.from({ length: MAX_ATTEMPTS }, (_, i) => i + 1).map((n) => {
          const filled = n <= current;
          const color = PILL_COLORS[n];
          return (
            <button
              key={n}
              type="button"
              disabled={pending}
              onClick={(e) => {
                e.stopPropagation();
                handleClick(n);
              }}
              aria-label={`${n <= current ? "Quitar" : "Marcar"} contacto ${n}`}
              title={
                n === MAX_ATTEMPTS && !filled
                  ? "Al marcar el 3er contacto, el lead baja al final de su columna"
                  : `${n} de ${MAX_ATTEMPTS} contactos`
              }
              className={cn(
                pillHeight,
                pillWidth,
                "rounded-full transition-colors",
                filled ? `${color.filled} ${color.hover}` : "bg-muted hover:bg-muted-foreground/40",
                pending && "opacity-60 cursor-wait",
              )}
            />
          );
        })}
      </div>
      <span className="text-xs font-medium tabular-nums text-muted-foreground">
        {current}/{MAX_ATTEMPTS}
      </span>
    </div>
  );
}
