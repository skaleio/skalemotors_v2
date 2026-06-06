import type { Notification } from "@/hooks/useNotifications";

type NavigableNotification = Pick<Notification, "action_url" | "entity_type" | "entity_id">;

/** Navegación al abrir una notificación (TopBar, Alerts, Dashboard). */
export function navigateFromNotification(
  notification: NavigableNotification,
  navigate: (path: string) => void,
): void {
  if (notification.action_url) {
    navigate(notification.action_url);
    return;
  }
  if (notification.entity_type === "lead" && notification.entity_id) {
    navigate(`/app/leads?openLead=${notification.entity_id}`);
    return;
  }
  if (notification.entity_type === "consignacion") {
    navigate("/app/consignaciones");
    return;
  }
  if (notification.entity_type === "vehicle") {
    navigate("/app/consignaciones");
    return;
  }
  if (notification.entity_type === "seller") {
    navigate("/app/users");
  }
}
