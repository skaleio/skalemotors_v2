import { AlertCircle, Calendar, CheckCircle2, Clock, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PendingTask } from "@/hooks/usePendingTasks";

export function TaskIcon({
  actionType,
  urgent,
}: {
  actionType: PendingTask["action_type"];
  urgent: boolean;
}) {
  const className = urgent
    ? "h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0"
    : "h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0";
  switch (actionType) {
    case "contactar":
      return <AlertCircle className={className} />;
    case "llamar":
      return <Clock className={className} />;
    case "confirmar":
      return <Calendar className={className} />;
    case "enviar_cotizacion":
      return <FileText className={className} />;
    default:
      return <FileText className={className} />;
  }
}

export type PendingTaskRowVariant = "urgent" | "today" | "later";

export function PendingTaskRow({
  task,
  variant,
  onAction,
  onComplete,
  isCompleting,
}: {
  task: PendingTask;
  variant: PendingTaskRowVariant;
  onAction: () => void;
  onComplete: () => void;
  isCompleting: boolean;
}) {
  const isUrgent = variant === "urgent";
  const cardClass = isUrgent
    ? "flex items-start gap-3 p-3 rounded-lg border border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20"
    : "flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors";
  const btnVariant = isUrgent ? "destructive" : "outline";
  return (
    <div className={cardClass}>
      <TaskIcon actionType={task.action_type} urgent={isUrgent} />
      <div className="flex-1 space-y-1 min-w-0">
        <p className="text-sm font-medium">{task.title}</p>
        {task.description && <p className="text-xs text-muted-foreground">{task.description}</p>}
      </div>
      <div className="flex flex-shrink-0 gap-1">
        <Button size="sm" variant={btnVariant} onClick={onAction}>
          {task.action_label}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-muted-foreground"
          onClick={(e) => {
            e.stopPropagation();
            onComplete();
          }}
          disabled={isCompleting}
          title="Marcar como hecha"
          aria-label="Marcar tarea como hecha"
        >
          <CheckCircle2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
