import { useTheme } from "@/contexts/ThemeContext";
import { useNavigationWithLoading } from "@/hooks/useNavigationWithLoading";
import { leadService } from "@/lib/services/leads";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  Award,
  BarChart3,
  Bell,
  CreditCard as BillingIcon,
  Brain,
  Calculator,
  Calendar,
  Car,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  DollarSign,
  FileText,
  Globe,
  Heart,
  Keyboard,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  MoreVertical,
  Package,
  Phone,
  PieChart,
  Plug,
  Plus,
  Receipt,
  RefreshCw,
  Settings,
  Target,
  TrendingUp,
  UserCheck,
  UserCircle,
  UserCog,
  Users
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

// Categorías organizadas del menú
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
    title: "CRM",
    icon: Target,
    items: [
      { title: "CRM", url: "/app/crm", icon: Target },
      { title: "Mensajes", url: "/app/messages", icon: MessageCircle },
      { title: "Leads", url: "/app/leads", icon: Users },
    ]
  },
  {
    title: "Inventario & Vehículos",
    icon: Car,
    items: [
      { title: "Inventario", url: "/app/inventory", icon: Car },
      { title: "Consignaciones", url: "/app/consignaciones", icon: ClipboardList },
      { title: "Inventario Avanzado", url: "/app/inventory-advanced", icon: Activity },
      { title: "Publicaciones", url: "/app/listings", icon: Globe },
    ]
  },
  {
    title: "Operaciones",
    icon: Settings,
    items: [
      { title: "Llamadas", url: "/app/calls", icon: Phone },
      { title: "Citas", url: "/app/appointments", icon: Calendar },
      { title: "Cotizaciones", url: "/app/quotes", icon: FileText },
      { title: "Trámites", url: "/app/tramites", icon: ClipboardCheck },
      { title: "Permutas", url: "/app/tradein", icon: RefreshCw },
      { title: "Entregas", url: "/app/deliveries", icon: Package },
    ]
  },
  {
    title: "Finanzas",
    icon: DollarSign,
    items: [
      { title: "Gastos/Ingresos", url: "/app/finance", icon: Receipt },
      { title: "Ventas", url: "/app/sales", icon: TrendingUp },
      { title: "Vendedores", url: "/app/vendors", icon: UserCheck },
      { title: "Seguimiento Financiero", url: "/app/financial-tracking", icon: DollarSign },
      { title: "Calculadora Financiera", url: "/app/financial-calculator", icon: Calculator },
      { title: "Facturación Electrónica", url: "/app/billing", icon: BillingIcon },
    ]
  },
  {
    title: "Post-Venta & Servicios",
    icon: Award,
    items: [
      { title: "CRM Post-Venta", url: "/app/post-sale", icon: Award },
      { title: "Facturación Servicios", url: "/app/post-sale?tab=billing", icon: Receipt },
      { title: "Fidelización", url: "/app/loyalty", icon: Heart },
    ]
  },
  {
    title: "Analytics & Herramientas",
    icon: BarChart3,
    items: [
      { title: "Reportes", url: "/app/reports", icon: PieChart },
      { title: "Alertas", url: "/app/alerts", icon: Bell },
      { title: "Meta ADS", url: "/app/studio-ia/marketing/facebook-ads", icon: BarChart3 },
      { title: "Studio IA", url: "/app/studio-ia", icon: Brain },
    ]
  }
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
  "Dashboard", "CRM", "Inventario & Vehículos", "Operaciones",
  "Finanzas", "Post-Venta & Servicios", "Analytics & Herramientas", "Sistema",
] as const;

