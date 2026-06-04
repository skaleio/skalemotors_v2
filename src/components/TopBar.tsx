import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useGlobalSearch, type GlobalSearchResult } from "@/hooks/useGlobalSearch";
import { useNavigationWithLoading } from "@/hooks/useNavigationWithLoading";
import {
  useDismissNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  type Notification,
} from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { es as esLocale } from "date-fns/locale";
import { Bell, Car, Check, CheckCircle, ChevronDown, Clock, Command, Info, Loader2, Moon, Search, Sun, UserPlus, Users, X } from "lucide-react";
import { usePreloadUserAvatar } from "@/hooks/usePreloadUserAvatar";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { AppBreadcrumb } from "@/components/AppBreadcrumb";
import { openGlobalQuickActions } from "@/components/GlobalQuickActions";
import { ProfileAvatarImage } from "@/components/ProfileAvatarImage";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function TopBar() {
  usePreloadUserAvatar();
  const navigate = useNavigate();
  const location = useLocation();
  const { navigateWithLoading } = useNavigationWithLoading();
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();

  // Verificar si estamos en Dashboard Principal
  const isDashboardPrincipal = location.pathname === '/';

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const {
    results: searchResults,
    isSearching,
    minQueryLength,
    queryTooShort,
  } = useGlobalSearch({
    query: searchQuery,
    enabled: isSearchExpanded && !!user,
    branchId: user?.branch_id ?? undefined,
    role: user?.role,
    userId: user?.id,
  });

  const navigateToSearchResult = (result: GlobalSearchResult) => {
    navigateWithLoading(result.url);
    setSearchQuery('');
    setIsSearchExpanded(false);
  };

  const { notifications, unreadCount } = useNotifications({
    userId: user?.id,
    role: user?.role,
    limit: 20,
    syncStaleAlerts: notificationsOpen,
  });
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();
  const dismissMutation = useDismissNotification();

  // Animación campana: brinca cuando el contador de no leídas aumenta (nueva notificación).
  const prevUnreadRef = useRef(unreadCount);
  const [bellBounce, setBellBounce] = useState(false);
  useEffect(() => {
    if (unreadCount > prevUnreadRef.current) {
      setBellBounce(true);
      const t = setTimeout(() => setBellBounce(false), 1800);
      prevUnreadRef.current = unreadCount;
      return () => clearTimeout(t);
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount]);

  const markAsRead = (id: string) => markReadMutation.mutate(id);
  const dismissNotification = (id: string) => dismissMutation.mutate(id);
  const markAllAsRead = () => {
    if (user?.id) markAllReadMutation.mutate(user.id);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'lead_sold':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'vehicle_sold':
        return <CheckCircle className="h-5 w-5 text-emerald-600" />;
      case 'consignacion_created':
        return <Car className="h-5 w-5 text-indigo-500" />;
      case 'consignacion_stale':
        return <Clock className="h-5 w-5 text-amber-500" />;
      case 'vehicle_unpublished':
        return <Car className="h-5 w-5 text-amber-600" />;
      case 'lead_stale':
        return <Clock className="h-5 w-5 text-red-500" />;
      case 'seller_inactive':
        return <UserPlus className="h-5 w-5 text-rose-500" />;
      case 'lead_contactado':
        return <Info className="h-5 w-5 text-blue-500" />;
      case 'lead_assigned':
        return <UserPlus className="h-5 w-5 text-pink-500" />;
      case 'lead':
        return <Info className="h-5 w-5 text-pink-500" />;
      case 'appointment':
        return <Clock className="h-5 w-5 text-orange-500" />;
      default:
        return <Info className="h-5 w-5 text-gray-500" />;
    }
  };

  const formatNotificationTime = (iso: string) => {
    try {
      return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: esLocale });
    } catch {
      return '';
    }
  };

  const openNotification = (notification: Notification) => {
    if (!notification.read_at) markAsRead(notification.id);
    if (notification.action_url) {
      navigateWithLoading(notification.action_url);
      return;
    }
    if (notification.entity_type === "lead" && notification.entity_id) {
      navigateWithLoading(`/app/leads?openLead=${notification.entity_id}`);
      return;
    }
    if (notification.entity_type === "consignacion") {
      navigateWithLoading("/app/consignaciones");
      return;
    }
    if (notification.entity_type === "vehicle") {
      navigateWithLoading("/app/inventory");
      return;
    }
    if (notification.entity_type === "seller") {
      navigateWithLoading("/app/vendors");
    }
  };

  return (
    <header className="relative h-14 flex items-center border-b border-border bg-background/80 backdrop-blur-sm px-3 md:px-5 gap-3">
      {/* Izquierda: hamburguesa + logo mobile + breadcrumb desktop */}
      <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
        <SidebarTrigger className="h-8 w-8 shrink-0" />

        {/* Branding (mobile) */}
        <button
          onClick={() => navigate('/app')}
          className="skale-logo text-sm md:hidden whitespace-nowrap top-bar-logo"
          aria-label="Ir al dashboard"
        >
          SKALEMOTORS
        </button>

        {/* Breadcrumb (desktop) */}
        <AppBreadcrumb className="hidden md:flex" />
      </div>

      {/* Centro: logo SKALEMOTORS con glow rosa y pulso suave (visible md+). */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:block z-0">
        <button
          type="button"
          onClick={() => navigate('/app')}
          className="skale-logo top-bar-logo animate-pulse pointer-events-auto cursor-pointer hover:opacity-80 transition-opacity"
          aria-label="Ir al dashboard"
        >
          SKALEMOTORS
        </button>
      </div>

      {/* Derecha: search + acción rápida + notificaciones + tema + usuario */}
      <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
        {/* Search trigger — solo ícono lupa, abre dialog modal */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => {
            setIsSearchExpanded(true);
            setTimeout(() => searchInputRef.current?.focus(), 0);
          }}
          aria-label="Buscar"
        >
          <Search className="h-4 w-4 text-muted-foreground" />
        </Button>

        {/* Search Dialog — ventana emergente con buscador global */}
        <Dialog
          open={isSearchExpanded}
          onOpenChange={(open) => {
            setIsSearchExpanded(open);
            if (!open) {
              setSearchQuery('');
            } else {
              setTimeout(() => searchInputRef.current?.focus(), 0);
            }
          }}
        >
          <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
            <DialogTitle className="sr-only">Buscar en SkaleMotors</DialogTitle>
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar vehículos por marca/modelo/año/patente, leads por nombre/teléfono…"
                className="border-0 shadow-none focus-visible:ring-0 px-0 h-9 text-sm"
              />
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
              ) : searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-accent/40 transition-colors"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {!searchQuery.trim() ? (
                <div className="px-6 py-10 text-center">
                  <Search className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
                  <p className="text-sm font-medium text-foreground mb-1">Buscá vehículos o leads</p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Por marca, modelo, año o patente en el inventario. Por nombre, teléfono o email en leads.
                  </p>
                </div>
              ) : queryTooShort ? (
                <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                  Escribí al menos {minQueryLength} caracteres para buscar.
                </div>
              ) : searchResults.length === 0 && !isSearching ? (
                <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                  Sin resultados para <span className="font-medium text-foreground">"{searchQuery}"</span>
                </div>
              ) : (
                <div className="py-2">
                  {(() => {
                    const vehicleResults = searchResults.filter((r) => r.type === 'vehicle');
                    const leadResults = searchResults.filter((r) => r.type === 'lead');
                    return (
                      <>
                        {vehicleResults.length > 0 && (
                          <div className="px-2 py-1">
                            <div className="px-2 py-1.5 text-[10px] font-medium tracking-wider uppercase text-muted-foreground">
                              Vehículos · {vehicleResults.length}
                            </div>
                            {vehicleResults.map((result) => (
                              <button
                                key={result.id}
                                onClick={() => navigateToSearchResult(result)}
                                className="w-full flex items-center gap-3 px-2 py-2 text-left rounded-md hover:bg-accent/40 transition-colors"
                              >
                                <div className="w-8 h-8 rounded-md flex items-center justify-center bg-muted text-muted-foreground shrink-0">
                                  <Car className="h-4 w-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm text-foreground truncate">{result.title}</div>
                                  <div className="text-xs text-muted-foreground truncate">{result.description}</div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                        {leadResults.length > 0 && (
                          <div className="px-2 py-1">
                            <div className="px-2 py-1.5 text-[10px] font-medium tracking-wider uppercase text-muted-foreground">
                              Leads · {leadResults.length}
                            </div>
                            {leadResults.map((result) => (
                              <button
                                key={result.id}
                                onClick={() => navigateToSearchResult(result)}
                                className="w-full flex items-center gap-3 px-2 py-2 text-left rounded-md hover:bg-accent/40 transition-colors"
                              >
                                <div className="w-8 h-8 rounded-md flex items-center justify-center bg-muted text-muted-foreground shrink-0">
                                  <Users className="h-4 w-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm text-foreground truncate">{result.title}</div>
                                  <div className="text-xs text-muted-foreground truncate">{result.description}</div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Acción rápida — mismo modal que Ctrl+K (tokens de tema claro/oscuro) */}
        {!isDashboardPrincipal && (
          <div className="hidden md:block">
            <Button size="sm" className="gap-2" onClick={openGlobalQuickActions}>
              <Command className="h-3.5 w-3.5" />
              Acción rápida
            </Button>
          </div>
        )}

        {/* Notifications */}
        <DropdownMenu onOpenChange={setNotificationsOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-9 w-9">
              <Bell className={`h-4 w-4 transition-transform ${bellBounce ? 'animate-bounce text-primary' : ''}`} />
              {unreadCount > 0 && (
                <>
                  <span className="absolute -top-1 -right-1 flex h-5 w-5">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-60 animate-ping" />
                  </span>
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs flex items-center justify-center z-10"
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Badge>
                </>
              )}
              <span className="sr-only">Notificaciones</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={`w-96 p-0 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white'
            }`}>
            {/* Header */}
            <div className={`flex items-center justify-between p-4 border-b ${theme === 'dark' ? 'border-slate-600' : 'border-gray-200'
              }`}>
              <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>Notificaciones</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className={`text-sm font-medium ${theme === 'dark'
                      ? 'text-pink-400 hover:text-pink-300'
                      : 'text-pink-600 hover:text-pink-800'
                    }`}
                >
                  Marcar todas como leídas
                </button>
              )}
            </div>

            {/* Notifications List */}
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className={`p-8 text-center text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'
                  }`}>
                  No hay notificaciones
                </div>
              ) : (
                notifications.map((notification) => {
                  const unread = !notification.read_at;
                  return (
                  <div
                    key={notification.id}
                    className={`p-4 border-b transition-colors ${theme === 'dark'
                        ? `border-slate-600 hover:bg-slate-700 ${unread ? 'bg-pink-900/20' : 'bg-slate-800'
                        }`
                        : `border-gray-100 hover:bg-gray-50 ${unread ? 'bg-pink-50' : 'bg-white'
                        }`
                      }`}
                  >
                    <div className="flex items-start space-x-3">
                      {/* Icon */}
                      <div className="flex-shrink-0 mt-0.5">
                        {getNotificationIcon(notification.type)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div
                            className="flex-1 cursor-pointer"
                            onClick={() => openNotification(notification)}
                          >
                            <h4 className={`text-sm font-semibold mb-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                              }`}>
                              {notification.title}
                            </h4>
                            {notification.message && (
                              <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-600'
                                }`}>
                                {notification.message}
                              </p>
                            )}
                            <div className="flex items-center justify-between">
                              <div className={`flex items-center space-x-1 text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-400'
                                }`}>
                                <Clock className="h-3 w-3" />
                                <span>{formatNotificationTime(notification.created_at)}</span>
                              </div>
                              {notification.action_url && (
                                <span className={`text-xs font-medium ${theme === 'dark'
                                    ? 'text-pink-400 hover:text-pink-300'
                                    : 'text-pink-600 hover:text-pink-800'
                                  }`}>
                                  Ver
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="flex items-center space-x-1 ml-2">
                            {unread && (
                              <button
                                onClick={() => markAsRead(notification.id)}
                                className={`p-1 rounded-full transition-colors ${theme === 'dark'
                                    ? 'hover:bg-slate-600'
                                    : 'hover:bg-gray-200'
                                  }`}
                                title="Marcar como leída"
                              >
                                <Check className={`h-3 w-3 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'
                                  }`} />
                              </button>
                            )}
                            <button
                              onClick={() => dismissNotification(notification.id)}
                              className={`p-1 rounded-full transition-colors ${theme === 'dark'
                                  ? 'hover:bg-slate-600'
                                  : 'hover:bg-gray-200'
                                }`}
                              title="Descartar"
                            >
                              <X className={`h-3 w-3 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'
                                }`} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className={`p-3 border-t ${theme === 'dark'
                ? 'border-slate-600 bg-slate-700/50'
                : 'border-gray-200 bg-gray-50'
              }`}>
              <button
                onClick={() => navigateWithLoading('/app/alerts')}
                className={`w-full text-center text-sm font-medium ${theme === 'dark'
                  ? 'text-pink-400 hover:text-pink-300'
                  : 'text-pink-600 hover:text-pink-800'
                  }`}
              >
                Ver todas las notificaciones
              </button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Moon className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 h-9 px-2">
              <Avatar className="h-7 w-7">
                <ProfileAvatarImage avatarUrl={user?.avatar_url} size={28} cacheKey={user?.updated_at} priority="high" />
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                  {user?.full_name ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="hidden md:inline text-sm">{user?.full_name || 'Usuario'}</span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Mi cuenta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigateWithLoading('/app/profile')}>
              Perfil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigateWithLoading('/app/settings')}>
              Configuración
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut()}>
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
