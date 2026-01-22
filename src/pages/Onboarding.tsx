import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  CheckCircle, 
  ArrowRight, 
  ArrowLeft, 
  Zap, 
  Users, 
  Car, 
  BarChart3, 
  Settings, 
  Globe, 
  MessageSquare, 
  CreditCard, 
  Shield, 
  Star,
  Sparkles,
  Target,
  TrendingUp,
  Building2,
  Smartphone,
  Mail,
  Calendar,
  FileText,
  Database,
  Cloud,
  Lock,
  Check,
  X,
  Loader2
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

// Datos de integraciones disponibles
const availableIntegrations = [
  {
    id: "chileautos",
    name: "Chileautos",
    description: "Publica y sincroniza tu inventario en Chileautos",
    icon: Globe,
    category: "Portales",
    features: ["Publicación automática", "Sincronización de inventario", "Gestión de avisos"],
    color: "blue",
    popular: true
  },
  {
    id: "mercadolibre",
    name: "Mercado Libre",
    description: "Conecta y publica vehículos en Mercado Libre",
    icon: Globe,
    category: "Portales",
    features: ["Publicaciones centralizadas", "Gestión de stock", "Optimización de avisos"],
    color: "orange",
    popular: true
  },
  {
    id: "crm",
    name: "CRM Avanzado",
    description: "Gestión completa de clientes y leads",
    icon: Users,
    category: "Ventas",
    features: ["Gestión de leads", "Pipeline de ventas", "Seguimiento de clientes", "Automatización"],
    color: "blue",
    popular: true
  },
  {
    id: "inventory",
    name: "Inventario Inteligente",
    description: "Control total de tu stock de vehículos",
    icon: Car,
    category: "Inventario",
    features: ["Control de stock", "Alertas automáticas", "Reportes de rotación", "Integración con proveedores"],
    color: "green",
    popular: true
  },
  {
    id: "analytics",
    name: "Analytics Avanzado",
    description: "Insights profundos sobre tu negocio",
    icon: BarChart3,
    category: "Analytics",
    features: ["Dashboards ejecutivos", "Reportes personalizados", "Predicciones", "KPIs en tiempo real"],
    color: "purple",
    popular: true
  },
  {
    id: "website",
    name: "Constructor de Sitio Web",
    description: "Crea tu presencia online profesional",
    icon: Globe,
    category: "Marketing",
    features: ["Diseño responsive", "SEO optimizado", "Integración con inventario", "Formularios de contacto"],
    color: "indigo",
    popular: false
  },
  {
    id: "messaging",
    name: "Sistema de Mensajería",
    description: "Comunicación unificada con clientes",
    icon: MessageSquare,
    category: "Comunicación",
    features: ["WhatsApp Business", "Email marketing", "SMS automáticos", "Chat en vivo"],
    color: "emerald",
    popular: false
  },
  {
    id: "billing",
    name: "Facturación Digital",
    description: "Gestión completa de facturación",
    icon: CreditCard,
    category: "Finanzas",
    features: ["Facturación electrónica", "Pagos online", "Reportes fiscales", "Integración contable"],
    color: "orange",
    popular: false
  },
  {
    id: "security",
    name: "Seguridad Avanzada",
    description: "Protección de datos y cumplimiento",
    icon: Shield,
    category: "Seguridad",
    features: ["Encriptación de datos", "Backup automático", "Cumplimiento GDPR", "Auditoría de accesos"],
    color: "red",
    popular: false
  },
  {
    id: "mobile",
    name: "App Móvil",
    description: "Acceso completo desde tu smartphone",
    icon: Smartphone,
    category: "Movilidad",
    features: ["Acceso offline", "Notificaciones push", "Sincronización automática", "Interfaz táctil"],
    color: "cyan",
    popular: false
  }
];

