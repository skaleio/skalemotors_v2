import { useTheme } from "@/contexts/ThemeContext";
import { useNavigationWithLoading } from "@/hooks/useNavigationWithLoading";
import { leadService } from "@/lib/services/leads";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BarChart3,
  CreditCard as BillingIcon,
  Calculator,
  Calendar,
  Car,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  CreditCard,
  DollarSign,
  FileText,
  Keyboard,
  LayoutDashboard,
  LogOut,
  MoreVertical,
  PieChart,
  Plug,
  Plus,
  Receipt,
  ScrollText,
  Settings,
  Target,
  TrendingUp,
  UserCheck,
  UserCircle,
  UserCog,
  Users,
  Wallet,
  Moon,
  Sun
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import { ProfileAvatarImage } from "@/components/ProfileAvatarImage";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

// Categorías organizadas del menú — Fase 1
const menuCategories = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    items: [
      { title: "Dashboard Principal", url: "/app", icon: LayoutDashboard },
      { title: "Dashboard Ejecutivo", url: "/app/executive", icon: BarChart3 },
    ]
  },
  {
    title: "CRM & Leads",
    icon: Target,
    items: [
      { title: "CRM", url: "/app/crm", icon: Target },
      { title: "Leads", url: "/app/leads", icon: Users },
      { title: "Citas", url: "/app/appointments", icon: Calendar },
    ]
  },
  {
    title: "Inventario & Vehículos",
    icon: Car,
    items: [
      { title: "Consignaciones", url: "/app/consignaciones", icon: ClipboardList },
      { title: "Tasación", url: "/app/tasacion", icon: Calculator },
    ]
  },
  {
    title: "Documentos",
    icon: FileText,
    items: [
      { title: "Contratos de Venta", url: "/app/documents/venta", icon: FileText },
      { title: "Contratos de Consignación", url: "/app/documents/consignacion", icon: ScrollText },
    ]
  },
  {
    title: "Finanzas",
    icon: DollarSign,
    items: [
      { title: "Gastos / Ingresos", url: "/app/finance", icon: Receipt },
      { title: "Gestión de Fondos", url: "/app/fund-management", icon: Wallet },
      { title: "Ventas", url: "/app/sales", icon: TrendingUp },
      { title: "Distribución de Salarios", url: "/app/salary-distribution", icon: PieChart },
      { title: "Vendedores", url: "/app/vendors", icon: UserCheck },
      { title: "Seguimiento Financiero", url: "/app/financial-tracking", icon: DollarSign },
      { title: "Calculadora Financiera", url: "/app/financial-calculator", icon: Calculator },
    ]
  },
];

const settingsCategory = {
  title: "Sistema",
  icon: Settings,
  items: [
    { title: "Configuración", url: "/app/settings", icon: Settings },
    { title: "Integraciones", url: "/app/integrations", icon: Plug },
    { title: "Usuarios", url: "/app/users", icon: UserCog },
  ]
};

const ALL_CATEGORY_KEYS = [
  "Dashboard", "CRM & Leads", "Inventario & Vehículos", "Documentos", "Finanzas", "Sistema",
] as const;

