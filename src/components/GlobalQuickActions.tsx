import { useState, useMemo, useEffect, useRef, useDeferredValue, memo } from "react";
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
  CheckCircle,
  ClipboardList,
  CircleDollarSign
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
import { ShortcutsCustomizerModal } from "@/components/ShortcutsCustomizerModal";

type QuickActionOption = {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  category: string;
  keywords: string[];
  shortcut?: string;
  action: () => void;
};

const QuickActionRow = memo(function QuickActionRow({
  option,
  theme,
  onSelect,
}: {
  option: QuickActionOption;
  theme: string;
  onSelect: () => void;
}) {
  const Icon = option.icon;
  const iconBgClass = theme === "dark" ? option.color.replace("600", "800") : option.color.replace("600", "100");
  const iconTextClass = theme === "dark" ? option.color.replace("bg-", "text-").replace("600", "300") : option.color.replace("bg-", "text-");
  return (
    <div
      role="button"
      tabIndex={0}
      className={`group flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer border border-transparent ${
        theme === "dark"
          ? "hover:bg-slate-700/80 hover:border-slate-600/50"
          : "hover:bg-gray-50/80 hover:border-gray-200/50"
      }`}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } }}
    >
      <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${iconBgClass}`}>
        <Icon className={`h-3.5 w-3.5 ${iconTextClass}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className={`font-medium text-sm ${theme === "dark" ? "text-white group-hover:text-slate-200" : "text-gray-900 group-hover:text-gray-700"}`}>
          {option.label}
        </div>
        <div className={`text-xs truncate ${theme === "dark" ? "text-slate-400" : "text-gray-500"}`}>
          {option.description}
        </div>
      </div>
      {option.shortcut && (
        <div className={`flex-shrink-0 text-xs ${theme === "dark" ? "text-slate-400" : "text-gray-400"}`}>
          {option.shortcut.split("+").map((key, i) => (
            <span key={i} className="inline-flex items-center gap-0.5">
              {i > 0 && <span className="mx-0.5">+</span>}
              <kbd className={`px-1.5 py-0.5 border rounded font-mono ${theme === "dark" ? "bg-slate-600 border-slate-500 text-slate-300" : "bg-white border-gray-200"}`}>
                {key.trim()}
              </kbd>
            </span>
          ))}
        </div>
      )}
    </div>
  );
});

const QuickActionCategory = memo(function QuickActionCategory({
  category,
  options,
  theme,
  onSelect,
}: {
  category: string;
  options: QuickActionOption[];
  theme: string;
  onSelect: (action: () => void) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className={`text-xs font-semibold uppercase tracking-wide ${theme === "dark" ? "text-slate-300" : "text-gray-700"}`}>
          {category}
        </h3>
        <div className={`h-px flex-1 ${theme === "dark" ? "bg-slate-600" : "bg-gray-200"}`} />
        <Badge variant="outline" className={`text-xs px-1.5 py-0 ${theme === "dark" ? "bg-slate-700 text-slate-300 border-slate-600" : "bg-gray-50 text-gray-600 border-gray-200"}`}>
          {options.length}
        </Badge>
      </div>
      <div className="grid grid-cols-1 gap-0.5">
        {options.map((option, index) => (
          <QuickActionRow key={`${option.label}-${index}`} option={option} theme={theme} onSelect={() => onSelect(option.action)} />
        ))}
      </div>
    </div>
  );
});

