import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { KPICard } from "@/components/ui/kpi-card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { toast } from "@/hooks/use-toast";
import { useAppointments } from "@/hooks/useAppointments";
import { useBranchSellers } from "@/hooks/useBranchSellers";
import {
  resolveDelegatableSellersScope,
  useBranchSellersOptionsFromUser,
} from "@/lib/delegatableSellersScope";
import { supabase } from "@/lib/supabase";
import { useLeads } from "@/hooks/useLeads";
import { useVehicles } from "@/hooks/useVehicles";
import { leadsAssignedToForQuery } from "@/lib/leadsScope";
import { resolveAppointmentCalendarScope } from "@/lib/appointmentCalendarScope";
import { appointmentService } from "@/lib/services/appointments";
import type { Database } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import "@/styles/calendar.css";
import { useQueryClient } from "@tanstack/react-query";
import { addDays, endOfDay, format, getDay, isSameDay, isToday, isWithinInterval, parse, startOfDay, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import {
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  User,
  UserCheck,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Calendar as BigCalendar, dateFnsLocalizer, View } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";

const locales = {
  es: es,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { locale: es }),
  getDay,
  locales,
});

/** Formato 24h (16:00 en lugar de 4:00 PM) en todo el calendario */
const calendarFormats24h = {
  timeGutterFormat: "HH:mm",
  agendaTimeFormat: "HH:mm",
  eventTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) =>
    `${format(start, "HH:mm", { locale: es })} – ${format(end, "HH:mm", { locale: es })}`,
  eventTimeRangeStartFormat: ({ start }: { start: Date }) =>
    `${format(start, "HH:mm", { locale: es })} – `,
  eventTimeRangeEndFormat: ({ end }: { end: Date }) =>
    ` – ${format(end, "HH:mm", { locale: es })}`,
  selectRangeFormat: ({ start, end }: { start: Date; end: Date }) =>
    `${format(start, "HH:mm", { locale: es })} – ${format(end, "HH:mm", { locale: es })}`,
  agendaTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) =>
    `${format(start, "HH:mm", { locale: es })} – ${format(end, "HH:mm", { locale: es })}`,
};

type Appointment = Database["public"]["Tables"]["appointments"]["Row"];

type AppointmentWithRelations = Appointment & {
  lead?: { id: string; full_name: string; email?: string | null; phone?: string | null } | null;
  vehicle?: { id: string; make: string; model: string; year?: number | null } | null;
  user?: { id: string; full_name: string; email?: string | null } | null;
  branch?: { id: string; name: string } | null;
};

interface Event {
  id: string;
  title: string;
  start: Date;
  end: Date;
  description?: string;
  type:
    | "test_drive"
    | "meeting"
    | "delivery"
    | "service"
    | "other"
    | "vehicle_purchase"
    | "trade_in"
    | "consignment";
  status: "programada" | "completada" | "cancelada";
  leadId?: string | null;
  vehicleId?: string | null;
  userId?: string | null;
  assigneeName?: string | null;
  clientName?: string;
  clientPhone?: string;
  vehicleInfo?: string;
}

/** Clases CSS definidas en src/styles/calendar.css. Cada tipo de evento usa
 *  un color de CHART_PALETTE para mantener coherencia con los charts. */
const eventTypeClass: Record<Event["type"], string> = {
  test_drive: "event-test-drive",  // azul (chart-1)
  meeting: "event-meeting",        // verde (chart-2)
  delivery: "event-delivery",      // violeta (chart-4)
  service: "event-service",        // ámbar (chart-3)
  other: "event-other",            // muted
  vehicle_purchase: "event-vehicle-purchase",
  trade_in: "event-trade-in",
  consignment: "event-consignment",
};

const eventTypeLabels = {
  test_drive: "Test Drive",
  meeting: "Reunión",
  delivery: "Entrega",
  service: "Servicio",
  other: "Otro",
  vehicle_purchase: "Compra de vehículo",
  trade_in: "Vehículo en parte",
  consignment: "Consignación",
};

const eventStatusLabels: Record<Event["status"], string> = {
  programada: "Programada",
  completada: "Completada",
  cancelada: "Cancelada",
};

type AppointmentDialogMode = "create" | "view" | "edit" | "day-pick";

const APPOINTMENT_NO_SELLER = "__appointment_sin_vendedor__";

// Mapeo tipo DB (español) -> tipo Event (inglés)
const DB_TYPE_TO_EVENT: Record<string, Event["type"]> = {
  test_drive: "test_drive",
  reunion: "meeting",
  entrega: "delivery",
  servicio: "service",
  otro: "other",
  compra_vehiculo: "vehicle_purchase",
  vehiculo_en_parte: "trade_in",
  consignacion: "consignment",
};

function safeEventType(t: string | undefined): Event["type"] {
  return (t && DB_TYPE_TO_EVENT[t]) || "meeting";
}

function safeEventStatus(s: string | undefined): Event["status"] {
  if (s === "completada" || s === "cancelada") return s;
  return "programada";
}

