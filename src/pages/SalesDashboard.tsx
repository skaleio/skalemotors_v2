import { DashboardSalesAlertsPanel } from "@/components/dashboard/DashboardSalesAlertsPanel";
import { SellerPerformanceBar } from "@/components/SellerPerformanceBar";
import { SellerSalesGoalBar } from "@/components/SellerSalesGoalBar";
import { PendingTaskRow } from "@/components/tasks/PendingTaskRow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KPICard } from "@/components/ui/kpi-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useAppointments } from "@/hooks/useAppointments";
import { useLeads } from "@/hooks/useLeads";
import { useCompletePendingTask, usePendingTasks, type PendingTask } from "@/hooks/usePendingTasks";
import { findEngagementForUser, useSellerEngagement } from "@/hooks/useSellerEngagement";
import { useSalesRanking } from "@/hooks/useSalesRanking";
import { useTenantSalesGoal } from "@/hooks/useTenantSalesGoal";
import { appointmentTypeLabels, type AppointmentListItem } from "@/lib/appointmentDisplay";
import { resolveMonthlySalesGoal } from "@/lib/sellerPerformance";
import { Calendar, ChevronRight, Target, Trophy, Users } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";

const EMPTY_ENGAGEMENT = {
  engagement_score: 0,
  notes_count: 0,
  activities_count: 0,
  lead_moves_count: 0,
  is_inactive: false,
  stale_assigned_leads: 0,
};

function isActiveLeadStatus(status: string | null | undefined): boolean {
  const s = (status || "").toLowerCase();
  return s !== "vendido" && s !== "perdido" && s !== "cancelado";
}

function SalesAppointmentRow({ apt, onOpen }: { apt: AppointmentListItem; onOpen: (id: string) => void }) {
  const when = new Date(apt.scheduled_at);
  return (
    <button
      type="button"
      onClick={() => onOpen(apt.id)}
      className="w-full text-left rounded-lg border p-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold truncate">{apt.title || "Cita"}</p>
          <p className="text-xs text-muted-foreground">
            {format(when, "EEE d MMM · HH:mm", { locale: es })}
            {apt.type ? ` · ${appointmentTypeLabels[apt.type] ?? apt.type}` : ""}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
      </div>
    </button>
  );
}

