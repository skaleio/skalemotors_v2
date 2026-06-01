import { LoginAlertTaskItem } from "@/components/login-alerts/LoginAlertTaskItem";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useLoginAlerts } from "@/hooks/useLoginAlerts";
import { useCompletePendingTask, type PendingTask } from "@/hooks/usePendingTasks";
import {
  markLoginAlertsShown,
  pickHighlightedLoginTasks,
  summarizeLoginAlertCategories,
} from "@/lib/loginAlerts";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

const ENTITY_ROUTE: Record<PendingTask["entity_type"], string | null> = {
  lead: "/app/crm",
  appointment: "/app/appointments",
  vehicle: "/app/inventory",
  consignacion: "/app/consignaciones",
  custom: "/app/tasks",
};

type LoginAlertsDialogContentProps = {
  user: NonNullable<ReturnType<typeof useLoginAlerts>["user"]>;
  shouldOpen: boolean;
  tasks: PendingTask[];
  newLeadsCount: number;
};

function LoginAlertsDialogContent({
  user,
  shouldOpen,
  tasks,
  newLeadsCount,
}: LoginAlertsDialogContentProps) {
  const navigate = useNavigate();
  const completeTaskMutation = useCompletePendingTask();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (shouldOpen) setOpen(true);
  }, [shouldOpen]);

  const categories = summarizeLoginAlertCategories(tasks);
  const highlighted = pickHighlightedLoginTasks(tasks, 8);
  const remaining = Math.max(0, tasks.length - highlighted.length);
  const urgentCount = useMemo(
    () => tasks.filter((t) => t.priority === "urgent").length,
    [tasks],
  );

  const handleDismiss = () => {
    markLoginAlertsShown(user.id);
    setOpen(false);
  };

  const handleGoTasks = () => {
    handleDismiss();
    navigate("/app/tasks");
  };

  const handleGoCrm = () => {
    handleDismiss();
    navigate("/app/crm");
  };

  const handleTaskAction = (task: PendingTask) => {
    const route = ENTITY_ROUTE[task.entity_type];
    handleDismiss();
    if (route) {
      const suffix =
        task.entity_type === "lead" && task.entity_id ? `?id=${task.entity_id}` : "";
      navigate(`${route}${suffix}`);
    }
  };

  const handleComplete = (taskId: string) => {
    completeTaskMutation.mutate(taskId, {
      onSuccess: () => toast({ title: "Tarea completada" }),
      onError: (err) =>
        toast({
          title: "No se pudo completar",
          description: err instanceof Error ? err.message : "Error desconocido",
          variant: "destructive",
        }),
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleDismiss();
        else setOpen(next);
      }}
    >
      <DialogContent
        className={cn(
          "gap-0 p-0 sm:max-w-[440px]",
          "max-h-[min(88vh,680px)] flex flex-col overflow-hidden",
          /* Botón cerrar del Dialog: área propia, sin solapar el header */
          "[&>button]:absolute [&>button]:right-3 [&>button]:top-3 [&>button]:z-20",
          "[&>button]:flex [&>button]:h-8 [&>button]:w-8 [&>button]:items-center [&>button]:justify-center",
          "[&>button]:rounded-md [&>button]:border [&>button]:border-border [&>button]:bg-background",
          "[&>button]:opacity-100 [&>button]:shadow-sm",
          "hover:[&>button]:bg-muted [&>button]:ring-offset-0",
        )}
      >
        <DialogHeader className="space-y-3 px-5 pt-5 pb-4 pr-12 text-left">
          <div className="space-y-1">
            <DialogTitle className="text-base font-semibold tracking-tight pr-1">
              Pendientes al iniciar sesión
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              Revisá lo más importante antes de seguir en el panel.
            </DialogDescription>
          </div>

          {(urgentCount > 0 || categories.length > 0 || newLeadsCount > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {urgentCount > 0 && (
                <Badge variant="destructive" className="font-normal">
                  {urgentCount} urgente{urgentCount !== 1 ? "s" : ""}
                </Badge>
              )}
              {newLeadsCount > 0 && (
                <span className="inline-flex items-center rounded-md border bg-muted/50 px-2 py-0.5 text-xs">
                  <span className="text-muted-foreground">Leads nuevos</span>
                  <span className="ml-1.5 font-semibold tabular-nums text-foreground">
                    {newLeadsCount}
                  </span>
                </span>
              )}
              {categories.map((cat) => (
                <span
                  key={cat.id}
                  className="inline-flex items-center rounded-md border bg-muted/50 px-2 py-0.5 text-xs"
                >
                  <span className="text-muted-foreground">{cat.label}</span>
                  <span className="ml-1.5 font-semibold tabular-nums text-foreground">
                    {cat.count}
                  </span>
                </span>
              ))}
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4">
          {newLeadsCount > 0 && (
            <>
              <button
                type="button"
                onClick={handleGoCrm}
                className={cn(
                  "mb-3 flex w-full items-center justify-between gap-3 rounded-lg border-l-[3px]",
                  "border-l-primary bg-muted/40 px-3 py-2.5 text-left transition-colors hover:bg-muted/70",
                )}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    {newLeadsCount === 1
                      ? "1 lead nuevo sin gestionar"
                      : `${newLeadsCount} leads nuevos sin gestionar`}
                  </span>
                  <span className="text-xs text-muted-foreground">Últimas 48 horas · Ir al CRM</span>
                </span>
                <span className="text-xs font-medium text-primary shrink-0">Abrir</span>
              </button>
              {highlighted.length > 0 && <Separator className="mb-3" />}
            </>
          )}

          {highlighted.length > 0 ? (
            <div className="space-y-0.5">
              {highlighted.map((task) => (
                <LoginAlertTaskItem
                  key={task.id}
                  task={task}
                  onAction={() => handleTaskAction(task)}
                  onComplete={() => handleComplete(task.id)}
                  isCompleting={
                    completeTaskMutation.isPending
                    && completeTaskMutation.variables === task.id
                  }
                />
              ))}
            </div>
          ) : newLeadsCount === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay alertas pendientes por ahora.
            </p>
          ) : null}

          {remaining > 0 && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              <button
                type="button"
                className="font-medium text-foreground underline-offset-4 hover:underline"
                onClick={handleGoTasks}
              >
                Ver {remaining} alerta{remaining !== 1 ? "s" : ""} más
              </button>
            </p>
          )}
        </div>

        <DialogFooter className="flex-row gap-2 border-t bg-muted/20 px-5 py-4 sm:justify-stretch">
          {tasks.length > 0 && (
            <Button type="button" variant="outline" className="flex-1" onClick={handleGoTasks}>
              Todas las tareas
            </Button>
          )}
          <Button type="button" className="flex-1" onClick={handleDismiss}>
            Continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LoginAlertsDialog() {
  const alerts = useLoginAlerts();
  if (!alerts.user || !alerts.enabled) return null;
  return (
    <LoginAlertsDialogContent
      user={alerts.user}
      shouldOpen={alerts.shouldOpen}
      tasks={alerts.tasks}
      newLeadsCount={alerts.newLeadsCount}
    />
  );
}
