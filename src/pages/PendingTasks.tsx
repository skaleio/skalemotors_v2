import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle2, ClipboardList, Inbox, Loader2, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { PendingTaskRow, TaskIcon } from "@/components/tasks/PendingTaskRow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import {
  useCompletePendingTask,
  useCompletedPendingTasks,
  usePendingTasks,
  type PendingTask,
} from "@/hooks/usePendingTasks";
import { cn } from "@/lib/utils";

type PriorityFilter = "all" | PendingTask["priority"];
type EntityFilter = "all" | PendingTask["entity_type"];
type SourceFilter = "all" | PendingTask["source"];

const PRIORITY_FILTERS: Array<{ value: PriorityFilter; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "urgent", label: "Urgente" },
  { value: "today", label: "Hoy" },
  { value: "later", label: "Luego" },
];

const ENTITY_FILTERS: Array<{ value: EntityFilter; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "lead", label: "Leads" },
  { value: "appointment", label: "Citas" },
  { value: "vehicle", label: "Vehículos" },
  { value: "consignacion", label: "Consignaciones" },
  { value: "custom", label: "Otros" },
];

const SOURCE_FILTERS: Array<{ value: SourceFilter; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "rule", label: "Auto" },
  { value: "llm", label: "IA" },
  { value: "whatsapp", label: "WhatsApp" },
];

const ENTITY_ROUTE: Record<PendingTask["entity_type"], string | null> = {
  lead: "/app/leads",
  appointment: "/app/appointments",
  vehicle: "/app/inventory",
  consignacion: "/app/consignaciones",
  custom: null,
};

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      className="h-7 px-3 text-xs"
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function StatCard({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant: "urgent" | "today" | "later";
}) {
  const tone =
    variant === "urgent"
      ? "border-red-200 dark:border-red-900"
      : variant === "today"
        ? "border-amber-200 dark:border-amber-900"
        : "border-border";
  const valueTone =
    variant === "urgent"
      ? "text-red-600 dark:text-red-400"
      : variant === "today"
        ? "text-amber-600 dark:text-amber-400"
        : "text-foreground";
  return (
    <Card className={cn("border", tone)}>
      <CardContent className="pt-4 pb-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={cn("text-3xl font-semibold skale-num mt-1", valueTone)}>{value}</div>
      </CardContent>
    </Card>
  );
}

function CompletedRow({ task }: { task: PendingTask }) {
  const completedAt = task.completed_at ? new Date(task.completed_at) : null;
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30">
      <TaskIcon actionType={task.action_type} urgent={false} />
      <div className="flex-1 space-y-1 min-w-0">
        <p className="text-sm font-medium line-through text-muted-foreground">{task.title}</p>
        {task.description && (
          <p className="text-xs text-muted-foreground">{task.description}</p>
        )}
        {completedAt && (
          <p className="text-xs text-muted-foreground/80">
            Completada {formatDistanceToNow(completedAt, { locale: es, addSuffix: true })}
          </p>
        )}
      </div>
      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-1" />
    </div>
  );
}

function EmptyState({
  title,
  hint,
  icon: Icon,
}: {
  title: string;
  hint: string;
  icon: typeof Inbox;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-2 py-12 text-muted-foreground">
      <Icon className="h-8 w-8" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs max-w-md">{hint}</p>
    </div>
  );
}