export function AppSidebar() {
  const { state, setOpen } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { navigateWithLoading } = useNavigationWithLoading();
  const { theme } = useTheme();
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
  // Inicializar todas como false
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    "Dashboard": false,
    "CRM": false,
    "Inventario & Vehículos": false,
    "Operaciones": false,
    "Finanzas": false,
    "Post-Venta & Servicios": false,
    "Analytics & Herramientas": false,
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
          "CRM": false,
          "Inventario & Vehículos": false,
          "Operaciones": false,
          "Finanzas": false,
          "Post-Venta & Servicios": false,
          "Analytics & Herramientas": false,
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
      return "bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold shadow-lg shadow-blue-500/25 border border-blue-500/30";
    }

    return "text-slate-700 hover:text-slate-900 hover:bg-gradient-to-r hover:from-slate-100 hover:to-slate-50 transition-all duration-300 hover:shadow-md hover:border hover:border-slate-200";
  };

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
        className={`${isCollapsed ? "w-14" : "w-64"} bg-gradient-to-b from-slate-50 via-white to-slate-50 border-r border-slate-200 shadow-lg transition-[width] duration-200 ease-sidebar`}
        collapsible="icon"
      >
        <SidebarHeader className="border-b border-slate-200 p-3 bg-gradient-to-r from-slate-50 to-white transition-all duration-200 min-w-0 overflow-hidden">
          {!isCollapsed ? (
            <div className="flex items-center gap-2 min-w-0 w-full animate-in slide-in-from-left-2 duration-150 fade-in-0">
              <div className="w-8 h-8 shrink-0 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg hover:scale-110 transition-transform duration-200">
                <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <span className="skale-logo text-slate-800 font-bold text-lg tracking-wide truncate min-w-0 animate-in fade-in-0 duration-150 delay-75">
                SKALEMOTORS
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-center w-full animate-in slide-in-from-left-2 duration-150 fade-in-0">
              <div className="w-8 h-8 shrink-0 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg hover:scale-110 transition-transform duration-200">
                <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
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
                    className="cursor-pointer transition-all duration-300 hover:bg-gradient-to-r hover:from-slate-100 hover:to-slate-50 rounded-lg mx-2 px-3 py-2 group hover:shadow-sm group-data-[collapsible=icon]:!opacity-100 group-data-[collapsible=icon]:!mt-0 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:h-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:mx-0 group-data-[collapsible=icon]:px-1.5 group-data-[collapsible=icon]:min-w-0 group-data-[collapsible=icon]:w-full"
                    onClick={isCollapsed ? () => handleCollapsedCategoryClick(category) : undefined}
                  >
                    <div className="flex items-center justify-between w-full min-w-0 group-data-[collapsible=icon]:justify-center">
                      {isCollapsed ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center justify-center flex-shrink-0 group-data-[collapsible=icon]:flex">
                              <category.icon className="h-5 w-5 text-slate-600 group-hover:text-blue-600 transition-all duration-200 group-hover:scale-110 shrink-0" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="bg-white text-slate-800 border-slate-200 shadow-lg animate-in fade-in-0 zoom-in-95 duration-200">
                            <p>{category.title}</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <>
                          <span className="font-bold text-xs tracking-wider uppercase text-slate-600 group-hover:text-slate-800 transition-colors duration-200">
                            {category.title}
                          </span>
                          <div className="transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
                            {expandedCategories[category.title] ?
                              <ChevronDown className="h-4 w-4 text-slate-500 group-hover:text-slate-700 transition-all duration-200" /> :
                              <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-slate-700 transition-all duration-200" />
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
                                    <item.icon className={`h-4 w-4 flex-shrink-0 transition-all duration-200 ${isActive(item.url) ? 'text-white' : 'text-slate-600 group-hover:text-blue-600 group-hover:scale-110'
                                      }`} />
                                    <span className={`font-medium text-sm transition-all duration-200 ${isActive(item.url) ? 'text-white' : 'text-slate-700 group-hover:text-slate-900'
                                      }`}>
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
                                    <item.icon className={`h-4 w-4 flex-shrink-0 transition-all duration-200 ${isActive(item.url) ? 'text-white' : 'text-slate-600 group-hover:text-blue-600 group-hover:scale-110'
                                      }`} />
                                    <span className={`font-medium text-sm transition-all duration-200 ${isActive(item.url) ? 'text-white' : 'text-slate-700 group-hover:text-slate-900'
                                      }`}>
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
                  className="cursor-pointer transition-all duration-300 hover:bg-gradient-to-r hover:from-slate-100 hover:to-slate-50 rounded-lg mx-2 px-3 py-2 group hover:shadow-sm group-data-[collapsible=icon]:!opacity-100 group-data-[collapsible=icon]:!mt-0 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:h-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:mx-0 group-data-[collapsible=icon]:px-1.5 group-data-[collapsible=icon]:min-w-0 group-data-[collapsible=icon]:w-full"
                  onClick={isCollapsed ? () => handleCollapsedCategoryClick(settingsCategory) : undefined}
                >
                  <div className="flex items-center justify-between w-full min-w-0 group-data-[collapsible=icon]:justify-center">
                    {isCollapsed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center justify-center flex-shrink-0 group-data-[collapsible=icon]:flex">
                            <settingsCategory.icon className="h-5 w-5 text-slate-600 group-hover:text-blue-600 transition-all duration-200 group-hover:scale-110 shrink-0" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="bg-white text-slate-800 border-slate-200 shadow-lg animate-in fade-in-0 zoom-in-95 duration-200">
                          <p>{settingsCategory.title}</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <>
                        <span className="font-bold text-xs tracking-wider uppercase text-slate-600 group-hover:text-slate-800 transition-colors duration-200">
                          {settingsCategory.title}
                        </span>
                        <div className="transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
                          {expandedCategories["Sistema"] ?
                            <ChevronDown className="h-4 w-4 text-slate-500 group-hover:text-slate-700 transition-all duration-200" /> :
                            <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-slate-700 transition-all duration-200" />
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
                                    <item.icon className={`h-4 w-4 flex-shrink-0 transition-colors ${isActive(item.url) ? 'text-white' : 'text-slate-600 group-hover:text-blue-600'
                                      }`} />
                                    {!isCollapsed && (
                                      <span className={`font-medium text-sm transition-colors ${isActive(item.url) ? 'text-white' : 'text-slate-700 group-hover:text-slate-900'
                                        }`}>
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
                                    <item.icon className={`h-4 w-4 flex-shrink-0 transition-colors ${isActive(item.url) ? 'text-white' : 'text-slate-600 group-hover:text-blue-600'
                                      }`} />
                                    {!isCollapsed && (
                                      <span className={`font-medium text-sm transition-colors ${isActive(item.url) ? 'text-white' : 'text-slate-700 group-hover:text-slate-900'
                                        }`}>
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
        <SidebarFooter className="border-t border-slate-200 p-4 group-data-[collapsible=icon]:p-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100 transition-colors group group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:min-w-0">
                <Avatar className="h-8 w-8 shrink-0">
                  <ProfileAvatarImage avatarUrl={user?.avatar_url} size={64} cacheKey={user?.updated_at} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-sm font-semibold">
                    {user?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                {!isCollapsed && (
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {user?.full_name || 'Usuario'}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {user?.email || 'usuario@ejemplo.com'}
                    </p>
                  </div>
                )}
                <MoreVertical className="h-4 w-4 text-slate-500 group-hover:text-slate-700 shrink-0 group-data-[collapsible=icon]:hidden" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 bg-white border border-slate-200 shadow-lg">
              {/* Mi Cuenta */}
              <div className="px-3 py-2">
                <p className="text-sm font-semibold text-slate-800">Mi Cuenta</p>
              </div>
              <DropdownMenuItem
                className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50"
                onClick={() => navigate('/app/profile')}
              >
                <UserCircle className="h-4 w-4 text-slate-600" />
                <span className="text-sm text-slate-700">Perfil</span>
                <div className="ml-auto text-xs text-slate-400">⇧⌘P</div>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50"
                onClick={() => navigate('/app/billing')}
              >
                <BillingIcon className="h-4 w-4 text-slate-600" />
                <span className="text-sm text-slate-700">Facturación</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50"
                onClick={() => navigate('/app/settings')}
              >
                <Settings className="h-4 w-4 text-slate-600" />
                <span className="text-sm text-slate-700">Configuración</span>
                <div className="ml-auto text-xs text-slate-400">⌘S</div>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50"
                onClick={() => {
                  // Aquí podrías abrir un modal con atajos de teclado
                  toast({
                    title: "Atajos de teclado",
                    description: "Funcionalidad en desarrollo",
                  });
                }}
              >
                <Keyboard className="h-4 w-4 text-slate-600" />
                <span className="text-sm text-slate-700">Atajos de teclado</span>
                <div className="ml-auto text-xs text-slate-400">⌘K</div>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {/* Equipo */}
              <div className="px-3 py-2">
                <p className="text-sm font-semibold text-slate-800">Equipo</p>
              </div>
              <DropdownMenuItem
                className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50"
                onClick={() => navigate('/app/users')}
              >
                <Users className="h-4 w-4 text-slate-600" />
                <span className="text-sm text-slate-700">Invitar usuarios</span>
                <ArrowRight className="h-4 w-4 text-slate-400 ml-auto" />
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50"
                onClick={() => {
                  toast({
                    title: "Nuevo Equipo",
                    description: "Funcionalidad en desarrollo",
                  });
                }}
              >
                <Plus className="h-4 w-4 text-slate-600" />
                <span className="text-sm text-slate-700">Nuevo Equipo</span>
                <div className="ml-auto text-xs text-slate-400">⌘+T</div>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {/* Cerrar Sesión */}
              <DropdownMenuItem
                className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-red-50 text-red-600"
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
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-sm font-semibold">
                      {user?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-800">
                      {user?.full_name || 'Usuario'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {user?.email || 'usuario@ejemplo.com'}
                    </p>
                  </div>
                  <MoreVertical className="h-4 w-4 text-slate-400" />
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>
    </TooltipProvider>
  );
}
