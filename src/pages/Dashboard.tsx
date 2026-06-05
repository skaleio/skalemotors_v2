import DashboardLoader from "@/components/DashboardLoader";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KPICard } from "@/components/ui/kpi-card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useAppointments } from "@/hooks/useAppointments";
import { useDashboardStats, DASHBOARD_STATS_QUERY_KEY, type DashboardSelectedMonth } from "@/hooks/useDashboardStats";
import { useCompletePendingTask, usePendingTasks } from "@/hooks/usePendingTasks";
import { PendingTaskRow } from "@/components/tasks/PendingTaskRow";
import { formatCLP } from "@/lib/format";
import { DASHBOARD_KPI_INFO } from "@/lib/dashboardKpiInfo";
import {
  isAppointmentCalendarQueryEnabled,
  resolveAppointmentCalendarScope,
} from "@/lib/appointmentCalendarScope";
import { appointmentService } from "@/lib/services/appointments";
import { supabase } from "@/lib/supabase";
import { ingresosEmpresaService } from "@/lib/services/ingresosEmpresa";
import { leadService } from "@/lib/services/leads";
import { AlertCircle, ArrowDownRight, ArrowUpRight, BarChart3, Calendar, Car, CheckCircle2, ChevronLeft, ChevronRight, Clock, DollarSign, ExternalLink, FileText, Mail, MapPin, Phone, Send, TrendingUp, Trash2, UserCheck, Users, Wallet, Banknote } from "lucide-react";
import type { PendingTask } from "@/hooks/usePendingTasks";
import { addDays, format, isSameDay, isToday } from "date-fns";
import { es } from "date-fns/locale";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SalesPipelineChart } from "@/components/dashboard/SalesPipelineChart";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { CHART_PALETTE, CHART_PRIMARY } from "@/lib/chartPalette";

const COLORS = CHART_PALETTE;

const categoryLabels: Record<string, string> = {
  nuevo: 'Nuevos',
  usado: 'Usados',
  consignado: 'Consignados'
};

