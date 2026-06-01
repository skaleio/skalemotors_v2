import { ChevronDown, ChevronUp, GripVertical, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { DocumentClause } from "@/lib/documents/templateTypes";
import { cn } from "@/lib/utils";

interface DocumentTemplateClauseCardProps {
  clause: DocumentClause;
  index: number;
  total: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (patch: Partial<DocumentClause>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}

export function DocumentTemplateClauseCard({
  clause,
  index,
  total,
  open,
  onOpenChange,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
}: DocumentTemplateClauseCardProps) {
  const preview = clause.body.trim().slice(0, 120);
  const hasBody = clause.body.trim().length > 0;

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <div
        className={cn(
          "rounded-xl border bg-card transition-shadow",
          open && "ring-2 ring-violet-500/20 border-violet-200 dark:border-violet-800"
        )}
      >
        <div className="flex items-stretch gap-1 p-2">
          <div className="flex flex-col items-center justify-center px-1 text-muted-foreground/50">
            <GripVertical className="h-4 w-4" />
            <span className="text-[10px] font-mono mt-0.5">{index + 1}</span>
          </div>

          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex-1 min-w-0 text-left rounded-lg px-3 py-2 hover:bg-muted/60 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-sm text-violet-900 dark:text-violet-200">
                  {clause.title || `Cláusula ${index + 1}`}
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                    open && "rotate-180"
                  )}
                />
              </div>
              {!open && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {hasBody ? preview + (clause.body.length > 120 ? "…" : "") : "Sin texto — haz clic para editar"}
                </p>
              )}
            </button>
          </CollapsibleTrigger>

          <div className="flex flex-col gap-0.5 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={index === 0}
              onClick={onMoveUp}
              title="Subir"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={index >= total - 1}
              onClick={onMoveDown}
              title="Bajar"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              disabled={total <= 1}
              onClick={onRemove}
              title="Eliminar cláusula"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <CollapsibleContent>
          <div className="px-4 pb-4 pt-0 space-y-3 border-t border-dashed mx-3">
            <div className="space-y-1.5 pt-3">
              <label className="text-xs font-medium text-muted-foreground">
                Título de la cláusula
              </label>
              <Input
                value={clause.title}
                onChange={(e) => onChange({ title: e.target.value })}
                placeholder="Ej. PRIMERO, SEGUNDO…"
                className="font-semibold"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Texto legal
              </label>
              <Textarea
                value={clause.body}
                onChange={(e) => onChange({ body: e.target.value })}
                placeholder="Redacta el contenido de esta cláusula…"
                className="min-h-[140px] text-sm leading-relaxed resize-y"
              />
              <p className="text-[10px] text-muted-foreground">
                {clause.body.length} caracteres
              </p>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