export function AppSidebar() {
  const { state, setOpen } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { navigateWithLoading } = useNavigationWithLoading();
  const { theme, toggleTheme } = useTheme();
  const queryClient = useQueryClient();
  const { user, signOut } = useAuth();
  const currentPath = location.pathname + location.search;
  const isCollapsed = state === "collapsed";

  // Función para encontrar la categoría que contiene la ruta actual
  const findCategoryForPath = (path: string): string | null => {
    // Normalizar la ruta (sin query params para comparación)
    const basePath = path.split('?')[0];

    // Caso especial: ruta raíz "/app" debe coincidir exactamente con "/app"
    if (basePath === '/app' || basePath === '/app/') {
      return "Dashboard";
    }

    // Buscar en menuCategories
    for (const category of menuCategories) {
      if (category.items.some(item => {
        const itemBasePath = item.url.split('?')[0];
        // Verificar coincidencia exacta
        if (basePath === itemBasePath) {
          return true;
        }
        // Verificar si la ruta actual es una subruta (pero no para rutas exactas como /app)
        if (basePath.startsWith(itemBasePath + '/') && itemBasePath !== '/app') {
          return true;
        }
        return false;
      })) {
        return category.title;
      }
    }

    // Buscar en settingsCategory
    if (settingsCategory.items.some(item => {
      const itemBasePath = item.url.split('?')[0];
      return basePath === itemBasePath || (basePath.startsWith(itemBasePath + '/') && itemBasePath !== '/app');
    })) {
      return settingsCategory.title;
    }

    return null;
  };

  // Estado para controlar qué categorías están expandidas
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    "Dashboard": false,
    "CRM & Leads": false,
    "Inventario & Vehículos": true,
    "Documentos": false,
    "Finanzas": false,
    "Sistema": false,
  });

  // Efecto para expandir automáticamente la categoría de la ruta actual
  useEffect(() => {
    const categoryForCurrentPath = findCategoryForPath(currentPath);

    if (categoryForCurrentPath) {
      setExpandedCategories(prev => {
        // Solo actualizar si la categoría actual no está expandida
        if (prev[categoryForCurrentPath]) {
          return prev; // Ya está expandida, no hacer nada
        }

        // Colapsar todas las categorías y expandir solo la actual
        const updated: Record<string, boolean> = {
          "Dashboard": false,
          "CRM & Leads": false,
          "Inventario & Vehículos": false,
          "Documentos": false,
          "Finanzas": false,
          "Sistema": false,
        };

        updated[categoryForCurrentPath] = true;
        return updated;
      });
    }
  }, [currentPath]);

  const isActive = (path: string) => {
    if (path === "/") return currentPath === "/";

    // Manejar rutas con parámetros de query (solo para Post-Venta)
    if (path.includes('?')) {
      const [basePath, queryParams] = path.split('?');
      const [currentBasePath, currentQuery] = currentPath.split('?');

      // Si la ruta base coincide
      if (currentBasePath === basePath) {
        // Si hay parámetros de query, verificar que coincidan
        if (queryParams && currentQuery) {
          const expectedParam = queryParams.split('=')[1];
          return currentQuery.includes(expectedParam);
        }
        // Si no hay parámetros de query en la ruta actual, no activar
        return false;
      }
      return false;
    }

    // Para rutas sin query, activar si es una coincidencia exacta
    return currentPath === path;
  };

  const getNavCls = (isActiveState: boolean) => {
    if (isActiveState) {
      return "bg-gradient-to-r from-pink-500 to-pink-600 text-white font-semibold shadow-lg shadow-pink-500/25 border border-pink-500/40 dark:from-pink-500 dark:to-pink-600 dark:border-pink-400/30";
    }
    return [
      "text-slate-700 dark:text-zinc-200",
      "hover:text-slate-900 dark:hover:text-white",
      "hover:bg-gradient-to-r hover:from-slate-100 hover:to-slate-50",
      "dark:hover:from-zinc-800 dark:hover:to-zinc-800/90",
      "border border-transparent hover:border-slate-200 dark:hover:border-zinc-600/80",
      "transition-all duration-300 hover:shadow-md",
    ].join(" ");
  };

  const navIconCls = (active: boolean, withScale = true) =>
    active
      ? "text-white"
      : [
          "text-slate-600 dark:text-zinc-400",
          "group-hover:text-pink-600 dark:group-hover:text-pink-400",
          withScale ? "group-hover:scale-110" : "",
        ].filter(Boolean).join(" ");

  const navLabelCls = (active: boolean) =>
    active
      ? "text-white"
      : "text-slate-700 dark:text-zinc-200 group-hover:text-slate-900 dark:group-hover:text-white";

  const toggleCategory = (categoryTitle: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryTitle]: !prev[categoryTitle]
    }));
  };

  /** Al hacer clic en un icono con el sidebar acoplado: expandir sidebar, abrir solo esa categoría y navegar a la primera herramienta */
  const handleCollapsedCategoryClick = (category: { title: string; items: { url: string }[] }) => {
    setOpen(true);
    const next: Record<string, boolean> = {};
    ALL_CATEGORY_KEYS.forEach(k => { next[k] = k === category.title; });
    setExpandedCategories(next);
    navigateWithLoading(category.items[0].url);
  };

  const handleNavigation = (url: string) => {
    navigateWithLoading(url);
  };

  const prefetchLeads = useCallback(() => {
    import("@/pages/Leads");
    if (!user?.branch_id) return;
    queryClient.prefetchQuery({
      queryKey: ["leads", user.branch_id, undefined, undefined, undefined, undefined],
      queryFn: () => leadService.getAll({ branchId: user.branch_id }),
      staleTime: 5 * 60 * 1000,
    });
  }, [queryClient, user?.branch_id]);

  return (
    <TooltipProvider delayDuration={300}>
      <Sidebar
        className={`app-sidebar ${isCollapsed ? "w-14" : "w-64"} bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 border-r border-slate-200 dark:border-zinc-800 shadow-lg shadow-slate-200/50 dark:shadow-black/40 transition-[width] duration-200 ease-sidebar [box-shadow:2px_0_12px_-4px_rgba(0,0,0,0.08)] dark:[box-shadow:2px_0_16px_-4px_rgba(0,0,0,0.5)]`}
        collapsible="icon"
      >
        <SidebarHeader className="border-b border-slate-200 dark:border-zinc-800 p-3 bg-gradient-to-r from-slate-50 to-white dark:from-zinc-900 dark:to-zinc-900/95 transition-all duration-200 min-w-0 overflow-hidden shrink-0 flex-shrink-0">
          {!isCollapsed ? (
            <div className="flex items-center justify-between gap-2 min-w-0 w-full animate-in slide-in-from-left-2 duration-150 fade-in-0">
              <span className="skale-logo font-bold text-lg tracking-wide truncate min-w-0 flex-1 animate-in fade-in-0 duration-150 delay-75">
                SKALEMOTORS
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0 rounded-lg border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-100 hover:text-slate-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-amber-400 dark:hover:bg-zinc-700 dark:hover:text-amber-300"
                    onClick={toggleTheme}
                    aria-label={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
                  >
                    {theme === "dark" ? (
                      <Sun className="h-4 w-4" />
                    ) : (
                      <Moon className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700">
                  {theme === "dark" ? "Tema claro" : "Tema oscuro"}
                </TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 w-full animate-in slide-in-from-left-2 duration-150 fade-in-0">
              <span className="skale-logo font-bold text-lg tracking-wide">
                SK
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0 rounded-lg border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-amber-400 dark:hover:bg-zinc-700"
                    onClick={toggleTheme}
                    aria-label={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
                  >
                    {theme === "dark" ? (
                      <Sun className="h-3.5 w-3.5" />
                    ) : (
                      <Moon className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700">
                  {theme === "dark" ? "Tema claro" : "Tema oscuro"}
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </SidebarHeader>

        <SidebarContent className="group-data-[collapsible=icon]:overflow-y-auto">
          {menuCategories.map((category) => (
            <Collapsible
              key={category.title}
              open={expandedCategories[category.title]}
              onOpenChange={() => toggleCategory(category.title)}
            >
              <SidebarGroup>
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel
                    className="cursor-pointer transition-all duration-300 hover:bg-gradient-to-r hover:from-slate-100 hover:to-slate-50 dark:hover:from-zinc-800 dark:hover:to-zinc-800/80 rounded-lg mx-2 px-3 py-2 group hover:shadow-sm dark:hover:shadow-none group-data-[collapsible=icon]:!opacity-100 group-data-[collapsible=icon]:!mt-0 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:h-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:mx-0 group-data-[collapsible=icon]:px-1.5 group-data-[collapsible=icon]:min-w-0 group-data-[collapsible=icon]:w-full"
                    onClick={isCollapsed ? () => handleCollapsedCategoryClick(category) : undefined}
                  >
                    <div className="flex items-center justify-between w-full min-w-0 group-data-[collapsible=icon]:justify-center">
                      {isCollapsed ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center justify-center flex-shrink-0 group-data-[collapsible=icon]:flex">
                              <category.icon className="h-5 w-5 text-slate-600 dark:text-zinc-400 group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-all duration-200 group-hover:scale-110 shrink-0" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 border-slate-200 dark:border-zinc-700 shadow-lg animate-in fade-in-0 zoom-in-95 duration-200">
                            <p>{category.title}</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <>
                          <span className="font-bold text-xs tracking-wider uppercase text-slate-600 dark:text-zinc-300 group-hover:text-slate-800 dark:group-hover:text-zinc-100 transition-colors duration-200">
                            {category.title}
                          </span>
                          <div className="transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
                            {expandedCategories[category.title] ?
                              <ChevronDown className="h-4 w-4 text-slate-500 dark:text-zinc-500 group-hover:text-slate-700 dark:group-hover:text-zinc-300 transition-all duration-200" /> :
                              <ChevronRight className="h-4 w-4 text-slate-500 dark:text-zinc-500 group-hover:text-slate-700 dark:group-hover:text-zinc-300 transition-all duration-200" />
                            }
                          </div>
                        </>
                      )}
                    </div>
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                {!isCollapsed && (
                  <CollapsibleContent className="animate-in slide-in-from-top-2 duration-150 fade-in-0">
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {category.items.map((item, index) => {
                          const isLeadsItem = item.url === "/app/leads";
                          return (
                            <SidebarMenuItem key={item.title} className="animate-in slide-in-from-left-2 duration-150 fade-in-0" style={{ animationDelay: `${Math.min(index * 20, 120)}ms` }}>
                              <SidebarMenuButton asChild>
                                {item.url.includes('?') ? (
                                  <button
                                    onClick={() => handleNavigation(item.url)}
                                    className={`${getNavCls(isActive(item.url))} w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left mx-2 group transition-all duration-300 hover:scale-[1.02] hover:shadow-md active:scale-[0.98]`}
                                  >
                                    <item.icon className={`h-4 w-4 flex-shrink-0 transition-all duration-200 ${navIconCls(isActive(item.url))}`} />
                                    <span className={`font-medium text-sm transition-all duration-200 ${navLabelCls(isActive(item.url))}`}>
                                      {item.title}
                                    </span>
                                  </button>
                                ) : (
                                  <NavLink
                                    to={item.url}
                                    end={item.url === "/"}
                                    onMouseEnter={isLeadsItem ? prefetchLeads : undefined}
                                    onFocus={isLeadsItem ? prefetchLeads : undefined}
                                    onTouchStart={isLeadsItem ? prefetchLeads : undefined}
                                    className={`${getNavCls(isActive(item.url))} w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left mx-2 group transition-all duration-300 hover:scale-[1.02] hover:shadow-md active:scale-[0.98]`}
                                  >
                                    <item.icon className={`h-4 w-4 flex-shrink-0 transition-all duration-200 ${navIconCls(isActive(item.url))}`} />
                                    <span className={`font-medium text-sm transition-all duration-200 ${navLabelCls(isActive(item.url))}`}>
                                      {item.title}
                                    </span>
                                  </NavLink>
                                )}
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          )
                        })}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                )}
              </SidebarGroup>
            </Collapsible>
          ))}

          {/* Apartado Sistema - Colapsible */}
          <Collapsible
            open={expandedCategories["Sistema"]}
            onOpenChange={() => toggleCategory("Sistema")}
          >
            <SidebarGroup>
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel
                  className="cursor-pointer transition-all duration-300 hover:bg-gradient-to-r hover:from-slate-100 hover:to-slate-50 dark:hover:from-zinc-800 dark:hover:to-zinc-800/80 rounded-lg mx-2 px-3 py-2 group hover:shadow-sm dark:hover:shadow-none group-data-[collapsible=icon]:!opacity-100 group-data-[collapsible=icon]:!mt-0 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:h-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:mx-0 group-data-[collapsible=icon]:px-1.5 group-data-[collapsible=icon]:min-w-0 group-data-[collapsible=icon]:w-full"
                  onClick={isCollapsed ? () => handleCollapsedCategoryClick(settingsCategory) : undefined}
                >
                  <div className="flex items-center justify-between w-full min-w-0 group-data-[collapsible=icon]:justify-center">
                    {isCollapsed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center justify-center flex-shrink-0 group-data-[collapsible=icon]:flex">
                            <settingsCategory.icon className="h-5 w-5 text-slate-600 dark:text-zinc-400 group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-all duration-200 group-hover:scale-110 shrink-0" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 border-slate-200 dark:border-zinc-700 shadow-lg animate-in fade-in-0 zoom-in-95 duration-200">
                          <p>{settingsCategory.title}</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <>
                        <span className="font-bold text-xs tracking-wider uppercase text-slate-600 dark:text-zinc-300 group-hover:text-slate-800 dark:group-hover:text-zinc-100 transition-colors duration-200">
                          {settingsCategory.title}
                        </span>
                        <div className="transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
                          {expandedCategories["Sistema"] ?
                            <ChevronDown className="h-4 w-4 text-slate-500 dark:text-zinc-500 group-hover:text-slate-700 dark:group-hover:text-zinc-300 transition-all duration-200" /> :
                            <ChevronRight className="h-4 w-4 text-slate-500 dark:text-zinc-500 group-hover:text-slate-700 dark:group-hover:text-zinc-300 transition-all duration-200" />
                          }
                        </div>
                      </>
                    )}
                  </div>
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              {!isCollapsed && (
                <CollapsibleContent className="animate-in slide-in-from-top-2 duration-150 fade-in-0">
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {settingsCategory.items.map((item, index) => (
                        <SidebarMenuItem key={item.title} className="animate-in slide-in-from-left-2 duration-150 fade-in-0" style={{ animationDelay: `${Math.min(index * 20, 120)}ms` }}>
                          <SidebarMenuButton asChild>
                            {item.url.includes('?') ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => handleNavigation(item.url)}
                                    className={`${getNavCls(isActive(item.url))} w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left mx-2 group transition-all duration-300 hover:scale-[1.02] hover:shadow-md active:scale-[0.98]`}
                                  >
                                    <item.icon className={`h-4 w-4 flex-shrink-0 transition-colors ${navIconCls(isActive(item.url), false)}`} />
                                    {!isCollapsed && (
                                      <span className={`font-medium text-sm transition-colors ${navLabelCls(isActive(item.url))}`}>
                                        {item.title}
                                      </span>
                                    )}
                                  </button>
                                </TooltipTrigger>
                                {isCollapsed && (
                                  <TooltipContent side="right" className="bg-slate-800 text-white border-slate-600">
                                    <p>{item.title}</p>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            ) : (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <NavLink
                                    to={item.url}
                                    className={`${getNavCls(isActive(item.url))} w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left mx-2 group transition-all duration-300 hover:scale-[1.02] hover:shadow-md active:scale-[0.98]`}
                                  >
                                    <item.icon className={`h-4 w-4 flex-shrink-0 transition-colors ${navIconCls(isActive(item.url), false)}`} />
                                    {!isCollapsed && (
                                      <span className={`font-medium text-sm transition-colors ${navLabelCls(isActive(item.url))}`}>
                                        {item.title}
                                      </span>
                                    )}
                                  </NavLink>
                                </TooltipTrigger>
                                {isCollapsed && (
                                  <TooltipContent side="right" className="bg-slate-800 text-white border-slate-600">
                                    <p>{item.title}</p>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            )}
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              )}
            </SidebarGroup>
          </Collapsible>
        </SidebarContent>

        {/* Footer con información del usuario */}
        <SidebarFooter className="border-t border-slate-200 dark:border-zinc-800 p-4 group-data-[collapsible=icon]:p-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800/70 transition-colors group group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:min-w-0">
                <Avatar className="h-8 w-8 shrink-0">
                  <ProfileAvatarImage avatarUrl={user?.avatar_url} size={64} cacheKey={user?.updated_at} />
                  <AvatarFallback className="bg-gradient-to-br from-pink-500 to-pink-700 text-white text-sm font-semibold">
                    {user?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                {!isCollapsed && (
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-zinc-100 truncate">
                      {user?.full_name || 'Usuario'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                      {user?.email || 'usuario@ejemplo.com'}
                    </p>
                  </div>
                )}
                <MoreVertical className="h-4 w-4 text-slate-500 dark:text-zinc-500 group-hover:text-slate-700 dark:group-hover:text-zinc-300 shrink-0 group-data-[collapsible=icon]:hidden" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 shadow-lg">
              {/* Mi Cuenta */}
              <div className="px-3 py-2">
                <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100">Mi Cuenta</p>
              </div>
              <DropdownMenuItem
                className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800 focus:bg-slate-50 dark:focus:bg-zinc-800"
                onClick={() => navigate('/app/profile')}
              >
                <UserCircle className="h-4 w-4 text-slate-600 dark:text-zinc-400" />
                <span className="text-sm text-slate-700 dark:text-zinc-200">Perfil</span>
                <div className="ml-auto text-xs text-slate-400 dark:text-zinc-500">⇧⌘P</div>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800 focus:bg-slate-50 dark:focus:bg-zinc-800"
                onClick={() => navigate('/app/billing')}
              >
                <BillingIcon className="h-4 w-4 text-slate-600 dark:text-zinc-400" />
                <span className="text-sm text-slate-700 dark:text-zinc-200">Facturación</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800 focus:bg-slate-50 dark:focus:bg-zinc-800"
                onClick={() => navigate('/app/settings')}
              >
                <Settings className="h-4 w-4 text-slate-600 dark:text-zinc-400" />
                <span className="text-sm text-slate-700 dark:text-zinc-200">Configuración</span>
                <div className="ml-auto text-xs text-slate-400 dark:text-zinc-500">⌘S</div>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800 focus:bg-slate-50 dark:focus:bg-zinc-800"
                onClick={() => {
                  // Aquí podrías abrir un modal con atajos de teclado
                  toast({
                    title: "Atajos de teclado",
                    description: "Funcionalidad en desarrollo",
                  });
                }}
              >
                <Keyboard className="h-4 w-4 text-slate-600 dark:text-zinc-400" />
                <span className="text-sm text-slate-700 dark:text-zinc-200">Atajos de teclado</span>
                <div className="ml-auto text-xs text-slate-400 dark:text-zinc-500">⌘K</div>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {/* Equipo */}
              <div className="px-3 py-2">
                <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100">Equipo</p>
              </div>
              <DropdownMenuItem
                className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800 focus:bg-slate-50 dark:focus:bg-zinc-800"
                onClick={() => navigate('/app/users')}
              >
                <Users className="h-4 w-4 text-slate-600 dark:text-zinc-400" />
                <span className="text-sm text-slate-700 dark:text-zinc-200">Invitar usuarios</span>
                <ArrowRight className="h-4 w-4 text-slate-400 dark:text-zinc-500 ml-auto" />
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800 focus:bg-slate-50 dark:focus:bg-zinc-800"
                onClick={() => {
                  toast({
                    title: "Nuevo Equipo",
                    description: "Funcionalidad en desarrollo",
                  });
                }}
              >
                <Plus className="h-4 w-4 text-slate-600 dark:text-zinc-400" />
                <span className="text-sm text-slate-700 dark:text-zinc-200">Nuevo Equipo</span>
                <div className="ml-auto text-xs text-slate-400 dark:text-zinc-500">⌘+T</div>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {/* Cerrar Sesión */}
              <DropdownMenuItem
                className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400"
                onClick={() => {
                  if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
                    signOut();
                    navigate('/login');
                  }
                }}
              >
                <LogOut className="h-4 w-4" />
                <span className="text-sm">Cerrar Sesión</span>
                <div className="ml-auto text-xs text-red-400">⇧⌘Q</div>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {/* Información del usuario */}
              <div className="px-3 py-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <ProfileAvatarImage avatarUrl={user?.avatar_url} size={64} cacheKey={user?.updated_at} />
                    <AvatarFallback className="bg-gradient-to-br from-pink-500 to-pink-700 text-white text-sm font-semibold">
                      {user?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-800 dark:text-zinc-100">
                      {user?.full_name || 'Usuario'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      {user?.email || 'usuario@ejemplo.com'}
                    </p>
                  </div>
                  <MoreVertical className="h-4 w-4 text-slate-400 dark:text-zinc-500" />
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>
    </TooltipProvider>
  );
}
