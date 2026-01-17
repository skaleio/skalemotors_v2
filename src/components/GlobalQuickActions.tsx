import { useState, useMemo, useEffect, useRef } from "react";
import { 
  Car, 
  Users, 
  Calendar, 
  TrendingUp, 
  Clock, 
  DollarSign, 
  Star, 
  Plus, 
  UserPlus, 
  Car as CarIcon, 
  CalendarPlus, 
  FileText, 
  Save, 
  Phone, 
  Mail, 
  MapPin, 
  Command, 
  Target, 
  Receipt, 
  CreditCard, 
  Search, 
  Activity, 
  CheckCircle 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useNavigationWithLoading } from "@/hooks/useNavigationWithLoading";
import { useTheme } from "@/contexts/ThemeContext";

export function GlobalQuickActions() {
  const { navigateWithLoading } = useNavigationWithLoading();
  const { theme } = useTheme();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const createOptions = [
  // Ventas & CRM
  { 
    label: "Nuevo Lead", 
    description: "Agregar un nuevo prospecto al sistema",
    icon: UserPlus,
    action: () => navigateWithLoading('/crm'),
    color: "bg-blue-600",
    category: "Ventas & CRM",
    keywords: ["lead", "prospecto", "cliente", "venta", "crm"]
  },
  { 
    label: "CRM Pipeline", 
    description: "Gestionar el proceso de ventas",
    icon: Target,
    action: () => navigateWithLoading('/crm'),
    color: "bg-green-600",
    category: "Ventas & CRM",
    keywords: ["pipeline", "ventas", "proceso", "crm", "seguimiento"]
  },
  { 
    label: "Nueva Cotización", 
    description: "Crear propuesta comercial",
    icon: FileText,
    action: () => navigateWithLoading('/crm'),
    color: "bg-purple-600",
    category: "Ventas & CRM",
    keywords: ["cotización", "propuesta", "precio", "oferta", "comercial"]
  },
  { 
    label: "Seguimiento de Ventas", 
    description: "Revisar estado de negociaciones",
    icon: TrendingUp,
    action: () => navigateWithLoading('/crm'),
    color: "bg-indigo-600",
    category: "Ventas & CRM",
    keywords: ["seguimiento", "ventas", "negociación", "estado", "progreso"]
  },
  
  // Operaciones
  { 
    label: "Llamada", 
    description: "Realizar llamada telefónica",
    icon: Phone,
    action: () => navigateWithLoading('/calls'),
    color: "bg-red-600",
    category: "Operaciones",
    keywords: ["llamada", "teléfono", "contacto", "comunicación", "call"]
  },
  { 
    label: "Agendar Cita", 
    description: "Programar test drive o reunión",
    icon: CalendarPlus,
    action: () => navigateWithLoading('/appointments'),
    color: "bg-orange-600",
    category: "Operaciones",
    keywords: ["cita", "agendar", "test drive", "reunión", "calendario"]
  },
  { 
    label: "Financiamiento", 
    description: "Calcular opciones de financiamiento",
    icon: CreditCard,
    action: () => navigateWithLoading('/financial-calculator'),
    color: "bg-green-600",
    category: "Operaciones",
    keywords: ["financiamiento", "crédito", "cuotas", "calcular", "préstamo"]
  },
  { 
    label: "Gestión de Citas", 
    description: "Ver y administrar citas programadas",
    icon: Calendar,
    action: () => navigateWithLoading('/appointments'),
    color: "bg-blue-600",
    category: "Operaciones",
    keywords: ["citas", "calendario", "agenda", "programar", "administrar"]
  },
  { 
    label: "Reportes de Actividad", 
    description: "Ver resumen de actividades diarias",
    icon: Activity,
    action: () => navigateWithLoading('/reports'),
    color: "bg-purple-600",
    category: "Operaciones",
    keywords: ["reportes", "actividad", "resumen", "estadísticas", "métricas"]
  },
  
  // Inventario
  { 
    label: "Agregar Vehículo", 
    description: "Registrar un nuevo vehículo en inventario",
    icon: CarIcon,
    action: () => navigateWithLoading('/inventory'),
    color: "bg-emerald-600",
    category: "Inventario",
    keywords: ["vehículo", "auto", "inventario", "stock", "agregar"]
  },
  { 
    label: "Gestión de Inventario", 
    description: "Administrar stock de vehículos",
    icon: Car,
    action: () => navigateWithLoading('/inventory'),
    color: "bg-blue-600",
    category: "Inventario",
    keywords: ["inventario", "stock", "vehículos", "administrar", "gestión"]
  },
  { 
    label: "Actualizar Precios", 
    description: "Modificar precios de vehículos",
    icon: DollarSign,
    action: () => navigateWithLoading('/inventory'),
    color: "bg-yellow-600",
    category: "Inventario",
    keywords: ["precios", "actualizar", "modificar", "vehículos", "costos"]
  },
  { 
    label: "Estados de Vehículos", 
    description: "Cambiar estado de vehículos",
    icon: CheckCircle,
    action: () => navigateWithLoading('/inventory'),
    color: "bg-green-600",
    category: "Inventario",
    keywords: ["estado", "vehículos", "disponible", "vendido", "reservado"]
  },
  
  // Finanzas
  { 
    label: "Nueva Factura", 
    description: "Emitir una factura electrónica",
    icon: Receipt,
    action: () => navigateWithLoading('/billing'),
    color: "bg-red-600",
    category: "Finanzas",
    keywords: ["factura", "emitir", "electrónica", "documento", "cobro"]
  },
  { 
    label: "Calculadora Financiera", 
    description: "Calcular financiamiento y cuotas",
    icon: CreditCard,
    action: () => navigateWithLoading('/financial-calculator'),
    color: "bg-indigo-600",
    category: "Finanzas",
    keywords: ["calculadora", "financiera", "cuotas", "crédito", "calcular"]
  },
  { 
    label: "Reportes Financieros", 
    description: "Ver reportes de ingresos y gastos",
    icon: TrendingUp,
    action: () => navigateWithLoading('/finance'),
    color: "bg-green-600",
    category: "Finanzas",
    keywords: ["reportes", "financieros", "ingresos", "gastos", "estadísticas"]
  },
  { 
    label: "Gestión de Pagos", 
    description: "Administrar pagos y cobros",
    icon: DollarSign,
    action: () => navigateWithLoading('/finance'),
    color: "bg-yellow-600",
    category: "Finanzas",
    keywords: ["pagos", "cobros", "administrar", "finanzas", "dinero"]
  },
  
  // Post Venta
  { 
    label: "CRM Post Venta", 
    description: "Gestionar clientes post venta",
    icon: Users,
    action: () => navigateWithLoading('/post-sale-crm'),
    color: "bg-purple-600",
    category: "Post Venta",
    keywords: ["post venta", "clientes", "servicio", "mantenimiento", "garantía"]
  },
  { 
    label: "Servicios Programados", 
    description: "Ver servicios de mantenimiento",
    icon: Calendar,
    action: () => navigateWithLoading('/post-sale-crm'),
    color: "bg-blue-600",
    category: "Post Venta",
    keywords: ["servicios", "mantenimiento", "programados", "citas", "taller"]
  },
  { 
    label: "Garantías", 
    description: "Administrar garantías de vehículos",
    icon: CheckCircle,
    action: () => navigateWithLoading('/post-sale-crm'),
    color: "bg-green-600",
    category: "Post Venta",
    keywords: ["garantías", "administrar", "vehículos", "cobertura", "seguro"]
  },
  
  // Configuración
  { 
    label: "Configuración", 
    description: "Ajustar configuración del sistema",
    icon: Star,
    action: () => navigateWithLoading('/settings'),
    color: "bg-gray-600",
    category: "Configuración",
    keywords: ["configuración", "ajustes", "sistema", "preferencias", "opciones"]
  },
  { 
    label: "Usuarios", 
    description: "Gestionar usuarios del sistema",
    icon: Users,
    action: () => navigateWithLoading('/settings'),
    color: "bg-indigo-600",
    category: "Configuración",
    keywords: ["usuarios", "gestionar", "permisos", "acceso", "equipo"]
  }
];

  // Escuchar el evento personalizado para abrir el modal
  useEffect(() => {
    const handleOpenQuickActions = () => {
      setShowCreateDialog(true);
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 100);
    };

    window.addEventListener('openQuickActions', handleOpenQuickActions);
    return () => {
      window.removeEventListener('openQuickActions', handleOpenQuickActions);
    };
  }, []);

  // Filtrar opciones basado en la búsqueda
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return createOptions;
    
    const query = searchQuery.toLowerCase();
    return createOptions.filter(option => 
      option.label.toLowerCase().includes(query) ||
      option.description.toLowerCase().includes(query) ||
      option.category.toLowerCase().includes(query) ||
      option.keywords.some(keyword => keyword.toLowerCase().includes(query))
    );
  }, [searchQuery]);

  // Agrupar opciones filtradas por categoría
  const groupedOptions = useMemo(() => {
    const groups: { [key: string]: typeof createOptions } = {};
    filteredOptions.forEach(option => {
      if (!groups[option.category]) {
        groups[option.category] = [];
      }
      groups[option.category].push(option);
    });
    return groups;
  }, [filteredOptions]);

  return (
    <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
      <DialogContent className={`max-w-4xl max-h-[85vh] border-0 backdrop-blur-xl shadow-2xl p-0 overflow-hidden flex flex-col rounded-2xl ${
        theme === 'dark' 
          ? 'bg-slate-800/95 border-slate-700' 
          : 'bg-white/95'
      }`}>
        {/* Header Minimalista */}
        <div className={`p-6 flex-shrink-0 border-b ${
          theme === 'dark' ? 'border-slate-600/50' : 'border-gray-100/50'
        }`}>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <Command className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className={`text-xl font-semibold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>Acciones Rápidas</h2>
              <p className={`text-sm ${
                theme === 'dark' ? 'text-slate-400' : 'text-gray-500'
              }`}>
                Busca y ejecuta funciones rápidamente
              </p>
            </div>
          </div>
        </div>

        {/* Buscador Moderno */}
        <div className="p-6 flex-shrink-0">
          <div className="relative group">
            <Search className={`absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 transition-colors ${
              theme === 'dark' 
                ? 'text-slate-400 group-focus-within:text-blue-400' 
                : 'text-gray-400 group-focus-within:text-blue-500'
            }`} />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar acciones... (ej: factura, vehículo, cita)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`pl-11 h-11 text-sm rounded-xl transition-all ${
                theme === 'dark'
                  ? 'border-slate-600 focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20 bg-slate-700/50 focus:bg-slate-700 text-white placeholder:text-slate-400'
                  : 'border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 bg-gray-50/50 focus:bg-white'
              }`}
            />
          </div>
          {searchQuery && (
            <div className={`mt-3 text-xs font-medium ${
              theme === 'dark' ? 'text-slate-400' : 'text-gray-500'
            }`}>
              {filteredOptions.length} resultado{filteredOptions.length !== 1 ? 's' : ''} encontrado{filteredOptions.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Content Scrolleable */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {Object.keys(groupedOptions).length === 0 ? (
            <div className="text-center py-16">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
                theme === 'dark' ? 'bg-slate-700' : 'bg-gray-50'
              }`}>
                <Search className={`h-6 w-6 ${
                  theme === 'dark' ? 'text-slate-400' : 'text-gray-400'
                }`} />
              </div>
              <h3 className={`text-base font-medium mb-1 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>Sin resultados</h3>
              <p className={`text-sm ${
                theme === 'dark' ? 'text-slate-400' : 'text-gray-500'
              }`}>Prueba con otros términos de búsqueda</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedOptions).map(([category, options]) => (
                <div key={category} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className={`text-sm font-semibold uppercase tracking-wide ${
                      theme === 'dark' ? 'text-slate-300' : 'text-gray-700'
                    }`}>
                      {category}
                    </h3>
                    <div className={`h-px flex-1 ${
                      theme === 'dark' ? 'bg-slate-600' : 'bg-gray-200'
                    }`}></div>
                    <Badge variant="outline" className={`text-xs px-2 py-0.5 ${
                      theme === 'dark' 
                        ? 'bg-slate-700 text-slate-300 border-slate-600' 
                        : 'bg-gray-50 text-gray-600 border-gray-200'
                    }`}>
                      {options.length}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-2">
                    {options.map((option, index) => (
                      <div
                        key={`${option.label}-${index}`}
                        className={`group flex items-center gap-3 p-3 rounded-xl transition-all duration-150 cursor-pointer border border-transparent ${
                          theme === 'dark'
                            ? 'hover:bg-slate-700/80 hover:border-slate-600/50'
                            : 'hover:bg-gray-50/80 hover:border-gray-200/50'
                        }`}
                        onClick={() => {
                          option.action();
                          setShowCreateDialog(false);
                        }}
                      >
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform duration-150 ${
                          theme === 'dark'
                            ? option.color.replace('600', '800')
                            : option.color.replace('600', '100')
                        }`}>
                          <option.icon className={`h-4 w-4 ${
                            theme === 'dark'
                              ? option.color.replace('bg-', 'text-').replace('600', '300')
                              : option.color.replace('bg-', 'text-')
                          }`} />
                        </div>
                            <div className="flex-1 min-w-0">
                              <div className={`font-medium text-sm transition-colors ${
                                theme === 'dark'
                                  ? 'text-white group-hover:text-slate-200'
                                  : 'text-gray-900 group-hover:text-gray-700'
                              }`}>
                                {option.label}
                              </div>
                              <div className={`text-xs truncate ${
                                theme === 'dark' ? 'text-slate-400' : 'text-gray-500'
                              }`}>
                                {option.description}
                              </div>
                            </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Minimalista */}
        <div className={`px-6 py-4 border-t flex-shrink-0 ${
          theme === 'dark' 
            ? 'border-slate-600/50 bg-slate-700/30' 
            : 'border-gray-100/50 bg-gray-50/30'
        }`}>
          <div className={`flex items-center justify-between text-xs ${
            theme === 'dark' ? 'text-slate-400' : 'text-gray-500'
          }`}>
            <div className="flex items-center gap-1">
              <span>Atajo:</span>
              <kbd className={`px-1.5 py-0.5 border rounded text-xs font-mono ${
                theme === 'dark'
                  ? 'bg-slate-600 border-slate-500 text-slate-300'
                  : 'bg-white border-gray-200'
              }`}>Ctrl</kbd>
              <span>+</span>
              <kbd className={`px-1.5 py-0.5 border rounded text-xs font-mono ${
                theme === 'dark'
                  ? 'bg-slate-600 border-slate-500 text-slate-300'
                  : 'bg-white border-gray-200'
              }`}>K</kbd>
              <span className={`ml-2 ${
                theme === 'dark' ? 'text-slate-500' : 'text-gray-400'
              }`}>•</span>
              <span className="ml-2">Escape para cerrar</span>
            </div>
            <button 
              className={`font-medium transition-colors ${
                theme === 'dark'
                  ? 'text-blue-400 hover:text-blue-300'
                  : 'text-blue-600 hover:text-blue-700'
              }`}
              onClick={() => {
                navigateWithLoading('/settings');
                setShowCreateDialog(false);
              }}
            >
              Configuración
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
