import { useState, useEffect, useRef } from "react";
import { Search, User, ChevronDown, Bell, CheckCircle, Info, Clock, Check, X, Plus, Command, Car, Users, FileText, CreditCard, Calendar, Target, TrendingUp, Building2, Receipt, Award, PieChart, Monitor, Settings, Loader2 } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useNavigationWithLoading } from "@/hooks/useNavigationWithLoading";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useVehicles } from "@/hooks/useVehicles";
import { useLeads } from "@/hooks/useLeads";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface SearchResult {
  id: string;
  type: 'vehicle' | 'lead' | 'client';
  title: string;
  description: string;
  url: string;
  highlightId?: string;
}

export function TopBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { navigateWithLoading } = useNavigationWithLoading();
  const { theme } = useTheme();
  const { user, signOut } = useAuth();
  const { vehicles } = useVehicles({ branchId: user?.branch_id ?? undefined, enabled: !!user });
  const { leads } = useLeads({ branchId: user?.branch_id ?? undefined, enabled: !!user });
  
  // Verificar si estamos en Dashboard Principal
  const isDashboardPrincipal = location.pathname === '/';
  
  // Estados para búsqueda
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  
  // Función de búsqueda
  const performSearch = (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearchOpen(false);
      return;
    }

    setIsSearching(true);
    const lowerCaseQuery = query.toLowerCase();
    const results: SearchResult[] = [];

    // Buscar en vehículos
    vehicles.forEach(vehicle => {
      if (
        vehicle.make.toLowerCase().includes(lowerCaseQuery) ||
        vehicle.model.toLowerCase().includes(lowerCaseQuery) ||
        vehicle.year.toString().includes(lowerCaseQuery) ||
        (vehicle.color || "").toLowerCase().includes(lowerCaseQuery) ||
        (vehicle.vin || "").toLowerCase().includes(lowerCaseQuery)
      ) {
        results.push({
          id: `vehicle-${vehicle.id}`,
          type: 'vehicle',
          title: `${vehicle.make} ${vehicle.model} (${vehicle.year})`,
          description: `VIN: ${vehicle.vin} | Color: ${vehicle.color} | $${Number(vehicle.price || 0).toLocaleString()}`,
          url: '/app/inventory',
          highlightId: vehicle.id,
        });
      }
    });

    // Buscar en leads
    leads.forEach(lead => {
      if (
        lead.full_name.toLowerCase().includes(lowerCaseQuery) ||
        (lead.email || "").toLowerCase().includes(lowerCaseQuery) ||
        (lead.phone || "").includes(lowerCaseQuery)
      ) {
        results.push({
          id: `lead-${lead.id}`,
          type: 'lead',
          title: `Lead: ${lead.full_name}`,
          description: `Tel: ${lead.phone} | Email: ${lead.email || "—"} | Estado: ${lead.status}`,
          url: `/app/leads?openLead=${lead.id}`,
          highlightId: lead.id,
        });
      }
    });

    // Simular delay de búsqueda
    setTimeout(() => {
      setSearchResults(results);
      setIsSearching(false);
      setIsSearchOpen(results.length > 0);
    }, 300);
  };

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      performSearch(searchQuery);
    }, 300);

    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Cerrar búsqueda al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Navegar a resultado de búsqueda
  const navigateToSearchResult = (result: SearchResult) => {
    navigateWithLoading(result.url);
    setSearchQuery('');
    setSearchResults([]);
    setIsSearchOpen(false);
  };

  const [notifications, setNotifications] = useState<
    Array<{
      id: number;
      title: string;
      message: string;
      time: string;
      unread: boolean;
      type: string;
      action?: string;
    }>
  >([]);

  const unreadCount = notifications.filter(n => n.unread).length;

  const markAsRead = (id: number) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id 
          ? { ...notification, unread: false }
          : notification
      )
    );
  };

  const dismissNotification = (id: number) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  };

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, unread: false }))
    );
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'sale':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'lead':
        return <Info className="h-5 w-5 text-blue-500" />;
      case 'appointment':
        return <Clock className="h-5 w-5 text-orange-500" />;
      case 'inventory':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      default:
        return <Info className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <header className="h-16 flex items-center justify-between border-b bg-background px-6">
      <div className="flex items-center gap-4">
        <SidebarTrigger />
        
        {/* Search Bar */}
        <div ref={searchRef} className="relative max-w-md w-full">
          <Search className={`absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${
            theme === 'dark' ? 'text-slate-400' : 'text-muted-foreground'
          }`} />
          <Input
            placeholder="Buscar vehículos, leads, PPU, RUT..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`pl-10 ${
              theme === 'dark' 
                ? 'bg-slate-700 border-slate-600 text-white placeholder:text-slate-400' 
                : 'bg-background border-input'
            }`}
          />
          
          {/* Search Results Dropdown */}
          {isSearchOpen && (
            <div className={`absolute top-full left-0 right-0 mt-1 rounded-lg shadow-lg border z-50 max-h-80 overflow-y-auto ${
              theme === 'dark' 
                ? 'bg-slate-800 border-slate-700' 
                : 'bg-white border-gray-200'
            }`}>
              {isSearching ? (
                <div className="flex items-center justify-center p-4 text-sm text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Buscando...
                </div>
              ) : searchResults.length === 0 ? (
                <div className={`p-4 text-center text-sm ${
                  theme === 'dark' ? 'text-slate-400' : 'text-gray-500'
                }`}>
                  No se encontraron resultados para "{searchQuery}"
                </div>
              ) : (
                <div className="py-2">
                  {searchResults.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => navigateToSearchResult(result)}
                      className={`w-full flex items-center gap-3 p-3 text-left hover:bg-opacity-80 transition-colors ${
                        theme === 'dark' 
                          ? 'hover:bg-slate-700 text-white' 
                          : 'hover:bg-gray-50 text-gray-900'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-md flex items-center justify-center ${
                        theme === 'dark'
                          ? result.type === 'vehicle' 
                            ? 'bg-emerald-900/20 text-emerald-300'
                            : 'bg-blue-900/20 text-blue-300'
                          : result.type === 'vehicle'
                            ? 'bg-emerald-100 text-emerald-600'
                            : 'bg-blue-100 text-blue-600'
                      }`}>
                        {result.type === 'vehicle' ? (
                          <Car className="h-4 w-4" />
                        ) : (
                          <Users className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{result.title}</div>
                        <div className={`text-xs ${
                          theme === 'dark' ? 'text-slate-400' : 'text-gray-500'
                        }`}>
                          {result.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Logo centrado */}
      <div className="absolute left-1/2 transform -translate-x-1/2">
        <button 
          onClick={() => navigate('/app')}
          className="skale-logo animate-pulse cursor-pointer hover:opacity-80 transition-opacity"
        >
          SKALEMOTORS
        </button>
      </div>

      <div className="flex items-center gap-4">

        {/* Quick Actions Menu - Oculto en Dashboard Principal */}
        {!isDashboardPrincipal && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-200 border-0">
                <Command className="h-4 w-4 mr-2" />
                Acción Rápida
              </Button>
            </DropdownMenuTrigger>
          <DropdownMenuContent className="w-80 p-0 border-0 shadow-2xl bg-white/95 backdrop-blur-sm">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 text-sm">Acciones Rápidas</h3>
              <p className="text-xs text-gray-500 mt-1">Accede rápidamente a las funciones más utilizadas</p>
            </div>
            
            <div className="p-2">
              {/* Ventas & CRM */}
              <div className="mb-3">
                <div className="px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Ventas & CRM</div>
                <div className="space-y-1">
                  <button 
                    onClick={() => navigateWithLoading('/leads')}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-all duration-150 group"
                  >
                    <div className="p-1.5 bg-blue-100 group-hover:bg-blue-200 rounded-md transition-colors">
                      <Users className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium">Nuevo Lead</div>
                      <div className="text-xs text-gray-500">Agregar prospecto</div>
                    </div>
                    <div className="text-xs text-gray-400 group-hover:text-blue-500">Ctrl+L</div>
                  </button>
                  
                  <button 
                    onClick={() => navigateWithLoading('/crm')}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-all duration-150 group"
                  >
                    <div className="p-1.5 bg-green-100 group-hover:bg-green-200 rounded-md transition-colors">
                      <Target className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium">CRM Pipeline</div>
                      <div className="text-xs text-gray-500">Gestionar ventas</div>
                    </div>
                    <div className="text-xs text-gray-400 group-hover:text-blue-500">Ctrl+P</div>
                  </button>
                  
                  <button 
                    onClick={() => navigateWithLoading('/quotes')}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-all duration-150 group"
                  >
                    <div className="p-1.5 bg-purple-100 group-hover:bg-purple-200 rounded-md transition-colors">
                      <FileText className="h-4 w-4 text-purple-600" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium">Nueva Cotización</div>
                      <div className="text-xs text-gray-500">Crear propuesta</div>
                    </div>
                    <div className="text-xs text-gray-400 group-hover:text-blue-500">Ctrl+Q</div>
                  </button>
                </div>
              </div>

              {/* Operaciones */}
              <div className="mb-3">
                <div className="px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Operaciones</div>
                <div className="space-y-1">
                  <button 
                    onClick={() => navigateWithLoading('/appointments')}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-all duration-150 group"
                  >
                    <div className="p-1.5 bg-orange-100 group-hover:bg-orange-200 rounded-md transition-colors">
                      <Calendar className="h-4 w-4 text-orange-600" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium">Nueva Cita</div>
                      <div className="text-xs text-gray-500">Programar reunión</div>
                    </div>
                    <div className="text-xs text-gray-400 group-hover:text-blue-500">Ctrl+A</div>
                  </button>
                  
                  <button 
                    onClick={() => navigateWithLoading('/finance')}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-all duration-150 group"
                  >
                    <div className="p-1.5 bg-emerald-100 group-hover:bg-emerald-200 rounded-md transition-colors">
                      <CreditCard className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium">Financiamiento</div>
                      <div className="text-xs text-gray-500">Calcular cuotas</div>
                    </div>
                    <div className="text-xs text-gray-400 group-hover:text-blue-500">Ctrl+F</div>
                  </button>
                </div>
              </div>

              {/* Inventario */}
              <div className="mb-3">
                <div className="px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Inventario</div>
                <div className="space-y-1">
                  <button 
                    onClick={() => navigateWithLoading('/inventory')}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-all duration-150 group"
                  >
                    <div className="p-1.5 bg-indigo-100 group-hover:bg-indigo-200 rounded-md transition-colors">
                      <Car className="h-4 w-4 text-indigo-600" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium">Agregar Vehículo</div>
                      <div className="text-xs text-gray-500">Nuevo stock</div>
                    </div>
                    <div className="text-xs text-gray-400 group-hover:text-blue-500">Ctrl+V</div>
                  </button>
                </div>
              </div>

              {/* Finanzas */}
              <div className="mb-3">
                <div className="px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Finanzas</div>
                <div className="space-y-1">
                  <button 
                    onClick={() => navigateWithLoading('/billing')}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-all duration-150 group"
                  >
                    <div className="p-1.5 bg-rose-100 group-hover:bg-rose-200 rounded-md transition-colors">
                      <Receipt className="h-4 w-4 text-rose-600" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium">Nueva Factura</div>
                      <div className="text-xs text-gray-500">Emitir documento</div>
                    </div>
                    <div className="text-xs text-gray-400 group-hover:text-blue-500">Ctrl+I</div>
                  </button>
                </div>
              </div>
            </div>
            
            <div className="p-3 border-t border-gray-100 bg-gray-50/50">
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  Usa <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs">K</kbd> para buscar
                </div>
                <button 
                  onClick={() => navigateWithLoading('/settings')}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  Configuración
                </button>
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
        )}


        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs flex items-center justify-center"
                >
                  {unreadCount}
                </Badge>
              )}
              <span className="sr-only">Notificaciones</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={`w-96 p-0 ${
            theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white'
          }`}>
            {/* Header */}
            <div className={`flex items-center justify-between p-4 border-b ${
              theme === 'dark' ? 'border-slate-600' : 'border-gray-200'
            }`}>
              <h3 className={`font-semibold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>Notificaciones</h3>
              {unreadCount > 0 && (
                <button 
                  onClick={markAllAsRead}
                  className={`text-sm font-medium ${
                    theme === 'dark' 
                      ? 'text-blue-400 hover:text-blue-300' 
                      : 'text-blue-600 hover:text-blue-800'
                  }`}
                >
                  Marcar todas como leídas
                </button>
              )}
            </div>

            {/* Notifications List */}
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className={`p-8 text-center text-sm ${
                  theme === 'dark' ? 'text-slate-400' : 'text-gray-500'
                }`}>
                  No hay notificaciones
                </div>
              ) : (
                notifications.map((notification) => (
                  <div 
                    key={notification.id} 
                    className={`p-4 border-b transition-colors ${
                      theme === 'dark'
                        ? `border-slate-600 hover:bg-slate-700 ${
                            notification.unread ? 'bg-blue-900/20' : 'bg-slate-800'
                          }`
                        : `border-gray-100 hover:bg-gray-50 ${
                            notification.unread ? 'bg-blue-50' : 'bg-white'
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
                          <div className="flex-1">
                            <h4 className={`text-sm font-semibold mb-1 ${
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            }`}>
                              {notification.title}
                            </h4>
                            <p className={`text-sm mb-2 ${
                              theme === 'dark' ? 'text-slate-300' : 'text-gray-600'
                            }`}>
                              {notification.message}
                            </p>
                            <div className="flex items-center justify-between">
                              <div className={`flex items-center space-x-1 text-xs ${
                                theme === 'dark' ? 'text-slate-400' : 'text-gray-400'
                              }`}>
                                <Clock className="h-3 w-3" />
                                <span>{notification.time}</span>
                              </div>
                              <button className={`text-xs font-medium ${
                                theme === 'dark' 
                                  ? 'text-blue-400 hover:text-blue-300' 
                                  : 'text-blue-600 hover:text-blue-800'
                              }`}>
                                {notification.action}
                              </button>
                            </div>
                          </div>
                          
                          {/* Action buttons */}
                          <div className="flex items-center space-x-1 ml-2">
                            {notification.unread && (
                              <button
                                onClick={() => markAsRead(notification.id)}
                                className={`p-1 rounded-full transition-colors ${
                                  theme === 'dark' 
                                    ? 'hover:bg-slate-600' 
                                    : 'hover:bg-gray-200'
                                }`}
                                title="Marcar como leída"
                              >
                                <Check className={`h-3 w-3 ${
                                  theme === 'dark' ? 'text-slate-400' : 'text-gray-500'
                                }`} />
                              </button>
                            )}
                            <button
                              onClick={() => dismissNotification(notification.id)}
                              className={`p-1 rounded-full transition-colors ${
                                theme === 'dark' 
                                  ? 'hover:bg-slate-600' 
                                  : 'hover:bg-gray-200'
                              }`}
                              title="Descartar"
                            >
                              <X className={`h-3 w-3 ${
                                theme === 'dark' ? 'text-slate-400' : 'text-gray-500'
                              }`} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className={`p-3 border-t ${
                theme === 'dark' 
                  ? 'border-slate-600 bg-slate-700/50' 
                  : 'border-gray-200 bg-gray-50'
              }`}>
                <button className={`w-full text-center text-sm font-medium ${
                  theme === 'dark' 
                    ? 'text-blue-400 hover:text-blue-300' 
                    : 'text-blue-600 hover:text-blue-800'
                }`}>
                  Ver todas las notificaciones
                </button>
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback>
                  {user?.full_name ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="hidden md:inline">{user?.full_name || 'Usuario'}</span>
              <ChevronDown className="h-4 w-4" />
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