import { PendingTaskRow } from "@/components/tasks/PendingTaskRow";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLoginAlerts } from "@/hooks/useLoginAlerts";
import { useCompletePendingTask, type PendingTask } from "@/hooks/usePendingTasks";
import {
  markLoginAlertsShown,
  pickHighlightedLoginTasks,
  summarizeLoginAlertCategories,
} from "@/lib/loginAlerts";
import { AlertTriangle, Bell, Car, Users } from "lucide-react";
import { useEffect, useState } from "react";
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

/** Montado solo con usuario y rol elegible; evita mezclar muchos hooks de React Query en el mismo fiber que useLoginAlerts. */
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
  const highlighted = pickHighlightedLoginTasks(tasks, 6);
  const remaining = Math.max(0, tasks.length - highlighted.length);
  const totalCount = tasks.length + (newLeadsCount > 0 ? newLeadsCount : 0);

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
        task.entity_type === "lead" && task.entity_id
          ? `?id=${task.entity_id}`
          : "";
      navigate(`${route}${suffix}`);
    }
  };

  const handleComplete = (taskId: string) => {
    completeTaskMutation.mutate(taskId, {
      onSuccess: () => toast({ title: "Tarea marcada como hecha" }),
      onError: (err) =>
        toast({
          title: "No se pudo completar",
          description: err instanceof Error ? err.message : "Error desconocido",
          variant: "destructive",
        }),
    });
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleDismiss();
        else setOpen(next);
      }}
    >
      <AlertDialogContent className="max-w-lg max-h-[min(90vh,720px)] flex flex-col gap-0 p-0 overflow-hidden">
        <AlertDialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-amber-100 dark:bg-amber-950/50 p-2">
              <Bell className="h-5 w-5 text-amber-700 dark:text-amber-400" />
            </div>
            <div className="space-y-1 min-w-0">
              <AlertDialogTitle>Resumen al iniciar sesión</AlertDialogTitle>
              <AlertDialogDescription>
                {totalCount === 1
                  ? "Hay 1 punto que requiere tu atención."
                  : `Hay ${totalCount} puntos que requieren tu atención.`}
                {" "}
                Revisá leads, stock sin publicar y unidades que llevan mucho tiempo en inventario.
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {newLeadsCount > 0 && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Leads nuevos en CRM</span>
                <Badge variant="secondary">{newLeadsCount}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {newLeadsCount === 1
                  ? "1 lead llegó en las últimas 48 h y sigue en estado nuevo."
                  : `${newLeadsCount} leads llegaron en las últimas 48 h y siguen en estado nuevo.`}
              </p>
              <Button type="button" size="sm" variant="default" onClick={handleGoCrm}>
                Ir al CRM
              </Button>
            </div>
          )}

          {categories.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="rounded-lg border border-border p-3 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium flex items-center gap-1.5">
                      {cat.id.startsWith("inventory") ? (
                        <Car className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : cat.id === "leads" ? (
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      {cat.label}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {cat.count}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-snug">{cat.hint}</p>
                </div>
              ))}
            </div>
          )}

          {highlighted.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Prioridad alta
              </p>
              <div className="space-y-2">
                {highlighted.map((task) => (
                  <PendingTaskRow
                    key={task.id}
                    task={task}
                    variant={task.priority === "urgent" ? "urgent" : "today"}
                    onAction={() => handleTaskAction(task)}
                    onComplete={() => handleComplete(task.id)}
                    isCompleting={
                      completeTaskMutation.isPending
                      && completeTaskMutation.variables === task.id
                    }
                  />
                ))}
              </div>
              {remaining > 0 && (
                <p className="text-xs text-muted-foreground text-center pt-1">
                  y {remaining} alerta{remaining !== 1 ? "s" : ""} más en Tareas
                </p>
              )}
            </div>
          )}
        </div>

        <AlertDialogFooter className="px-6 py-4 border-t shrink-0 flex-col sm:flex-row gap-2">
          <AlertDialogCancel type="button" className="sm:mr-auto mt-0">
            Entendido
          </AlertDialogCancel>
          {tasks.length > 0 && (
            <Button type="button" variant="outline" onClick={handleGoTasks}>
              Ver todas las tareas
            </Button>
          )}
          <AlertDialogAction type="button" onClick={handleDismiss}>
            Continuar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
