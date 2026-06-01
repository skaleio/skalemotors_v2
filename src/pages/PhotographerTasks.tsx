import { useMemo } from "react";
import { ClipboardList, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { PendingTaskRow } from "@/components/tasks/PendingTaskRow";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useCompletePendingTask, usePendingTasks, type PendingTask } from "@/hooks/usePendingTasks";
import { filterTasksForLoginRole } from "@/lib/loginAlerts";
import { toast } from "@/hooks/use-toast";

const ENTITY_ROUTE: Record<PendingTask["entity_type"], string | null> = {
  lead: null,
  appointment: null,
  custom: null,
  vehicle: "/app/consignaciones",
  consignacion: "/app/consignaciones",
};

export default function PhotographerTasks() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    urgentTasks,
    todayTasks,
    laterTasks,
    isLoading,
    error,
    refetch,
  } = usePendingTasks({
    branchId: user?.branch_id,
    tenantId: user?.tenant_id,
    role: user?.role,
    userId: user?.id,
  });

  const completeTaskMutation = useCompletePendingTask();

  const filteredUrgent = useMemo(
    () => filterTasksForLoginRole(urgentTasks, user?.role),
    [urgentTasks, user?.role],
  );
  const filteredToday = useMemo(
    () => filterTasksForLoginRole(todayTasks, user?.role),
    [todayTasks, user?.role],
  );
  const filteredLater = useMemo(
    () => filterTasksForLoginRole(laterTasks, user?.role),
    [laterTasks, user?.role],
  );

  const total = filteredUrgent.length + filteredToday.length + filteredLater.length;

  const handleTaskAction = (task: PendingTask) => {
    const route = ENTITY_ROUTE[task.entity_type];
    if (route) {
      const params = task.entity_id ? `?vehicle=${task.entity_id}` : "";
      navigate(`${route}${params}`);
      return;
    }
    toast({
      title: "Sin enlace directo",
      description: "Abrí inventario y buscá la unidad indicada en la tarea.",
    });
  };

  const handleComplete = (taskId: string) => {
    completeTaskMutation.mutate(taskId, {
      onSuccess: () => toast({ title: "Tarea completada" }),
      onError: (err) =>
        toast({
          title: "No se pudo marcar la tarea",
          description: err instanceof Error ? err.message : "Error desconocido",
          variant: "destructive",
        }),
    });
  };

  return (
    <div className="w-full max-w-3xl space-y-6 pb-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <ClipboardList className="h-7 w-7" />
          Tareas pendientes
        </h1>
        <p className="text-muted-foreground mt-1">
          Unidades del inventario y consignaciones que necesitan fotos o publicación.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando tareas…
        </div>
      )}

      {error && (
        <Card>
          <CardContent className="py-6 text-center text-sm text-destructive">
            No se pudieron cargar las tareas.{" "}
            <button type="button" className="underline" onClick={() => refetch()}>
              Reintentar
            </button>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && total === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No hay tareas pendientes de fotografía por ahora.
          </CardContent>
        </Card>
      )}

      {filteredUrgent.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600 dark:text-red-400">Urgente</CardTitle>
            <CardDescription>{filteredUrgent.length} tarea(s)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {filteredUrgent.map((task) => (
              <PendingTaskRow
                key={task.id}
                task={task}
                variant="urgent"
                onAction={() => handleTaskAction(task)}
                onComplete={() => handleComplete(task.id)}
                isCompleting={completeTaskMutation.isPending}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {filteredToday.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Hoy</CardTitle>
            <CardDescription>{filteredToday.length} tarea(s)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {filteredToday.map((task) => (
              <PendingTaskRow
                key={task.id}
                task={task}
                variant="today"
                onAction={() => handleTaskAction(task)}
                onComplete={() => handleComplete(task.id)}
                isCompleting={completeTaskMutation.isPending}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {filteredLater.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Próximas</CardTitle>
            <CardDescription>{filteredLater.length} tarea(s)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {filteredLater.map((task) => (
              <PendingTaskRow
                key={task.id}
                task={task}
                variant="later"
                onAction={() => handleTaskAction(task)}
                onComplete={() => handleComplete(task.id)}
                isCompleting={completeTaskMutation.isPending}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