import {
  appointmentTypeLabels,
  buildAppointmentDetailSnapshot,
  type AppointmentDetailSnapshot,
  type AppointmentListItem,
} from "@/lib/appointmentDisplay";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user?.role === "vendedor") {
      navigate("/app/crm", { replace: true });
    } else if (user?.role === "fotografo") {
      navigate("/app/consignaciones", { replace: true });
    }
  }, [user?.role, navigate]);

  const [selectedMonth, setSelectedMonth] = useState<DashboardSelectedMonth>(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const { data: stats, isLoading, error, refetch: refetchStats } = useDashboardStats(user?.branch_id, selectedMonth, user?.id);
  const { urgentCount, urgentTasks, todayTasks, laterTasks, isLoading: tasksLoading, queryClient } = usePendingTasks({
    branchId: user?.branch_id,
    tenantId: user?.tenant_id,
    role: user?.role,
    userId: user?.id,
  });
  const completeTaskMutation = useCompletePendingTask();

  const completePendingTask = (taskId: string, options?: { silent?: boolean }) => {
    completeTaskMutation.mutate(taskId, {
      onSuccess: () => {
        if (!options?.silent) {
          toast({ title: "Tarea completada" });
        }
      },
      onError: (err) => {
        toast({
          title: "No se pudo marcar la tarea",
          description: err instanceof Error ? err.message : "Error desconocido",
          variant: "destructive",
        });
      },
    });
  };

  const appointmentCalendarScope = useMemo(() => resolveAppointmentCalendarScope(user), [user]);
  const { appointments: calendarAppointments, loading: appointmentsLoading } = useAppointments({
    userId: appointmentCalendarScope?.userId,
    tenantId: appointmentCalendarScope?.tenantId,
    branchId: appointmentCalendarScope?.branchId,
    enabled: isAppointmentCalendarQueryEnabled(appointmentCalendarScope),
    live: true,
  });

  const upcomingAppointments = useMemo(() => {
    const now = new Date();
    return calendarAppointments
      .filter((apt) => {
        const scheduledAt = new Date(apt.scheduled_at);
        return scheduledAt >= now && apt.status !== "cancelada";
      })
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
      .slice(0, 5);
  }, [calendarAppointments]);

  useEffect(() => {
    const tenantId = user?.tenant_id;
    if (!tenantId) return;
    const channel = supabase
      .channel(`dashboard-appointments-live-${tenantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["appointments"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.tenant_id, queryClient]);

  useEffect(() => {
    const tenantId = user?.tenant_id;
    if (!tenantId) return;
    const channel = supabase
      .channel(`dashboard-sales-live-${tenantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sales",
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: [DASHBOARD_STATS_QUERY_KEY] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.tenant_id, queryClient]);

  // Modales de KPI: Ventas del mes, Total ingresos y Balance (gastos)
  const [showVentasMesModal, setShowVentasMesModal] = useState(false);
  const [showTotalIngresosModal, setShowTotalIngresosModal] = useState(false);
  const [showBalanceModal, setShowBalanceModal] = useState(false);

  // Id del ingreso "Otro" que se está borrando (para deshabilitar el botón)
  const [deletingIncomeId, setDeletingIncomeId] = useState<string | null>(null);

  // Estado para modal de detalle de venta reciente
  const [selectedRecentSale, setSelectedRecentSale] = useState<{
    id: string
    vehicle: string
    amount: number
    date: string
    seller: string
    clientName: string
    margin: number
    status: string
    payment_status: string | null
    commission_credit_status: string | null
    stock_origin: string | null
  } | null>(null);

  const [isSavingAppointment, setIsSavingAppointment] = useState(false);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);

  // Estados para los diálogos
  const [showNewAppointmentDialog, setShowNewAppointmentDialog] = useState(false);
  const [showQuoteDialog, setShowQuoteDialog] = useState(false);
  const [showCompleteAppointmentDialog, setShowCompleteAppointmentDialog] = useState(false);
  const [showAppointmentDetailDialog, setShowAppointmentDetailDialog] = useState(false);
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [showConfirmTestDriveDialog, setShowConfirmTestDriveDialog] = useState(false);
  const [showContactLeadDialog, setShowContactLeadDialog] = useState(false);
  const [showCallLeadDialog, setShowCallLeadDialog] = useState(false);

  // Estados para los formularios
  const [newAppointment, setNewAppointment] = useState({
    clientName: '',
    clientPhone: '',
    clientEmail: '',
    appointmentType: 'test_drive',
    date: '',
    time: '',
    vehicle: '',
    notes: ''
  });

  const [quoteData, setQuoteData] = useState({
    leadId: null as string | null,
    clientName: '',
    clientEmail: '',
    vehicle: '',
    price: '',
    notes: ''
  });

  const [contactData, setContactData] = useState({
    leadId: null as string | null,
    leadName: '',
    contactMethod: 'phone',
    notes: ''
  });

  const [rescheduleData, setRescheduleData] = useState({ date: '', time: '', reason: '' });
  const [confirmTestDriveData, setConfirmTestDriveData] = useState({ notes: '' });
  const [selectedAppointmentSnapshot, setSelectedAppointmentSnapshot] = useState<AppointmentDetailSnapshot | null>(null);

  const openAppointmentDetail = (apt: AppointmentListItem) => {
    const snapshot = buildAppointmentDetailSnapshot(apt);
    setSelectedAppointmentId(apt.id);
    setSelectedAppointmentSnapshot(snapshot);
    setShowAppointmentDetailDialog(true);
  };

  const selectAppointmentForAction = (apt: AppointmentListItem) => {
    setSelectedAppointmentId(apt.id);
    setSelectedAppointmentSnapshot(buildAppointmentDetailSnapshot(apt));
  };

  const openRescheduleFromSnapshot = (snapshot: AppointmentDetailSnapshot) => {
    setSelectedAppointmentId(snapshot.id);
    setSelectedAppointmentSnapshot(snapshot);
    const d = new Date(snapshot.scheduledAt);
    const pad = (n: number) => String(n).padStart(2, "0");
    setRescheduleData({
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
      reason: "",
    });
    setShowAppointmentDetailDialog(false);
    setShowRescheduleDialog(true);
  };

  const handleDeleteOtherIncome = async (id: string) => {
    if (!id) return;
    setDeletingIncomeId(id);
    try {
      await ingresosEmpresaService.remove(id);
      toast({ title: "Ingreso eliminado", description: "Se quitó de la lista y del total de otros ingresos." });
      refetchStats();
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "No se pudo eliminar.", variant: "destructive" });
    } finally {
      setDeletingIncomeId(null);
    }
  };

  const handleTaskAction = (task: PendingTask) => {
    if (task.entity_type === 'lead' && task.entity_id) {
      if (task.action_type === 'contactar') {
        setContactData({
          ...contactData,
          leadId: task.entity_id,
          leadName: task.title.replace(/^Contactar a\s+/i, '').trim() || task.title,
        });
        setShowContactLeadDialog(true);
      } else if (task.action_type === 'llamar') {
        setContactData({
          ...contactData,
          leadId: task.entity_id,
          leadName: task.title.replace(/^Llamar a\s+|^Seguimiento[^:]*:\s*/i, '').trim() || task.title,
        });
        setShowCallLeadDialog(true);
      } else if (task.action_type === 'enviar_cotizacion') {
        const meta = (typeof task.metadata === 'object' && task.metadata !== null)
          ? (task.metadata as { vehicle_name?: string })
          : {};
        setQuoteData({
          ...quoteData,
          leadId: task.entity_id,
          clientName: task.title.replace(/^Enviar cotización a\s+/i, '').trim() || task.title,
          vehicle: meta.vehicle_name ?? '',
          price: '',
          notes: task.description ?? '',
        });
        setShowQuoteDialog(true);
      } else {
        completePendingTask(task.id, { silent: true });
        navigate(`/app/leads?id=${task.entity_id}`);
      }
    } else if (task.entity_type === 'appointment' && task.entity_id) {
      navigate(`/app/appointments?id=${task.entity_id}`);
    } else if (task.entity_type === 'vehicle' && task.entity_id) {
      navigate(`/app/consignaciones?vehicle=${task.entity_id}`);
    } else if (task.entity_type === 'consignacion' && task.entity_id) {
      navigate(`/app/consignaciones?consignacion=${task.entity_id}`);
    } else {
      navigate('/app/leads');
    }
  };

  // Funciones para manejar las acciones
  const handleCreateAppointment = async () => {
    if (!newAppointment.date || !newAppointment.time) {
      toast({ title: "Faltan datos", description: "Ingresa fecha y hora para la cita.", variant: "destructive" });
      return;
    }
    setIsSavingAppointment(true);
    try {
      const scheduledAt = new Date(`${newAppointment.date}T${newAppointment.time}`).toISOString();
      await appointmentService.create({
        title: newAppointment.clientName
          ? `${appointmentTypeLabels[newAppointment.appointmentType] ?? newAppointment.appointmentType} - ${newAppointment.clientName}`
          : appointmentTypeLabels[newAppointment.appointmentType] ?? 'Cita',
        type: newAppointment.appointmentType,
        scheduled_at: scheduledAt,
        notes: newAppointment.notes || null,
        branch_id: user?.branch_id ?? null,
        user_id: user?.id ?? null,
        status: 'programada',
      });
      toast({
        title: "✅ Cita agendada",
        description: `Cita con ${newAppointment.clientName || 'cliente'} agendada para ${newAppointment.date} a las ${newAppointment.time}`,
      });
      setShowNewAppointmentDialog(false);
      setNewAppointment({ clientName: '', clientPhone: '', clientEmail: '', appointmentType: 'test_drive', date: '', time: '', vehicle: '', notes: '' });
    } catch (err) {
      toast({ title: "Error al agendar", description: err instanceof Error ? err.message : 'Error desconocido', variant: "destructive" });
    } finally {
      setIsSavingAppointment(false);
    }
    setNewAppointment({
      clientName: '',
      clientPhone: '',
      clientEmail: '',
      appointmentType: 'test_drive',
      date: '',
      time: '',
      vehicle: '',
      notes: ''
    });
  };

  const handleSendQuote = async () => {
    if (!quoteData.leadId) {
      toast({ title: "Falta lead", description: "Abrí la cotización desde una tarea pendiente de un lead.", variant: "destructive" });
      return;
    }
    if (!quoteData.price.trim() && !quoteData.notes.trim()) {
      toast({ title: "Faltan datos", description: "Cargá al menos precio o notas.", variant: "destructive" });
      return;
    }
    setIsSavingAppointment(true);
    try {
      const lines = [
        quoteData.vehicle && `Vehículo: ${quoteData.vehicle}`,
        quoteData.price && `Precio: ${quoteData.price}`,
        quoteData.clientEmail && `Email: ${quoteData.clientEmail}`,
        quoteData.notes && `Notas: ${quoteData.notes}`,
      ].filter(Boolean) as string[];
      await leadService.addActivity(quoteData.leadId, {
        lead_id: quoteData.leadId,
        user_id: user?.id ?? null,
        type: 'cotizacion',
        subject: `Cotización ${quoteData.clientName ? `para ${quoteData.clientName}` : ''}`.trim(),
        description: lines.join('\n') || null,
        completed_at: new Date().toISOString(),
      });
      toast({ title: "✅ Cotización registrada", description: `Quedó en la actividad del lead.` });
      queryClient.invalidateQueries({ queryKey: ['pending-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setShowQuoteDialog(false);
      setQuoteData({ leadId: null, clientName: '', clientEmail: '', vehicle: '', price: '', notes: '' });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : 'Error desconocido', variant: "destructive" });
    } finally {
      setIsSavingAppointment(false);
    }
  };

  const handleCompleteAppointment = async () => {
    if (!selectedAppointmentId) {
      toast({ title: "Error", description: "No se seleccionó ninguna cita", variant: "destructive" });
      return;
    }
    setIsSavingAppointment(true);
    try {
      await appointmentService.update(selectedAppointmentId, { status: 'completada' });
      toast({
        title: "✅ Cita completada",
        description: "La cita ha sido marcada como completada",
      });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['pending-tasks'] });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : 'Error desconocido', variant: "destructive" });
    } finally {
      setIsSavingAppointment(false);
    }
    setShowCompleteAppointmentDialog(false);
    setShowAppointmentDetailDialog(false);
  };

  const handleReschedule = async () => {
    if (!selectedAppointmentId) {
      toast({ title: "Error", description: "No se seleccionó ninguna cita", variant: "destructive" });
      return;
    }
    if (!rescheduleData.date || !rescheduleData.time) {
      toast({ title: "Faltan datos", description: "Elegí fecha y hora", variant: "destructive" });
      return;
    }
    const parsed = new Date(`${rescheduleData.date}T${rescheduleData.time}`);
    if (isNaN(parsed.getTime())) {
      toast({ title: "Fecha u hora inválida", description: "Verificá los campos antes de reagendar.", variant: "destructive" });
      return;
    }
    setIsSavingAppointment(true);
    try {
      const scheduledAt = parsed.toISOString();
      const updates: { scheduled_at: string; notes?: string } = { scheduled_at: scheduledAt };
      if (rescheduleData.reason.trim()) {
        updates.notes = `Reagendada: ${rescheduleData.reason.trim()}`;
      }
      await appointmentService.update(selectedAppointmentId, updates);
      toast({ title: "✅ Cita reagendada", description: "Nueva fecha guardada." });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['pending-tasks'] });
      setShowRescheduleDialog(false);
      setRescheduleData({ date: '', time: '', reason: '' });
      setSelectedAppointmentSnapshot(null);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : 'Error desconocido', variant: "destructive" });
    } finally {
      setIsSavingAppointment(false);
    }
  };

  const handleConfirmTestDrive = async () => {
    if (!selectedAppointmentId) {
      toast({ title: "Error", description: "No se seleccionó ninguna cita", variant: "destructive" });
      return;
    }
    setIsSavingAppointment(true);
    try {
      const updates: { status: 'confirmada'; notes?: string } = { status: 'confirmada' };
      if (confirmTestDriveData.notes.trim()) {
        updates.notes = confirmTestDriveData.notes.trim();
      }
      await appointmentService.update(selectedAppointmentId, updates);
      toast({ title: "✅ Test drive confirmado", description: "Cita marcada como confirmada." });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['pending-tasks'] });
      setShowConfirmTestDriveDialog(false);
      setConfirmTestDriveData({ notes: '' });
      setSelectedAppointmentSnapshot(null);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : 'Error desconocido', variant: "destructive" });
    } finally {
      setIsSavingAppointment(false);
    }
  };

  const handleContactLead = async () => {
    if (!contactData.leadId) {
      toast({ title: "Falta lead", description: "Abrí el contacto desde una tarea pendiente.", variant: "destructive" });
      return;
    }
    if (!contactData.notes.trim()) {
      toast({ title: "Falta resumen", description: "Anotá lo que se habló.", variant: "destructive" });
      return;
    }
    const methodToType: Record<string, 'llamada' | 'email' | 'whatsapp' | 'reunion'> = {
      phone: 'llamada',
      email: 'email',
      whatsapp: 'whatsapp',
      presencial: 'reunion',
    };
    setIsSavingAppointment(true);
    try {
      await leadService.addActivity(contactData.leadId, {
        lead_id: contactData.leadId,
        user_id: user?.id ?? null,
        type: methodToType[contactData.contactMethod] ?? 'nota',
        description: contactData.notes.trim(),
        completed_at: new Date().toISOString(),
      });
      toast({ title: "✅ Contacto registrado", description: `Contacto con ${contactData.leadName} guardado.` });
      queryClient.invalidateQueries({ queryKey: ['pending-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setShowContactLeadDialog(false);
      setContactData({ leadId: null, leadName: '', contactMethod: 'phone', notes: '' });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : 'Error desconocido', variant: "destructive" });
    } finally {
      setIsSavingAppointment(false);
    }
  };

  const salesChange = useMemo(() => {
    if (!stats?.salesByMonth || stats.salesByMonth.length < 2) {
      return 0;
    }
    const current = stats.salesByMonth[stats.salesByMonth.length - 1].sales;
    const previous = stats.salesByMonth[stats.salesByMonth.length - 2].sales;
    if (!previous) {
      return 0;
    }
    return ((current - previous) / previous) * 100;
  }, [stats?.salesByMonth]);

  const now = new Date();
  const isCurrentMonth = selectedMonth.year === now.getFullYear() && selectedMonth.month === now.getMonth();
  const goPrevMonth = () => {
    setSelectedMonth((prev) => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { year: prev.year, month: prev.month - 1 };
    });
  };
  const goNextMonth = () => {
    if (isCurrentMonth) return;
    setSelectedMonth((prev) => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 };
      return { year: prev.year, month: prev.month + 1 };
    });
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Vista general de tu automotora
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goPrevMonth} title="Mes anterior">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <span className="min-w-[140px] text-center font-semibold text-sm">
            {stats?.selectedMonthLabel ?? "Cargando…"}
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goNextMonth} disabled={isCurrentMonth} title="Mes siguiente">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <KPICard
          label="Ventas del mes"
          icon={DollarSign}
          loading={!stats}
          loadingWidth="lg"
          value={stats ? formatCLP(stats.salesRevenue || 0) : ""}
          delta={stats && salesChange !== 0 ? { value: salesChange } : undefined}
          subtitle={stats ? `${stats.salesThisMonth || 0} vehículos · ${stats.selectedMonthLabel ?? ""}` : undefined}
          info={DASHBOARD_KPI_INFO.ventasDelMes}
          onClick={() => setShowVentasMesModal(true)}
        />

        <KPICard
          label="Total ingresos"
          icon={Banknote}
          loading={!stats}
          loadingWidth="lg"
          value={stats ? formatCLP(stats.totalIncomeMonth ?? 0) : ""}
          subtitle={`Ingresos del mes (${stats?.selectedMonthLabel ?? "—"})`}
          info={DASHBOARD_KPI_INFO.totalIngresos}
          onClick={() => setShowTotalIngresosModal(true)}
        />

        <KPICard
          label="Balance"
          icon={Wallet}
          loading={!stats}
          loadingWidth="lg"
          value={stats ? formatCLP(stats.balance ?? 0) : ""}
          valueTone={(stats?.balance ?? 0) >= 0 ? "positive" : "negative"}
          subtitle={`Ingresos − gastos (${stats?.selectedMonthLabel ?? "mes"})`}
          info={DASHBOARD_KPI_INFO.balance}
          onClick={() => setShowBalanceModal(true)}
        />

        <KPICard
          label="Inventario"
          icon={Car}
          loading={!stats}
          loadingWidth="sm"
          value={stats?.totalVehicles ?? 0}
          subtitle={stats ? `${stats.availableVehicles || 0} disponibles` : undefined}
        />

        <KPICard
          label="Leads activos"
          icon={Users}
          loading={!stats}
          loadingWidth="sm"
          value={stats?.activeLeads ?? 0}
          subtitle="En conversión"
        />

        <KPICard
          label="Citas"
          icon={Calendar}
          loading={!stats}
          loadingWidth="sm"
          value={stats?.scheduledAppointments ?? 0}
          subtitle="Programadas"
        />
      </div>

      {/* Próximas Citas y Tareas - Lado a lado */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Próximas Citas */}
        <Card className="border-0 shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  Próximas citas
                </CardTitle>
                <CardDescription className="text-xs">
                  {appointmentCalendarScope?.listDescription ?? "Citas programadas"}
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/app/appointments')}>
                Ver todas
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {appointmentsLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-24 w-full rounded-lg" />
                <Skeleton className="h-24 w-full rounded-lg" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : upcomingAppointments.length > 0 ? (
              <div className="space-y-4">
                {upcomingAppointments.map((apt) => {
                  const scheduledAt = new Date(apt.scheduled_at);
                  const dayLabel = isToday(scheduledAt)
                    ? "HOY"
                    : isSameDay(scheduledAt, addDays(new Date(), 1))
                      ? "MAÑANA"
                      : format(scheduledAt, "EEE d MMM", { locale: es });
                  const listItem = apt as AppointmentListItem;
                  const detail = buildAppointmentDetailSnapshot(listItem);
                  const typeLabel = detail.typeLabel;
                  const clientName = detail.clientName;
                  const vehicleStr = detail.vehicleStr;
                  const branchName = detail.branchName;
                  const assigneeName = detail.assigneeName;
                  return (
                    <div
                      key={apt.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openAppointmentDetail(listItem)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openAppointmentDetail(listItem);
                        }
                      }}
                      className="flex items-start gap-4 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="flex flex-col items-center gap-1 min-w-[60px]">
                        <Badge variant="default" className="bg-pink-500">
                          {dayLabel}
                        </Badge>
                        <span className="text-2xl font-bold">{format(scheduledAt, "HH:mm")}</span>
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold">{typeLabel}</h4>
                          <Badge variant="outline">{detail.statusLabel}</Badge>
                        </div>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            <span>{clientName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Car className="h-4 w-4" />
                            <span>{vehicleStr}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            <span>{branchName}</span>
                          </div>
                          {appointmentCalendarScope?.scope === "tenant" && (
                            <div className="flex items-center gap-2">
                              <UserCheck className="h-4 w-4" />
                              <span>{assigneeName || "Sin vendedor"}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 pt-2" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => {
                              selectAppointmentForAction(listItem);
                              setShowCompleteAppointmentDialog(true);
                            }}
                          >
                            Marcar completada
                          </Button>
                          {apt.type === 'test_drive' && apt.status === 'programada' && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                selectAppointmentForAction(listItem);
                                setConfirmTestDriveData({ notes: '' });
                                setShowConfirmTestDriveDialog(true);
                              }}
                            >
                              Confirmar
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openRescheduleFromSnapshot(detail)}
                          >
                            Reagendar
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div className="text-center py-4 text-sm text-muted-foreground">
                  <p>
                    {upcomingAppointments.length === 5
                      ? "Mostrando las 5 citas más próximas del calendario"
                      : `${upcomingAppointments.length} cita${upcomingAppointments.length === 1 ? "" : "s"} próxima${upcomingAppointments.length === 1 ? "" : "s"} en el calendario`}
                  </p>
                </div>
              </div>
            ) : (
              <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground">
                <Calendar className="h-12 w-12 mb-3 opacity-20" />
                <p className="text-sm font-medium">No hay citas próximas en el calendario</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setShowNewAppointmentDialog(true)}
                >
                  Agendar nueva cita
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tareas Pendientes */}
        <Card className="border-0 shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  Tareas pendientes
                </CardTitle>
                <CardDescription className="text-xs">Acciones que requieren tu atención</CardDescription>
              </div>
              {urgentCount > 0 && (
                <Badge variant="destructive" className="text-sm">{urgentCount} urgente{urgentCount !== 1 ? 's' : ''}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4 max-h-[400px] overflow-y-auto">
              {tasksLoading ? (
                <p className="text-sm text-muted-foreground py-4">Cargando tareas...</p>
              ) : urgentTasks.length === 0 && todayTasks.length === 0 && laterTasks.length === 0 ? (
                <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mb-3 opacity-20" />
                  <p className="text-sm font-medium">No hay tareas pendientes</p>
                  <p className="text-xs mt-1">Las alertas aparecerán aquí (leads sin contactar, seguimientos, citas por confirmar, recordatorios WhatsApp).</p>
                  <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/leads')}>
                    Ver leads
                  </Button>
                </div>
              ) : (
                <>
                  {urgentTasks.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive" className="text-xs">URGENTE</Badge>
                        <span className="text-sm font-semibold">Requieren atención inmediata</span>
                      </div>
                      <div className="space-y-2">
                        {urgentTasks.map((task) => (
                          <PendingTaskRow
                            key={task.id}
                            task={task}
                            variant="urgent"
                            onAction={() => handleTaskAction(task)}
                            onComplete={() => completePendingTask(task.id)}
                            isCompleting={
                              completeTaskMutation.isPending
                              && completeTaskMutation.variables === task.id
                            }
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {todayTasks.length > 0 && (
                    <div className="space-y-3 pt-4 border-t">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">HOY</Badge>
                        <span className="text-sm font-semibold">Para completar hoy</span>
                      </div>
                      <div className="space-y-2">
                        {todayTasks.map((task) => (
                          <PendingTaskRow
                            key={task.id}
                            task={task}
                            variant="today"
                            onAction={() => handleTaskAction(task)}
                            onComplete={() => completePendingTask(task.id)}
                            isCompleting={
                              completeTaskMutation.isPending
                              && completeTaskMutation.variables === task.id
                            }
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {laterTasks.length > 0 && (
                    <div className="space-y-3 pt-4 border-t">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">DESPUÉS</Badge>
                        <span className="text-sm font-semibold">Otras tareas</span>
                      </div>
                      <div className="space-y-2">
                        {laterTasks.slice(0, 3).map((task) => (
                          <PendingTaskRow
                            key={task.id}
                            task={task}
                            variant="later"
                            onAction={() => handleTaskAction(task)}
                            onComplete={() => completePendingTask(task.id)}
                            isCompleting={
                              completeTaskMutation.isPending
                              && completeTaskMutation.variables === task.id
                            }
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="text-center pt-4 border-t">
                    <Button variant="link" onClick={() => navigate('/leads')}>
                      Ver leads →
                    </Button>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Ventas por Mes */}
        <Card className="border-0 shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  Tendencia de ventas
                </CardTitle>
                <CardDescription className="text-xs">Últimos 6 meses</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {stats?.salesByMonth && stats.salesByMonth.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={stats.salesByMonth} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_PRIMARY} stopOpacity={0.15}/>
                      <stop offset="95%" stopColor={CHART_PRIMARY} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 500 }}
                    tickLine={false}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <YAxis
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 500 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      padding: '12px'
                    }}
                    formatter={(value: any, name: string) => {
                      if (name === 'sales') return [value, 'Ventas'];
                      return [formatCLP(value), 'Ingresos'];
                    }}
                    labelStyle={{ fontWeight: 600, marginBottom: '4px' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="sales"
                    stroke={CHART_PRIMARY}
                    strokeWidth={2}
                    dot={{ fill: CHART_PRIMARY, r: 3, strokeWidth: 2, stroke: 'hsl(var(--card))' }}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: 'hsl(var(--card))' }}
                    fill="url(#colorSales)"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[320px] flex flex-col items-center justify-center text-muted-foreground">
                <TrendingUp className="h-12 w-12 mb-3 opacity-20" />
                <p className="text-sm font-medium">No hay datos de ventas disponibles</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Inventario por Categoría */}
        <Card className="border-0 shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  Distribución de inventario
                </CardTitle>
                <CardDescription className="text-xs">Por categoría de vehículo</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {stats?.vehiclesByCategory && stats.vehiclesByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={stats.vehiclesByCategory.map(item => ({
                      ...item,
                      name: categoryLabels[item.category] || item.category
                    }))}
                    cx="50%"
                    cy="45%"
                    labelLine={false}
                    label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                      const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                      const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
                      const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);
                      return (
                        <text
                          x={x}
                          y={y}
                          fill="white"
                          textAnchor={x > cx ? 'start' : 'end'}
                          dominantBaseline="central"
                          className="text-xs font-bold"
                        >
                          {`${(percent * 100).toFixed(0)}%`}
                        </text>
                      );
                    }}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="count"
                    paddingAngle={3}
                  >
                    {stats.vehiclesByCategory.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                        stroke="hsl(var(--background))"
                        strokeWidth={3}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      padding: '12px'
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                    formatter={(value) => <span className="text-xs font-medium">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[320px] flex flex-col items-center justify-center text-muted-foreground">
                <Car className="h-12 w-12 mb-3 opacity-20" />
                <p className="text-sm font-medium">No hay vehículos en inventario</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Leads por Estado y Ventas Recientes */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Ventas Recientes */}
        <Card className="border-0 shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  Ventas Recientes
                </CardTitle>
                <CardDescription className="text-xs">Últimas 5 transacciones</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {stats?.recentSales && stats.recentSales.length > 0 ? (
              <div className="space-y-3">
                {stats.recentSales.map((sale, index) => (
                  <div
                    key={sale.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedRecentSale(sale)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSelectedRecentSale(sale)}
                    className="group flex items-center justify-between p-4 rounded-xl border border-border/50 hover:border-green-500/30 hover:bg-green-50/30 dark:hover:bg-green-950/10 transition-all duration-200 cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-500/20 text-white font-bold text-sm flex-shrink-0">
                        {index + 1}
                        <div className="absolute inset-0 rounded-xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="space-y-1.5 min-w-0">
                        <p className="text-sm font-semibold tracking-tight">{sale.vehicle}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1 font-medium">
                            <Users className="h-3 w-3" />
                            {sale.seller}
                          </span>
                          <span className="text-muted-foreground/50">•</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(sale.date).toLocaleDateString('es-CL', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-base font-bold text-green-600 dark:text-green-400 tracking-tight">
                        {formatCLP(sale.amount)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[320px] flex flex-col items-center justify-center text-muted-foreground">
                <DollarSign className="h-12 w-12 mb-3 opacity-20" />
                <p className="text-sm font-medium">No hay ventas recientes</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Leads por Estado */}
        <Card className="border-0 shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Pipeline de Ventas
                </CardTitle>
                <CardDescription className="text-xs">Embudo por etapa del CRM</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <SalesPipelineChart leadsByStatus={stats?.leadsByStatus ?? []} />
          </CardContent>
        </Card>

      </div>

      {/* Diálogos */}
      {/* Modal: Ventas del mes */}
      <Dialog open={showVentasMesModal} onOpenChange={setShowVentasMesModal}>
        <DialogContent className="sm:max-w-[520px] max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              Ventas del mes {stats?.selectedMonthLabel ? `(${stats.selectedMonthLabel})` : ""}
            </DialogTitle>
            <DialogDescription>
              Detalle de ventas completadas en el mes actual
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto flex-1 min-h-0">
            {stats?.salesThisMonthList && stats.salesThisMonthList.length > 0 ? (
              <>
                <div className="space-y-2">
                  {stats.salesThisMonthList.map((sale) => (
                    <div
                      key={sale.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{sale.vehicle}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(sale.date).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })} · {sale.seller}
                        </p>
                      </div>
                      <span className="font-semibold text-green-600 dark:text-green-400 shrink-0 ml-2">
                        {formatCLP(sale.amount)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="border-t pt-3 flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground">
                    {stats.salesThisMonthList.length} venta{stats.salesThisMonthList.length !== 1 ? 's' : ''} · Total
                  </span>
                  <span className="text-lg font-bold">{formatCLP(stats?.salesRevenue ?? 0)}</span>
                </div>
              </>
            ) : stats?.recentSales && stats.recentSales.length > 0 ? (
              <>
                <p className="text-sm text-muted-foreground">
                  No hay ventas completadas este mes. Últimas ventas registradas:
                </p>
                <div className="space-y-2">
                  {stats.recentSales.map((sale) => (
                    <div
                      key={sale.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{sale.vehicle}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(sale.date).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })} · {sale.seller}
                        </p>
                      </div>
                      <span className="font-semibold text-green-600 dark:text-green-400 shrink-0 ml-2">
                        {formatCLP(sale.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <Car className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No hay ventas completadas este mes</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVentasMesModal(false)}>Cerrar</Button>
            <Button onClick={() => { setShowVentasMesModal(false); navigate('/app/sales'); }}>
              Ver todas las ventas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Total ingresos */}
      <Dialog open={showTotalIngresosModal} onOpenChange={setShowTotalIngresosModal}>
        <DialogContent className="sm:max-w-[520px] max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-muted-foreground" />
              Total ingresos
            </DialogTitle>
            <DialogDescription>
              Desglose total histórico (ganancia por ventas y otros ingresos con pago realizado)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 overflow-y-auto flex-1 min-h-0">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Ganancia por ventas</span>
                <span className="font-semibold">{formatCLP(stats?.totalIncomeFromSales ?? 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Otros ingresos (ingresos empresa)</span>
                <span className="font-semibold">{formatCLP(stats?.totalIncomeFromEmpresa ?? 0)}</span>
              </div>
              <div className="border-t pt-3 flex justify-between items-center">
                <span className="font-medium">Total ingresos</span>
                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCLP(stats?.totalIncome ?? 0)}
                </span>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-2">Lista de ingresos</h4>
              {stats?.allIncomeList && stats.allIncomeList.length > 0 ? (
                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                  {stats.allIncomeList.map((item) => (
                    <div
                      key={`${item.type}-${item.id}`}
                      className="flex items-center justify-between gap-2 p-3 rounded-lg border bg-muted/30"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={item.type === 'sale' ? 'default' : 'secondary'} className="text-xs shrink-0">
                            {item.type === 'sale' ? 'Venta' : 'Otro'}
                          </Badge>
                          <p className="text-sm font-medium truncate">{item.description}</p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(item.date).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatCLP(item.amount)}
                        </span>
                        {item.type === 'other' && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteOtherIncome(item.id)}
                            disabled={deletingIncomeId === item.id}
                            title="Eliminar este ingreso (solo ingresos empresa, no ventas)"
                          >
                            {deletingIncomeId === item.id ? (
                              <span className="text-xs">...</span>
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">No hay ingresos registrados</p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Solo suman al total las ventas con pago realizado y los ingresos empresa marcados como realizados. Los ingresos empresa ligados a una venta (mismo pago) no se suman en &quot;Otros ingresos&quot; para evitar duplicados. Podés eliminar entradas &quot;Otro&quot; con el ícono de papelera si son comisiones/ganancias ya contadas en una venta, para dejar solo las ganancias por ventas y otros ingresos reales.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTotalIngresosModal(false)}>Cerrar</Button>
            <Button onClick={() => { setShowTotalIngresosModal(false); navigate('/app/finance'); }}>
              Ver finanzas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Balance (ingresos, gastos y lista de gastos) */}
      <Dialog open={showBalanceModal} onOpenChange={setShowBalanceModal}>
        <DialogContent className="sm:max-w-[520px] max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-muted-foreground" />
              Balance {stats?.selectedMonthLabel ? `(${stats.selectedMonthLabel})` : ""}
            </DialogTitle>
            <DialogDescription>
              Resumen del mes: ingresos, gastos, balance y pendientes
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto flex-1 min-h-0">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total ingresos (mes)</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCLP(stats?.totalIncomeMonth ?? 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total gastos (mes)</span>
                <span className="font-semibold text-red-600 dark:text-red-400">{formatCLP(stats?.totalExpenses ?? 0)}</span>
              </div>
              <div className="border-t pt-3 flex justify-between items-center">
                <span className="font-medium">Balance</span>
                <span className={`text-lg font-bold ${(stats?.balance ?? 0) >= 0 ? 'text-sky-600 dark:text-sky-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatCLP(stats?.balance ?? 0)}
                </span>
              </div>
            </div>

            {(stats?.totalIngresosPendientes ?? 0) > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Ingresos pendientes</h4>
                <p className="text-xs text-muted-foreground mb-2">
                  No suman al balance hasta marcarlos como realizados. Total: {formatCLP(stats.totalIngresosPendientes)}
                </p>
                <div className="space-y-2 max-h-[140px] overflow-y-auto">
                  {stats.ingresosPendientesList?.map((i) => (
                    <div key={i.id} className="flex items-center justify-between p-2 rounded-lg border bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{i.etiqueta}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(i.income_date).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {i.description ? ` · ${i.description}` : ''}
                        </p>
                      </div>
                      <span className="font-semibold text-amber-700 dark:text-amber-300 shrink-0 ml-2">{formatCLP(i.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(stats?.totalGastosPendientesDevolucion ?? 0) > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Gastos pendientes por devolver</h4>
                <p className="text-xs text-muted-foreground mb-2">
                  Gastos de inversores sin devolución. Total: {formatCLP(stats.totalGastosPendientesDevolucion)}
                </p>
                <div className="space-y-2 max-h-[140px] overflow-y-auto">
                  {stats.gastosPendientesDevolucionList?.map((g) => (
                    <div key={g.id} className="flex items-center justify-between p-2 rounded-lg border bg-orange-50/50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800">
                      <div className="min-w-0">
                        <p className="text-sm font-medium capitalize">{g.expense_type.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(g.expense_date).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {g.inversor_name ? ` · ${g.inversor_name}` : ''}
                          {g.description ? ` · ${g.description}` : ''}
                        </p>
                      </div>
                      <span className="font-semibold text-orange-700 dark:text-orange-300 shrink-0 ml-2">{formatCLP(g.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h4 className="text-sm font-semibold mb-2">Últimos gastos</h4>
              {stats?.recentGastos && stats.recentGastos.length > 0 ? (
                <div className="space-y-2 max-h-[240px] overflow-y-auto">
                  {stats.recentGastos.map((g) => (
                    <div
                      key={g.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium capitalize">{g.expense_type.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(g.expense_date).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {g.description ? ` · ${g.description}` : ''}
                        </p>
                      </div>
                      <span className="font-semibold text-red-600 dark:text-red-400 shrink-0 ml-2">
                        {formatCLP(g.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">No hay gastos registrados</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBalanceModal(false)}>Cerrar</Button>
            <Button onClick={() => { setShowBalanceModal(false); navigate('/app/finance'); }}>
              Ver gastos e ingresos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: Detalle de venta reciente */}
      <Dialog open={!!selectedRecentSale} onOpenChange={(open) => !open && setSelectedRecentSale(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Car className="h-5 w-5 text-green-500" />
              Detalle de la venta
            </DialogTitle>
            <DialogDescription>
              Información de la transacción
            </DialogDescription>
          </DialogHeader>
          {selectedRecentSale && (
            <div className="space-y-4 py-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-base">{selectedRecentSale.vehicle}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(selectedRecentSale.date).toLocaleDateString('es-CL', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </p>
                </div>
                <Badge variant={selectedRecentSale.status === 'completada' ? 'default' : 'secondary'} className="bg-green-600 shrink-0">
                  {selectedRecentSale.status === 'completada' ? 'Completada' : selectedRecentSale.status === 'cancelada' ? 'Cancelada' : 'Pendiente'}
                </Badge>
              </div>
              <div className="grid gap-2 rounded-lg border bg-muted/30 p-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Monto vendido</span>
                  <span className="font-semibold">{formatCLP(selectedRecentSale.amount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Ganancia</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">{formatCLP(selectedRecentSale.margin)}</span>
                </div>
              </div>
              <div className="space-y-1.5 text-sm">
                <p className="text-muted-foreground"><span className="font-medium text-foreground">Vendedor:</span> {selectedRecentSale.seller}</p>
                <p className="text-muted-foreground"><span className="font-medium text-foreground">Cliente:</span> {selectedRecentSale.clientName}</p>
                {selectedRecentSale.stock_origin && (
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">Origen:</span>{' '}
                    {selectedRecentSale.stock_origin === 'HESSENMOTORS' ? 'HessenMotors' : selectedRecentSale.stock_origin === 'MIAMIMOTORS' ? 'Miami Motors' : selectedRecentSale.stock_origin}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                {selectedRecentSale.payment_status && (
                  <Badge variant={selectedRecentSale.payment_status === 'realizado' ? 'default' : 'destructive'} className={selectedRecentSale.payment_status === 'realizado' ? 'bg-emerald-600' : ''}>
                    {selectedRecentSale.payment_status === 'realizado' ? 'Pago realizado' : 'Pago pendiente'}
                  </Badge>
                )}
                {selectedRecentSale.commission_credit_status != null && (
                  <Badge variant={selectedRecentSale.commission_credit_status === 'pagada' ? 'default' : 'destructive'} className={selectedRecentSale.commission_credit_status === 'pagada' ? 'bg-emerald-600' : ''}>
                    Comisión Crédito: {selectedRecentSale.commission_credit_status === 'pagada' ? 'Pagada' : 'Pendiente'}
                  </Badge>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedRecentSale(null)}>
              Cerrar
            </Button>
            <Button onClick={() => { if (selectedRecentSale) { setSelectedRecentSale(null); navigate(`/app/sales?id=${selectedRecentSale.id}`); } }}>
              Ver en ventas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: Agendar Nueva Cita */}
      <Dialog open={showNewAppointmentDialog} onOpenChange={setShowNewAppointmentDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-500" />
              Agendar Nueva Cita
            </DialogTitle>
            <DialogDescription>
              Completa los datos para agendar una nueva cita con un cliente
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="clientName">Nombre del cliente *</Label>
                <Input
                  id="clientName"
                  placeholder="Ej: Juan Pérez"
                  value={newAppointment.clientName}
                  onChange={(e) => setNewAppointment({ ...newAppointment, clientName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientPhone">Teléfono *</Label>
                <Input
                  id="clientPhone"
                  placeholder="+56 9 1234 5678"
                  value={newAppointment.clientPhone}
                  onChange={(e) => setNewAppointment({ ...newAppointment, clientPhone: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientEmail">Email</Label>
              <Input
                id="clientEmail"
                type="email"
                placeholder="cliente@ejemplo.com"
                value={newAppointment.clientEmail}
                onChange={(e) => setNewAppointment({ ...newAppointment, clientEmail: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="appointmentType">Tipo de cita *</Label>
              <Select
                value={newAppointment.appointmentType}
                onValueChange={(value) => setNewAppointment({ ...newAppointment, appointmentType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="test_drive">Test Drive</SelectItem>
                  <SelectItem value="cotizacion">Cotización</SelectItem>
                  <SelectItem value="entrega">Entrega de Vehículo</SelectItem>
                  <SelectItem value="servicio">Servicio Técnico</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Fecha *</Label>
                <Input
                  id="date"
                  type="date"
                  value={newAppointment.date}
                  onChange={(e) => setNewAppointment({ ...newAppointment, date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Hora *</Label>
                <Input
                  id="time"
                  type="time"
                  value={newAppointment.time}
                  onChange={(e) => setNewAppointment({ ...newAppointment, time: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicle">Vehículo de interés</Label>
              <Input
                id="vehicle"
                placeholder="Ej: Toyota Corolla 2024"
                value={newAppointment.vehicle}
                onChange={(e) => setNewAppointment({ ...newAppointment, vehicle: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notas adicionales</Label>
              <Textarea
                id="notes"
                placeholder="Información adicional sobre la cita..."
                value={newAppointment.notes}
                onChange={(e) => setNewAppointment({ ...newAppointment, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewAppointmentDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateAppointment} disabled={isSavingAppointment}>
              <Calendar className="h-4 w-4 mr-2" />
              {isSavingAppointment ? "Agendando..." : "Agendar Cita"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: Enviar Cotización */}
      <Dialog open={showQuoteDialog} onOpenChange={setShowQuoteDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-blue-500" />
              Enviar Cotización
            </DialogTitle>
            <DialogDescription>
              Confirma los datos antes de enviar la cotización al cliente
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="quoteClientName">Cliente</Label>
              <Input
                id="quoteClientName"
                value={quoteData.clientName}
                onChange={(e) => setQuoteData({ ...quoteData, clientName: e.target.value })}
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quoteClientEmail">Email del cliente *</Label>
              <Input
                id="quoteClientEmail"
                type="email"
                placeholder="cliente@ejemplo.com"
                value={quoteData.clientEmail}
                onChange={(e) => setQuoteData({ ...quoteData, clientEmail: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quoteVehicle">Vehículo</Label>
              <Input
                id="quoteVehicle"
                value={quoteData.vehicle}
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quotePrice">Precio cotizado *</Label>
              <Input
                id="quotePrice"
                placeholder="Ej: 15000000"
                value={quoteData.price}
                onChange={(e) => setQuoteData({ ...quoteData, price: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quoteNotes">Notas adicionales</Label>
              <Textarea
                id="quoteNotes"
                placeholder="Condiciones especiales, descuentos, etc..."
                value={quoteData.notes}
                onChange={(e) => setQuoteData({ ...quoteData, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuoteDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSendQuote}>
              <Send className="h-4 w-4 mr-2" />
              Enviar Cotización
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: Marcar Cita como Completada */}
      {/* Diálogo: Detalle de cita */}
      <Dialog open={showAppointmentDetailDialog} onOpenChange={setShowAppointmentDetailDialog}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-pink-500" />
              Detalle de la cita
            </DialogTitle>
            <DialogDescription>
              Información completa de la visita agendada
            </DialogDescription>
          </DialogHeader>
          {selectedAppointmentSnapshot && (
            <div className="space-y-4 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{selectedAppointmentSnapshot.typeLabel}</Badge>
                <Badge
                  variant={
                    selectedAppointmentSnapshot.status === "completada"
                      ? "default"
                      : selectedAppointmentSnapshot.status === "cancelada"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {selectedAppointmentSnapshot.statusLabel}
                </Badge>
              </div>
              <div>
                <p className="text-lg font-semibold leading-snug">{selectedAppointmentSnapshot.title}</p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Fecha</p>
                  <p className="text-base">
                    {format(new Date(selectedAppointmentSnapshot.scheduledAt), "EEEE d 'de' MMMM yyyy", { locale: es })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Horario</p>
                  <p className="text-base tabular-nums">
                    {format(new Date(selectedAppointmentSnapshot.scheduledAt), "HH:mm")} –{" "}
                    {format(new Date(selectedAppointmentSnapshot.endAt), "HH:mm")}
                  </p>
                </div>
              </div>
              <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Cliente / lead
                </p>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                  <p className="text-base font-medium">{selectedAppointmentSnapshot.clientName}</p>
                </div>
                {selectedAppointmentSnapshot.clientPhone ? (
                  <p className="text-sm text-muted-foreground pl-6">{selectedAppointmentSnapshot.clientPhone}</p>
                ) : null}
                {selectedAppointmentSnapshot.clientEmail ? (
                  <p className="text-sm text-muted-foreground pl-6">{selectedAppointmentSnapshot.clientEmail}</p>
                ) : null}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Vehículo</p>
                  <p className="text-base">{selectedAppointmentSnapshot.vehicleStr}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sucursal</p>
                  <p className="text-base">{selectedAppointmentSnapshot.branchName}</p>
                </div>
              </div>
              {selectedAppointmentSnapshot.assigneeName ? (
                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-1">
                    <UserCheck className="h-3.5 w-3.5" />
                    Vendedor asignado
                  </p>
                  <p className="text-base font-medium">{selectedAppointmentSnapshot.assigneeName}</p>
                </div>
              ) : null}
              {selectedAppointmentSnapshot.location ? (
                <div>
                  <p className="text-sm text-muted-foreground">Ubicación</p>
                  <p className="text-base">{selectedAppointmentSnapshot.location}</p>
                </div>
              ) : null}
              {selectedAppointmentSnapshot.notes ? (
                <div>
                  <p className="text-sm text-muted-foreground">Motivo / notas</p>
                  <p className="text-base whitespace-pre-wrap rounded-md border bg-muted/20 p-3">
                    {selectedAppointmentSnapshot.notes}
                  </p>
                </div>
              ) : null}
            </div>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                if (!selectedAppointmentSnapshot) return;
                setShowAppointmentDetailDialog(false);
                navigate(`/app/appointments?id=${selectedAppointmentSnapshot.id}`);
              }}
            >
              <ExternalLink className="h-4 w-4" />
              Ver en calendario
            </Button>
            <div className="flex flex-wrap gap-2 justify-end">
              {selectedAppointmentSnapshot?.status !== "completada" &&
              selectedAppointmentSnapshot?.status !== "cancelada" ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (!selectedAppointmentSnapshot) return;
                      openRescheduleFromSnapshot(selectedAppointmentSnapshot);
                    }}
                  >
                    Reagendar
                  </Button>
                  <Button
                    onClick={() => {
                      setShowAppointmentDetailDialog(false);
                      setShowCompleteAppointmentDialog(true);
                    }}
                  >
                    Marcar completada
                  </Button>
                </>
              ) : null}
              <Button variant="secondary" onClick={() => setShowAppointmentDetailDialog(false)}>
                Cerrar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCompleteAppointmentDialog} onOpenChange={setShowCompleteAppointmentDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Marcar Cita como Completada
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas marcar esta cita como completada?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            {selectedAppointmentSnapshot ? (
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <p className="text-sm font-semibold">
                  {selectedAppointmentSnapshot.typeLabel} — {selectedAppointmentSnapshot.clientName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(selectedAppointmentSnapshot.scheduledAt), "EEEE d MMM, HH:mm", { locale: es })}
                </p>
                <p className="text-xs text-muted-foreground">Vehículo: {selectedAppointmentSnapshot.vehicleStr}</p>
              </div>
            ) : (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Cita seleccionada</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompleteAppointmentDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCompleteAppointment} disabled={isSavingAppointment}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {isSavingAppointment ? "Guardando..." : "Marcar como Completada"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: Reagendar Cita */}
      <Dialog open={showRescheduleDialog} onOpenChange={setShowRescheduleDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-orange-500" />
              Reagendar Cita
            </DialogTitle>
            <DialogDescription>
              Selecciona una nueva fecha y hora para la cita
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {selectedAppointmentSnapshot && (
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <p className="text-sm font-semibold">Cita actual</p>
                <p className="text-xs text-muted-foreground">
                  {selectedAppointmentSnapshot.typeLabel} — {selectedAppointmentSnapshot.clientName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(selectedAppointmentSnapshot.scheduledAt), "EEEE d MMM, HH:mm", { locale: es })}
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rescheduleDate">Nueva fecha *</Label>
                <Input
                  id="rescheduleDate"
                  type="date"
                  value={rescheduleData.date}
                  onChange={(e) => setRescheduleData({ ...rescheduleData, date: e.target.value })}
                  disabled={isSavingAppointment}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rescheduleTime">Nueva hora *</Label>
                <Input
                  id="rescheduleTime"
                  type="time"
                  value={rescheduleData.time}
                  onChange={(e) => setRescheduleData({ ...rescheduleData, time: e.target.value })}
                  disabled={isSavingAppointment}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rescheduleReason">Motivo del cambio</Label>
              <Textarea
                id="rescheduleReason"
                placeholder="Razón por la que se reagenda la cita..."
                rows={3}
                value={rescheduleData.reason}
                onChange={(e) => setRescheduleData({ ...rescheduleData, reason: e.target.value })}
                disabled={isSavingAppointment}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRescheduleDialog(false)} disabled={isSavingAppointment}>
              Cancelar
            </Button>
            <Button onClick={handleReschedule} disabled={isSavingAppointment || !rescheduleData.date || !rescheduleData.time}>
              <Calendar className="h-4 w-4 mr-2" />
              Reagendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: Confirmar Test Drive */}
      <Dialog open={showConfirmTestDriveDialog} onOpenChange={setShowConfirmTestDriveDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Confirmar Test Drive
            </DialogTitle>
            <DialogDescription>
              Confirma el test drive con el cliente
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            {selectedAppointmentSnapshot && (
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <p className="text-sm font-semibold">
                  {selectedAppointmentSnapshot.typeLabel} — {selectedAppointmentSnapshot.clientName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(selectedAppointmentSnapshot.scheduledAt), "EEEE d MMM, HH:mm", { locale: es })}
                </p>
                <p className="text-xs text-muted-foreground">Vehículo: {selectedAppointmentSnapshot.vehicleStr}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="confirmNotes">Notas de confirmación</Label>
              <Textarea
                id="confirmNotes"
                placeholder="Detalles adicionales para el cliente..."
                rows={3}
                value={confirmTestDriveData.notes}
                onChange={(e) => setConfirmTestDriveData({ notes: e.target.value })}
                disabled={isSavingAppointment}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmTestDriveDialog(false)} disabled={isSavingAppointment}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmTestDrive} disabled={isSavingAppointment}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Confirmar Test Drive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: Contactar Lead */}
      <Dialog open={showContactLeadDialog} onOpenChange={setShowContactLeadDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-500" />
              Registrar Contacto con Lead
            </DialogTitle>
            <DialogDescription>
              Registra el contacto realizado con {contactData.leadName}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="contactMethod">Método de contacto *</Label>
              <Select
                value={contactData.contactMethod}
                onValueChange={(value) => setContactData({ ...contactData, contactMethod: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="phone">Teléfono</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="presencial">Presencial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactNotes">Resumen del contacto *</Label>
              <Textarea
                id="contactNotes"
                placeholder="¿Qué se habló? ¿Cuál es el siguiente paso?..."
                value={contactData.notes}
                onChange={(e) => setContactData({ ...contactData, notes: e.target.value })}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowContactLeadDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleContactLead}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Registrar Contacto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: Llamar Lead */}
      <Dialog open={showCallLeadDialog} onOpenChange={setShowCallLeadDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-green-500" />
              Registrar Llamada
            </DialogTitle>
            <DialogDescription>
              Registra la llamada realizada con {contactData.leadName}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                💡 Tip: Registra los puntos clave de la conversación y define el próximo paso
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="callNotes">Resumen de la llamada *</Label>
              <Textarea
                id="callNotes"
                placeholder="¿Qué se habló? ¿Mostró interés? ¿Cuál es el siguiente paso?..."
                value={contactData.notes}
                onChange={(e) => setContactData({ ...contactData, notes: e.target.value })}
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCallLeadDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleContactLead}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Registrar Llamada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
