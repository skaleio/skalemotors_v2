import { useNavigationWithLoading } from "@/hooks/useNavigationWithLoading";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
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
  DollarSign,
  FileText,
  Keyboard,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MoreVertical,
  PieChart,
  Pin,
  PinOff,
  Plug,
  Plus,
  Receipt,
  ScrollText,
  Settings,
  Target,
  TrendingUp,
  Trophy,
  UserCheck,
  UserCircle,
  UserCog,
  Users,
  Wallet
} from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import { ProfileAvatarImage } from "@/components/ProfileAvatarImage";
import { SidebarSalesRanking } from "@/components/SidebarSalesRanking";
import { SidebarConsignacionesRanking } from "@/components/SidebarConsignacionesRanking";
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
import { cn } from "@/lib/utils";

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
      { title: "Tareas", url: "/app/tasks", icon: ListChecks },
      { title: "Ranking Vendedores", url: "/app/ranking", icon: Trophy },
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

const itemBaseCls = "group w-full flex items-center gap-2.5 h-8 px-3 text-sm rounded-md border-l-2 border-transparent transition-colors";
const itemInactiveCls = "text-muted-foreground hover:text-foreground hover:bg-accent/40";
const itemActiveCls = "text-accent-foreground bg-accent border-l-2 border-primary font-medium";

const PIN_STORAGE_KEY = "skale-sidebar-pinned";
const HOVER_CLOSE_DELAY_MS = 200;

