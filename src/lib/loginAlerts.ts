import type { PendingTask } from "@/hooks/usePendingTasks";

const SESSION_KEY_PREFIX = "skale:login-alerts-shown:";

export type LoginAlertCategory =
  | "leads"
  | "inventory_unpublished"
  | "inventory_stale"
  | "consignaciones"
  | "appointments"
  | "other";

export type LoginAlertCategorySummary = {
  id: LoginAlertCategory;
  label: string;
  count: number;
  hint: string;
};

const CATEGORY_META: Record<
  LoginAlertCategory,
  { label: string; hint: string }
> = {
  leads: {
    label: "CRM / Leads",
    hint: "Seguimientos y leads que requieren acción",
  },
  inventory_unpublished: {
    label: "Sin publicar",
    hint: "Vehículos en stock que aún no están publicados",
  },
  inventory_stale: {
    label: "Stock lento",
    hint: "Llevan mucho tiempo sin vender — conviene revisar precio o promoción",
  },
  consignaciones: {
    label: "Consignaciones",
    hint: "Unidades consignadas que necesitan publicación o seguimiento",
  },
  appointments: {
    label: "Citas",
    hint: "Citas por confirmar o reagendar",
  },
  other: {
    label: "Otras alertas",
    hint: "Recordatorios generales del sistema",
  },
};

/** Roles que ven el popup de alertas al iniciar sesión. */
export const LOGIN_ALERT_ROLES = [
  "admin",
  "jefe_jefe",
  "gerente",
  "jefe_sucursal",
  "vendedor",
  "fotografo",
  "inventario",
] as const;

const ENTITY_BY_ROLE: Record<string, PendingTask["entity_type"][]> = {
  vendedor: ["lead", "appointment"],
  fotografo: ["vehicle", "consignacion"],
  inventario: ["vehicle", "consignacion"],
  gerente: ["lead", "appointment", "vehicle", "consignacion"],
  jefe_sucursal: ["lead", "appointment", "vehicle", "consignacion"],
  admin: ["lead", "appointment", "vehicle", "consignacion"],
  jefe_jefe: ["lead", "appointment", "vehicle", "consignacion"],
};

export function shouldShowLoginAlerts(role: string | null | undefined): boolean {
  return !!role && (LOGIN_ALERT_ROLES as readonly string[]).includes(role);
}

export function filterTasksForLoginRole(
  tasks: PendingTask[],
  role: string | null | undefined,
): PendingTask[] {
  const allowed = role ? ENTITY_BY_ROLE[role] : undefined;
  if (!allowed) return tasks;
  return tasks.filter((t) => allowed.includes(t.entity_type));
}

function taskCategory(task: PendingTask): LoginAlertCategory {
  if (task.entity_type === "lead") return "leads";
  if (task.entity_type === "appointment") return "appointments";
  if (task.entity_type === "consignacion") return "consignaciones";
  if (task.entity_type === "vehicle") {
    const meta =
      typeof task.metadata === "object" && task.metadata !== null
        ? (task.metadata as { alert_reason?: string })
        : {};
    if (meta.alert_reason === "unpublished" || /^Publicar vehículo/i.test(task.title)) {
      return "inventory_unpublished";
    }
    return "inventory_stale";
  }
  return "other";
}

export function summarizeLoginAlertCategories(
  tasks: PendingTask[],
): LoginAlertCategorySummary[] {
  const counts = new Map<LoginAlertCategory, number>();
  for (const task of tasks) {
    const cat = taskCategory(task);
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }

  const order: LoginAlertCategory[] = [
    "leads",
    "inventory_unpublished",
    "inventory_stale",
    "consignaciones",
    "appointments",
    "other",
  ];

  return order
    .filter((id) => (counts.get(id) ?? 0) > 0)
    .map((id) => ({
      id,
      label: CATEGORY_META[id].label,
      hint: CATEGORY_META[id].hint,
      count: counts.get(id) ?? 0,
    }));
}

export function loginAlertsSessionKey(userId: string): string {
  return `${SESSION_KEY_PREFIX}${userId}`;
}

export function wasLoginAlertsShown(userId: string): boolean {
  if (typeof sessionStorage === "undefined") return true;
  return sessionStorage.getItem(loginAlertsSessionKey(userId)) === "1";
}

export function markLoginAlertsShown(userId: string): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(loginAlertsSessionKey(userId), "1");
}

export function clearLoginAlertsShown(userId: string): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(loginAlertsSessionKey(userId));
}

const PRIORITY_ORDER: Record<PendingTask["priority"], number> = {
  urgent: 0,
  today: 1,
  later: 2,
};

/** Tareas destacadas en el popup (máx. N, prioridad + recientes). */
export function pickHighlightedLoginTasks(
  tasks: PendingTask[],
  limit = 6,
): PendingTask[] {
  return [...tasks]
    .sort((a, b) => {
      const pd = (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2);
      if (pd !== 0) return pd;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })
    .slice(0, limit);
}
