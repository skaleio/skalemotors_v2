import { Button } from "@/components/ui/button";
import type { PendingTask } from "@/hooks/usePendingTasks";
import { cn } from "@/lib/utils";
import { Check, ChevronRight, Loader2 } from "lucide-react";

const DOT: Record<PendingTask["priority"], string> = {
  urgent: "bg-destructive",
  today: "bg-amber-500",
  later: "bg-muted-foreground/35",
};

type LoginAlertTaskItemProps = {
  task: PendingTask;
  onAction: () => void;
  onComplete: () => void;
  isCompleting: boolean;
};

export function LoginAlertTaskItem({
  task,
  onAction,
  onComplete,
  isCompleting,
}: LoginAlertTaskItemProps) {
  return (
    <div className="flex items-stretch gap-0.5 rounded-lg border border-transparent hover:border-border/80 hover:bg-muted/50 transition-colors">
      <button
        type="button"
        onClick={onAction}
        className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left"
      >
        <span
          className={cn("h-2 w-2 shrink-0 rounded-full", DOT[task.priority] ?? DOT.later)}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-foreground truncate">{task.title}</span>
          {task.description ? (
            <span className="mt-0.5 block text-xs text-muted-foreground truncate">
              {task.description}
            </span>
          ) : null}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden />
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="my-1 mr-1 h-8 w-8 shrink-0 text-muted-foreground"
        onClick={onComplete}
        disabled={isCompleting}
        title="Marcar como hecha"
        aria-label="Marcar como hecha"
      >
        {isCompleting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Check className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
