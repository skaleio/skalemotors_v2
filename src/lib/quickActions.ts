import {
  BarChart3,
  Calculator,
  Calendar,
  CalendarPlus,
  Camera,
  Car,
  CircleDollarSign,
  ClipboardList,
  DollarSign,
  FileText,
  LayoutDashboard,
  ListChecks,
  MessageCircle,
  Receipt,
  Settings,
  Target,
  Trophy,
  UserCog,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { isPhotographerRole, isVendorRole } from "@/lib/appRoles";
import { hasPermission, type AppPermission } from "@/lib/rbac";
import { DEFAULT_SHORTCUTS, type ShortcutActionId } from "@/lib/shortcuts-defaults";

export type QuickActionContext = {
  navigateWithLoading: (path: string) => void;
  pathname: string;
};

export type QuickActionDef = {
  id: string;
  label: string;
  description: string;
  category: string;
  keywords: string[];
  color: string;
  icon: LucideIcon;
  shortcutId?: ShortcutActionId;
  isVisible: (role: string | undefined) => boolean;
  run: (ctx: QuickActionContext) => void;
};

function notPhotographer(role: string | undefined): boolean {
  return !!role && !isPhotographerRole(role);
}

function canFinance(role: string | undefined): boolean {
  return hasPermission(role, "finance:read");
}

function canManageUsers(role: string | undefined): boolean {
  return role === "admin" || role === "gerente" || role === "jefe_jefe" || role === "jefe_sucursal";
}

function canRanking(role: string | undefined): boolean {
  return (
    role === "admin" ||
    role === "gerente" ||
    role === "financiero" ||
    role === "jefe_jefe" ||
    role === "jefe_sucursal"
  );
}

function dispatchOrNavigate(
  ctx: QuickActionContext,
  opts: { onPath: string | string[]; event: string; targetPath: string },
) {
  const paths = Array.isArray(opts.onPath) ? opts.onPath : [opts.onPath];
  const onPage = paths.some((p) => ctx.pathname === p || ctx.pathname.startsWith(`${p}/`));
  if (onPage) {
    window.dispatchEvent(new CustomEvent(opts.event));
    return;
  }
  ctx.navigateWithLoading(opts.targetPath);
}

const INVENTORY_PATH = "/app/consignaciones";

const QUICK_ACTIONS: QuickActionDef[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Panel principal con KPIs del negocio",
    icon: LayoutDashboard,
    color: "bg-blue-600",
    category: "General",
    keywords: ["dashboard", "inicio", "panel", "kpis"],
    isVisible: (role) => !!role && !isVendorRole(role) && !isPhotographerRole(role),
    run: (ctx) => ctx.navigateWithLoading("/app"),
  },
  {
    id: "executive_dashboard",
    label: "Dashboard ejecutivo",
    description: "Vista gerencial con métricas y tendencias",
    icon: BarChart3,
    color: "bg-indigo-600",
    category: "General",
    keywords: ["ejecutivo", "gerencia", "métricas", "tendencias"],
    isVisible: canFinance,
    run: (ctx) => ctx.navigateWithLoading("/app/executive"),
  },
  {
    id: "new_lead",
    label: "Nuevo lead",
    description: "Registrar un prospecto en el CRM",
    icon: UserPlus,
    color: "bg-blue-600",
    category: "CRM",
    keywords: ["lead", "prospecto", "cliente", "crm"],
    shortcutId: "new_lead",
    isVisible: notPhotographer,
    run: (ctx) =>
      dispatchOrNavigate(ctx, {
        onPath: ["/app/leads", "/leads"],
        event: "openNewLeadForm",
        targetPath: "/app/leads?new=true",
      }),
  },
  {
    id: "crm",
    label: "CRM pipeline",
    description: "Tablero Kanban de ventas",
    icon: Target,
    color: "bg-green-600",
    category: "CRM",
    keywords: ["crm", "pipeline", "kanban", "embudo"],
    shortcutId: "crm",
    isVisible: notPhotographer,
    run: (ctx) => ctx.navigateWithLoading("/app/crm"),
  },
  {
    id: "new_sale",
    label: "Nueva venta",
    description: "Registrar una venta en el módulo de ventas",
    icon: CircleDollarSign,
    color: "bg-emerald-600",
    category: "CRM",
    keywords: ["venta", "registrar", "cerrar", "negocio"],
    shortcutId: "new_sale",
    isVisible: canFinance,
    run: (ctx) =>
      dispatchOrNavigate(ctx, {
        onPath: "/app/sales",
        event: "openNewSaleForm",
        targetPath: "/app/sales?new=true",
      }),
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    description: "Bandeja de conversaciones WhatsApp",
    icon: MessageCircle,
    color: "bg-green-600",
    category: "CRM",
    keywords: ["whatsapp", "chat", "mensajes", "inbox"],
    isVisible: notPhotographer,
    run: (ctx) => ctx.navigateWithLoading("/app/whatsapp"),
  },
  {
    id: "appointments",
    label: "Citas",
    description: "Calendario de test drives, reuniones y entregas",
    icon: Calendar,
    color: "bg-orange-600",
    category: "Operaciones",
    keywords: ["cita", "calendario", "agenda", "test drive"],
    shortcutId: "appointments",
    isVisible: notPhotographer,
    run: (ctx) => ctx.navigateWithLoading("/app/appointments"),
  },
  {
    id: "schedule_appointment",
    label: "Agendar cita",
    description: "Ir al calendario para programar una cita",
    icon: CalendarPlus,
    color: "bg-orange-600",
    category: "Operaciones",
    keywords: ["agendar", "programar", "reunión", "visita"],
    isVisible: notPhotographer,
    run: (ctx) => ctx.navigateWithLoading("/app/appointments"),
  },
  {
    id: "tasacion",
    label: "Tasación",
    description: "Valorar un vehículo por patente (GetAPI)",
    icon: Calculator,
    color: "bg-cyan-600",
    category: "Operaciones",
    keywords: ["tasación", "tasacion", "patente", "valor", "appraisal"],
    shortcutId: "tasacion",
    isVisible: notPhotographer,
    run: (ctx) => ctx.navigateWithLoading("/app/tasacion"),
  },
  {
    id: "daily_report",
    label: "Informe diario",
    description: "Tareas y reporte operativo del equipo",
    icon: ListChecks,
    color: "bg-purple-600",
    category: "Operaciones",
    keywords: ["informe", "diario", "tareas", "reporte"],
    isVisible: notPhotographer,
    run: (ctx) => ctx.navigateWithLoading("/app/tasks"),
  },
  {
    id: "financial_calculator",
    label: "Calculadora financiera",
    description: "Simular cuotas y financiamiento",
    icon: Calculator,
    color: "bg-indigo-600",
    category: "Finanzas",
    keywords: ["calculadora", "cuotas", "crédito", "financiamiento"],
    shortcutId: "financial_calculator",
    isVisible: canFinance,
    run: (ctx) => ctx.navigateWithLoading("/app/financial-calculator"),
  },
  {
    id: "finance",
    label: "Finanzas",
    description: "Gastos, ingresos y movimientos del mes",
    icon: Receipt,
    color: "bg-green-600",
    category: "Finanzas",
    keywords: ["finanzas", "gastos", "ingresos", "movimientos"],
    isVisible: canFinance,
    run: (ctx) => ctx.navigateWithLoading("/app/finance"),
  },
  {
    id: "sales_ranking",
    label: "Ranking vendedores",
    description: "Desempeño comercial por vendedor",
    icon: Trophy,
    color: "bg-yellow-600",
    category: "Finanzas",
    keywords: ["ranking", "vendedores", "comisiones", "metas"],
    isVisible: canRanking,
    run: (ctx) => ctx.navigateWithLoading("/app/ranking"),
  },
  {
    id: "new_vehicle",
    label: "Agregar vehículo",
    description: "Registrar un vehículo en inventario",
    icon: Car,
    color: "bg-emerald-600",
    category: "Inventario",
    keywords: ["vehículo", "auto", "stock", "inventario", "agregar"],
    shortcutId: "inventory",
    isVisible: (role) => !!role,
    run: (ctx) =>
      dispatchOrNavigate(ctx, {
        onPath: INVENTORY_PATH,
        event: "openNewVehicleForm",
        targetPath: `${INVENTORY_PATH}?new=true`,
      }),
  },
  {
    id: "inventory",
    label: "Inventario",
    description: "Ver y administrar stock de vehículos",
    icon: ClipboardList,
    color: "bg-blue-600",
    category: "Inventario",
    keywords: ["inventario", "consignaciones", "stock", "vehículos"],
    isVisible: (role) => !!role,
    run: (ctx) => ctx.navigateWithLoading(INVENTORY_PATH),
  },
  {
    id: "albums",
    label: "Álbumes",
    description: "Fotos de vehículos para publicación web",
    icon: Camera,
    color: "bg-teal-600",
    category: "Inventario",
    keywords: ["álbumes", "fotos", "imágenes", "web"],
    isVisible: (role) => role === "admin" || role === "fotografo",
    run: (ctx) => ctx.navigateWithLoading("/app/albums"),
  },
  {
    id: "photographer_tasks",
    label: "Mis tareas",
    description: "Trabajo pendiente de fotografía e inventario",
    icon: ListChecks,
    color: "bg-orange-600",
    category: "Inventario",
    keywords: ["tareas", "fotos", "pendientes", "fotógrafo"],
    isVisible: (role) => isPhotographerRole(role),
    run: (ctx) => ctx.navigateWithLoading("/app/mis-tareas"),
  },
  {
    id: "documents",
    label: "Documentos",
    description: "Contratos y documentación de ventas",
    icon: FileText,
    color: "bg-purple-600",
    category: "Documentos",
    keywords: ["documentos", "contratos", "pdf", "venta"],
    isVisible: notPhotographer,
    run: (ctx) => ctx.navigateWithLoading("/app/documents"),
  },
  {
    id: "fund_management",
    label: "Gestión de fondos",
    description: "Fondos e inversiones de la automotora",
    icon: DollarSign,
    color: "bg-emerald-600",
    category: "Finanzas",
    keywords: ["fondos", "inversión", "capital"],
    isVisible: (role) => hasPermission(role, "finance:write"),
    run: (ctx) => ctx.navigateWithLoading("/app/fund-management"),
  },
  {
    id: "settings",
    label: "Configuración",
    description: "Ajustes del tenant y preferencias",
    icon: Settings,
    color: "bg-gray-600",
    category: "Sistema",
    keywords: ["configuración", "ajustes", "preferencias"],
    isVisible: (role) => !!role,
    run: (ctx) => ctx.navigateWithLoading("/app/settings"),
  },
  {
    id: "users",
    label: "Usuarios",
    description: "Administrar equipo y accesos",
    icon: UserCog,
    color: "bg-indigo-600",
    category: "Sistema",
    keywords: ["usuarios", "equipo", "permisos", "roles"],
    isVisible: canManageUsers,
    run: (ctx) => ctx.navigateWithLoading("/app/users"),
  },
];

export function getQuickActionsForRole(role: string | undefined): QuickActionDef[] {
  return QUICK_ACTIONS.filter((action) => action.isVisible(role));
}

export function shortcutLabelForAction(action: QuickActionDef): string | undefined {
  if (!action.shortcutId) return undefined;
  return DEFAULT_SHORTCUTS[action.shortcutId];
}

/** Atajos de teclado personalizables — solo acciones con ruta real. */
export function isShortcutActionAvailable(actionId: ShortcutActionId, role: string | undefined): boolean {
  const action = QUICK_ACTIONS.find((a) => a.shortcutId === actionId);
  return action ? action.isVisible(role) : false;
}

export function getShortcutActionsForRole(role: string | undefined) {
  const visibleIds = new Set(
    QUICK_ACTIONS.filter((a) => a.shortcutId && a.isVisible(role)).map((a) => a.shortcutId!),
  );
  return Object.keys(DEFAULT_SHORTCUTS).filter((id) => visibleIds.has(id as ShortcutActionId));
}
