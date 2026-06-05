import { describe, expect, it } from "vitest";
import { countUnseenInBell, latestNotificationTimestamp } from "./notificationBellAck";
import type { Notification } from "@/hooks/useNotifications";

function n(partial: Partial<Notification> & Pick<Notification, "id" | "created_at">): Notification {
  return {
    tenant_id: "t1",
    branch_id: null,
    recipient_user_id: "u1",
    actor_user_id: null,
    type: "lead_assigned",
    title: "Test",
    message: null,
    entity_type: "lead",
    entity_id: "l1",
    action_url: null,
    metadata: null,
    read_at: null,
    archived_at: null,
    ...partial,
  } as Notification;
}

describe("notificationBellAck", () => {
  it("latestNotificationTimestamp elige el created_at más reciente", () => {
    const ts = latestNotificationTimestamp([
      n({ id: "1", created_at: "2026-01-01T10:00:00Z" }),
      n({ id: "2", created_at: "2026-01-03T10:00:00Z" }),
      n({ id: "3", created_at: "2026-01-02T10:00:00Z" }),
    ]);
    expect(ts).toBe("2026-01-03T10:00:00Z");
  });

  it("countUnseenInBell sin ack cuenta todas las no leídas", () => {
    const list = [
      n({ id: "1", created_at: "2026-01-01T10:00:00Z" }),
      n({ id: "2", created_at: "2026-01-02T10:00:00Z", read_at: "2026-01-02T11:00:00Z" }),
    ];
    expect(countUnseenInBell(list, null)).toBe(1);
  });

  it("countUnseenInBell con ack solo cuenta las posteriores al abrir campana", () => {
    const list = [
      n({ id: "1", created_at: "2026-01-01T10:00:00Z" }),
      n({ id: "2", created_at: "2026-01-03T10:00:00Z" }),
      n({ id: "3", created_at: "2026-01-04T10:00:00Z", read_at: "2026-01-04T11:00:00Z" }),
    ];
    expect(countUnseenInBell(list, "2026-01-02T10:00:00Z")).toBe(1);
  });
});