export function AppSidebar() {
  const { state, setOpen, isMobile } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { navigateWithLoading } = useNavigationWithLoading();
  const queryClient = useQueryClient();
  const { user, signOut } = useAuth();
  const { confirm: askConfirm, ConfirmDialog } = useConfirmDialog();
  const currentPath = location.pathname + location.search;
  const isCollapsed = state === "collapsed";

  const isVendorOnly = user?.role === "vendedor";

  /* Pin / hover-overlay: en desktop el sidebar puede estar 'pinned' (fijo
     expandido como hoy) o 'unpinned' (colapsado por default; al pasar el
     mouse se despliega como overlay flotante sin empujar el contenido).
     El estado persiste en localStorage. En mobile se ignora todo esto y
     queda el sheet/drawer de shadcn. */
  const [pinned, setPinned] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const stored = window.localStorage.getItem(PIN_STORAGE_KEY);
    return stored === null ? true : stored !== "false";
  });
  const [hovering, setHovering] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persistir pin en localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PIN_STORAGE_KEY, String(pinned));
    }
  }, [pinned]);

  // Sincronizar el state interno del SidebarProvider con pinned/hovering.
  // En mobile no aplicamos (lo maneja el sheet).
  useEffect(() => {
    if (isMobile) return;
    if (pinned) {
      setOpen(true);
    } else {
      setOpen(hovering);
    }
  }, [pinned, hovering, isMobile, setOpen]);

  // Cleanup del timer al desmontar
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  const handleMouseEnter = () => {
    if (pinned || isMobile) return;
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setHovering(true);
  };

  const handleMouseLeave = () => {
    if (pinned || isMobile) return;
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => setHovering(false), HOVER_CLOSE_DELAY_MS);
  };

  /** Overlay activo: sidebar flotando sobre el contenido (no en flow). */
  const isOverlay = !isMobile && !pinned && hovering;

  const categoriesToShow = useMemo(() => {
    if (isVendorOnly) {
      return menuCategories
        .map((c) => {
          if (c.title === "CRM & Leads") {
            const items = c.items.filter((item) => item.url !== "/app/ranking");
            return { ...c, items };
          }
          if (c.title === "Inventario & Vehículos") {
            const items = c.items.filter((item) => item.url === "/app/consignaciones");
            return items.length ? { ...c, items } : null;
          }
          return null;
        })
        .filter((c): c is (typeof menuCategories)[number] => c !== null);
    }
    return menuCategories;
  }, [isVendorOnly]);

  const findCategoryForPath = (path: string): string | null => {
    const basePath = path.split('?')[0];

    if (basePath === '/app' || basePath === '/app/') {
      return "Dashboard";
    }

    for (const category of categoriesToShow) {
      if (category.items.some(item => {
        const itemBasePath = item.url.split('?')[0];
        if (basePath === itemBasePath) return true;
        if (basePath.startsWith(itemBasePath + '/') && itemBasePath !== '/app') return true;
        return false;
      })) {
        return category.title;
      }
    }

    if (isVendorOnly) return null;

    if (settingsCategory.items.some(item => {
      const itemBasePath = item.url.split('?')[0];
      return basePath === itemBasePath || (basePath.startsWith(itemBasePath + '/') && itemBasePath !== '/app');
    })) {
      return settingsCategory.title;
    }

    return null;
  };

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    "Dashboard": false,
    "CRM & Leads": false,
    "Inventario & Vehículos": true,
    "Documentos": false,
    "Finanzas": false,
    "Sistema": false,
  });

  useEffect(() => {
    const categoryForCurrentPath = findCategoryForPath(currentPath);

    if (categoryForCurrentPath) {
      setExpandedCategories(prev => {
        if (prev[categoryForCurrentPath]) return prev;

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

    if (path.includes('?')) {
      const [basePath, queryParams] = path.split('?');
      const [currentBasePath, currentQuery] = currentPath.split('?');

      if (currentBasePath === basePath) {
        if (queryParams && currentQuery) {
          const expectedParam = queryParams.split('=')[1];
          return currentQuery.includes(expectedParam);
        }
        return false;
      }
      return false;
    }

    return currentPath === path;
  };

  const toggleCategory = (categoryTitle: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryTitle]: !prev[categoryTitle]
    }));
  };

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

  const renderItem = (item: { title: string; url: string; icon: typeof LayoutDashboard }) => {
    const active = isActive(item.url);
    const cls = cn(itemBaseCls, active ? itemActiveCls : itemInactiveCls);
    const isLeadsItem = item.url === "/app/leads";

    const content = (
      <>
        <item.icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
        <span className="truncate">{item.title}</span>
      </>
    );

    if (item.url.includes('?')) {
      return (
        <button onClick={() => handleNavigation(item.url)} className={cls}>
          {content}
        </button>
      );
    }

    return (
      <NavLink
        to={item.url}
        end={item.url === "/"}
        onMouseEnter={isLeadsItem ? prefetchLeads : undefined}
        onFocus={isLeadsItem ? prefetchLeads : undefined}
        onTouchStart={isLeadsItem ? prefetchLeads : undefined}
        className={cls}
      >
        {content}
      </NavLink>
    );
  };

  const renderCategoryLabel = (title: string, Icon: typeof LayoutDashboard, isOpen: boolean, onClick?: () => void) => {
    if (isCollapsed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center justify-center w-full">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">{title}</TooltipContent>
        </Tooltip>
      );
    }
    return (
      <div className="flex items-center justify-between w-full" onClick={onClick}>
        <span className="text-[11px] font-medium tracking-wider uppercase text-muted-foreground">
          {title}
        </span>
        {isOpen ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </div>
    );
  };

  return (
    <>
      {ConfirmDialog}
    <TooltipProvider delayDuration={300}>
      <Sidebar
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          "app-sidebar bg-sidebar border-r border-sidebar-border transition-[width] duration-200 ease-sidebar",
          isCollapsed ? "w-14" : "w-60",
          // Overlay mode: sidebar flota sobre el contenido sin empujarlo.
          isOverlay && "!fixed !inset-y-0 !left-0 !z-50 !w-60 shadow-2xl shadow-black/20",
        )}
        collapsible="icon"
      >
        <SidebarHeader className="border-b border-sidebar-border h-14 px-3 flex items-center justify-center shrink-0">
          <button
            type="button"
            onClick={() => navigate('/app')}
            className="skale-logo whitespace-nowrap"
            aria-label="Ir al dashboard"
          >
            {isCollapsed ? "SK" : "SKALEMOTORS"}
          </button>
        </SidebarHeader>

        <SidebarContent className="px-2 py-3 group-data-[collapsible=icon]:overflow-y-auto">
          {isCollapsed ? (
            // === MODO COLAPSADO: cada item con su icono y tooltip, divisores entre secciones ===
            <SidebarMenu className="gap-0.5">
              {categoriesToShow.map((category, ci) => (
                <Fragment key={category.title}>
                  {ci > 0 && <div className="h-px bg-sidebar-border mx-2 my-1.5" aria-hidden="true" />}
                  {category.items.map((item) => {
                    const active = isActive(item.url);
                    const isLeads = item.url === "/app/leads";
                    return (
                      <SidebarMenuItem key={item.title}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <NavLink
                              to={item.url}
                              end={item.url === "/"}
                              onMouseEnter={isLeads ? prefetchLeads : undefined}
                              className={cn(
                                "group flex items-center justify-center h-9 w-full rounded-md border-l-2 transition-colors",
                                active
                                  ? "border-primary bg-accent text-primary"
                                  : "border-transparent text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                              )}
                            >
                              <item.icon className="h-4 w-4 shrink-0" />
                            </NavLink>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="text-xs">{item.title}</TooltipContent>
                        </Tooltip>
                      </SidebarMenuItem>
                    );
                  })}
                </Fragment>
              ))}
              {!isVendorOnly && (
                <>
                  <div className="h-px bg-sidebar-border mx-2 my-1.5" aria-hidden="true" />
                  {settingsCategory.items.map((item) => {
                    const active = isActive(item.url);
                    return (
                      <SidebarMenuItem key={item.title}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <NavLink
                              to={item.url}
                              className={cn(
                                "flex items-center justify-center h-9 w-full rounded-md border-l-2 transition-colors",
                                active
                                  ? "border-primary bg-accent text-primary"
                                  : "border-transparent text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                              )}
                            >
                              <item.icon className="h-4 w-4 shrink-0" />
                            </NavLink>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="text-xs">{item.title}</TooltipContent>
                        </Tooltip>
                      </SidebarMenuItem>
                    );
                  })}
                </>
              )}
              {isVendorOnly && <SidebarSalesRanking collapsed />}
              {isVendorOnly && <SidebarConsignacionesRanking collapsed />}
            </SidebarMenu>
          ) : (
            // === MODO EXPANDIDO: categorías con Collapsible ===
            <>
              {categoriesToShow.map((category) => (
                <Collapsible
                  key={category.title}
                  open={expandedCategories[category.title]}
                  onOpenChange={() => toggleCategory(category.title)}
                >
                  <SidebarGroup className="py-1">
                    <CollapsibleTrigger asChild>
                      <SidebarGroupLabel className="cursor-pointer rounded-md px-2 py-1.5 transition-colors hover:bg-accent/30">
                        {renderCategoryLabel(category.title, category.icon, expandedCategories[category.title])}
                      </SidebarGroupLabel>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="animate-in slide-in-from-top-1 duration-150 fade-in-0">
                      <SidebarGroupContent>
                        <SidebarMenu className="gap-0.5 pt-1">
                          {category.items.map((item) => (
                            <SidebarMenuItem key={item.title}>
                              <SidebarMenuButton asChild>
                                {renderItem(item)}
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          ))}
                        </SidebarMenu>
                      </SidebarGroupContent>
                    </CollapsibleContent>
                  </SidebarGroup>
                </Collapsible>
              ))}

              {!isVendorOnly ? (
                <Collapsible
                  open={expandedCategories["Sistema"]}
                  onOpenChange={() => toggleCategory("Sistema")}
                >
                  <SidebarGroup className="py-1">
                    <CollapsibleTrigger asChild>
                      <SidebarGroupLabel className="cursor-pointer rounded-md px-2 py-1.5 transition-colors hover:bg-accent/30">
                        {renderCategoryLabel(settingsCategory.title, settingsCategory.icon, expandedCategories["Sistema"])}
                      </SidebarGroupLabel>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="animate-in slide-in-from-top-1 duration-150 fade-in-0">
                      <SidebarGroupContent>
                        <SidebarMenu className="gap-0.5 pt-1">
                          {settingsCategory.items.map((item) => (
                            <SidebarMenuItem key={item.title}>
                              <SidebarMenuButton asChild>
                                {renderItem(item)}
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          ))}
                        </SidebarMenu>
                      </SidebarGroupContent>
                    </CollapsibleContent>
                  </SidebarGroup>
                </Collapsible>
              ) : null}

              {isVendorOnly && <SidebarSalesRanking collapsed={false} />}
              {isVendorOnly && <SidebarConsignacionesRanking collapsed={false} />}
            </>
          )}
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border p-2 group-data-[collapsible=icon]:p-2">
          <div className="flex items-center gap-1 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex-1 min-w-0 flex items-center gap-2.5 p-2 rounded-md hover:bg-accent/40 transition-colors group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-1.5">
                <Avatar className="h-7 w-7 shrink-0">
                  <ProfileAvatarImage avatarUrl={user?.avatar_url} size={28} cacheKey={user?.updated_at} priority="high" />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                    {user?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                {!isCollapsed && (
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {user?.full_name || 'Usuario'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user?.email || ''}
                    </p>
                  </div>
                )}
                <MoreVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0 group-data-[collapsible=icon]:hidden" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <div className="px-2 py-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mi cuenta</p>
              </div>
              <DropdownMenuItem onClick={() => navigate('/app/profile')}>
                <UserCircle className="h-4 w-4 mr-2" />
                <span>Perfil</span>
                <span className="ml-auto text-xs text-muted-foreground">⇧⌘P</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/app/billing')}>
                <BillingIcon className="h-4 w-4 mr-2" />
                <span>Facturación</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/app/settings')}>
                <Settings className="h-4 w-4 mr-2" />
                <span>Configuración</span>
                <span className="ml-auto text-xs text-muted-foreground">⌘S</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => toast({ title: "Atajos de teclado", description: "Funcionalidad en desarrollo" })}
              >
                <Keyboard className="h-4 w-4 mr-2" />
                <span>Atajos de teclado</span>
                <span className="ml-auto text-xs text-muted-foreground">⌘K</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <div className="px-2 py-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Equipo</p>
              </div>
              <DropdownMenuItem onClick={() => navigate('/app/users')}>
                <Users className="h-4 w-4 mr-2" />
                <span>Invitar usuarios</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => toast({ title: "Nuevo Equipo", description: "Funcionalidad en desarrollo" })}
              >
                <Plus className="h-4 w-4 mr-2" />
                <span>Nuevo equipo</span>
                <span className="ml-auto text-xs text-muted-foreground">⌘+T</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                onSelect={(e) => {
                  e.preventDefault();
                  void (async () => {
                    const ok = await askConfirm({
                      title: "¿Cerrar sesión?",
                      description: "Vas a salir de tu cuenta en esta pestaña.",
                      confirmLabel: "Cerrar sesión",
                      destructive: true,
                    });
                    if (!ok) return;
                    await signOut();
                    navigate('/login');
                  })();
                }}
              >
                <LogOut className="h-4 w-4 mr-2" />
                <span>Cerrar sesión</span>
                <span className="ml-auto text-xs">⇧⌘Q</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Pin button — al lado del avatar (desktop). En collapsed va debajo. */}
          {!isMobile && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setPinned((p) => !p)}
                  className={cn(
                    "shrink-0 h-8 w-8 rounded-md inline-flex items-center justify-center transition-colors",
                    pinned
                      ? "text-primary bg-primary/10 hover:bg-primary/15"
                      : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
                  )}
                  aria-label={pinned ? "Despinear menú lateral" : "Fijar menú lateral"}
                  aria-pressed={pinned}
                >
                  {pinned ? <Pin className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5" />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                {pinned ? "Despinear (modo flotante al hover)" : "Fijar menú expandido"}
              </TooltipContent>
            </Tooltip>
          )}
          </div>
        </SidebarFooter>
      </Sidebar>
    </TooltipProvider>
    </>
  );
}
