import { supabase } from "@/lib/supabase";

const PENDING_TASKS_SYNC_AT_KEY = "skale:pending-tasks-sync-at";
const PENDING_TASKS_SYNC_SKIP_UNTIL_KEY = "skale:pending-tasks-sync-skip-until";
const PENDING_TASKS_SYNC_INTERVAL_MS = 5 * 60 * 1000;
/** Tras descartar una tarea, no volver a sincronizar alertas por un rato (evita recrearlas antes del deploy SQL). */
const PENDING_TASKS_SYNC_SKIP_AFTER_DISMISS_MS = 30 * 60 * 1000;

/** Roles que pueden disparar el sync de alertas (las RPC validan el mismo set). */
export const STALE_ALERTS_SYNC_ROLES = [
  "admin",
  "jefe_jefe",
  "gerente",
  "jefe_sucursal",
  "inventario",
] as const;

export function canSyncStaleAlerts(role: string | null | undefined): boolean {
  return !!role && (STALE_ALERTS_SYNC_ROLES as readonly string[]).includes(role);
}

const SYNC_RPCS = [
  { name: "sync_stale_consignaciones_to_pending_tasks", args: { dias_sin_publicar: 7 } },
  { name: "sync_stale_leads_to_pending_tasks", args: { dias_sin_movimiento: 4 } },
  { name: "sync_unpublished_vehicles_to_pending_tasks", args: { dias_sin_publicar: 5 } },
  { name: "sync_leads_contacted_no_attempts_to_pending_tasks", args: { horas_sin_intento: 24 } },
  { name: "sync_leads_searching_car_to_pending_tasks", args: { dias_buscando: 5 } },
] as const;

/** Evita que el sync de alertas recree tareas justo después de marcarlas como hechas. */
export function deferPendingTasksSyncAfterDismiss(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(
    PENDING_TASKS_SYNC_SKIP_UNTIL_KEY,
    String(Date.now() + PENDING_TASKS_SYNC_SKIP_AFTER_DISMISS_MS),
  );
}

/** RPCs de alertas; no deben correr en cada refetch tras completar una tarea. */
export async function syncPendingTasksIfDue(): Promise<void> {
  if (typeof sessionStorage === "undefined") return;

  const skipUntilRaw = sessionStorage.getItem(PENDING_TASKS_SYNC_SKIP_UNTIL_KEY);
  const skipUntil = skipUntilRaw ? Number(skipUntilRaw) : 0;
  if (skipUntil && Date.now() < skipUntil) return;

  const lastRaw = sessionStorage.getItem(PENDING_TASKS_SYNC_AT_KEY);
  const last = lastRaw ? Number(lastRaw) : 0;
  const now = Date.now();
  if (last && now - last < PENDING_TASKS_SYNC_INTERVAL_MS) return;

  sessionStorage.setItem(PENDING_TASKS_SYNC_AT_KEY, String(now));

  await Promise.all(
    SYNC_RPCS.map(({ name, args }) =>
      supabase.rpc(name, args).then(({ error }) => {
        const rpcNotFound =
          error?.code === "PGRST202"
          || error?.message?.includes("Could not find the function");
        if (error && !rpcNotFound) {
          console.warn(`${name}:`, error.message);
        }
      }),
    ),
  );
}

function mergeDismissedMetadata(metadata: unknown): Record<string, unknown> {
  const base =
    typeof metadata === "object" && metadata !== null && !Array.isArray(metadata)
      ? { ...(metadata as Record<string, unknown>) }
      : {};
  return {
    ...base,
    user_dismissed: true,
    user_dismissed_at: new Date().toISOString(),
  };
}

export const pendingTasksService = {
  async complete(taskId: string): Promise<void> {
    const { data: existing, error: fetchError } = await supabase
      .from("pending_tasks")
      .select("id, metadata")
      .eq("id", taskId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!existing?.id) {
      throw new Error("Tarea no encontrada o sin permiso para verla.");
    }

    const completedAt = new Date().toISOString();
    const { data, error } = await supabase
      .from("pending_tasks")
      .update({
        completed_at: completedAt,
        updated_at: completedAt,
        metadata: mergeDismissedMetadata(existing.metadata),
      })
      .eq("id", taskId)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data?.id) {
      throw new Error(
        "No se pudo marcar la tarea. Puede que ya esté completada o no tengas permiso.",
      );
    }

    deferPendingTasksSyncAfterDismiss();
  },
};
