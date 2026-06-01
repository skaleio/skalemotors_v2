import type { Database } from "@/lib/types/database";

type PendingTask = Database["public"]["Tables"]["pending_tasks"]["Row"];

const PRIORITY_RANK: Record<PendingTask["priority"], number> = {
  urgent: 0,
  today: 1,
  later: 2,
};

/** Razón lógica de la alerta (metadata o título). */
export function pendingTaskAlertKey(task: PendingTask): string {
  const meta =
    typeof task.metadata === "object" && task.metadata !== null
      ? (task.metadata as Record<string, unknown>)
      : {};

  const fromMeta =
    (typeof meta.alert_reason === "string" && meta.alert_reason)
    || (typeof meta.stale_reason === "string" && meta.stale_reason)
    || "";

  if (fromMeta) return fromMeta;

  const title = task.title.trim().toLowerCase();
  if (title.startsWith("registrar contacto:")) return "contacted_no_attempts";
  if (title.startsWith("mover lead:")) return "no_movement";
  if (title.startsWith("publicar vehículo")) return "unpublished";
  if (title.startsWith("revisar vehículo en inventario")) return "inventory_stale";
  if (title.startsWith("cliente buscando")) return "searching_car";

  return `${task.action_type}:${title}`;
}

export function pendingTaskDedupeKey(task: PendingTask): string {
  if (task.entity_id) {
    return `${task.entity_type}:${task.entity_id}:${pendingTaskAlertKey(task)}`;
  }
  return `custom:${task.id}`;
}

function taskRank(task: PendingTask): number {
  const priority = PRIORITY_RANK[task.priority] ?? 2;
  const created = new Date(task.created_at).getTime();
  return priority * 1e15 - created;
}

/** Una sola tarea activa por entidad + tipo de alerta (evita duplicados en BD). */
export function dedupePendingTasks(tasks: PendingTask[]): PendingTask[] {
  const best = new Map<string, PendingTask>();

  for (const task of tasks) {
    const key = pendingTaskDedupeKey(task);
    const existing = best.get(key);
    if (!existing || taskRank(task) < taskRank(existing)) {
      best.set(key, task);
    }
  }

  return Array.from(best.values());
}
