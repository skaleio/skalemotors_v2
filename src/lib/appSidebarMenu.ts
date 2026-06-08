import { isPhotographerRole, isVendorRole, isVendorSidebarItemLocked } from "@/lib/appRoles";
import {
  BarChart3,
  Calculator,
  Calendar,
  Camera,
  Car,
  ClipboardList,
  DollarSign,
  FileText,
  Globe,
  LayoutDashboard,
  ListChecks,
  MessageCircle,
  PieChart,
  Plug,
  Receipt,
  ScrollText,
  Settings,
  Share2,
  Target,
  TrendingUp,
  Trophy,
  UserCheck,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface SidebarMenuItem {
  title: string;
  url: string;
  icon: LucideIcon;
}

export interface SidebarMenuCategory {
  title: string;
  icon: LucideIcon;
  items: SidebarMenuItem[];
}

export const MENU_CATEGORIES: SidebarMenuCategory[] = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    items: [
      { title: "Dashboard Principal", url: "/app", icon: LayoutDashboard },
      { title: "Dashboard Ejecutivo", url: "/app/executive", icon: BarChart3 },
    ],
  },
  {
    title: "CRM & Leads",
    icon: Target,
    items: [
      { title: "CRM", url: "/app/crm", icon: Target },
      { title: "WhatsApp", url: "/app/whatsapp", icon: MessageCircle },
      { title: "Leads", url: "/app/leads", icon: Users },
      { title: "Citas", url: "/app/appointments", icon: Calendar },
      { title: "Informe diario", url: "/app/tasks", icon: ListChecks },
      { title: "Redes sociales", url: "/app/redes-sociales", icon: Share2 },
    ],
  },
  {
    title: "Inventario & Vehículos",
    icon: Car,
    items: [
      { title: "Consignaciones", url: "/app/consignaciones", icon: ClipboardList },
      { title: "Álbumes", url: "/app/albums", icon: Camera },
      { title: "Tasación", url: "/app/tasacion", icon: Calculator },
    ],
  },
  {
    title: "Documentos",
    icon: FileText,
    items: [
      { title: "Documentos", url: "/app/documents", icon: FileText },
      { title: "Contratos de Venta", url: "/app/documents/venta", icon: FileText },
      { title: "Contratos de Consignación", url: "/app/documents/consignacion", icon: ScrollText },
    ],
  },
  {
    title: "Finanzas",
    icon: DollarSign,
    items: [
      { title: "Gastos / Ingresos", url: "/app/finance", icon: Receipt },
      { title: "Ranking Vendedores", url: "/app/ranking", icon: Trophy },
      { title: "Gestión de Fondos", url: "/app/fund-management", icon: Wallet },
      { title: "Ventas", url: "/app/sales", icon: TrendingUp },
      { title: "Distribución de Salarios", url: "/app/salary-distribution", icon: PieChart },
      { title: "Vendedores", url: "/app/vendors", icon: UserCheck },
      { title: "Seguimiento Financiero", url: "/app/financial-tracking", icon: DollarSign },
      { title: "Calculadora Financiera", url: "/app/financial-calculator", icon: Calculator },
    ],
  },
];

export const SETTINGS_CATEGORY: SidebarMenuCategory = {
  title: "Sistema",
  icon: Settings,
  items: [
    { title: "Configuración", url: "/app/settings", icon: Settings },
    { title: "Mi Web", url: "/app/website", icon: Globe },
    { title: "Integraciones", url: "/app/integrations", icon: Plug },
    { title: "Usuarios", url: "/app/users", icon: UserCog },
  ],
};

const PHOTOGRAPHER_CATEGORIES: SidebarMenuCategory[] = [
  {
    title: "Mi trabajo",
    icon: Car,
    items: [
      { title: "Inventario", url: "/app/consignaciones", icon: Car },
      { title: "Álbumes", url: "/app/albums", icon: Camera },
      { title: "Precios web", url: "/app/website", icon: Globe },
      { title: "Tareas pendientes", url: "/app/mis-tareas", icon: ListChecks },
    ],
  },
];

function getDocumentsMenuItems(): SidebarMenuItem[] {
  return MENU_CATEGORIES.find((c) => c.title === "Documentos")?.items ?? [];
}

/** Categorías visibles en sidebar / Hub mobile según rol. */
export function getSidebarCategoriesForRole(role: string | undefined | null): SidebarMenuCategory[] {
  if (isPhotographerRole(role)) {
    return PHOTOGRAPHER_CATEGORIES;
  }
  if (isVendorRole(role)) {
    const documentItems = getDocumentsMenuItems();
    return MENU_CATEGORIES.map((category) => {
      if (category.title === "CRM & Leads") {
        const items = category.items.filter((item) => item.url !== "/app/ranking");
        return { ...category, items };
      }
      if (category.title === "Inventario & Vehículos") {
        const consignaciones = category.items.filter((item) => item.url === "/app/consignaciones");
        const items = [...consignaciones, ...documentItems];
        return items.length ? { ...category, items } : null;
      }
      return null;
    }).filter((category): category is SidebarMenuCategory => category !== null);
  }
  return MENU_CATEGORIES;
}

export function shouldShowSettingsCategory(role: string | undefined | null): boolean {
  return !isVendorRole(role) && !isPhotographerRole(role);
}

export function isSidebarItemLocked(url: string, role: string | undefined | null): boolean {
  return isVendorSidebarItemLocked(url, role);
}

export function isPathActive(currentPath: string, itemUrl: string): boolean {
  if (itemUrl.includes("?")) {
    const [basePath, queryParams] = itemUrl.split("?");
    const [currentBasePath, currentQuery] = currentPath.split("?");

    if (currentBasePath === basePath) {
      if (queryParams && currentQuery) {
        const expectedParam = queryParams.split("=")[1];
        return currentQuery.includes(expectedParam);
      }
      return false;
    }
    return false;
  }

  const base = currentPath.split("?")[0];
  const itemBase = itemUrl.split("?")[0];
  if (base === itemBase) return true;
  if (itemBase !== "/app" && base.startsWith(`${itemBase}/`)) return true;
  return false;
}