export function GlobalQuickActions() {
  const { navigateWithLoading } = useNavigationWithLoading();
  const { theme } = useTheme();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const createOptions = useMemo(() => [
  // Ventas & CRM
  { 
    label: "Nuevo Lead", 
    description: "Agregar un nuevo prospecto al sistema",
    icon: UserPlus,
    shortcut: "Ctrl+L",
    action: () => {
      const onLeadsPage = window.location.pathname === "/app/leads" || window.location.pathname === "/leads";
      if (onLeadsPage) {
        window.dispatchEvent(new CustomEvent("openNewLeadForm"));
      } else {
        navigateWithLoading("/app/leads?new=true");
      }
    },
    color: "bg-blue-600",
    category: "Ventas & CRM",
    keywords: ["lead", "prospecto", "cliente", "venta", "crm"]
  },
  { 
    label: "CRM Pipeline", 
    description: "Gestionar el proceso de ventas",
    icon: Target,
    shortcut: "Ctrl+P",
    action: () => navigateWithLoading('/app/crm'),
    color: "bg-green-600",
    category: "Ventas & CRM",
    keywords: ["pipeline", "ventas", "proceso", "crm", "seguimiento"]
  },
  { 
    label: "Nueva Cotización", 
    description: "Crear propuesta comercial",
    icon: FileText,
    shortcut: "Ctrl+Q",
    action: () => navigateWithLoading('/app/quotes'),
    color: "bg-purple-600",
    category: "Ventas & CRM",
    keywords: ["cotización", "propuesta", "precio", "oferta", "comercial"]
  },
  { 
    label: "Nueva Venta", 
    description: "Registrar una venta de vehículo",
    icon: CircleDollarSign,
    shortcut: "Ctrl+E",
    action: () => {
      const onSalesPage = window.location.pathname === "/app/sales";
      if (onSalesPage) {
        window.dispatchEvent(new CustomEvent("openNewSaleForm"));
      } else {
        navigateWithLoading("/app/sales?new=true");
      }
    },
    color: "bg-emerald-600",
    category: "Ventas & CRM",
    keywords: ["venta", "vender", "registrar", "ventas", "vehículo"]
  },
  { 
    label: "Seguimiento de Ventas", 
    description: "Revisar estado de negociaciones",
    icon: TrendingUp,
    action: () => navigateWithLoading('/app/crm'),
    color: "bg-indigo-600",
    category: "Ventas & CRM",
    keywords: ["seguimiento", "ventas", "negociación", "estado", "progreso"]
  },
  
  // Operaciones
  { 
    label: "Llamada", 
    description: "Realizar llamada telefónica",
    icon: Phone,
    action: () => navigateWithLoading('/app/calls'),
    color: "bg-red-600",
    category: "Operaciones",
    keywords: ["llamada", "teléfono", "contacto", "comunicación", "call"]
  },
  { 
    label: "Agendar Cita", 
    description: "Programar test drive o reunión",
    icon: CalendarPlus,
    shortcut: "Ctrl+A",
    action: () => navigateWithLoading('/app/appointments'),
    color: "bg-orange-600",
    category: "Operaciones",
    keywords: ["cita", "agendar", "test drive", "reunión", "calendario"]
  },
  { 
    label: "Financiamiento", 
    description: "Calcular opciones de financiamiento",
    icon: CreditCard,
    shortcut: "Ctrl+F",
    action: () => navigateWithLoading('/app/financial-calculator'),
    color: "bg-green-600",
    category: "Operaciones",
    keywords: ["financiamiento", "crédito", "cuotas", "calcular", "préstamo"]
  },
  { 
    label: "Gestión de Citas", 
    description: "Ver y administrar citas programadas",
    icon: Calendar,
    shortcut: "Ctrl+A",
    action: () => navigateWithLoading('/app/appointments'),
    color: "bg-blue-600",
    category: "Operaciones",
    keywords: ["citas", "calendario", "agenda", "programar", "administrar"]
  },
  { 
    label: "Reportes de Actividad", 
    description: "Ver resumen de actividades diarias",
    icon: Activity,
    action: () => navigateWithLoading('/app/reports'),
    color: "bg-purple-600",
    category: "Operaciones",
    keywords: ["reportes", "actividad", "resumen", "estadísticas", "métricas"]
  },
  
  // Inventario
  { 
    label: "Agregar Vehículo", 
    description: "Registrar un nuevo vehículo en inventario",
    icon: CarIcon,
    shortcut: "Ctrl+V",
    action: () => {
      if (window.location.pathname === "/app/inventory") {
        window.dispatchEvent(new CustomEvent("openNewVehicleForm"));
      } else {
        navigateWithLoading("/app/inventory?new=true");
      }
    },
    color: "bg-emerald-600",
    category: "Inventario",
    keywords: ["vehículo", "auto", "inventario", "stock", "agregar"]
  },
  { 
    label: "Agregar Consignación", 
    description: "Nuevo vehículo en consignación",
    icon: ClipboardList,
    shortcut: "Ctrl+C",
    action: () => {
      if (window.location.pathname === "/app/consignaciones") {
        window.dispatchEvent(new CustomEvent("openNewConsignacionForm"));
      } else {
        navigateWithLoading("/app/consignaciones?new=true");
      }
    },
    color: "bg-teal-600",
    category: "Inventario",
    keywords: ["consignación", "consignar", "vehículo", "inventario"]
  },
  { 
    label: "Gestión de Inventario", 
    description: "Administrar stock de vehículos",
    icon: Car,
    action: () => navigateWithLoading('/app/inventory'),
    color: "bg-blue-600",
    category: "Inventario",
    keywords: ["inventario", "stock", "vehículos", "administrar", "gestión"]
  },
  { 
    label: "Actualizar Precios", 
    description: "Modificar precios de vehículos",
    icon: DollarSign,
    action: () => navigateWithLoading('/app/inventory'),
    color: "bg-yellow-600",
    category: "Inventario",
    keywords: ["precios", "actualizar", "modificar", "vehículos", "costos"]
  },
  { 
    label: "Estados de Vehículos", 
    description: "Cambiar estado de vehículos",
    icon: CheckCircle,
    action: () => navigateWithLoading('/app/inventory'),
    color: "bg-green-600",
    category: "Inventario",
    keywords: ["estado", "vehículos", "disponible", "vendido", "reservado"]
  },
  
  // Finanzas
  { 
    label: "Nueva Factura", 
    description: "Emitir una factura electrónica",
    icon: Receipt,
    shortcut: "Ctrl+I",
    action: () => navigateWithLoading('/app/billing'),
    color: "bg-red-600",
    category: "Finanzas",
    keywords: ["factura", "emitir", "electrónica", "documento", "cobro"]
  },
  { 
    label: "Calculadora Financiera", 
    description: "Calcular financiamiento y cuotas",
    icon: CreditCard,
    shortcut: "Ctrl+F",
    action: () => navigateWithLoading('/app/financial-calculator'),
    color: "bg-indigo-600",
    category: "Finanzas",
    keywords: ["calculadora", "financiera", "cuotas", "crédito", "calcular"]
  },
  { 
    label: "Reportes Financieros", 
    description: "Ver reportes de ingresos y gastos",
    icon: TrendingUp,
    action: () => navigateWithLoading('/app/finance'),
    color: "bg-green-600",
    category: "Finanzas",
    keywords: ["reportes", "financieros", "ingresos", "gastos", "estadísticas"]
  },
  { 
    label: "Gestión de Pagos", 
    description: "Administrar pagos y cobros",
    icon: DollarSign,
    action: () => navigateWithLoading('/app/finance'),
    color: "bg-yellow-600",
    category: "Finanzas",
    keywords: ["pagos", "cobros", "administrar", "finanzas", "dinero"]
  },
  
  // Post Venta
  { 
    label: "CRM Post Venta", 
    description: "Gestionar clientes post venta",
    icon: Users,
    action: () => navigateWithLoading('/app/post-sale'),
    color: "bg-purple-600",
    category: "Post Venta",
    keywords: ["post venta", "clientes", "servicio", "mantenimiento", "garantía"]
  },
  { 
    label: "Servicios Programados", 
    description: "Ver servicios de mantenimiento",
    icon: Calendar,
    action: () => navigateWithLoading('/app/post-sale'),
    color: "bg-blue-600",
    category: "Post Venta",
    keywords: ["servicios", "mantenimiento", "programados", "citas", "taller"]
  },
  { 
    label: "Garantías", 
    description: "Administrar garantías de vehículos",
    icon: CheckCircle,
    action: () => navigateWithLoading('/app/post-sale'),
    color: "bg-green-600",
    category: "Post Venta",
    keywords: ["garantías", "administrar", "vehículos", "cobertura", "seguro"]
  },
  
  // Configuración
  { 
    label: "Configuración", 
    description: "Ajustar configuración del sistema",
    icon: Star,
    action: () => navigateWithLoading('/app/settings'),
    color: "bg-gray-600",
    category: "Configuración",
    keywords: ["configuración", "ajustes", "sistema", "preferencias", "opciones"]
  },
  { 
    label: "Usuarios", 
    description: "Gestionar usuarios del sistema",
    icon: Users,
    action: () => navigateWithLoading('/app/settings'),
    color: "bg-indigo-600",
    category: "Configuración",
    keywords: ["usuarios", "gestionar", "permisos", "acceso", "equipo"]
  }
], [navigateWithLoading]);

  // Escuchar el evento personalizado para abrir el modal
  useEffect(() => {
    const handleOpenQuickActions = () => {
      setShowCreateDialog(true);
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    };

    window.addEventListener('openQuickActions', handleOpenQuickActions);
    return () => {
      window.removeEventListener('openQuickActions', handleOpenQuickActions);
    };
  }, []);

  // Filtrar opciones basado en la búsqueda (deferido para no bloquear al escribir)
  const filteredOptions = useMemo(() => {
    if (!deferredSearchQuery.trim()) return createOptions;

    const query = deferredSearchQuery.toLowerCase();
    return createOptions.filter(option =>
      option.label.toLowerCase().includes(query) ||
      option.description.toLowerCase().includes(query) ||
      option.category.toLowerCase().includes(query) ||
      option.keywords.some(keyword => keyword.toLowerCase().includes(query))
    );
  }, [createOptions, deferredSearchQuery]);

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
    <>
    <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
      <DialogContent className={`max-w-4xl min-h-[75vh] max-h-[90vh] border-0 backdrop-blur-sm shadow-2xl p-0 overflow-hidden flex flex-col rounded-2xl ${
        theme === 'dark' 
          ? 'bg-slate-800/95 border-slate-700' 
          : 'bg-white/95'
      }`}>
        {/* Header + Buscador compactos en un solo bloque */}
        <div className={`px-4 pt-4 pb-3 flex-shrink-0 border-b ${
          theme === 'dark' ? 'border-slate-600/50' : 'border-gray-100/50'
        }`}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md shrink-0">
              <Command className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className={`text-lg font-semibold leading-tight ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>Acciones Rápidas</h2>
              <p className={`text-xs truncate ${
                theme === 'dark' ? 'text-slate-400' : 'text-gray-500'
              }`}>
                Busca y ejecuta funciones rápidamente
              </p>
            </div>
          </div>
          <div className="relative group">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${
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
              className={`pl-9 h-9 text-sm rounded-lg ${
                theme === 'dark'
                  ? 'border-slate-600 focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20 bg-slate-700/50 focus:bg-slate-700 text-white placeholder:text-slate-400'
                  : 'border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 bg-gray-50/50 focus:bg-white'
              }`}
            />
          </div>
          {deferredSearchQuery && (
            <div className={`mt-1.5 text-xs font-medium ${
              theme === 'dark' ? 'text-slate-400' : 'text-gray-500'
            }`}>
              {filteredOptions.length} resultado{filteredOptions.length !== 1 ? 's' : ''} encontrado{filteredOptions.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Lista de opciones - altura mínima para que se vean varias opciones sin scroll */}
        <div className="flex-1 min-h-[50vh] overflow-y-auto overflow-x-hidden overscroll-y-contain px-4 py-3 [contain:strict]">
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
            <div className="space-y-4">
              {Object.entries(groupedOptions).map(([category, options]) => (
                <QuickActionCategory
                  key={category}
                  category={category}
                  options={options}
                  theme={theme}
                  onSelect={(action) => {
                    action();
                    setShowCreateDialog(false);
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`px-4 py-3 border-t flex-shrink-0 ${
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
              <span className="ml-2">
                <kbd className={`px-1.5 py-0.5 border rounded text-xs font-mono ${
                  theme === 'dark'
                    ? 'bg-slate-600 border-slate-500 text-slate-300'
                    : 'bg-white border-gray-200'
                }`}>Esc</kbd>
                <span className="ml-1">para cerrar</span>
              </span>
            </div>
            <button 
              className={`font-medium transition-colors ${
                theme === 'dark'
                  ? 'text-blue-400 hover:text-blue-300'
                  : 'text-blue-600 hover:text-blue-700'
              }`}
              onClick={() => setShowShortcutsModal(true)}
            >
              Personalizar atajos
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <ShortcutsCustomizerModal open={showShortcutsModal} onOpenChange={setShowShortcutsModal} />
  </>
  );
}