function safeDate(value: string | null | undefined): Date | null {
  if (value == null) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function safeFormatDateTime(d: Date | undefined | null): string {
  if (!d || isNaN(d.getTime())) return "";
  return format(d, "yyyy-MM-dd'T'HH:mm", { locale: es });
}

/** Formato HH:mm para mostrar/editar hora (24h). */
function safeFormatTime(d: Date | undefined | null): string {
  if (!d || isNaN(d.getTime())) return "";
  return format(d, "HH:mm");
}

/** Parsea texto escrito por el usuario a "HH:mm" (24h). Acepta "16", "16:00", "16:30", "1630". */
function parseTimeInput(input: string): string | null {
  const t = input.trim().replace(/,/, ".");
  if (!t) return null;
  const withColon = t.includes(":") ? t : t.replace(/(\d{1,2})(\d{2})?$/, (_, h, m) => (m ? `${h}:${m}` : `${h}:00`));
  const [hStr, mStr] = withColon.split(":");
  const h = parseInt(hStr ?? "0", 10);
  const m = Math.min(59, parseInt(mStr ?? "0", 10) || 0);
  if (h < 0 || h > 23 || Number.isNaN(h)) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Actualiza solo la hora de una fecha (mantiene el día). timeStr en formato HH:mm. */
function setTimeOnDate(date: Date, timeStr: string): Date {
  const parsed = parseTimeInput(timeStr) ?? "00:00";
  const [h = 0, m = 0] = parsed.split(":").map(Number);
  const out = new Date(date);
  out.setHours(h, m, 0, 0);
  return out;
}

export default function Appointments() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { confirm: askConfirm, ConfirmDialog } = useConfirmDialog();
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkAppointmentId = searchParams.get("id");
  const handledDeepLinkRef = useRef<string | null>(null);

  const role = user?.role;
  const tenantId = user?.tenant_id ?? undefined;
  const appointmentCalendarScope = resolveAppointmentCalendarScope(user);
  const canSeeSelf = appointmentCalendarScope?.scope === "self";
  const canSeeTeam = appointmentCalendarScope?.scope === "branch";
  const canSeeTenant = appointmentCalendarScope?.scope === "tenant";

  const delegateScope = resolveDelegatableSellersScope(user);
  const canDelegate = canSeeTenant || canSeeTeam || !!delegateScope;
  const sellersQueryEnabled = !!user?.tenant_id && canDelegate;

  const delegatedSellerOpts = useBranchSellersOptionsFromUser(user, {
    enabled: sellersQueryEnabled,
  });
  const { sellers: delegatableSellers, loading: loadingDelegatableSellers } = useBranchSellers(
    delegateScope
      ? delegatedSellerOpts
      : {
          tenantId: user?.tenant_id ?? null,
          branchId: canSeeTeam ? user?.branch_id ?? null : null,
          scope: canSeeTenant ? "tenant" : "branch",
          enabled: sellersQueryEnabled,
          roles: ["vendedor", "jefe_sucursal"],
        },
  );

  const { leads } = useLeads({
    branchId: user?.branch_id ?? undefined,
    assignedTo: leadsAssignedToForQuery(user?.role, user?.id),
    enabled: !!user,
  });
  const { vehicles } = useVehicles({
    branchId: user?.branch_id ?? undefined,
    enabled: !!user,
  });
  const { appointments, loading, isFetching, refetch } = useAppointments({
    userId: appointmentCalendarScope?.userId,
    tenantId: appointmentCalendarScope?.tenantId,
    branchId: appointmentCalendarScope?.branchId,
    enabled: !!user && !!appointmentCalendarScope,
    live: true,
  });

  // Citas creadas desde landing-booking u otros canales externos
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel(`appointments-live-${tenantId}`)
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
  }, [tenantId, queryClient]);
  const [view, setView] = useState<View>("month");
  const [date, setDate] = useState(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<AppointmentDialogMode>("create");
  /** true = abierto desde clic en slot del calendario (no pedir fecha). false = desde "Nueva Cita" o editar (sí pedir fecha) */
  const [openedFromSlot, setOpenedFromSlot] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [dayPickerDate, setDayPickerDate] = useState<Date | null>(null);
  const [dayPickerEvents, setDayPickerEvents] = useState<Event[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isAssigningSeller, setIsAssigningSeller] = useState(false);
  const [cancelledSectionOpen, setCancelledSectionOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Event>>({
    title: "",
    start: new Date(),
    end: new Date(Date.now() + 60 * 60 * 1000),
    type: "meeting",
    status: "programada",
    leadId: "",
    vehicleId: "",
    userId: "",
    description: "",
  });
  /** Hora inicio/fin editables como texto (ej. "16:00") cuando se abre desde slot */
  const [startTimeStr, setStartTimeStr] = useState("");
  const [endTimeStr, setEndTimeStr] = useState("");
  const formTimesRef = useRef({ start: null as Date | null, end: null as Date | null });
  formTimesRef.current = { start: formData.start ?? null, end: formData.end ?? null };

  // Sincronizar horas solo al abrir el diálogo (no en cada tecla, para no pisar lo que escribe el usuario)
  useEffect(() => {
    if (!isDialogOpen) return;
    const { start, end } = formTimesRef.current;
    setStartTimeStr(safeFormatTime(start) ?? "");
    setEndTimeStr(safeFormatTime(end) ?? "");
  }, [isDialogOpen]);

  const events = useMemo(() => {
    return (appointments as AppointmentWithRelations[])
      .map((appointment) => {
        const start = safeDate(appointment.scheduled_at);
        if (!start) return null;
        const end =
          safeDate(appointment.end_at) ??
          (() => {
            const mins = (appointment as { duration_minutes?: number | null }).duration_minutes ?? 60;
            return new Date(start.getTime() + mins * 60 * 1000);
          })();
        const vehicleInfo = appointment.vehicle
          ? `${appointment.vehicle.make} ${appointment.vehicle.model}${appointment.vehicle.year ? ` ${appointment.vehicle.year}` : ""}`
          : "";

        return {
          id: appointment.id,
          title: appointment.title ?? "Cita",
          start,
          end,
          description: appointment.description ?? (appointment as { notes?: string | null }).notes ?? "",
          type: safeEventType(appointment.type),
          status: safeEventStatus(appointment.status),
          leadId: appointment.lead_id,
          vehicleId: appointment.vehicle_id,
          userId: appointment.user_id,
          assigneeName: appointment.user?.full_name?.trim() || appointment.user?.email?.trim() || null,
          clientName: appointment.lead?.full_name,
          clientPhone: appointment.lead?.phone || undefined,
          vehicleInfo,
        } as Event;
      })
      .filter((e): e is Event => e != null);
  }, [appointments]);

  const calendarEvents = useMemo(
    () => events.filter((e) => e.status !== "cancelada"),
    [events],
  );

  const cancelledEvents = useMemo(
    () =>
      events
        .filter((e) => e.status === "cancelada")
        .sort((a, b) => b.start.getTime() - a.start.getTime()),
    [events],
  );

  const populateFormFromEvent = (event: Event) => {
    setFormData({
      title: event.title,
      start: event.start,
      end: event.end,
      type: event.type,
      status: event.status,
      leadId: event.leadId || "",
      vehicleId: event.vehicleId || "",
      userId: event.userId || "",
      description: event.description || "",
    });
  };

  const resolveAssigneeUserId = (raw: string | undefined | null) => {
    const trimmed = raw?.trim() ?? "";
    return trimmed.length > 0 ? trimmed : null;
  };

  const sellerLabel = (sellerId: string | null | undefined) => {
    if (!sellerId) return "Sin asignar";
    const match = delegatableSellers.find((s) => s.id === sellerId);
    return match?.full_name?.trim() || match?.email?.trim() || "Vendedor";
  };

  const handleAssignSeller = async () => {
    if (!selectedEvent || !canDelegate) return;

    const nextUserId = resolveAssigneeUserId(formData.userId);
    const currentUserId = selectedEvent.userId ?? null;
    if (nextUserId === currentUserId) {
      toast({
        title: "Sin cambios",
        description: "El vendedor asignado ya es el mismo.",
      });
      return;
    }

    const seller = nextUserId ? delegatableSellers.find((s) => s.id === nextUserId) : null;
    setIsAssigningSeller(true);
    try {
      const updates: { user_id: string | null; branch_id?: string | null } = {
        user_id: nextUserId,
      };
      if (seller?.branch_id) updates.branch_id = seller.branch_id;

      await appointmentService.update(selectedEvent.id, updates);
      await queryClient.invalidateQueries({ queryKey: ["appointments"] });

      const assigneeName = seller
        ? seller.full_name?.trim() || seller.email?.trim() || null
        : null;
      setSelectedEvent({ ...selectedEvent, userId: nextUserId, assigneeName });
      setFormData((f) => ({ ...f, userId: nextUserId ?? "" }));

      toast({
        variant: "success",
        title: "Vendedor asignado",
        description: nextUserId
          ? `La cita aparecerá en el calendario de ${assigneeName ?? "el vendedor"}.`
          : "La cita quedó sin vendedor asignado.",
      });
    } catch (error) {
      console.error("[Appointments] assign seller", error);
      toast({
        title: "No se pudo asignar",
        description: error instanceof Error ? error.message : "Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsAssigningSeller(false);
    }
  };

  const closeAppointmentDialog = () => {
    setIsDialogOpen(false);
    setDialogMode("create");
    setSelectedEvent(null);
    setDayPickerDate(null);
    setDayPickerEvents([]);
  };

  const openEventView = (event: Event) => {
    setSelectedEvent(event);
    populateFormFromEvent(event);
    setDialogMode("view");
    setIsDialogOpen(true);
  };

  useEffect(() => {
    handledDeepLinkRef.current = null;
  }, [deepLinkAppointmentId]);

  useEffect(() => {
    if (!deepLinkAppointmentId || loading) return;
    if (handledDeepLinkRef.current === deepLinkAppointmentId) return;
    const event = events.find((item) => item.id === deepLinkAppointmentId);
    if (!event) return;
    handledDeepLinkRef.current = deepLinkAppointmentId;
    openEventView(event);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("id");
        return next;
      },
      { replace: true },
    );
  }, [deepLinkAppointmentId, loading, events, setSearchParams]);

  const openEventEdit = (event: Event) => {
    setSelectedEvent(event);
    setOpenedFromSlot(false);
    populateFormFromEvent(event);
    setDialogMode("edit");
    setIsDialogOpen(true);
  };

  const handleSelectSlot = ({ start, end }: { start: Date; end: Date }) => {
    const day = startOfDay(start);
    const onDay = calendarEvents
      .filter((e) => isSameDay(e.start, day))
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    if (onDay.length === 1) {
      openEventView(onDay[0]);
      return;
    }
    if (onDay.length > 1) {
      setDayPickerDate(day);
      setDayPickerEvents(onDay);
      setSelectedEvent(null);
      setDialogMode("day-pick");
      setIsDialogOpen(true);
      return;
    }

    setSelectedEvent(null);
    setDialogMode("create");
    setOpenedFromSlot(true);
    setFormData({
      title: "",
      start,
      end,
      type: "meeting",
      status: "programada",
      leadId: "",
      vehicleId: "",
      userId: user?.id ?? "",
      description: "",
    });
    setIsDialogOpen(true);
  };

  const handleSelectEvent = (event: Event) => {
    openEventView(event);
  };

  const handleSaveEvent = async () => {
    let startDate = formData.start && !isNaN(formData.start.getTime()) ? formData.start : null;
    let endDate = formData.end && !isNaN(formData.end.getTime()) ? formData.end : null;
    if (openedFromSlot && startDate) {
      const startParsed = parseTimeInput(startTimeStr);
      const endParsed = parseTimeInput(endTimeStr);
      if (startParsed) startDate = setTimeOnDate(startDate, startParsed);
      if (endParsed) endDate = setTimeOnDate(startDate, endParsed);
      if (endDate && startDate && endDate.getTime() <= startDate.getTime()) {
        endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
      }
    }
    if (!formData.title?.trim() || !startDate || !endDate) {
      toast({
        title: "Error",
        description: "Por favor completa los campos obligatorios (nombre, fecha/hora inicio y fin)",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSaving(true);
      const assigneeId = canDelegate
        ? resolveAssigneeUserId(formData.userId)
        : user?.id ?? null;
      const assigneeSeller = assigneeId
        ? delegatableSellers.find((s) => s.id === assigneeId)
        : null;

      const payload = {
        title: formData.title.trim(),
        description: formData.description?.trim() || null,
        type: formData.type || "meeting",
        status: formData.status || "programada",
        scheduled_at: startDate.toISOString(),
        end_at: endDate.toISOString(),
        lead_id: formData.leadId ? formData.leadId : null,
        vehicle_id: formData.vehicleId ? formData.vehicleId : null,
        user_id: assigneeId,
        branch_id: assigneeSeller?.branch_id ?? user?.branch_id ?? null,
        tenant_id: user?.tenant_id ?? null,
      } as Parameters<typeof appointmentService.update>[1] & {
        title: string;
        scheduled_at: string;
        end_at: string;
      };

      if (selectedEvent) {
        await appointmentService.update(selectedEvent.id, payload);
        toast({
          variant: "success",
          title: (
            <span className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
              Evento actualizado con éxito
            </span>
          ),
          description: "Los cambios se han guardado correctamente.",
        });
      } else {
        await appointmentService.create(payload);
        toast({
          variant: "success",
          title: (
            <span className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
              Evento creado con éxito
            </span>
          ),
          description: "La cita se ha guardado correctamente.",
        });
      }

      await queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setDate(startDate);
      closeAppointmentDialog();
      setFormData({
        title: "",
        start: new Date(),
        end: new Date(Date.now() + 60 * 60 * 1000),
        type: "meeting",
        status: "programada",
        leadId: "",
        vehicleId: "",
        userId: user?.id ?? "",
        description: "",
      });
    } catch (error) {
      console.error("Error al guardar evento:", error);
      toast({
        title: "Error",
        description: "Hubo un problema al guardar el evento",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelAppointment = async () => {
    if (!selectedEvent || selectedEvent.status === "cancelada") return;

    const ok = await askConfirm({
      title: "¿Cancelar esta cita?",
      description:
        "La visita quedará marcada como cancelada. Dejará de mostrarse en el calendario y pasará al apartado de canceladas.",
      confirmLabel: "Sí, cancelar cita",
      destructive: true,
    });
    if (!ok) return;

    setIsCancelling(true);
    try {
      await appointmentService.update(selectedEvent.id, { status: "cancelada" });
      await queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast({
        variant: "success",
        title: "Cita cancelada",
        description: "La visita quedó en el apartado de citas canceladas.",
      });
      setCancelledSectionOpen(true);
      closeAppointmentDialog();
    } catch (error) {
      console.error("Error al cancelar cita:", error);
      toast({
        title: "No se pudo cancelar",
        description: error instanceof Error ? error.message : "Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (selectedEvent) {
      try {
        await appointmentService.delete(selectedEvent.id);
        await queryClient.invalidateQueries({ queryKey: ["appointments"] });
        toast({
          variant: "success",
          title: (
            <span className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
              Evento eliminado
            </span>
          ),
          description: "La cita se ha eliminado correctamente.",
        });
        closeAppointmentDialog();
      } catch (error) {
        console.error("Error al eliminar evento:", error);
        toast({
          title: "Error",
          description: "Hubo un problema al eliminar el evento",
          variant: "destructive",
        });
      }
    }
  };

  const upcomingEvents = useMemo(() => {
    return calendarEvents
      .filter((e) => e.start >= new Date())
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .slice(0, 5);
  }, [calendarEvents]);

  /** KPI stats — operación diaria + funnel últimos 30 días (incl. canceladas). */
  const appointmentStats = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { locale: es });
    const weekEnd = endOfDay(addDays(weekStart, 6));
    const thirtyDaysAgo = addDays(startOfDay(now), -30);

    let today = 0;
    let thisWeek = 0;
    let pending = 0;
    let completed = 0;
    let cancelled30d = 0;
    let total30d = 0;

    for (const e of events) {
      const inLast30 = e.start >= thirtyDaysAgo;
      if (inLast30) total30d++;
      if (inLast30 && e.status === "cancelada") cancelled30d++;

      if (e.status === "cancelada") continue;
      if (isToday(e.start)) today++;
      if (isWithinInterval(e.start, { start: weekStart, end: weekEnd })) thisWeek++;
      if (e.status === "programada" && e.start >= now) pending++;
      if (e.status === "completada" && inLast30) completed++;
    }

    const cancellationRate =
      total30d > 0 ? Math.round((cancelled30d / total30d) * 1000) / 10 : 0;

    return { today, thisWeek, pending, completed, cancelled30d, total30d, cancellationRate };
  }, [events]);

  const eventStyleGetter = (event: Event) => ({
    className: eventTypeClass[event.type],
  });

  const isRefreshing = loading || isFetching;

  const handleRefreshAppointments = useCallback(async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: ["appointments"] });
      const result = await refetch();
      const count = Array.isArray(result.data) ? result.data.length : appointments.length;
      toast({
        title: "Calendario actualizado",
        description: `${count} cita${count === 1 ? "" : "s"} cargadas.`,
      });
    } catch (error) {
      console.error("[Appointments] refresh", error);
      toast({
        title: "No se pudo actualizar",
        description: error instanceof Error ? error.message : "Intenta de nuevo.",
        variant: "destructive",
      });
    }
  }, [queryClient, refetch, appointments.length]);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Citas</h1>
          <p className="text-muted-foreground mt-2">
            Agendá test drives, reuniones, entregas y servicios desde un solo lugar.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={isRefreshing}
            onClick={() => void handleRefreshAppointments()}
            title="Actualizar citas (landing y otros canales)"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Actualizando…" : "Actualizar"}
          </Button>
          <Button onClick={() => {
            setSelectedEvent(null);
            setDialogMode("create");
            setOpenedFromSlot(false);
            setFormData({
              title: "",
              start: new Date(),
              end: new Date(Date.now() + 60 * 60 * 1000),
              type: "meeting",
              status: "programada",
              leadId: "",
              vehicleId: "",
              userId: user?.id ?? "",
              description: "",
            });
            setIsDialogOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva cita
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KPICard
          label="Hoy"
          icon={CalendarClock}
          loading={loading}
          loadingWidth="sm"
          value={appointmentStats.today}
          subtitle={appointmentStats.today === 0 ? "Sin citas programadas" : appointmentStats.today === 1 ? "1 cita en el día" : `${appointmentStats.today} citas en el día`}
        />
        <KPICard
          label="Esta semana"
          icon={CalendarDays}
          loading={loading}
          loadingWidth="sm"
          value={appointmentStats.thisWeek}
          subtitle="Lunes a domingo"
        />
        <KPICard
          label="Pendientes"
          icon={Clock}
          loading={loading}
          loadingWidth="sm"
          value={appointmentStats.pending}
          subtitle="Programadas a futuro"
        />
        <KPICard
          label="Completadas"
          icon={CalendarCheck}
          loading={loading}
          loadingWidth="sm"
          value={appointmentStats.completed}
          subtitle="Últimos 30 días"
        />
        <KPICard
          label="Canceladas"
          icon={XCircle}
          loading={loading}
          loadingWidth="sm"
          value={appointmentStats.cancelled30d}
          subtitle={
            appointmentStats.cancelled30d === 1
              ? "1 cita cancelada (30 días)"
              : `${appointmentStats.cancelled30d} citas canceladas (30 días)`
          }
          onClick={() => setCancelledSectionOpen(true)}
        />
        <KPICard
          label="% cancelación"
          icon={XCircle}
          loading={loading}
          loadingWidth="sm"
          value={`${appointmentStats.cancellationRate}%`}
          subtitle={
            appointmentStats.total30d > 0
              ? `${appointmentStats.cancelled30d} de ${appointmentStats.total30d} citas (30 días)`
              : "Sin citas en el período"
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-2">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  Calendario
                </CardTitle>
                <CardDescription className="text-xs">
                  Clic en cita o día con visitas: ver detalle · día vacío: nueva cita
                </CardDescription>
              </div>
              {/* Leyenda de tipos */}
              <div className="hidden md:flex items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><span className="event-dot event-test-drive" />Test drive</span>
                <span className="inline-flex items-center gap-1.5"><span className="event-dot event-meeting" />Reunión</span>
                <span className="inline-flex items-center gap-1.5"><span className="event-dot event-delivery" />Entrega</span>
                <span className="inline-flex items-center gap-1.5"><span className="event-dot event-service" />Servicio</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div style={{ height: "600px" }}>
              <BigCalendar
                localizer={localizer}
                events={calendarEvents}
                startAccessor="start"
                endAccessor="end"
                view={view}
                onView={setView}
                date={date}
                onNavigate={setDate}
                onSelectSlot={handleSelectSlot}
                onSelectEvent={handleSelectEvent}
                selectable
                culture="es"
                formats={calendarFormats24h}
                messages={{
                  next: "Siguiente",
                  previous: "Anterior",
                  today: "Hoy",
                  month: "Mes",
                  week: "Semana",
                  day: "Día",
                  agenda: "Agenda",
                  date: "Fecha",
                  time: "Hora",
                  event: "Evento",
                  noEventsInRange: "No hay eventos en este rango",
                  showMore: (total) => `+ Ver más (${total})`,
                }}
                eventPropGetter={eventStyleGetter}
              />
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Próximas citas
            </CardTitle>
            <CardDescription className="text-xs">
              Las {upcomingEvents.length === 0 ? "" : `${upcomingEvents.length} `}más cercanas
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {upcomingEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="rounded-2xl bg-muted p-4 mb-3">
                  <CalendarDays className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">Sin citas próximas</p>
                <p className="text-xs text-muted-foreground max-w-[200px]">
                  Cuando agendes algo, va a aparecer acá.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingEvents.map((event) => {
                  const dayLabel = isToday(event.start)
                    ? "HOY"
                    : isSameDay(event.start, addDays(new Date(), 1))
                      ? "MAÑANA"
                      : format(event.start, "EEE d MMM", { locale: es });
                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => openEventView(event)}
                      className="w-full text-left p-3 rounded-md border border-border hover:bg-accent/30 transition-colors group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center gap-0.5 min-w-[52px] pt-0.5">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {dayLabel}
                          </span>
                          <span className="skale-num text-base font-semibold leading-tight">
                            {format(event.start, "HH:mm")}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`event-dot ${eventTypeClass[event.type]}`} />
                            <span className="text-xs font-medium text-muted-foreground">
                              {eventTypeLabels[event.type]}
                            </span>
                          </div>
                          <p className="text-sm font-medium truncate group-hover:text-foreground">
                            {event.title}
                          </p>
                          {event.clientName && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <User className="h-3 w-3" />
                              <span className="truncate">{event.clientName}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Collapsible open={cancelledSectionOpen} onOpenChange={setCancelledSectionOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left transition-colors hover:bg-muted/40"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <XCircle className="h-4 w-4 text-destructive shrink-0" />
                  <span className="text-base font-semibold">Citas canceladas</span>
                  <Badge variant="secondary" className="text-[10px] h-5">
                    {cancelledEvents.length}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  No aparecen en el calendario. Abrí este apartado para ver fecha y horario.
                </p>
              </div>
              <ChevronDown
                className={cn(
                  "h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200",
                  cancelledSectionOpen && "rotate-180",
                )}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="border-t pt-4 pb-6">
              {cancelledEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <p className="text-sm font-medium text-foreground">Sin citas canceladas</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                    Cuando canceles una visita, va a quedar registrada acá con su horario original.
                  </p>
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {cancelledEvents.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => openEventView(event)}
                      className="w-full rounded-lg border border-border/80 bg-muted/20 p-3 text-left transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex min-w-[72px] flex-col items-start gap-0.5 pt-0.5">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {format(event.start, "EEE d MMM", { locale: es })}
                          </span>
                          <span className="skale-num text-sm font-semibold tabular-nums text-destructive/90">
                            {format(event.start, "HH:mm")} – {format(event.end, "HH:mm")}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`event-dot ${eventTypeClass[event.type]} opacity-60`} />
                            <span className="text-xs text-muted-foreground">
                              {eventTypeLabels[event.type]}
                            </span>
                            <Badge variant="destructive" className="text-[10px] h-5">
                              Cancelada
                            </Badge>
                          </div>
                          <p className="truncate text-sm font-medium">{event.title}</p>
                          {event.clientName ? (
                            <p className="truncate text-xs text-muted-foreground">{event.clientName}</p>
                          ) : null}
                          {event.assigneeName ? (
                            <p className="truncate text-xs text-muted-foreground">
                              {event.assigneeName}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Event Dialog */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeAppointmentDialog();
          else setIsDialogOpen(true);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "day-pick"
                ? "Visitas del día"
                : dialogMode === "view"
                  ? "Detalle de la cita"
                  : dialogMode === "edit"
                    ? "Editar cita"
                    : "Nueva cita"}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "day-pick" && dayPickerDate
                ? format(dayPickerDate, "EEEE d 'de' MMMM yyyy", { locale: es })
                : dialogMode === "view"
                  ? "Información de la visita agendada"
                  : dialogMode === "edit"
                    ? "Modifica los detalles y guarda los cambios"
                    : "Completa la información del nuevo evento"}
            </DialogDescription>
          </DialogHeader>

          {dialogMode === "day-pick" ? (
            <div className="space-y-2 py-2">
              <p className="text-sm text-muted-foreground">
                Este día tiene varias visitas. Elige una para ver el detalle.
              </p>
              <div className="max-h-[min(50vh,360px)] space-y-2 overflow-y-auto pr-1">
                {dayPickerEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => openEventView(event)}
                    className="flex w-full items-start gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-accent/40"
                  >
                    <span className="skale-num shrink-0 text-sm font-semibold tabular-nums">
                      {format(event.start, "HH:mm")}
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`event-dot ${eventTypeClass[event.type]}`} />
                        <span className="text-xs text-muted-foreground">{eventTypeLabels[event.type]}</span>
                        <Badge variant="secondary" className="text-[10px] h-5">
                          {eventStatusLabels[event.status]}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium truncate">{event.title}</p>
                      {event.clientName ? (
                        <p className="text-xs text-muted-foreground truncate">{event.clientName}</p>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : dialogMode === "view" && selectedEvent ? (
            <div className="space-y-4 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="gap-1.5">
                  <span className={`event-dot ${eventTypeClass[selectedEvent.type]}`} />
                  {eventTypeLabels[selectedEvent.type]}
                </Badge>
                <Badge
                  variant={
                    selectedEvent.status === "completada"
                      ? "default"
                      : selectedEvent.status === "cancelada"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {eventStatusLabels[selectedEvent.status]}
                </Badge>
              </div>
              <div>
                <p className="text-lg font-semibold leading-snug">{selectedEvent.title}</p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Fecha</p>
                  <p className="text-base">
                    {format(selectedEvent.start, "EEEE d 'de' MMMM yyyy", { locale: es })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Horario</p>
                  <p className="text-base skale-num tabular-nums">
                    {format(selectedEvent.start, "HH:mm")} – {format(selectedEvent.end, "HH:mm")}
                  </p>
                </div>
              </div>
              {(selectedEvent.clientName || selectedEvent.clientPhone) && (
                <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Cliente / lead
                  </p>
                  {selectedEvent.clientName ? (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground shrink-0" />
                      <p className="text-base font-medium">{selectedEvent.clientName}</p>
                    </div>
                  ) : null}
                  {selectedEvent.clientPhone ? (
                    <p className="text-sm text-muted-foreground pl-6">{selectedEvent.clientPhone}</p>
                  ) : null}
                </div>
              )}
              {selectedEvent.vehicleInfo ? (
                <div>
                  <p className="text-sm text-muted-foreground">Vehículo</p>
                  <p className="text-base">{selectedEvent.vehicleInfo}</p>
                </div>
              ) : null}
              <div className="rounded-md border bg-muted/30 p-3 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5" />
                  Vendedor asignado
                </p>
                {canDelegate ? (
                  <>
                    <Select
                      value={
                        formData.userId?.trim()
                          ? formData.userId
                          : APPOINTMENT_NO_SELLER
                      }
                      onValueChange={(value) =>
                        setFormData({
                          ...formData,
                          userId: value === APPOINTMENT_NO_SELLER ? "" : value,
                        })
                      }
                      disabled={loadingDelegatableSellers || isAssigningSeller}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            loadingDelegatableSellers
                              ? "Cargando vendedores…"
                              : "Seleccionar vendedor"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={APPOINTMENT_NO_SELLER}>Sin asignar</SelectItem>
                        {delegatableSellers.map((seller) => (
                          <SelectItem key={seller.id} value={seller.id}>
                            {seller.full_name?.trim() || seller.email || "Vendedor"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Al asignar, la cita aparecerá en el calendario personal del vendedor.
                    </p>
                  </>
                ) : (
                  <p className="text-base font-medium">
                    {selectedEvent.assigneeName ||
                      sellerLabel(selectedEvent.userId) ||
                      "Sin asignar"}
                  </p>
                )}
              </div>
              {selectedEvent.description?.trim() ? (
                <div>
                  <p className="text-sm text-muted-foreground">Motivo / notas</p>
                  <p className="text-base whitespace-pre-wrap rounded-md border bg-muted/20 p-3">
                    {selectedEvent.description.trim()}
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Nombre de la persona *</Label>
              <Input
                id="title"
                placeholder="Ej: Juan Pérez"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            {openedFromSlot ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Fecha: {formData.start && !isNaN(formData.start.getTime())
                    ? format(formData.start, "EEEE d 'de' MMMM yyyy", { locale: es })
                    : "—"}
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start-time">Hora Inicio * (24h, ej. 16:00)</Label>
                    <Input
                      id="start-time"
                      type="text"
                      inputMode="numeric"
                      placeholder="ej. 16:00"
                      value={startTimeStr}
                      onChange={(e) => setStartTimeStr(e.target.value)}
                      onBlur={() => {
                        const parsed = parseTimeInput(startTimeStr);
                        const base = formData.start && !isNaN(formData.start.getTime()) ? formData.start : new Date();
                        if (parsed != null) {
                          setStartTimeStr(parsed);
                          const start = setTimeOnDate(base, parsed);
                          const end = formData.end && !isNaN(formData.end.getTime()) ? formData.end : new Date(start.getTime() + 60 * 60 * 1000);
                          setFormData((prev) => ({
                            ...prev,
                            start,
                            end: end.getTime() <= start.getTime() ? new Date(start.getTime() + 60 * 60 * 1000) : end,
                          }));
                        } else {
                          setStartTimeStr(safeFormatTime(base) ?? "");
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end-time">Hora Fin * (24h, ej. 17:30)</Label>
                    <Input
                      id="end-time"
                      type="text"
                      inputMode="numeric"
                      placeholder="ej. 17:30"
                      value={endTimeStr}
                      onChange={(e) => setEndTimeStr(e.target.value)}
                      onBlur={() => {
                        const parsed = parseTimeInput(endTimeStr);
                        const base = formData.start && !isNaN(formData.start.getTime()) ? formData.start : new Date();
                        if (parsed != null) {
                          setEndTimeStr(parsed);
                          const end = setTimeOnDate(base, parsed);
                          const start = formData.start && !isNaN(formData.start.getTime()) ? formData.start : new Date(end.getTime() - 60 * 60 * 1000);
                          setFormData((prev) => ({
                            ...prev,
                            start,
                            end: end.getTime() <= start.getTime() ? new Date(start.getTime() + 60 * 60 * 1000) : end,
                          }));
                        } else {
                          setEndTimeStr(safeFormatTime(formData.end) ?? "");
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start">Fecha y Hora Inicio *</Label>
                  <Input
                    id="start"
                    type="datetime-local"
                    value={safeFormatDateTime(formData.start)}
                    onChange={(e) =>
                      setFormData({ ...formData, start: new Date(e.target.value) })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end">Fecha y Hora Fin *</Label>
                  <Input
                    id="end"
                    type="datetime-local"
                    value={safeFormatDateTime(formData.end)}
                    onChange={(e) =>
                      setFormData({ ...formData, end: new Date(e.target.value) })
                    }
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="type">Tipo de Evento *</Label>
              <Select
                value={formData.type || "meeting"}
                onValueChange={(value: Event["type"]) =>
                  setFormData({ ...formData, type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="test_drive">Test Drive</SelectItem>
                  <SelectItem value="meeting">Reunión</SelectItem>
                  <SelectItem value="delivery">Entrega</SelectItem>
                  <SelectItem value="service">Servicio</SelectItem>
                  <SelectItem value="vehicle_purchase">Compra de vehículo</SelectItem>
                  <SelectItem value="trade_in">Vehículo en parte</SelectItem>
                  <SelectItem value="consignment">Consignación</SelectItem>
                  <SelectItem value="other">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Estado</Label>
              <Select
                value={formData.status || "programada"}
                onValueChange={(value) =>
                  setFormData({ ...formData, status: value as Event["status"] })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="programada">Programada</SelectItem>
                  <SelectItem value="completada">Completada</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Lead (opcional)</Label>
                <Select
                  value={formData.leadId || "none"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, leadId: value === "none" ? "" : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un lead" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin lead</SelectItem>
                    {leads.map((lead) => (
                      <SelectItem key={lead.id} value={lead.id}>
                        {lead.full_name} {lead.phone ? `(${lead.phone})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Vehículo (opcional)</Label>
                <Select
                  value={formData.vehicleId || "none"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, vehicleId: value === "none" ? "" : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un vehículo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin vehículo</SelectItem>
                    {vehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.make} {vehicle.model} {vehicle.year ? vehicle.year : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {canDelegate ? (
              <div className="space-y-2">
                <Label>Vendedor asignado</Label>
                <Select
                  value={
                    formData.userId?.trim() ? formData.userId : APPOINTMENT_NO_SELLER
                  }
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      userId: value === APPOINTMENT_NO_SELLER ? "" : value,
                    })
                  }
                  disabled={loadingDelegatableSellers}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        loadingDelegatableSellers
                          ? "Cargando vendedores…"
                          : "Seleccionar vendedor"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={APPOINTMENT_NO_SELLER}>Sin asignar</SelectItem>
                    {delegatableSellers.map((seller) => (
                      <SelectItem key={seller.id} value={seller.id}>
                        {seller.full_name?.trim() || seller.email || "Vendedor"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  La cita se mostrará en el calendario del vendedor elegido.
                </p>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                placeholder="Notas adicionales sobre el evento..."
                rows={3}
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>
          </div>
          )}

          <DialogFooter className="flex items-center justify-between gap-2">
            {dialogMode === "day-pick" ? (
              <Button variant="outline" className="ml-auto" onClick={closeAppointmentDialog}>
                Cerrar
              </Button>
            ) : dialogMode === "view" && selectedEvent ? (
              <div className="flex w-full flex-wrap items-center justify-between gap-2">
                {selectedEvent.status !== "cancelada" ? (
                  <Button
                    type="button"
                    variant="destructive"
                    className="gap-2"
                    disabled={isCancelling || loading}
                    onClick={() => void handleCancelAppointment()}
                  >
                    {isCancelling ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    Cancelar cita
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">Esta cita ya está cancelada</span>
                )}
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  {canDelegate &&
                  selectedEvent.status !== "cancelada" &&
                  resolveAssigneeUserId(formData.userId) !==
                    (selectedEvent.userId ?? null) ? (
                    <Button
                      type="button"
                      variant="secondary"
                      className="gap-2"
                      disabled={isAssigningSeller || loadingDelegatableSellers}
                      onClick={() => void handleAssignSeller()}
                    >
                      {isAssigningSeller ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UserCheck className="h-4 w-4" />
                      )}
                      Asignar al calendario
                    </Button>
                  ) : null}
                  <Button variant="outline" onClick={closeAppointmentDialog}>
                    Cerrar
                  </Button>
                  {selectedEvent.status !== "cancelada" ? (
                    <Button className="gap-2" onClick={() => openEventEdit(selectedEvent)}>
                      <Pencil className="h-4 w-4" />
                      Editar
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : (
              <>
                <div>
                  {dialogMode === "edit" && selectedEvent ? (
                    <Button
                      variant="destructive"
                      onClick={handleDeleteEvent}
                      className="flex items-center gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      Eliminar
                    </Button>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={closeAppointmentDialog}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveEvent} disabled={isSaving || loading}>
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Guardando...
                      </>
                    ) : dialogMode === "edit" ? (
                      "Guardar cambios"
                    ) : (
                      "Crear cita"
                    )}
                  </Button>
                </div>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {ConfirmDialog}
    </div>
  );
}