export default function PendingTasks() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const completeTaskMutation = useCompletePendingTask();

  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [entityFilter, setEntityFilter] = useState<EntityFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [onlyMine, setOnlyMine] = useState(false);
  const [tab, setTab] = useState<"pendientes" | "completadas">("pendientes");

  const userCtx = {
    branchId: user?.branch_id,
    tenantId: user?.tenant_id,
    role: user?.role,
    userId: user?.id,
  };

  const { tasks, isLoading, refetch } = usePendingTasks(userCtx);
  const completed = useCompletedPendingTasks(userCtx, { enabled: tab === "completadas" });

  const passesFilters = useMemo(() => {
    return (task: PendingTask) => {
      if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
      if (entityFilter !== "all" && task.entity_type !== entityFilter) return false;
      if (sourceFilter !== "all" && task.source !== sourceFilter) return false;
      if (onlyMine && task.assigned_to !== user?.id) return false;
      return true;
    };
  }, [priorityFilter, entityFilter, sourceFilter, onlyMine, user?.id]);

  const filtered = useMemo(() => tasks.filter(passesFilters), [tasks, passesFilters]);
  const filteredCompleted = useMemo(
    () => completed.tasks.filter(passesFilters),
    [completed.tasks, passesFilters],
  );

  const urgentCount = tasks.filter((t) => t.priority === "urgent").length;
  const todayCount = tasks.filter((t) => t.priority === "today").length;
  const laterCount = tasks.filter((t) => t.priority === "later").length;

  const groups: Array<{
    variant: "urgent" | "today" | "later";
    label: string;
    items: PendingTask[];
  }> = [
    { variant: "urgent", label: "Urgente", items: filtered.filter((t) => t.priority === "urgent") },
    { variant: "today", label: "Hoy", items: filtered.filter((t) => t.priority === "today") },
    { variant: "later", label: "Luego", items: filtered.filter((t) => t.priority === "later") },
  ];
  const visibleGroups =
    priorityFilter === "all" ? groups : groups.filter((g) => g.variant === priorityFilter);

  const handleAction = (task: PendingTask) => {
    const route = ENTITY_ROUTE[task.entity_type];
    if (!route) {
      toast({
        title: "Tarea sin destino",
        description: "Marcala como hecha cuando termines.",
      });
      return;
    }
    navigate(route);
  };

  const handleComplete = (task: PendingTask) => {
    completeTaskMutation.mutate(task.id, {
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
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardList className="h-7 w-7" />
            Tareas pendientes
          </h1>
          <p className="text-muted-foreground mt-1">
            Alertas generadas por el sistema y recordatorios capturados desde WhatsApp.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refrescar
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Urgentes" value={urgentCount} variant="urgent" />
        <StatCard label="Hoy" value={todayCount} variant="today" />
        <StatCard label="Luego" value={laterCount} variant="later" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-xs text-muted-foreground w-20 shrink-0">Prioridad</Label>
            {PRIORITY_FILTERS.map((opt) => (
              <FilterChip
                key={opt.value}
                active={priorityFilter === opt.value}
                onClick={() => setPriorityFilter(opt.value)}
              >
                {opt.label}
              </FilterChip>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-xs text-muted-foreground w-20 shrink-0">Tipo</Label>
            {ENTITY_FILTERS.map((opt) => (
              <FilterChip
                key={opt.value}
                active={entityFilter === opt.value}
                onClick={() => setEntityFilter(opt.value)}
              >
                {opt.label}
              </FilterChip>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-xs text-muted-foreground w-20 shrink-0">Fuente</Label>
            {SOURCE_FILTERS.map((opt) => (
              <FilterChip
                key={opt.value}
                active={sourceFilter === opt.value}
                onClick={() => setSourceFilter(opt.value)}
              >
                {opt.label}
              </FilterChip>
            ))}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Switch id="only-mine" checked={onlyMine} onCheckedChange={setOnlyMine} />
            <Label htmlFor="only-mine" className="text-sm cursor-pointer">
              Solo asignadas a mí
            </Label>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="pendientes">
            Pendientes
            <Badge variant="secondary" className="ml-2 text-xs">
              {filtered.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="completadas">
            Completadas (30d)
            {tab === "completadas" && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {filteredCompleted.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pendientes" className="space-y-4 mt-4">
          {isLoading && tasks.length === 0 ? (
            <EmptyState
              icon={Loader2}
              title="Cargando tareas..."
              hint="Sincronizando alertas del sistema."
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="Sin tareas pendientes"
              hint="Cuando haya leads sin contactar, citas sin confirmar o consignaciones detenidas, aparecerán acá."
            />
          ) : (
            visibleGroups.map((group) =>
              group.items.length === 0 ? null : (
                <div key={group.variant} className="space-y-2">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                    <span>{group.label}</span>
                    <span className="text-foreground/80">·</span>
                    <span>{group.items.length}</span>
                  </div>
                  <div className="space-y-2">
                    {group.items.map((task) => (
                      <PendingTaskRow
                        key={task.id}
                        task={task}
                        variant={group.variant}
                        onAction={() => handleAction(task)}
                        onComplete={() => handleComplete(task)}
                        isCompleting={completeTaskMutation.isPending}
                      />
                    ))}
                  </div>
                </div>
              ),
            )
          )}
        </TabsContent>

        <TabsContent value="completadas" className="space-y-2 mt-4">
          {completed.isLoading ? (
            <EmptyState
              icon={Loader2}
              title="Cargando historial..."
              hint="Buscando tareas completadas."
            />
          ) : filteredCompleted.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Sin tareas completadas"
              hint="Cuando completes tareas con los filtros activos, aparecerán aquí (últimos 30 días)."
            />
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {filteredCompleted.length} tarea(s) completada(s) en los últimos 30 días. Última:{" "}
                {filteredCompleted[0]?.completed_at
                  ? format(new Date(filteredCompleted[0].completed_at), "dd MMM yyyy, HH:mm", {
                      locale: es,
                    })
                  : "—"}
              </p>
              {filteredCompleted.map((task) => (
                <CompletedRow key={task.id} task={task} />
              ))}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
