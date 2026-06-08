import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Bell, Clock, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";

const LIMIT = 5;

function formatAlertTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: esLocale });
  } catch {
    return "";
  }
}

function SalesAlertRow({
  notification,
  onOpen,
}: {
  notification: Notification;
  onOpen: (notification: Notification) => void;
}) {
  const unread = !notification.read_at && !notification.archived_at;
  const meta = getNotificationEventMeta(notification.type);
  const Icon = meta?.icon ?? Info;

  return (
    <button
      type="button"
      onClick={() => onOpen(notification)}
      className={`w-full text-left rounded-lg border p-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        unread ? "border-pink-200/80 bg-pink-50/40 dark:border-pink-900/40 dark:bg-pink-950/20" : "border-border"
      }`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${meta?.iconClass ?? "text-muted-foreground"}`} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold leading-snug">{notification.title}</p>
            {unread ? (
              <Badge variant="secondary" className="h-5 text-[10px] uppercase tracking-wide">
                Nuevo
              </Badge>
            ) : null}
          </div>
          {notification.message ? (
            <p className="text-xs text-muted-foreground line-clamp-2">{notification.message}</p>
          ) : null}
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{formatAlertTime(notification.created_at)}</span>
            <span>·</span>
            <span>{notificationLabelForType(notification.type)}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

interface DashboardSalesAlertsPanelProps {
  userId: string | undefined;
  role: string | undefined;
}

export function DashboardSalesAlertsPanel({ userId, role }: DashboardSalesAlertsPanelProps) {
  const navigate = useNavigate();
  const markReadMutation = useMarkNotificationRead();
  const { notifications, unreadCount, isLoading } = useNotifications({
    userId,
    role,
    limit: LIMIT,
  });

  const openAlert = (notification: Notification) => {
    if (!notification.read_at) markReadMutation.mutate(notification.id);
    navigateFromNotification(notification, navigate);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Avisos</h3>
        </div>
        {unreadCount > 0 ? (
          <Badge variant="secondary" className="text-xs">
            {unreadCount} nuevo{unreadCount !== 1 ? "s" : ""}
          </Badge>
        ) : null}
      </div>
      {isLoading ? (
        <Skeleton className="h-16 w-full rounded-lg" />
      ) : notifications.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">No tienes avisos recientes.</p>
      ) : (
        <>
          {notifications.map((n) => (
            <SalesAlertRow key={n.id} notification={n} onOpen={openAlert} />
          ))}
          <Button variant="link" className="w-full h-auto p-0" onClick={() => navigate("/app/alerts")}>
            Ver todos los avisos →
          </Button>
        </>
      )}
    </div>
  );
}
