import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { toast } from "@/hooks/use-toast";
import { useAppointments } from "@/hooks/useAppointments";
import { useLeads } from "@/hooks/useLeads";
import { useVehicles } from "@/hooks/useVehicles";
import { appointmentService } from "@/lib/services/appointments";
import type { Database } from "@/lib/types/database";
import "@/styles/calendar.css";
import { useQueryClient } from "@tanstack/react-query";
import { format, getDay, parse, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar, CheckCircle2, Clock, Loader2, Plus, Trash2, User } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
  type: "test_drive" | "meeting" | "delivery" | "service" | "other";
  status: "programada" | "completada" | "cancelada";
  leadId?: string | null;
  vehicleId?: string | null;
  clientName?: string;
  clientPhone?: string;
  vehicleInfo?: string;
}

const eventTypeColors = {
  test_drive: "bg-blue-500",
  meeting: "bg-green-500",
  delivery: "bg-purple-500",
  service: "bg-orange-500",
  other: "bg-gray-500",
};

const eventTypeLabels = {
  test_drive: "Test Drive",
  meeting: "Reunión",
  delivery: "Entrega",
  service: "Servicio",
  other: "Otro",
};

// Mapeo tipo DB (español) -> tipo Event (inglés)
const DB_TYPE_TO_EVENT: Record<string, Event["type"]> = {
  test_drive: "test_drive",
  reunion: "meeting",
  entrega: "delivery",
  servicio: "service",
  otro: "other",
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
  const { leads } = useLeads({
    branchId: user?.branch_id ?? undefined,
    enabled: !!user,
  });
  const { vehicles } = useVehicles({
    branchId: user?.branch_id ?? undefined,
    enabled: !!user,
  });
  const { appointments, loading } = useAppointments({
    branchId: user?.branch_id ?? undefined,
    enabled: !!user,
  });
  const [view, setView] = useState<View>("month");
  const [date, setDate] = useState(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  /** true = abierto desde clic en slot del calendario (no pedir fecha). false = desde "Nueva Cita" o editar (sí pedir fecha) */
  const [openedFromSlot, setOpenedFromSlot] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<Event>>({
    title: "",
    start: new Date(),
    end: new Date(Date.now() + 60 * 60 * 1000),
    type: "meeting",
    status: "programada",
    leadId: "",
    vehicleId: "",
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
          clientName: appointment.lead?.full_name,
          clientPhone: appointment.lead?.phone || undefined,
          vehicleInfo,
        } as Event;
      })
      .filter((e): e is Event => e != null);
  }, [appointments]);

  const handleSelectSlot = ({ start, end }: { start: Date; end: Date }) => {
    setSelectedEvent(null);
    setOpenedFromSlot(true); // fecha ya elegida en el calendario, no mostrar campos de fecha
    setFormData({
      title: "",
      start,
      end,
      type: "meeting",
      status: "programada",
      leadId: "",
      vehicleId: "",
      description: "",
    });
    setIsDialogOpen(true);
  };

  const handleSelectEvent = (event: Event) => {
    setSelectedEvent(event);
    setOpenedFromSlot(false); // editar: sí mostrar campos de fecha por si cambian
    setFormData({
      title: event.title,
      start: event.start,
      end: event.end,
      type: event.type,
      status: event.status,
      leadId: event.leadId || "",
      vehicleId: event.vehicleId || "",
      description: event.description || "",
    });
    setIsDialogOpen(true);
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
        description: "Por favor completa los campos obligatorios (título, fecha/hora inicio y fin)",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSaving(true);
      const payload = {
        title: formData.title.trim(),
        description: formData.description?.trim() || null,
        type: formData.type || "meeting",
        status: formData.status || "programada",
        scheduled_at: startDate.toISOString(),
        end_at: endDate.toISOString(),
        lead_id: formData.leadId ? formData.leadId : null,
        vehicle_id: formData.vehicleId ? formData.vehicleId : null,
        user_id: user?.id ?? null,
        branch_id: user?.branch_id ?? null,
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
      setIsDialogOpen(false);
      setSelectedEvent(null);
      setFormData({
        title: "",
        start: new Date(),
        end: new Date(Date.now() + 60 * 60 * 1000),
        type: "meeting",
        status: "programada",
        leadId: "",
        vehicleId: "",
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
        setIsDialogOpen(false);
        setSelectedEvent(null);
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
    return events
      .filter((e) => e.start >= new Date() && e.status !== "cancelada")
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .slice(0, 5);
  }, [events]);

  const eventStyleGetter = (event: Event) => {
    const backgroundColor = eventTypeColors[event.type];
    return {
      className: `${backgroundColor} text-white rounded-lg px-2 py-1`,
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Citas</h1>
          <p className="text-muted-foreground mt-2">
            Gestiona las citas y test drives
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => {
            setSelectedEvent(null);
            setOpenedFromSlot(false); // desde botón: sí pedir fecha en el formulario
            setFormData({
              title: "",
              start: new Date(),
              end: new Date(Date.now() + 60 * 60 * 1000),
              type: "meeting",
              status: "programada",
              leadId: "",
              vehicleId: "",
              description: "",
            });
            setIsDialogOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Cita
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Calendario
            </CardTitle>
            <CardDescription>
              Haz clic en una fecha para crear un evento o en un evento para editarlo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ height: "600px" }}>
              <BigCalendar
                localizer={localizer}
                events={events}
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
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Próximas Citas
            </CardTitle>
            <CardDescription>
              Eventos próximos programados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No hay citas próximas
                </p>
              ) : (
                upcomingEvents.map((event) => (
                  <div
                    key={event.id}
                    className="p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => handleSelectEvent(event)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{event.title}</p>
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {event.start && !isNaN(event.start.getTime())
                            ? format(event.start, "dd MMM, HH:mm", { locale: es })
                            : "—"}
                        </div>
                        {event.clientName && (
                          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                            <User className="h-3 w-3" />
                            {event.clientName}
                          </div>
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className={`${eventTypeColors[event.type]} text-white border-none`}
                      >
                        {eventTypeLabels[event.type]}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Event Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedEvent ? "Editar Evento" : "Nuevo Evento"}
            </DialogTitle>
            <DialogDescription>
              {selectedEvent
                ? "Modifica los detalles del evento"
                : "Completa la información del nuevo evento"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                placeholder="Ej: Test Drive - Toyota Corolla"
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

          <DialogFooter className="flex items-center justify-between">
            <div>
              {selectedEvent && (
                <Button
                  variant="destructive"
                  onClick={handleDeleteEvent}
                  className="flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Eliminar
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveEvent} disabled={isSaving || loading}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  selectedEvent ? "Guardar Cambios" : "Crear Evento"
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
