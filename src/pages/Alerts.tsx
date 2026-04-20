import { useState } from "react";
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
import { Bell, Car, Check, CheckCircle, Clock, Info, Loader2, X } from "lucide-react";
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

type Filter = "all" | "unread" | "lead_sold" | "consignacion_created" | "consignacion_stale";

function iconFor(type: string) {
  switch (type) {
    case "lead_sold":
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case "consignacion_created":
      return <Car className="h-5 w-5 text-indigo-500" />;
    case "consignacion_stale":
      return <Clock className="h-5 w-5 text-amber-500" />;
    case "lead":
    case "lead_assigned":
      return <Info className="h-5 w-5 text-pink-500" />;
    default:
      return <Info className="h-5 w-5 text-gray-500" />;
  }
}

function formatTime(iso: string) {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: esLocale });
  } catch {
    return "";
  }
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

  const filtered = notifications.filter((n) => {
    if (filter === "all") return true;
    if (filter === "unread") return !n.read_at;
    return n.type === filter;
  });

  const leadSoldCount = notifications.filter((n) => n.type === "lead_sold" && !n.read_at).length;
  const consignacionCount = notifications.filter(
    (n) => n.type === "consignacion_created" && !n.read_at,
  ).length;
  const staleCount = notifications.filter(
    (n) => n.type === "consignacion_stale" && !n.read_at,
  ).length;

  const openNotification = (n: Notification) => {
    if (!n.read_at) markReadMutation.mutate(n.id);
    if (n.action_url) navigateWithLoading(n.action_url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Alertas</h1>
          <p className="text-muted-foreground mt-2">
            Historial completo de notificaciones {unreadCount > 0 && `(${unreadCount} sin leer)`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIncludeArchived((v) => !v)}
          >
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

      {/* Resumen */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Negocios cerrados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{leadSoldCount}</div>
            <p className="text-xs text-muted-foreground">sin leer</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Car className="h-4 w-4 text-indigo-500" />
              Consignaciones nuevas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{consignacionCount}</div>
            <p className="text-xs text-muted-foreground">sin leer</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-amber-500" />
              Sin publicar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{staleCount}</div>
            <p className="text-xs text-muted-foreground">consignaciones demoradas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Bell className="h-4 w-4 text-orange-500" />
              Total no leídas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unreadCount}</div>
            <p className="text-xs text-muted-foreground">en las últimas notificaciones</p>
          </CardContent>
        </Card>
      </div>

      {/* Historial */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Historial
            </CardTitle>
            <CardDescription>Últimas 100 notificaciones</CardDescription>
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Filtrar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="unread">No leídas</SelectItem>
              <SelectItem value="lead_sold">Negocios cerrados</SelectItem>
              <SelectItem value="consignacion_created">Consignaciones nuevas</SelectItem>
              <SelectItem value="consignacion_stale">Consignaciones sin publicar</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No hay notificaciones</p>
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
                      <div
                        className="cursor-pointer"
                        onClick={() => openNotification(n)}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-semibold">{n.title}</h4>
                          {unread && <Badge variant="secondary">Nuevo</Badge>}
                          {archived && <Badge variant="outline">Archivada</Badge>}
                        </div>
                        {n.message && (
                          <p className="text-sm text-muted-foreground mt-1">{n.message}</p>
                        )}
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
