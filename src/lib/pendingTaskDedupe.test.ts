import { describe, expect, it } from "vitest";
import { dedupePendingTasks } from "./pendingTaskDedupe";
import type { Database } from "./types/database";

type PendingTask = Database["public"]["Tables"]["pending_tasks"]["Row"];

function task(
  partial: Partial<PendingTask> & Pick<PendingTask, "id" | "title" | "entity_id">,
): PendingTask {
  return {
    branch_id: "b1",
    tenant_id: "t1",
    assigned_to: null,
    priority: "urgent",
    description: null,
    action_type: "otro",
    action_label: "Ver lead",
    entity_type: "lead",
    metadata: {},
    source: "rule",
    due_at: null,
    completed_at: null,
    created_at: "2026-05-22T10:00:00Z",
    updated_at: "2026-05-22T10:00:00Z",
    ...partial,
  };
}

describe("dedupePendingTasks", () => {
  it("colapsa dos alertas del mismo lead con el mismo motivo", () => {
    const leadId = "11111111-1111-1111-1111-111111111111";
    const tasks = dedupePendingTasks([
      task({
        id: "a",
        entity_id: leadId,
        title: "Registrar contacto: Barbara",
        metadata: { alert_reason: "contacted_no_attempts" },
      }),
      task({
        id: "b",
        entity_id: leadId,
        title: "Registrar contacto: Barbara",
        metadata: {},
        created_at: "2026-05-21T10:00:00Z",
      }),
    ]);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe("a");
  });

  it("mantiene alertas distintas para el mismo lead", () => {
    const leadId = "22222222-2222-2222-2222-222222222222";
    const tasks = dedupePendingTasks([
      task({
        id: "a",
        entity_id: leadId,
        title: "Registrar contacto: Juan",
        metadata: { alert_reason: "contacted_no_attempts" },
      }),
      task({
        id: "b",
        entity_id: leadId,
        priority: "today",
        title: "Mover lead: Juan",
        metadata: { stale_reason: "no_movement" },
      }),
    ]);
    expect(tasks).toHaveLength(2);
  });
});
