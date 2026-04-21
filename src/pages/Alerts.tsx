import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bell, Car, Check, CheckCircle, Clock, Info, Loader2, UserPlus, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigationWithLoading } from "@/hooks/useNavigationWithLoading";
import {
  useDismissNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  type Notification,
} from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { es as esLocale } from "date-fns/locale";

type Filter = "all" | "unread" | EventKey;

type EventKey =
  | "lead_sold"
  | "lead_contactado"
  | "lead_assigned"
  | "lead_stale"
  | "consignacion_created"
  | "consignacion_stale";

type EventMeta = {
  key: EventKey;
  label: string;
  short: string;
  icon: LucideIcon;
  iconClass: string;
  description: string;
  roles: readonly ("admin" | "vendedor" | "gerente" | "jefe_jefe" | "jefe_sucursal" | "inventario" | "financiero" | "servicio")[];
};

const EVENT_TYPES: readonly EventMeta[] = [
  {
    key: "lead_sold",
    label: "Negocios cerrados",
    short: "Cerrados",
    icon: CheckCircle,
    iconClass: "text-green-500",
    description: "Cuando un lead pasa a vendido",
    roles: ["admin", "gerente", "jefe_jefe", "jefe_sucursal"],
  },
  {
    key: "lead_contactado",
    label: "Leads contactados",
    short: "Contactados",
    icon: Info,
    iconClass: "text-blue-500",
    description: "Vendedor marca un lead como contactado",
    roles: ["admin"],
  },
  {
    key: "lead_assigned",
    label: "Asignados a mí",
    short: "Asignados",
    icon: UserPlus,
    iconClass: "text-pink-500",
    description: "Un admin te asignó un lead",
    roles: ["vendedor"],
  },
  {
    key: "lead_stale",
    label: "Sin movimiento",
    short: "Estancados",
    icon: Clock,
    iconClass: "text-red-500",
    description: "Leads sin cambiar de estado > 3 días",
    roles: ["admin"],
  },
  {
    key: "consignacion_created",
    label: "Consignaciones nuevas",
    short: "Nuevas",
    icon: Car,
    iconClass: "text-indigo-500",
    description: "Alta de consignación en el sistema",
    roles: ["admin", "gerente", "jefe_jefe", "jefe_sucursal", "inventario"],
  },
  {
    key: "consignacion_stale",
    label: "Sin publicar",
    short: "Sin publicar",
    icon: Clock,
    iconClass: "text-amber-500",
    description: "Consignaciones > 7 días sin publicarse",
    roles: ["admin"],
  },
] as const;

function iconFor(type: string): JSX.Element {
  const meta = EVENT_TYPES.find((e) => e.key === type);
  if (meta) {
    const Icon = meta.icon;
    return <Icon className={`h-5 w-5 ${meta.iconClass}`} />;
  }
  return <Info className="h-5 w-5 text-gray-500" />;
}

function formatTime(iso: string) {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: esLocale });
  } catch {
    return "";
  }
}

function labelFor(type: string): string {
  return EVENT_TYPES.find((e) => e.key === type)?.label ?? type;
}

