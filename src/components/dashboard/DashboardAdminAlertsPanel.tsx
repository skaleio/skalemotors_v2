import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useMarkNotificationRead,
  useNotifications,
  type Notification,
} from "@/hooks/useNotifications";
import { getNotificationEventMeta, notificationLabelForType } from "@/lib/notificationEvents";
import { navigateFromNotification } from "@/lib/notificationNavigation";
import { formatDistanceToNow } from "date-fns";
import { es as esLocale } from "date-fns/locale";
import { Bell, CheckCircle2, Clock, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";

const DASHBOARD_ALERTS_LIMIT = 8;

function formatAlertTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: esLocale });
  } catch {
    return "";
  }
}

function NotificationTypeIcon({ type }: { type: string }) {
  const meta = getNotificationEventMeta(type);
  if (meta) {
    const Icon = meta.icon;
    return <Icon className={`h-4 w-4 shrink-0 ${meta.iconClass}`} />;
  }
  return <Info className="h-4 w-4 shrink-0 text-muted-foreground" />;
}

function AdminAlertRow({
  notification,
  onOpen,
}: {
  notification: Notification;
  onOpen: (notification: Notification) => void;
}) {
  const unread = !notification.read_at && !notification.archived_at;

  return (
    <button
      type="button"
      onClick={() => onOpen(notification)}
      className={`w-full text-left rounded-lg border p-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        unread ? "border-pink-200/80 bg-pink-50/40 dark:border-pink-900/40 dark:bg-pink-950/20" : "border-border"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          <NotificationTypeIcon type={notification.type} />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold leading-snug">{notification.title}</p>
            {unread ? (
              <Badge variant="secondary" className="h-5 text-[10px] uppercase tracking-wide">
                Nuevo
              </Badge>
            ) : null}
          </div>
          <Badge variant="outline" className="text-[10px] font-normal">
            {notificationLabelForType(notification.type)}
          </Badge>
          {notification.message ? (
            <p className="text-xs text-muted-foreground line-clamp-2">{notification.message}</p>
          ) : null}
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{formatAlertTime(notification.created_at)}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

interface DashboardAdminAlertsPanelProps {
  userId: string | undefined;
}

export function DashboardAdminAlertsPanel({ userId }: DashboardAdminAlertsPanelProps) {
  const navigate = useNavigate();
  const markReadMutation = useMarkNotificationRead();
  const { notifications, unreadCount, isLoading } = useNotifications({
    userId,
    role: "admin",
    limit: DASHBOARD_ALERTS_LIMIT,
    syncStaleAlerts: true,
  });

  const openAlert = (notification: Notification) => {
    if (!notification.read_at) {
      markReadMutation.mutate(notification.id);
    }
    navigateFromNotification(notification, navigate);
  };

  return (
    <>
      <CardHeader className="border-b">
        <div className="flex items-center justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Bell className="h-4 w-4 text-muted-foreground" />
              Avisos del equipo
            </CardTitle>
            <CardDescription className="text-xs">
              Señales de control: actividad de vendedores, leads e inventario
            </CardDescription>
          </div>
          {unreadCount > 0 ? (
            <Badge variant="destructive" className="text-sm shrink-0">
              {unreadCount} nuevo{unreadCount !== 1 ? "s" : ""}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mb-3 opacity-20" />
              <p className="text-sm font-medium">Sin avisos recientes</p>
              <p className="text-xs mt-1 text-center max-w-xs px-4">
                Aquí verás movimientos del equipo: leads contactados, cambios en el CRM, vendedores
                sin actividad y consignaciones nuevas.
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate("/app/alerts")}>
                Ver centro de avisos
              </Button>
            </div>
          ) : (
            <>
              {notifications.map((notification) => (
                <AdminAlertRow key={notification.id} notification={notification} onOpen={openAlert} />
              ))}
              <div className="text-center pt-2 border-t">
                <Button variant="link" onClick={() => navigate("/app/alerts")}>
                  Ver todos los avisos →
                </Button>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </>
  );
}