// Pasos del onboarding
const onboardingSteps = [
  {
    id: "welcome",
    title: "¡Bienvenido a SKALE Motors!",
    subtitle: "Tu plataforma integral para la gestión automotriz",
    description: "Vamos a configurar tu experiencia personalizada en solo unos minutos."
  },
  {
    id: "business",
    title: "Cuéntanos sobre tu negocio",
    subtitle: "Personaliza la plataforma para tu automotora",
    description: "Esta información nos ayudará a adaptar las funcionalidades a tus necesidades específicas."
  },
  {
    id: "integrations",
    title: "Selecciona tus integraciones",
    subtitle: "Elige las herramientas que necesitas",
    description: "Puedes activar o desactivar estas integraciones en cualquier momento desde configuración."
  },
  {
    id: "team",
    title: "Configura tu equipo",
    subtitle: "Invita a tu equipo y define roles",
    description: "Agrega a los miembros de tu equipo y asigna los permisos correspondientes."
  },
  {
    id: "preferences",
    title: "Personaliza tu experiencia",
    subtitle: "Ajusta la plataforma a tu estilo",
    description: "Configura tus preferencias de visualización y notificaciones."
  },
  {
    id: "complete",
    title: "¡Todo listo!",
    subtitle: "Tu plataforma está configurada",
    description: "Ya puedes comenzar a usar todas las funcionalidades de SKALE Motors."
  }
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user, completeOnboarding } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedIntegrations, setSelectedIntegrations] = useState<string[]>([]);
  const [businessInfo, setBusinessInfo] = useState({
    name: "",
    type: "",
    size: "",
    location: "",
    years: ""
  });
  const [teamMembers, setTeamMembers] = useState([
    { name: "", email: "", role: "vendedor" }
  ]);
  const [platformConnections, setPlatformConnections] = useState({
    chileautos: {
      clientId: "",
      clientSecret: "",
      sellerIdentifier: "",
      connected: false
    },
    mercadolibre: {
      accessToken: "",
      connected: false
    }
  });
  const [preferences, setPreferences] = useState({
    theme: "light",
    notifications: true,
    language: "es",
    timezone: "America/Santiago"
  });
  const [isLoading, setIsLoading] = useState(false);

  const progress = ((currentStep + 1) / onboardingSteps.length) * 100;

  const handleNext = () => {
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleIntegrationToggle = (integrationId: string) => {
    setSelectedIntegrations(prev => 
      prev.includes(integrationId) 
        ? prev.filter(id => id !== integrationId)
        : [...prev, integrationId]
    );
  };

  const handlePlatformFieldChange = (
    platform: "chileautos" | "mercadolibre",
    field: "clientId" | "clientSecret" | "sellerIdentifier" | "accessToken",
    value: string
  ) => {
    setPlatformConnections(prev => ({
      ...prev,
      [platform]: {
        ...prev[platform],
        [field]: value
      }
    }));
  };

  const handlePlatformConnect = (platform: "chileautos" | "mercadolibre") => {
    if (platform === "chileautos") {
      const { clientId, clientSecret, sellerIdentifier } = platformConnections.chileautos;
      if (!clientId || !clientSecret || !sellerIdentifier) {
        toast({
          title: "Faltan datos",
          description: "Completa Client ID, Client Secret y Seller Identifier para conectar Chileautos.",
          variant: "destructive",
        });
        return;
      }
    }

    if (platform === "mercadolibre") {
      const { accessToken } = platformConnections.mercadolibre;
      if (!accessToken) {
        toast({
          title: "Faltan datos",
          description: "Ingresa tu Access Token para conectar Mercado Libre.",
          variant: "destructive",
        });
        return;
      }
    }

    setPlatformConnections(prev => ({
      ...prev,
      [platform]: {
        ...prev[platform],
        connected: true
      }
    }));

    toast({
      title: "Conexión registrada",
      description:
        platform === "chileautos"
          ? "Chileautos quedó conectado para este onboarding."
          : "Mercado Libre quedó conectado para este onboarding.",
    });
  };

  const handleCompleteOnboarding = async () => {
    if (!user) {
      console.error("❌ No hay usuario autenticado");
      toast({
        title: "Error de autenticación",
        description: "No hay usuario autenticado. Por favor, inicia sesión nuevamente.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Simular guardado de configuración
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Aquí se guardaría la configuración en la base de datos
      console.log("💾 Guardando configuración de onboarding:", {
        businessInfo,
        selectedIntegrations,
        teamMembers,
        preferences
      });
      
      // Marcar el onboarding como completado en el contexto
      await completeOnboarding();
      
      console.log("✅ Onboarding completado, redirigiendo...");
      
      toast({
        title: "¡Onboarding completado!",
        description: "Tu configuración ha sido guardada exitosamente.",
      });
      
      // Pequeño delay para asegurar que el estado se actualice y mostrar el toast
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Redirigir al Dashboard General
      navigate("/app");
    } catch (error) {
      console.error("❌ Error completando onboarding:", error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      toast({
        title: "Error al completar onboarding",
        description: `No se pudo completar el proceso: ${errorMessage}. Por favor, intenta nuevamente.`,
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const renderStepContent = () => {
    const step = onboardingSteps[currentStep];

    switch (step.id) {
      case "welcome":
        return (
          <div className="text-center space-y-10">
            <div className="relative inline-block">
              <div className={`w-40 h-40 mx-auto rounded-full flex items-center justify-center shadow-2xl ${
                theme === 'dark' 
                  ? 'bg-gradient-to-br from-cyan-500 via-blue-500 to-blue-600' 
                  : 'bg-gradient-to-br from-cyan-400 via-blue-500 to-blue-600'
              }`}>
                <svg className="h-20 w-20 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
              </div>
              <div className="absolute -top-1 -right-1 w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center shadow-lg ring-4 ring-white dark:ring-slate-900">
                <Check className="w-6 h-6 text-white" />
              </div>
            </div>
            
            <div className="space-y-5">
              <h2 className={`text-5xl font-bold bg-gradient-to-r ${
                theme === 'dark' 
                  ? 'from-cyan-400 via-blue-400 to-blue-500' 
                  : 'from-cyan-600 via-blue-600 to-blue-700'
              } bg-clip-text text-transparent`}>
                {step.title}
              </h2>
              <p className={`text-2xl font-semibold ${
                theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
              }`}>
                {step.subtitle}
              </p>
              <p className={`text-lg max-w-2xl mx-auto ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {step.description}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto mt-12">
              <div className={`group p-8 rounded-2xl transition-all duration-300 ${
                theme === 'dark' 
                  ? 'bg-gradient-to-br from-slate-800/90 to-slate-900/90 border border-slate-700/50' 
                  : 'bg-gradient-to-br from-white to-gray-50 border border-gray-200'
              } shadow-lg hover:shadow-2xl hover:scale-105 hover:-translate-y-1`}>
                <div className={`w-16 h-16 mx-auto mb-6 rounded-xl flex items-center justify-center ${
                  theme === 'dark' 
                    ? 'bg-gradient-to-br from-cyan-500/20 to-blue-500/20' 
                    : 'bg-gradient-to-br from-cyan-100 to-blue-100'
                } group-hover:scale-110 transition-transform duration-300`}>
                  <Target className={`w-8 h-8 ${
                    theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'
                  }`} />
                </div>
                <h3 className={`text-xl font-bold mb-3 ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>
                  Gestión Completa
                </h3>
                <p className={`text-sm leading-relaxed ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Desde leads hasta entregas, todo en una plataforma
                </p>
              </div>
              
              <div className={`group p-8 rounded-2xl transition-all duration-300 ${
                theme === 'dark' 
                  ? 'bg-gradient-to-br from-slate-800/90 to-slate-900/90 border border-slate-700/50' 
                  : 'bg-gradient-to-br from-white to-gray-50 border border-gray-200'
              } shadow-lg hover:shadow-2xl hover:scale-105 hover:-translate-y-1`}>
                <div className={`w-16 h-16 mx-auto mb-6 rounded-xl flex items-center justify-center ${
                  theme === 'dark' 
                    ? 'bg-gradient-to-br from-emerald-500/20 to-green-500/20' 
                    : 'bg-gradient-to-br from-emerald-100 to-green-100'
                } group-hover:scale-110 transition-transform duration-300`}>
                  <TrendingUp className={`w-8 h-8 ${
                    theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                  }`} />
                </div>
                <h3 className={`text-xl font-bold mb-3 ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>
                  Analytics Avanzado
                </h3>
                <p className={`text-sm leading-relaxed ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Insights profundos para optimizar tu negocio
                </p>
              </div>
              
              <div className={`group p-8 rounded-2xl transition-all duration-300 ${
                theme === 'dark' 
                  ? 'bg-gradient-to-br from-slate-800/90 to-slate-900/90 border border-slate-700/50' 
                  : 'bg-gradient-to-br from-white to-gray-50 border border-gray-200'
              } shadow-lg hover:shadow-2xl hover:scale-105 hover:-translate-y-1`}>
                <div className={`w-16 h-16 mx-auto mb-6 rounded-xl flex items-center justify-center ${
                  theme === 'dark' 
                    ? 'bg-gradient-to-br from-blue-500/20 to-indigo-500/20' 
                    : 'bg-gradient-to-br from-blue-100 to-indigo-100'
                } group-hover:scale-110 transition-transform duration-300`}>
                  <Shield className={`w-8 h-8 ${
                    theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                  }`} />
                </div>
                <h3 className={`text-xl font-bold mb-3 ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>
                  Seguridad Enterprise
                </h3>
                <p className={`text-sm leading-relaxed ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Protección de datos de nivel empresarial
                </p>
              </div>
            </div>
          </div>
        );

      case "business":
        return (
          <div className="max-w-2xl mx-auto space-y-8">
            <div className="text-center space-y-4">
              <div className={`w-20 h-20 mx-auto rounded-xl flex items-center justify-center ${
                theme === 'dark' 
                  ? 'bg-gradient-to-br from-cyan-500/20 to-blue-500/20' 
                  : 'bg-gradient-to-br from-cyan-100 to-blue-100'
              }`}>
                <Building2 className={`w-10 h-10 ${
                  theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'
                }`} />
              </div>
              <h2 className={`text-3xl font-bold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                {step.title}
              </h2>
              <p className={`text-lg ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              }`}>
                {step.description}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Nombre de la Automotora *
                </label>
                <input
                  type="text"
                  value={businessInfo.name}
                  onChange={(e) => setBusinessInfo({...businessInfo, name: e.target.value})}
                  className={`w-full px-4 py-3 rounded-lg border transition-all duration-200 ${
                    theme === 'dark' 
                      ? 'bg-slate-800 border-slate-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  } focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500`}
                  placeholder="Ej: Automotora Los Andes"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Tipo de Negocio *
                </label>
                <select
                  value={businessInfo.type}
                  onChange={(e) => setBusinessInfo({...businessInfo, type: e.target.value})}
                  className={`w-full px-4 py-3 rounded-lg border transition-all duration-200 ${
                    theme === 'dark' 
                      ? 'bg-slate-800 border-slate-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  } focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500`}
                >
                  <option value="">Seleccionar tipo</option>
                  <option value="nuevos">Vehículos Nuevos</option>
                  <option value="usados">Vehículos Usados</option>
                  <option value="mixto">Nuevos y Usados</option>
                  <option value="consignacion">Consignación</option>
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Tamaño del Negocio *
                </label>
                <select
                  value={businessInfo.size}
                  onChange={(e) => setBusinessInfo({...businessInfo, size: e.target.value})}
                  className={`w-full px-4 py-3 rounded-lg border transition-all duration-200 ${
                    theme === 'dark' 
                      ? 'bg-slate-800 border-slate-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  } focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500`}
                >
                  <option value="">Seleccionar tamaño</option>
                  <option value="pequeno">1-5 empleados</option>
                  <option value="mediano">6-20 empleados</option>
                  <option value="grande">21-50 empleados</option>
                  <option value="empresa">50+ empleados</option>
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Años en el Negocio *
                </label>
                <select
                  value={businessInfo.years}
                  onChange={(e) => setBusinessInfo({...businessInfo, years: e.target.value})}
                  className={`w-full px-4 py-3 rounded-lg border transition-all duration-200 ${
                    theme === 'dark' 
                      ? 'bg-slate-800 border-slate-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  } focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500`}
                >
                  <option value="">Seleccionar años</option>
                  <option value="nuevo">Menos de 1 año</option>
                  <option value="1-3">1-3 años</option>
                  <option value="3-5">3-5 años</option>
                  <option value="5-10">5-10 años</option>
                  <option value="10+">Más de 10 años</option>
                </select>
              </div>
            </div>
          </div>
        );

      case "integrations":
        const showChileautos = selectedIntegrations.includes("chileautos");
        const showMercadoLibre = selectedIntegrations.includes("mercadolibre");

        return (
          <div className="max-w-6xl mx-auto space-y-8">
            <div className="text-center space-y-4">
              <div className={`w-20 h-20 mx-auto rounded-xl flex items-center justify-center ${
                theme === 'dark' 
                  ? 'bg-gradient-to-br from-yellow-500/20 to-amber-500/20' 
                  : 'bg-gradient-to-br from-yellow-100 to-amber-100'
              }`}>
                <Zap className={`w-10 h-10 ${
                  theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'
                }`} />
              </div>
              <h2 className={`text-3xl font-bold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                {step.title}
              </h2>
              <p className={`text-lg ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              }`}>
                {step.description}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {availableIntegrations.map((integration) => {
                const Icon = integration.icon;
                const isSelected = selectedIntegrations.includes(integration.id);
                
                return (
                  <Card 
                    key={integration.id}
                    className={`cursor-pointer transition-all duration-300 ${
                      isSelected 
                        ? `border-2 shadow-xl scale-105 ${
                            integration.color === 'blue' ? 'border-cyan-500 bg-cyan-50/50 dark:bg-cyan-900/10' :
                            integration.color === 'green' ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10' :
                            integration.color === 'purple' ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-900/10' :
                            integration.color === 'indigo' ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/10' :
                            integration.color === 'emerald' ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10' :
                            integration.color === 'orange' ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-900/10' :
                            integration.color === 'red' ? 'border-red-500 bg-red-50/50 dark:bg-red-900/10' :
                            'border-cyan-500 bg-cyan-50/50 dark:bg-cyan-900/10'
                          }` 
                        : `hover:shadow-lg hover:scale-[1.02] ${
                            theme === 'dark' ? 'border-slate-700 hover:border-slate-600' : 'border-gray-200 hover:border-gray-300'
                          }`
                    } ${
                      theme === 'dark' ? 'bg-slate-800' : 'bg-white'
                    }`}
                    onClick={() => handleIntegrationToggle(integration.id)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className={`p-3 rounded-lg ${
                          integration.color === 'blue' ? 'bg-blue-100 dark:bg-blue-900/30' :
                          integration.color === 'green' ? 'bg-green-100 dark:bg-green-900/30' :
                          integration.color === 'purple' ? 'bg-purple-100 dark:bg-purple-900/30' :
                          integration.color === 'indigo' ? 'bg-indigo-100 dark:bg-indigo-900/30' :
                          integration.color === 'emerald' ? 'bg-emerald-100 dark:bg-emerald-900/30' :
                          integration.color === 'orange' ? 'bg-orange-100 dark:bg-orange-900/30' :
                          integration.color === 'red' ? 'bg-red-100 dark:bg-red-900/30' :
                          'bg-cyan-100 dark:bg-cyan-900/30'
                        }`}>
                          <Icon className={`w-6 h-6 ${
                            integration.color === 'blue' ? 'text-blue-600 dark:text-blue-400' :
                            integration.color === 'green' ? 'text-green-600 dark:text-green-400' :
                            integration.color === 'purple' ? 'text-purple-600 dark:text-purple-400' :
                            integration.color === 'indigo' ? 'text-indigo-600 dark:text-indigo-400' :
                            integration.color === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' :
                            integration.color === 'orange' ? 'text-orange-600 dark:text-orange-400' :
                            integration.color === 'red' ? 'text-red-600 dark:text-red-400' :
                            'text-cyan-600 dark:text-cyan-400'
                          }`} />
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {integration.popular && (
                            <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                              Popular
                            </Badge>
                          )}
                          {isSelected && (
                            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <CardTitle className={`text-lg ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>
                        {integration.name}
                      </CardTitle>
                      <CardDescription className={`${
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        {integration.description}
                      </CardDescription>
                    </CardHeader>
                    
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        <p className={`text-sm font-medium ${
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          Características:
                        </p>
                        <ul className="space-y-1">
                          {integration.features.map((feature, index) => (
                            <li key={index} className={`flex items-center gap-2 text-sm ${
                              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                            }`}>
                              <Check className="w-3 h-3 text-green-500 flex-shrink-0" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {(showChileautos || showMercadoLibre) && (
              <div className="space-y-6">
                <div className="text-left space-y-2">
                  <h3 className={`text-xl font-semibold ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    Conecta tus plataformas
                  </h3>
                  <p className={`text-sm ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Completa los datos necesarios para dejar activadas tus conexiones.
                  </p>
                </div>

                {showChileautos && (
                  <Card className={`${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            Chileautos
                          </CardTitle>
                          <CardDescription>
                            Credenciales de Global Inventory API
                          </CardDescription>
                        </div>
                        <Badge className={platformConnections.chileautos.connected ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-300"}>
                          {platformConnections.chileautos.connected ? "Conectado" : "No conectado"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className={`block text-sm font-medium mb-2 ${
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            Client ID
                          </label>
                          <input
                            type="text"
                            value={platformConnections.chileautos.clientId}
                            onChange={(e) => handlePlatformFieldChange("chileautos", "clientId", e.target.value)}
                            placeholder="UUID de client_id"
                            className={`w-full px-4 py-3 rounded-lg border ${
                              theme === 'dark' 
                                ? 'bg-slate-800 border-slate-600 text-white' 
                                : 'bg-white border-gray-300 text-gray-900'
                            } focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500`}
                          />
                        </div>
                        <div>
                          <label className={`block text-sm font-medium mb-2 ${
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            Client Secret
                          </label>
                          <input
                            type="password"
                            value={platformConnections.chileautos.clientSecret}
                            onChange={(e) => handlePlatformFieldChange("chileautos", "clientSecret", e.target.value)}
                            placeholder="Clave secreta"
                            className={`w-full px-4 py-3 rounded-lg border ${
                              theme === 'dark' 
                                ? 'bg-slate-800 border-slate-600 text-white' 
                                : 'bg-white border-gray-300 text-gray-900'
                            } focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500`}
                          />
                        </div>
                        <div>
                          <label className={`block text-sm font-medium mb-2 ${
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            Seller Identifier
                          </label>
                          <input
                            type="text"
                            value={platformConnections.chileautos.sellerIdentifier}
                            onChange={(e) => handlePlatformFieldChange("chileautos", "sellerIdentifier", e.target.value)}
                            placeholder="GUID de la sucursal"
                            className={`w-full px-4 py-3 rounded-lg border ${
                              theme === 'dark' 
                                ? 'bg-slate-800 border-slate-600 text-white' 
                                : 'bg-white border-gray-300 text-gray-900'
                            } focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500`}
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <Button onClick={() => handlePlatformConnect("chileautos")}>
                          Conectar Chileautos
                        </Button>
                        <a
                          href="https://www.chileautos.cl/staticpages/global-inventory-integration"
                          target="_blank"
                          rel="noreferrer"
                          className={`text-sm underline ${
                            theme === 'dark' ? 'text-cyan-300' : 'text-cyan-600'
                          }`}
                        >
                          Ver guía de integración
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {showMercadoLibre && (
                  <Card className={`${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            Mercado Libre
                          </CardTitle>
                          <CardDescription>
                            Access Token para API/MCP
                          </CardDescription>
                        </div>
                        <Badge className={platformConnections.mercadolibre.connected ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-300"}>
                          {platformConnections.mercadolibre.connected ? "Conectado" : "No conectado"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          Access Token
                        </label>
                        <input
                          type="password"
                          value={platformConnections.mercadolibre.accessToken}
                          onChange={(e) => handlePlatformFieldChange("mercadolibre", "accessToken", e.target.value)}
                          placeholder="Bearer Access Token"
                          className={`w-full px-4 py-3 rounded-lg border ${
                            theme === 'dark' 
                              ? 'bg-slate-800 border-slate-600 text-white' 
                              : 'bg-white border-gray-300 text-gray-900'
                          } focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500`}
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <Button onClick={() => handlePlatformConnect("mercadolibre")}>
                          Conectar Mercado Libre
                        </Button>
                        <a
                          href="https://developers.mercadolibre.cl/es_ar/mcp-server"
                          target="_blank"
                          rel="noreferrer"
                          className={`text-sm underline ${
                            theme === 'dark' ? 'text-cyan-300' : 'text-cyan-600'
                          }`}
                        >
                          Ver guía MCP Server
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        );

      case "team":
        return (
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="text-center space-y-4">
              <div className={`w-20 h-20 mx-auto rounded-xl flex items-center justify-center ${
                theme === 'dark' 
                  ? 'bg-gradient-to-br from-emerald-500/20 to-green-500/20' 
                  : 'bg-gradient-to-br from-emerald-100 to-green-100'
              }`}>
                <Users className={`w-10 h-10 ${
                  theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                }`} />
              </div>
              <h2 className={`text-3xl font-bold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                {step.title}
              </h2>
              <p className={`text-lg ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              }`}>
                {step.description}
              </p>
            </div>

            <div className="space-y-6">
              {teamMembers.map((member, index) => (
                <Card key={index} className={`${
                  theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'
                }`}>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          Nombre Completo
                        </label>
                        <input
                          type="text"
                          value={member.name}
                          onChange={(e) => {
                            const newMembers = [...teamMembers];
                            newMembers[index].name = e.target.value;
                            setTeamMembers(newMembers);
                          }}
                          className={`w-full px-4 py-3 rounded-lg border ${
                            theme === 'dark' 
                              ? 'bg-slate-800 border-slate-600 text-white' 
                              : 'bg-white border-gray-300 text-gray-900'
                          } focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500`}
                          placeholder="Ej: María González"
                        />
                      </div>
                      
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          Email
                        </label>
                        <input
                          type="email"
                          value={member.email}
                          onChange={(e) => {
                            const newMembers = [...teamMembers];
                            newMembers[index].email = e.target.value;
                            setTeamMembers(newMembers);
                          }}
                          className={`w-full px-4 py-3 rounded-lg border ${
                            theme === 'dark' 
                              ? 'bg-slate-800 border-slate-600 text-white' 
                              : 'bg-white border-gray-300 text-gray-900'
                          } focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500`}
                          placeholder="maria@automotora.com"
                        />
                      </div>
                      
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          Rol
                        </label>
                        <select
                          value={member.role}
                          onChange={(e) => {
                            const newMembers = [...teamMembers];
                            newMembers[index].role = e.target.value;
                            setTeamMembers(newMembers);
                          }}
                          className={`w-full px-4 py-3 rounded-lg border ${
                            theme === 'dark' 
                              ? 'bg-slate-800 border-slate-600 text-white' 
                              : 'bg-white border-gray-300 text-gray-900'
                          } focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500`}
                        >
                          <option value="vendedor">Vendedor</option>
                          <option value="gerente">Gerente</option>
                          <option value="admin">Administrador</option>
                          <option value="contador">Contador</option>
                          <option value="mecanico">Mecánico</option>
                        </select>
                      </div>
                    </div>
                    
                    {teamMembers.length > 1 && (
                      <div className="mt-4 flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newMembers = teamMembers.filter((_, i) => i !== index);
                            setTeamMembers(newMembers);
                          }}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Eliminar
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              
              <Button
                variant="outline"
                onClick={() => setTeamMembers([...teamMembers, { name: "", email: "", role: "vendedor" }])}
                className="w-full"
              >
                <Users className="w-4 h-4 mr-2" />
                Agregar Miembro del Equipo
              </Button>
            </div>
          </div>
        );

      case "preferences":
        return (
          <div className="max-w-2xl mx-auto space-y-8">
            <div className="text-center space-y-4">
              <div className={`w-20 h-20 mx-auto rounded-xl flex items-center justify-center ${
                theme === 'dark' 
                  ? 'bg-gradient-to-br from-blue-500/20 to-indigo-500/20' 
                  : 'bg-gradient-to-br from-blue-100 to-indigo-100'
              }`}>
                <Settings className={`w-10 h-10 ${
                  theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                }`} />
              </div>
              <h2 className={`text-3xl font-bold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                {step.title}
              </h2>
              <p className={`text-lg ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              }`}>
                {step.description}
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Tema de la Interfaz
                </label>
                <select
                  value={preferences.theme}
                  onChange={(e) => setPreferences({...preferences, theme: e.target.value})}
                  className={`w-full px-4 py-3 rounded-lg border transition-all duration-200 ${
                    theme === 'dark' 
                      ? 'bg-slate-800 border-slate-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  } focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500`}
                >
                  <option value="light">Claro</option>
                  <option value="dark">Oscuro</option>
                  <option value="auto">Automático</option>
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Idioma
                </label>
                <select
                  value={preferences.language}
                  onChange={(e) => setPreferences({...preferences, language: e.target.value})}
                  className={`w-full px-4 py-3 rounded-lg border transition-all duration-200 ${
                    theme === 'dark' 
                      ? 'bg-slate-800 border-slate-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  } focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500`}
                >
                  <option value="es">Español</option>
                  <option value="en">English</option>
                  <option value="pt">Português</option>
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Zona Horaria
                </label>
                <select
                  value={preferences.timezone}
                  onChange={(e) => setPreferences({...preferences, timezone: e.target.value})}
                  className={`w-full px-4 py-3 rounded-lg border transition-all duration-200 ${
                    theme === 'dark' 
                      ? 'bg-slate-800 border-slate-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  } focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500`}
                >
                  <option value="America/Santiago">Santiago (GMT-3)</option>
                  <option value="America/Lima">Lima (GMT-5)</option>
                  <option value="America/Bogota">Bogotá (GMT-5)</option>
                  <option value="America/Mexico_City">México (GMT-6)</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-slate-700">
                <div>
                  <h3 className={`font-medium ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    Notificaciones
                  </h3>
                  <p className={`text-sm ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Recibir notificaciones por email y push
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.notifications}
                  onChange={(e) => setPreferences({...preferences, notifications: e.target.checked})}
                  className="w-5 h-5 text-cyan-600 rounded focus:ring-cyan-500"
                />
              </div>
            </div>
          </div>
        );

      case "complete":
        return (
          <div className="text-center space-y-10">
            <div className="relative inline-block">
              <div className={`w-40 h-40 mx-auto rounded-full flex items-center justify-center shadow-2xl ${
                theme === 'dark' 
                  ? 'bg-gradient-to-br from-emerald-500 via-green-500 to-emerald-600' 
                  : 'bg-gradient-to-br from-emerald-400 via-green-500 to-emerald-600'
              }`}>
                <CheckCircle className="w-20 h-20 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-12 h-12 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-full flex items-center justify-center shadow-lg ring-4 ring-white dark:ring-slate-900 animate-bounce">
                <Star className="w-6 h-6 text-white" />
              </div>
            </div>
            
            <div className="space-y-5">
              <h2 className={`text-5xl font-bold bg-gradient-to-r ${
                theme === 'dark' 
                  ? 'from-emerald-400 via-green-400 to-emerald-500' 
                  : 'from-emerald-600 via-green-600 to-emerald-700'
              } bg-clip-text text-transparent`}>
                {step.title}
              </h2>
              <p className={`text-2xl font-semibold ${
                theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
              }`}>
                {step.subtitle}
              </p>
              <p className={`text-lg max-w-2xl mx-auto ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {step.description}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto mt-12">
              <div className={`p-8 rounded-2xl transition-all duration-300 ${
                theme === 'dark' 
                  ? 'bg-gradient-to-br from-slate-800/90 to-slate-900/90 border border-slate-700/50' 
                  : 'bg-gradient-to-br from-white to-gray-50 border border-gray-200'
              } shadow-lg hover:shadow-xl`}>
                <div className="flex items-center gap-4 mb-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    theme === 'dark' 
                      ? 'bg-gradient-to-br from-cyan-500/20 to-blue-500/20' 
                      : 'bg-gradient-to-br from-cyan-100 to-blue-100'
                  }`}>
                    <CheckCircle className={`w-6 h-6 ${
                      theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'
                    }`} />
                  </div>
                  <h3 className={`text-xl font-bold ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    Configuración Completada
                  </h3>
                </div>
                <p className={`text-base ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {selectedIntegrations.length} integraciones activadas
                </p>
              </div>
              
              <div className={`p-8 rounded-2xl transition-all duration-300 ${
                theme === 'dark' 
                  ? 'bg-gradient-to-br from-slate-800/90 to-slate-900/90 border border-slate-700/50' 
                  : 'bg-gradient-to-br from-white to-gray-50 border border-gray-200'
              } shadow-lg hover:shadow-xl`}>
                <div className="flex items-center gap-4 mb-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    theme === 'dark' 
                      ? 'bg-gradient-to-br from-emerald-500/20 to-green-500/20' 
                      : 'bg-gradient-to-br from-emerald-100 to-green-100'
                  }`}>
                    <Users className={`w-6 h-6 ${
                      theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                    }`} />
                  </div>
                  <h3 className={`text-xl font-bold ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    Equipo Configurado
                  </h3>
                </div>
                <p className={`text-base ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {teamMembers.length} miembros del equipo
                </p>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`min-h-screen ${
      theme === 'dark' 
        ? 'bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800' 
        : 'bg-gradient-to-br from-gray-50 via-white to-gray-50'
    }`}>
      {/* Header */}
      <div className={`border-b backdrop-blur-sm ${
        theme === 'dark' 
          ? 'border-slate-800 bg-slate-900/80' 
          : 'border-gray-200 bg-white/80'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg`}>
                <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
              </div>
              <span className={`text-xl font-bold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                SKALE Motors
              </span>
            </div>
            
            <div className="flex items-center gap-4">
              <div className={`text-sm ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {user?.full_name || 'Usuario'}
              </div>
              <div className={`w-10 h-10 rounded-full ${
                theme === 'dark' 
                  ? 'bg-gradient-to-br from-slate-700 to-slate-600' 
                  : 'bg-gradient-to-br from-gray-200 to-gray-300'
              } flex items-center justify-center shadow-md`}>
                <span className={`text-sm font-medium ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>
                  {(user?.full_name || 'U').charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className={`border-b backdrop-blur-sm ${
        theme === 'dark' 
          ? 'border-slate-800 bg-slate-900/80' 
          : 'border-gray-200 bg-white/80'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm font-medium ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Paso {currentStep + 1} de {onboardingSteps.length}
            </span>
            <span className={`text-sm ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              {Math.round(progress)}% completado
            </span>
          </div>
          <div className="h-3 w-full rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all duration-500 ease-out rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-4xl mx-auto">
          {renderStepContent()}
        </div>
      </div>

      {/* Footer Navigation */}
      <div className={`fixed bottom-0 left-0 right-0 border-t backdrop-blur-md shadow-2xl ${
        theme === 'dark' 
          ? 'border-slate-800 bg-slate-900/95' 
          : 'border-gray-200 bg-white/95'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Anterior
            </Button>

            <div className="flex items-center gap-2">
              {onboardingSteps.map((_, index) => (
                <div
                  key={index}
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                    index === currentStep 
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 w-8' 
                      : index < currentStep 
                        ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' 
                        : theme === 'dark' 
                          ? 'bg-slate-600' 
                          : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>

            {currentStep === onboardingSteps.length - 1 ? (
              <Button
                onClick={handleCompleteOnboarding}
                disabled={isLoading}
                className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Configurando...
                  </>
                ) : (
                  <>
                    Comenzar
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
              >
                Siguiente
                <ArrowRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