export default function SalesDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { goal: tenantGoal, isLoading: loadingGoal } = useTenantSalesGoal();
  const { data: rankingData, isLoading: loadingRanking } = useSalesRanking("month", user?.branch_id ?? null, {
    enabled: !!user,
  });
  const { data: engagementRows = [], isLoading: loadingEngagement } = useSellerEngagement({
    enabled: !!user,
  });
  const { leads, loading: leadsLoading } = useLeads({
    assignedTo: user?.id,
    enabled: !!user?.id,
  });
  const { appointments, loading: appointmentsLoading } = useAppointments({
    userId: user?.id,
    enabled: !!user?.id,
    live: true,
  });
  const { urgentTasks, todayTasks, isLoading: tasksLoading } = usePendingTasks({
    branchId: user?.branch_id,
    tenantId: user?.tenant_id,
    role: user?.role,
    userId: user?.id,
    enabled: !!user,
  });
  const completeTaskMutation = useCompletePendingTask();

  const rows = rankingData?.rows ?? [];
  const ownIndex = rows.findIndex((r) => r.seller_id === user?.id);
  const ownSalesCount = ownIndex >= 0 ? rows[ownIndex].sales_count : 0;
  const rankPosition = ownIndex >= 0 ? ownIndex + 1 : null;
  const effectiveGoal = resolveMonthlySalesGoal(null, tenantGoal);
  const ownEngagement = findEngagementForUser(engagementRows, user?.id ?? "") ?? EMPTY_ENGAGEMENT;

  const activeLeadsCount = useMemo(
    () => leads.filter((l) => isActiveLeadStatus(l.status)).length,
    [leads],
  );

  const upcomingAppointments = useMemo(() => {
    const now = new Date();
    return appointments
      .filter((apt) => {
        const scheduledAt = new Date(apt.scheduled_at);
        return scheduledAt >= now && apt.status !== "cancelada";
      })
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
      .slice(0, 5)
      .map(
        (apt): AppointmentListItem => ({
          id: apt.id,
          title: apt.title,
          scheduled_at: apt.scheduled_at,
          type: apt.type,
          status: apt.status,
        }),
      );
  }, [appointments]);

  const visibleTasks = [...urgentTasks, ...todayTasks].slice(0, 5);
  const kpisLoading = loadingGoal || loadingRanking || loadingEngagement || leadsLoading;

  const completePendingTask = (taskId: string) => {
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

  const handleTaskAction = (task: PendingTask) => {
    if (task.entity_type === "lead" && task.entity_id) {
      navigate(`/app/crm?lead=${task.entity_id}`);
      return;
    }
    if (task.entity_type === "appointment" && task.entity_id) {
      navigate(`/app/appointments?id=${task.entity_id}`);
      return;
    }
    if (task.entity_type === "vehicle" && task.entity_id) {
      navigate(`/app/consignaciones?vehicle=${task.entity_id}`);
      return;
    }
    navigate("/app/crm");
  };

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Inicio</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Tu resumen comercial — ventas, leads, citas y tareas del día.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard
          label="Ventas del mes"
          value={ownSalesCount}
          subtitle={effectiveGoal ? `Meta: ${effectiveGoal}` : undefined}
          icon={Target}
          loading={kpisLoading}
          onClick={() => navigate("/app/ranking")}
        />
        <KPICard
          label="Ranking sucursal"
          value={rankPosition ? `#${rankPosition}` : "—"}
          subtitle={rows.length > 0 ? `de ${rows.length} vendedores` : "Sin ventas aún"}
          icon={Trophy}
          loading={loadingRanking}
          onClick={() => navigate("/app/ranking")}
        />
        <KPICard
          label="Leads activos"
          value={activeLeadsCount}
          subtitle="Asignados a ti"
          icon={Users}
          loading={leadsLoading}
          onClick={() => navigate("/app/crm")}
        />
        <KPICard
          label="Próximas citas"
          value={upcomingAppointments.length}
          subtitle="Programadas"
          icon={Calendar}
          loading={appointmentsLoading}
          onClick={() => navigate("/app/appointments")}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Desempeño y meta</CardTitle>
            <CardDescription>Actividad en CRM y avance de ventas del mes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingEngagement || loadingGoal ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <>
                <SellerPerformanceBar engagement={ownEngagement} />
                <SellerSalesGoalBar salesCount={ownSalesCount} goal={effectiveGoal} />
                {ownEngagement.stale_assigned_leads > 0 ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Tienes {ownEngagement.stale_assigned_leads} lead
                    {ownEngagement.stale_assigned_leads !== 1 ? "s" : ""} sin actividad reciente.
                  </p>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Próximas citas</CardTitle>
              <CardDescription>Tus citas programadas</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/app/appointments">Ver calendario</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {appointmentsLoading ? (
              <Skeleton className="h-16 w-full rounded-lg" />
            ) : upcomingAppointments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No tienes citas próximas.</p>
            ) : (
              upcomingAppointments.map((apt) => (
                <SalesAppointmentRow
                  key={apt.id}
                  apt={apt}
                  onOpen={(id) => navigate(`/app/appointments?id=${id}`)}
                />
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Tareas pendientes</CardTitle>
              <CardDescription>Urgentes y de hoy</CardDescription>
            </div>
            {(urgentTasks.length > 0 || todayTasks.length > 0) && (
              <Badge variant="secondary" className="text-xs">
                {urgentTasks.length + todayTasks.length}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {tasksLoading ? (
              <Skeleton className="h-16 w-full rounded-lg" />
            ) : visibleTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Sin tareas pendientes por ahora.</p>
            ) : (
              <>
                {visibleTasks.map((task) => (
                  <PendingTaskRow
                    key={task.id}
                    task={task}
                    variant={urgentTasks.some((t) => t.id === task.id) ? "urgent" : "today"}
                    onAction={() => handleTaskAction(task)}
                    onComplete={() => completePendingTask(task.id)}
                    isCompleting={
                      completeTaskMutation.isPending && completeTaskMutation.variables === task.id
                    }
                  />
                ))}
                <Button variant="link" className="w-full h-auto p-0" asChild>
                  <Link to="/app/mis-tareas">Ver todas las tareas →</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Avisos</CardTitle>
            <CardDescription>Notificaciones recientes para ti</CardDescription>
          </CardHeader>
          <CardContent>
            <DashboardSalesAlertsPanel userId={user?.id} role={user?.role} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