export default function Alerts() {
  const { user } = useAuth();
  const { navigateWithLoading } = useNavigationWithLoading();
  const [filter, setFilter] = useState<Filter>("all");
  const [includeArchived, setIncludeArchived] = useState(false);

  const { notifications, unreadCount, isLoading } = useNotifications({
    userId: user?.id,
    limit: 100,
    includeArchived,
  });

  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();
  const dismissMutation = useDismissNotification();

  // Cards visibles según el rol del usuario (solo las que le aplican).
  const visibleEvents = useMemo(
    () =>
      user?.role
        ? EVENT_TYPES.filter((e) => (e.roles as readonly string[]).includes(user.role))
        : EVENT_TYPES,
    [user?.role],
  );

  // Contador por tipo: unread + total (ventana actual).
  const countsByType = useMemo(() => {
    const acc: Record<string, { unread: number; total: number }> = {};
    for (const t of EVENT_TYPES) {
      acc[t.key] = { unread: 0, total: 0 };
    }
    for (const n of notifications) {
      const bucket = acc[n.type];
      if (!bucket) continue;
      bucket.total += 1;
      if (!n.read_at && !n.archived_at) bucket.unread += 1;
    }
    return acc;
  }, [notifications]);

  const filtered = notifications.filter((n) => {
    if (filter === "all") return true;
    if (filter === "unread") return !n.read_at;
    return n.type === filter;
  });

  const openNotification = (n: Notification) => {
    if (!n.read_at) markReadMutation.mutate(n.id);
    if (n.action_url) navigateWithLoading(n.action_url);
  };

  const emptyHint = (() => {
    if (user?.role === "vendedor") return "Aquí verás los leads que te asignen y recordatorios relevantes para tu día.";
    if (user?.role === "admin")
      return "Aquí aparecerán avisos de tu equipo: leads contactados, negocios cerrados, consignaciones nuevas y avisos de tareas pendientes.";
    return "Aquí aparecerán los avisos importantes de tu sucursal y equipo.";
  })();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Alertas</h1>
          <p className="text-muted-foreground mt-2">
            Historial completo de notificaciones
            {unreadCount > 0 && (
              <span className="ml-2 text-pink-600 font-medium">({unreadCount} sin leer)</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIncludeArchived((v) => !v)}>
            {includeArchived ? "Ocultar archivadas" : "Mostrar archivadas"}
          </Button>
          {unreadCount > 0 && user?.id && (
            <Button
              size="sm"
              onClick={() => markAllReadMutation.mutate(user.id)}
              disabled={markAllReadMutation.isPending}
            >
              Marcar todas como leídas
            </Button>
          )}
        </div>
      </div>

      {/* Resumen por tipo (clickeable, filtra el historial) */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {/* Card pivot: Total no leídas */}
        <Card
          role="button"
          onClick={() => setFilter("unread")}
          className={`cursor-pointer transition-shadow hover:shadow-md ${
            filter === "unread" ? "ring-2 ring-pink-500" : ""
          }`}
        >
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Bell className="h-4 w-4 text-orange-500" />
              Total no leídas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unreadCount}</div>
            <p className="text-xs text-muted-foreground">Click para filtrar</p>
          </CardContent>
        </Card>

        {visibleEvents.map((e) => {
          const Icon = e.icon;
          const { unread, total } = countsByType[e.key];
          const isActive = filter === e.key;
          return (
            <Card
              key={e.key}
              role="button"
              onClick={() => setFilter((prev) => (prev === e.key ? "all" : e.key))}
              className={`cursor-pointer transition-shadow hover:shadow-md ${
                isActive ? "ring-2 ring-pink-500" : ""
              }`}
              title={e.description}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Icon className={`h-4 w-4 ${e.iconClass}`} />
                  {e.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <div className="text-2xl font-bold">{unread}</div>
                  {total > unread && (
                    <span className="text-xs text-muted-foreground">/ {total}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{e.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Historial */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Historial
            </CardTitle>
            <CardDescription>
              Últimas 100 notificaciones
              {filter !== "all" && (
                <>
                  {" "}· filtrando por{" "}
                  <span className="font-medium">
                    {filter === "unread" ? "no leídas" : labelFor(filter)}
                  </span>
                </>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {filter !== "all" && (
              <Button variant="ghost" size="sm" onClick={() => setFilter("all")}>
                Limpiar filtro
              </Button>
            )}
            <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
              <SelectTrigger className="w-[230px]">
                <SelectValue placeholder="Filtrar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="unread">No leídas</SelectItem>
                {visibleEvents.map((e) => (
                  <SelectItem key={e.key} value={e.key}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="mb-2 font-medium text-foreground">
                {notifications.length === 0 ? "Todavía no hay notificaciones" : "Sin resultados para este filtro"}
              </p>
              <p className="text-sm max-w-md mx-auto">{emptyHint}</p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((n) => {
                const unread = !n.read_at;
                const archived = !!n.archived_at;
                return (
                  <div
                    key={n.id}
                    className={`p-4 flex items-start gap-3 ${unread ? "bg-pink-50/40 dark:bg-pink-900/10" : ""}`}
                  >
                    <div className="flex-shrink-0 mt-0.5">{iconFor(n.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="cursor-pointer" onClick={() => openNotification(n)}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-semibold">{n.title}</h4>
                          <Badge variant="outline" className="text-xs font-normal">
                            {labelFor(n.type)}
                          </Badge>
                          {unread && <Badge variant="secondary">Nuevo</Badge>}
                          {archived && <Badge variant="outline">Archivada</Badge>}
                        </div>
                        {n.message && <p className="text-sm text-muted-foreground mt-1">{n.message}</p>}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                          <Clock className="h-3 w-3" />
                          <span>{formatTime(n.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {unread && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => markReadMutation.mutate(n.id)}
                          title="Marcar como leída"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      {!archived && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => dismissMutation.mutate(n.id)}
                          title="Archivar"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
