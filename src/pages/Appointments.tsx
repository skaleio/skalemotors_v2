import { useState, useMemo, useEffect } from "react";
import { Calendar as BigCalendar, dateFnsLocalizer, View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { es } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "@/styles/calendar.css";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar, Plus, Clock, User, Edit, Trash2, X, ExternalLink, Loader2, CalendarCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { googleCalendarService } from "@/services/googleCalendar";
import GoogleCalendarSetupInstructions from "@/components/GoogleCalendarSetupInstructions";
import { useChat } from "@/contexts/ChatContext";

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

interface Event {
  id: string;
  title: string;
  start: Date;
  end: Date;
  description?: string;
  type: "test_drive" | "meeting" | "delivery" | "service" | "other";
  clientName?: string;
  clientPhone?: string;
  vehicleInfo?: string;
  googleEventId?: string;
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

export default function Appointments() {
  const { openChat } = useChat();
  const [events, setEvents] = useState<Event[]>([
    {
      id: "1",
      title: "Test Drive - Toyota Corolla",
      start: new Date(2026, 0, 25, 10, 0),
      end: new Date(2026, 0, 25, 11, 0),
      type: "test_drive",
      clientName: "Juan Pérez",
      clientPhone: "+56912345678",
      vehicleInfo: "Toyota Corolla 2024",
      description: "Cliente interesado en versión híbrida",
    },
  ]);

  const [view, setView] = useState<View>("month");
  const [date, setDate] = useState(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showSetupInstructions, setShowSetupInstructions] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [formData, setFormData] = useState<Partial<Event>>({
    title: "",
    start: new Date(),
    end: new Date(),
    type: "meeting",
    clientName: "",
    clientPhone: "",
    vehicleInfo: "",
    description: "",
  });

  // Inicializar Google Calendar API al cargar el componente
  useEffect(() => {
    const initGoogleAPI = async () => {
      try {
        await googleCalendarService.initialize();
        // Verificar si ya está autenticado
        if (googleCalendarService.isAuthenticated()) {
          setIsGoogleConnected(true);
          await syncGoogleEvents();
        }
      } catch (error) {
        console.error("Error al inicializar Google Calendar API:", error);
      }
    };

    initGoogleAPI();
  }, []);

  const handleSelectSlot = ({ start, end }: { start: Date; end: Date }) => {
    setSelectedEvent(null);
    setFormData({
      title: "",
      start,
      end,
      type: "meeting",
      clientName: "",
      clientPhone: "",
      vehicleInfo: "",
      description: "",
    });
    setIsDialogOpen(true);
  };

  const handleSelectEvent = (event: Event) => {
    setSelectedEvent(event);
    setFormData(event);
    setIsDialogOpen(true);
  };

  const handleSaveEvent = async () => {
    if (!formData.title || !formData.start || !formData.end) {
      toast({
        title: "Error",
        description: "Por favor completa los campos obligatorios",
        variant: "destructive",
      });
      return;
    }

    try {
      if (selectedEvent) {
        // Editar evento existente
        if (selectedEvent.googleEventId && isGoogleConnected) {
          // Actualizar en Google Calendar
          await googleCalendarService.updateEvent(selectedEvent.googleEventId, {
            summary: formData.title,
            description: formData.description,
            start: formData.start,
            end: formData.end,
          });
        }

        setEvents(
          events.map((e) =>
            e.id === selectedEvent.id
              ? { ...e, ...formData } as Event
              : e
          )
        );
        toast({
          title: "Evento actualizado",
          description: "El evento ha sido actualizado correctamente",
        });
      } else {
        // Crear nuevo evento
        let googleEventId: string | undefined;

        // Si está conectado a Google, crear también en Google Calendar
        if (isGoogleConnected) {
          try {
            const googleEvent = await googleCalendarService.createEvent({
              summary: formData.title!,
              description: formData.description,
              start: formData.start!,
              end: formData.end!,
              location: formData.vehicleInfo,
            });
            googleEventId = googleEvent.id;

            toast({
              title: "Sincronizado con Google Calendar",
              description: "El evento se creó en tu Google Calendar",
            });
          } catch (error) {
            console.error("Error al crear en Google Calendar:", error);
            toast({
              title: "Advertencia",
              description: "El evento se creó localmente pero no se pudo sincronizar con Google Calendar",
            });
          }
        }

        const newEvent: Event = {
          id: Date.now().toString(),
          ...formData as Omit<Event, 'id'>,
          googleEventId,
        };
        setEvents([...events, newEvent]);
        toast({
          title: "Evento creado",
          description: "El evento ha sido creado correctamente",
        });
      }

      setIsDialogOpen(false);
      setSelectedEvent(null);
      setFormData({
        title: "",
        start: new Date(),
        end: new Date(),
        type: "meeting",
      });
    } catch (error) {
      console.error("Error al guardar evento:", error);
      toast({
        title: "Error",
        description: "Hubo un problema al guardar el evento",
        variant: "destructive",
      });
    }
  };

  const handleDeleteEvent = async () => {
    if (selectedEvent) {
      try {
        // Si el evento está sincronizado con Google Calendar, eliminarlo también allí
        if (selectedEvent.googleEventId && isGoogleConnected) {
          try {
            await googleCalendarService.deleteEvent(selectedEvent.googleEventId);
            toast({
              title: "Eliminado de Google Calendar",
              description: "El evento se eliminó de tu Google Calendar",
            });
          } catch (error) {
            console.error("Error al eliminar de Google Calendar:", error);
            toast({
              title: "Advertencia",
              description: "El evento se eliminó localmente pero no se pudo eliminar de Google Calendar",
            });
          }
        }

        setEvents(events.filter((e) => e.id !== selectedEvent.id));
        toast({
          title: "Evento eliminado",
          description: "El evento ha sido eliminado correctamente",
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

  const syncGoogleEvents = async () => {
    try {
      const now = new Date();
      const threeMonthsLater = new Date();
      threeMonthsLater.setMonth(now.getMonth() + 3);

      const googleEvents = await googleCalendarService.listEvents(now, threeMonthsLater, 50);

      // Convertir eventos de Google Calendar a nuestro formato
      const convertedEvents: Event[] = googleEvents.map((gEvent: any) => ({
        id: gEvent.id,
        title: gEvent.summary || "Sin título",
        start: new Date(gEvent.start.dateTime || gEvent.start.date),
        end: new Date(gEvent.end.dateTime || gEvent.end.date),
        description: gEvent.description,
        type: "other" as const,
        googleEventId: gEvent.id,
      }));

      // Combinar eventos locales con eventos de Google
      setEvents((prevEvents) => {
        const localEvents = prevEvents.filter((e) => !e.googleEventId);
        return [...localEvents, ...convertedEvents];
      });

      toast({
        title: "Sincronización completada",
        description: `Se sincronizaron ${convertedEvents.length} eventos de Google Calendar`,
      });
    } catch (error) {
      console.error("Error al sincronizar eventos:", error);
      toast({
        title: "Error al sincronizar",
        description: "No se pudieron cargar los eventos de Google Calendar",
        variant: "destructive",
      });
    }
  };

  const handleConnectGoogle = async () => {
    // Verificar si está configurado
    if (!googleCalendarService.isConfigured()) {
      setShowSetupInstructions(true);
      return;
    }

    setIsConnecting(true);
    try {
      // Intentar autenticación con Google
      const success = await googleCalendarService.authenticate();

      if (success) {
        setIsGoogleConnected(true);
        toast({
          title: "Conexión exitosa",
          description: "Tu cuenta de Google Calendar ha sido conectada correctamente",
        });

        // Sincronizar eventos después de conectar
        await syncGoogleEvents();
      }
    } catch (error: any) {
      console.error("Error al conectar con Google Calendar:", error);
      
      // Si es un error de configuración, mostrar instrucciones
      if (error.message && error.message.includes("configurado")) {
        setShowSetupInstructions(true);
      }
      
      toast({
        title: "Error de conexión",
        description: error.message || "No se pudo conectar con Google Calendar. Verifica tus credenciales.",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    try {
      await googleCalendarService.signOut();
      setIsGoogleConnected(false);

      // Remover eventos de Google del calendario
      setEvents((prevEvents) => prevEvents.filter((e) => !e.googleEventId));

      toast({
        title: "Desconectado",
        description: "Tu cuenta de Google Calendar ha sido desconectada",
      });
    } catch (error) {
      console.error("Error al desconectar:", error);
      toast({
        title: "Error",
        description: "Hubo un problema al desconectar la cuenta",
        variant: "destructive",
      });
    }
  };

  const upcomingEvents = useMemo(() => {
    return events
      .filter((e) => e.start >= new Date())
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
          {isGoogleConnected ? (
            <Button
              variant="outline"
              onClick={handleDisconnectGoogle}
              className="flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Desconectar Google Calendar
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={handleConnectGoogle}
              disabled={isConnecting}
              className="flex items-center gap-2"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Conectando...
                </>
              ) : (
                <>
                  <CalendarCheck className="h-4 w-4" />
                  Conectar Google Calendar
                </>
              )}
            </Button>
          )}
          <Button onClick={() => {
            setSelectedEvent(null);
            setFormData({
              title: "",
              start: new Date(),
              end: new Date(),
              type: "meeting",
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
                          {format(event.start, "dd MMM, HH:mm", { locale: es })}
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start">Fecha y Hora Inicio *</Label>
                <Input
                  id="start"
                  type="datetime-local"
                  value={formData.start ? format(formData.start, "yyyy-MM-dd'T'HH:mm") : ""}
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
                  value={formData.end ? format(formData.end, "yyyy-MM-dd'T'HH:mm") : ""}
                  onChange={(e) =>
                    setFormData({ ...formData, end: new Date(e.target.value) })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Tipo de Evento *</Label>
              <Select
                value={formData.type}
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="clientName">Nombre Cliente</Label>
                <Input
                  id="clientName"
                  placeholder="Ej: Juan Pérez"
                  value={formData.clientName}
                  onChange={(e) =>
                    setFormData({ ...formData, clientName: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="clientPhone">Teléfono Cliente</Label>
                <Input
                  id="clientPhone"
                  placeholder="Ej: +56912345678"
                  value={formData.clientPhone}
                  onChange={(e) =>
                    setFormData({ ...formData, clientPhone: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vehicleInfo">Vehículo</Label>
              <Input
                id="vehicleInfo"
                placeholder="Ej: Toyota Corolla 2024"
                value={formData.vehicleInfo}
                onChange={(e) =>
                  setFormData({ ...formData, vehicleInfo: e.target.value })
                }
              />
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
              <Button onClick={handleSaveEvent}>
                {selectedEvent ? "Guardar Cambios" : "Crear Evento"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Setup Instructions Dialog */}
      <Dialog open={showSetupInstructions} onOpenChange={setShowSetupInstructions}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <GoogleCalendarSetupInstructions 
            onClose={() => setShowSetupInstructions(false)}
            onContactSupport={() => {
              setShowSetupInstructions(false);
              openChat();
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
