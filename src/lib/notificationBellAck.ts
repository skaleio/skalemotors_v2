import type { Notification } from "@/hooks/useNotifications";

const bellAckStorageKey = (userId: string) => `skale:notif-bell-ack:${userId}`;

export function loadBellAckUpTo(userId: string): string | null {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage.getItem(bellAckStorageKey(userId));
}

export function saveBellAckUpTo(userId: string, iso: string): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(bellAckStorageKey(userId), iso);
}

/** Timestamp más reciente del listado actual (para marcar "visto al abrir campana"). */
export function latestNotificationTimestamp(notifications: Notification[]): string {
  if (notifications.length === 0) return new Date().toISOString();
  return notifications.reduce(
    (max, n) => (n.created_at > max ? n.created_at : max),
    notifications[0].created_at,
  );
}

/**
 * Contador del badge de la campana: solo notificaciones no leídas que llegaron
 * después de la última vez que el usuario abrió el panel.
 */
export function countUnseenInBell(
  notifications: Notification[],
  acknowledgedUpTo: string | null,
): number {
  return notifications.filter((n) => {
    if (n.archived_at || n.read_at) return false;
    if (!acknowledgedUpTo) return true;
    return n.created_at > acknowledgedUpTo;
  }).length;
}
