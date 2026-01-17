import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Sparkles, 
  Image, 
  PenTool, 
  Video, 
  FileText, 
  Palette, 
  Zap, 
  Brain,
  Camera,
  Wand2,
  Lightbulb,
  Target,
  TrendingUp,
  ArrowRight,
  Settings,
  Plus,
  MessageSquare,
  Zap as ZapIcon,
  Globe,
  Layout,
  Bot,
  Cpu,
  Car,
  Phone,
  BarChart3,
  Megaphone,
  Mail,
  Calendar,
  DollarSign,
  Users,
  Search
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AITool {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  category: 'content' | 'visual' | 'analytics' | 'automation' | 'sales' | 'marketing';
  status: 'available' | 'coming_soon' | 'beta';
  features: string[];
  color: string;
  route?: string;
}

const aiTools: AITool[] = [
  {
    id: 'vehicle-descriptions',
    title: 'Descripciones de Vehículos',
    description: 'Genera descripciones profesionales y atractivas para tus vehículos. Crea textos optimizados para portales y catálogos que convierten.',
    icon: Car,
    category: 'content',
    status: 'available',
    features: ['Descripciones optimizadas', 'SEO integrado', 'Múltiples formatos', 'Tono personalizable'],
    color: 'from-blue-500 to-cyan-500',
    route: '/app/studio-ia/content/descriptions'
  },
  {
    id: 'social-posts',
    title: 'Generador de Posts para Redes',
    description: 'Crea posts atractivos para Instagram, Facebook y otras redes sociales. Genera contenido automotriz que engancha y convierte.',
    icon: Megaphone,
    category: 'content',
    status: 'available',
    features: ['Posts para Instagram', 'Contenido Facebook', 'Hashtags automáticos', 'Call-to-actions'],
    color: 'from-blue-500 to-cyan-500',
    route: '/app/studio-ia/content/posts'
  },
  {
    id: 'call-scripts',
    title: 'Scripts para Llamadas',
    description: 'Genera scripts personalizados para llamadas de seguimiento, ventas y atención al cliente. Mejora tus conversaciones telefónicas.',
    icon: Phone,
    category: 'sales',
    status: 'available',
    features: ['Scripts personalizados', 'Objeción handling', 'Cierre de ventas', 'Seguimiento'],
    color: 'from-green-500 to-emerald-500',
    route: '/app/studio-ia/sales/call-scripts'
  },
  {
    id: 'vehicle-images',
    title: 'Optimizador de Imágenes',
    description: 'Mejora y optimiza las imágenes de tus vehículos. Genera fondos profesionales y ajusta automáticamente para portales.',
    icon: Image,
    category: 'visual',
    status: 'beta',
    features: ['Fondos automáticos', 'Ajuste de calidad', 'Batch processing', 'Formato optimizado'],
    color: 'from-orange-500 to-red-500',
    route: '/app/studio-ia/visual/image-optimizer'
  },
  {
    id: 'seo-automotriz',
    title: 'SEO Automotriz',
    description: 'Optimiza el SEO de tus vehículos y páginas web. Genera meta descriptions, keywords y contenido optimizado para motores de búsqueda.',
    icon: Search,
    category: 'marketing',
    status: 'available',
    features: ['Keyword research', 'Meta optimization', 'Content suggestions', 'Competitor analysis'],
    color: 'from-yellow-500 to-amber-500',
    route: '/app/studio-ia/marketing/seo'
  },
  {
    id: 'facebook-ads',
    title: 'Campañas Facebook Ads',
    description: 'Crea anuncios efectivos para Facebook e Instagram. Genera copies, imágenes y estrategias de targeting para tu automotora.',
    icon: Megaphone,
    category: 'marketing',
    status: 'available',
    features: ['Ad copies', 'Audience targeting', 'Budget optimization', 'A/B testing'],
    color: 'from-blue-600 to-cyan-500',
    route: '/app/studio-ia/marketing/facebook-ads'
  },
  {
    id: 'google-ads',
    title: 'Google Ads para Vehículos',
    description: 'Genera campañas optimizadas para Google Ads. Crea anuncios de búsqueda y display que atraen compradores calificados.',
    icon: Target,
    category: 'marketing',
    status: 'available',
    features: ['Search ads', 'Display campaigns', 'Keyword optimization', 'Landing pages'],
    color: 'from-teal-500 to-cyan-500',
    route: '/app/studio-ia/marketing/google-ads'
  },
  {
    id: 'email-marketing',
    title: 'Email Marketing Automotriz',
    description: 'Crea emails promocionales, newsletters y secuencias automatizadas para mantener a tus clientes y leads comprometidos.',
    icon: Mail,
    category: 'marketing',
    status: 'coming_soon',
    features: ['Templates personalizados', 'Secuencias automáticas', 'A/B testing', 'Analytics'],
    color: 'from-rose-500 to-pink-500',
    route: '/app/studio-ia/marketing/email'
  },
  {
    id: 'pricing-optimizer',
    title: 'Optimizador de Precios',
    description: 'Encuentra el precio óptimo para tus vehículos basado en análisis de mercado, competencia y demanda.',
    icon: DollarSign,
    category: 'analytics',
    status: 'beta',
    features: ['Market analysis', 'Competitor pricing', 'Demand forecasting', 'Profit optimization'],
    color: 'from-emerald-500 to-teal-500',
    route: '/app/studio-ia/analytics/pricing-optimizer'
  },
  {
    id: 'customer-insights',
    title: 'Análisis de Clientes',
    description: 'Analiza reviews, comentarios y feedback de clientes para entender mejor las necesidades del mercado automotriz.',
    icon: Brain,
    category: 'analytics',
    status: 'coming_soon',
    features: ['Sentiment analysis', 'Trend detection', 'Customer feedback', 'Market insights'],
    color: 'from-blue-600 to-cyan-500',
    route: '/app/studio-ia/analytics/customer-insights'
  },
  {
    id: 'chatbot-builder',
    title: 'Chatbot para Automotora',
    description: 'Crea chatbots inteligentes para atención al cliente, consultas sobre vehículos y agendamiento de test drives.',
    icon: MessageSquare,
    category: 'automation',
    status: 'coming_soon',
    features: ['Natural conversations', 'Multi-language', 'Integration ready', 'Analytics included'],
    color: 'from-blue-600 to-cyan-500',
    route: '/app/studio-ia/automation/chatbot'
  },
  {
    id: 'website-builder',
    title: 'Website Builder Automotriz',
    description: 'Construye sitios web profesionales para tu automotora con plantillas inteligentes optimizadas para conversiones.',
    icon: Globe,
    category: 'visual',
    status: 'available',
    features: ['Plantillas automotrices', 'Diseño responsive', 'SEO automático', 'Optimización conversiones'],
    color: 'from-cyan-500 to-blue-500',
    route: '/app/website-builder'
  },
  {
    id: 'logo-generator',
    title: 'Generador de Logos',
    description: 'Crea logos profesionales y únicos para tu automotora usando IA. Genera múltiples opciones basadas en tu marca.',
    icon: Wand2,
    category: 'visual',
    status: 'available',
    features: ['Múltiples estilos', 'Personalización completa', 'Formatos vectoriales', 'Brand guidelines'],
    color: 'from-blue-600 to-cyan-500',
    route: '/app/studio-ia/visual/logo-generator'
  },
  {
    id: 'agent-builder',
    title: 'Constructor de Agentes IA',
    description: 'Crea agentes de IA personalizados para automatizar tareas específicas de tu automotora. Configura comportamientos y flujos de trabajo.',
    icon: Bot,
    category: 'automation',
    status: 'available',
    features: ['Agentes personalizados', 'Flujos de trabajo', 'Integraciones API', 'Automatización inteligente'],
    color: 'from-blue-600 to-cyan-500',
    route: '/app/studio-ia/automation/agent-builder'
  },
  {
    id: 'video-scripts',
    title: 'Scripts para Videos',
    description: 'Crea guiones profesionales para videos promocionales, reviews de vehículos y contenido social para tu automotora.',
    icon: Video,
    category: 'content',
    status: 'coming_soon',
    features: ['Scripts personalizados', 'Múltiples formatos', 'Call-to-actions', 'Storytelling'],
    color: 'from-red-500 to-orange-500',
    route: '/app/studio-ia/content/video-scripts'
  },
  {
    id: 'script-generator',
    title: 'Generador de Guiones para Reels',
    description: 'Crea guiones dinámicos y atractivos para reels de Instagram, TikTok y videos cortos. Genera contenido viral optimizado para redes sociales.',
    icon: Video,
    category: 'content',
    status: 'available',
    features: ['Guiones para reels', 'Hooks atractivos', 'Call-to-actions', 'Optimizado para redes'],
    color: 'from-blue-500 to-cyan-500',
    route: '/app/studio-ia/content/script-generator'
  },
  {
    id: 'brand-identity',
    title: 'Asistente de Identidad de Marca',
    description: 'Desarrolla y refina la identidad visual de tu automotora con sugerencias de colores, tipografías y estilos.',
    icon: Palette,
    category: 'visual',
    status: 'beta',
    features: ['Paleta de colores', 'Tipografías', 'Logo concepts', 'Brand guidelines'],
    color: 'from-green-500 to-emerald-500',
    route: '/app/studio-ia/visual/brand-identity'
  }
];

const categories = [
  { id: 'all', name: 'Todas las Herramientas', icon: Sparkles },
  { id: 'content', name: 'Contenido', icon: FileText },
  { id: 'visual', name: 'Visual', icon: Image },
  { id: 'marketing', name: 'Marketing', icon: Megaphone },
  { id: 'sales', name: 'Ventas', icon: TrendingUp },
  { id: 'analytics', name: 'Analytics', icon: BarChart3 },
  { id: 'automation', name: 'Automatización', icon: Zap }
];

export default function StudioIAPage() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTool, setSelectedTool] = useState<AITool | null>(null);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [selectedQuickAction, setSelectedQuickAction] = useState<string | null>(null);
  const [showConfiguration, setShowConfiguration] = useState(false);

  const handleToolClick = (tool: AITool) => {
    // Si tiene ruta definida, navegar directamente
    if (tool.route) {
      navigate(tool.route);
      return;
    }
    
    // Si no tiene ruta pero está disponible o en beta, intentar navegar según el ID
    if (tool.status === 'available' || tool.status === 'beta' || tool.status === 'coming_soon') {
      // Generar ruta basada en el ID y categoría
      const routeMap: { [key: string]: string } = {
        'vehicle-images': '/app/studio-ia/visual/image-optimizer',
        'logo-generator': '/app/studio-ia/visual/logo-generator',
        'agent-builder': '/app/studio-ia/automation/agent-builder',
        'pricing-optimizer': '/app/studio-ia/analytics/pricing-optimizer',
        'brand-identity': '/app/studio-ia/visual/brand-identity',
        'email-marketing': '/app/studio-ia/marketing/email',
        'customer-insights': '/app/studio-ia/analytics/customer-insights',
        'chatbot-builder': '/app/studio-ia/automation/chatbot',
        'video-scripts': '/app/studio-ia/content/video-scripts',
      };
      
      if (routeMap[tool.id]) {
        navigate(routeMap[tool.id]);
      } else {
        // Si no hay ruta mapeada, mostrar modal como fallback
        setSelectedTool(tool);
      }
    }
  };

  const filteredTools = selectedCategory === 'all' 
    ? aiTools 
    : aiTools.filter(tool => tool.category === selectedCategory);

  const availableTools = aiTools.filter(t => t.status === 'available').length;
  const betaTools = aiTools.filter(t => t.status === 'beta').length;
  const comingSoonTools = aiTools.filter(t => t.status === 'coming_soon').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available':
        return <Badge className="bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/40">Disponible</Badge>;
      case 'beta':
        return <Badge className="bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/40">Beta</Badge>;
      case 'coming_soon':
        return <Badge className="bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/40">Próximamente</Badge>;
      default:
        return null;
    }
  };

  const getCategoryIcon = (categoryId: string) => {
    const category = categories.find(cat => cat.id === categoryId);
    return category ? category.icon : Sparkles;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2">
            <span className="bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 bg-clip-text text-transparent">
              Studio IA
            </span>
          </h1>
          <p className="text-muted-foreground">
            Herramientas de Inteligencia Artificial para potenciar tu automotora
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            className="flex items-center gap-2"
            onClick={() => setShowConfiguration(true)}
          >
            <Settings className="w-4 h-4" />
            Configuración
          </Button>
          <Button 
            variant="outline" 
            className="flex items-center gap-2 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border-blue-500/40 hover:from-blue-500/30 hover:to-cyan-500/30"
            onClick={() => setShowQuickActions(true)}
          >
            <ZapIcon className="w-4 h-4" />
            Acción Rápida
          </Button>
          <Button className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600">
            <Plus className="w-4 h-4 mr-2" />
            Nueva Herramienta
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Herramientas Disponibles</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{availableTools}</p>
              </div>
              <div className="p-3 bg-green-500/20 rounded-full">
                <Zap className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">En Desarrollo</p>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{comingSoonTools}</p>
              </div>
              <div className="p-3 bg-yellow-500/20 rounded-full">
                <Lightbulb className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">En Beta</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{betaTools}</p>
              </div>
              <div className="p-3 bg-blue-500/20 rounded-full">
                <Brain className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Usos Este Mes</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">1,247</p>
              </div>
              <div className="p-3 bg-blue-500/20 rounded-full">
                <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Filter */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-3">
            {categories.map((category) => {
              const Icon = category.icon;
              return (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "default" : "outline"}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`flex items-center gap-2 ${
                    selectedCategory === category.id 
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:from-blue-700 hover:to-cyan-600' 
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {category.name}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Card 
              key={tool.id} 
              className="hover:shadow-lg transition-all duration-300 cursor-pointer group border-l-4"
              style={{ borderLeftColor: tool.status === 'available' ? '#10b981' : tool.status === 'beta' ? '#f59e0b' : '#3b82f6' }}
              onClick={() => handleToolClick(tool)}
            >
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className={`p-3 rounded-lg bg-gradient-to-r ${tool.color} bg-opacity-20`}>
                    <Icon className="w-6 h-6" style={{ color: `var(--${tool.color.split('-')[1]}-600)` }} />
                  </div>
                  {getStatusBadge(tool.status)}
                </div>
                <CardTitle className="text-lg group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors mt-4">
                  {tool.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm mb-4">
                  {tool.description}
                </p>
                
                <div className="space-y-2 mb-4">
                  {tool.features.slice(0, 2).map((feature, index) => (
                    <div key={index} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                      {feature}
                    </div>
                  ))}
                  {tool.features.length > 2 && (
                    <div className="text-xs text-muted-foreground pl-3.5">
                      +{tool.features.length - 2} más características
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {(() => {
                      const CategoryIcon = getCategoryIcon(tool.category);
                      return <CategoryIcon className="w-3 h-3" />;
                    })()}
                    {categories.find(cat => cat.id === tool.category)?.name}
                  </div>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    className="group-hover:bg-blue-500/20 group-hover:text-blue-600 dark:group-hover:text-blue-400"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Modal de Acciones Rápidas */}
      <Dialog open={showQuickActions} onOpenChange={setShowQuickActions}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ZapIcon className="w-5 h-5 text-blue-500" />
              Acciones Rápidas
            </DialogTitle>
            <DialogDescription>
              Selecciona una acción rápida para comenzar inmediatamente
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Selección de Acción */}
            {!selectedQuickAction && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Button 
                  variant="outline" 
                  className="h-24 flex flex-col items-center gap-3 hover:bg-blue-500/10 hover:border-blue-500/40"
                  onClick={() => setSelectedQuickAction('generate-description')}
                >
                  <Car className="w-8 h-8 text-blue-500" />
                  <span className="font-medium">Descripción Vehículo</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-24 flex flex-col items-center gap-3 hover:bg-green-500/10 hover:border-green-500/40"
                  onClick={() => setSelectedQuickAction('write-copy')}
                >
                  <PenTool className="w-8 h-8 text-green-500" />
                  <span className="font-medium">Escribir Copy</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-24 flex flex-col items-center gap-3 hover:bg-orange-500/10 hover:border-orange-500/40"
                  onClick={() => setSelectedQuickAction('optimize-seo')}
                >
                  <Search className="w-8 h-8 text-orange-500" />
                  <span className="font-medium">Optimizar SEO</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-24 flex flex-col items-center gap-3 hover:bg-blue-500/10 hover:border-blue-500/40"
                  onClick={() => setSelectedQuickAction('generate-logo')}
                >
                  <Wand2 className="w-8 h-8 text-blue-500" />
                  <span className="font-medium">Generar Logo</span>
                </Button>
              </div>
            )}

            {/* Dashboard de la Acción Seleccionada */}
            {selectedQuickAction && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">
                    {selectedQuickAction === 'generate-description' && 'Descripción de Vehículo'}
                    {selectedQuickAction === 'write-copy' && 'Copywriting para Automotora'}
                    {selectedQuickAction === 'optimize-seo' && 'Optimizador SEO'}
                    {selectedQuickAction === 'generate-logo' && 'Generador de Logos'}
                  </h3>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setSelectedQuickAction(null)}
                  >
                    ← Volver
                  </Button>
                </div>

                {/* Contenido específico según la acción */}
                {selectedQuickAction === 'generate-description' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="vehicle-make">Marca</Label>
                        <Input 
                          id="vehicle-make"
                          placeholder="Ej: Toyota"
                        />
                      </div>
                      <div>
                        <Label htmlFor="vehicle-model">Modelo</Label>
                        <Input 
                          id="vehicle-model"
                          placeholder="Ej: Corolla Cross"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="vehicle-year">Año</Label>
                        <Input 
                          id="vehicle-year"
                          type="number"
                          placeholder="2024"
                        />
                      </div>
                      <div>
                        <Label htmlFor="vehicle-price">Precio (CLP)</Label>
                        <Input 
                          id="vehicle-price"
                          type="number"
                          placeholder="15.990.000"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="vehicle-features">Características destacadas</Label>
                      <Textarea 
                        id="vehicle-features"
                        placeholder="Ej: Motor 2.0L, transmisión automática, tracción 4WD, techo panorámico..."
                        rows={3}
                      />
                    </div>
                    <div>
                      <Label htmlFor="description-style">Estilo</Label>
                      <Select defaultValue="professional">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="professional">Profesional</SelectItem>
                          <SelectItem value="casual">Casual</SelectItem>
                          <SelectItem value="luxury">Lujo</SelectItem>
                          <SelectItem value="sporty">Deportivo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600">
                      <Car className="w-4 h-4 mr-2" />
                      Generar Descripción
                    </Button>
                  </div>
                )}

                {selectedQuickAction === 'write-copy' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="copy-type">Tipo de contenido</Label>
                        <Select defaultValue="social">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="social">Post Redes Sociales</SelectItem>
                            <SelectItem value="email">Email Marketing</SelectItem>
                            <SelectItem value="ad">Anuncio Publicitario</SelectItem>
                            <SelectItem value="web">Contenido Web</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="copy-tone">Tono</Label>
                        <Select defaultValue="professional">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="professional">Profesional</SelectItem>
                            <SelectItem value="friendly">Amigable</SelectItem>
                            <SelectItem value="persuasive">Persuasivo</SelectItem>
                            <SelectItem value="urgent">Urgente</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="copy-info">Información del vehículo o promoción</Label>
                      <Textarea 
                        id="copy-info"
                        placeholder="Describe el vehículo, promoción, características, beneficios..."
                        rows={3}
                      />
                    </div>
                    <Button className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600">
                      <PenTool className="w-4 h-4 mr-2" />
                      Generar Copy
                    </Button>
                  </div>
                )}

                {selectedQuickAction === 'optimize-seo' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="seo-url">URL o página</Label>
                        <Input 
                          id="seo-url"
                          type="text"
                          placeholder="https://tu-automotora.com/vehiculo"
                        />
                      </div>
                      <div>
                        <Label htmlFor="seo-keyword">Palabra clave principal</Label>
                        <Input 
                          id="seo-keyword"
                          type="text"
                          placeholder="ej: toyota corolla usado"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="seo-content">Contenido actual</Label>
                      <Textarea 
                        id="seo-content"
                        placeholder="Pega aquí el contenido actual que quieres optimizar..."
                        rows={3}
                      />
                    </div>
                    <Button className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600">
                      <Search className="w-4 h-4 mr-2" />
                      Optimizar SEO
                    </Button>
                  </div>
                )}

                {selectedQuickAction === 'generate-logo' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="logo-name">Nombre de la automotora</Label>
                        <Input 
                          id="logo-name"
                          type="text"
                          placeholder="ej: SKALE MOTORS"
                        />
                      </div>
                      <div>
                        <Label htmlFor="logo-industry">Tipo de automotora</Label>
                        <Select defaultValue="general">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="general">General</SelectItem>
                            <SelectItem value="luxury">Lujo</SelectItem>
                            <SelectItem value="used">Usados</SelectItem>
                            <SelectItem value="new">Nuevos</SelectItem>
                            <SelectItem value="sports">Deportivos</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="logo-style">Estilo de logo</Label>
                        <Select defaultValue="modern">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="minimal">Minimalista</SelectItem>
                            <SelectItem value="modern">Moderno</SelectItem>
                            <SelectItem value="classic">Clásico</SelectItem>
                            <SelectItem value="creative">Creativo</SelectItem>
                            <SelectItem value="elegant">Elegante</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="logo-colors">Colores preferidos</Label>
                        <div className="flex gap-2">
                          <Input type="color" className="w-12 h-10 p-1 border rounded" defaultValue="#3B82F6" />
                          <Input type="color" className="w-12 h-10 p-1 border rounded" defaultValue="#10B981" />
                          <Input type="color" className="w-12 h-10 p-1 border rounded" defaultValue="#F59E0B" />
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="logo-description">Descripción adicional</Label>
                      <Textarea 
                        id="logo-description"
                        placeholder="Describe el tipo de logo que tienes en mente, elementos específicos, etc..."
                        rows={3}
                      />
                    </div>
                    <Button className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600">
                      <Wand2 className="w-4 h-4 mr-2" />
                      Generar Logo
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Configuración */}
      <Dialog open={showConfiguration} onOpenChange={setShowConfiguration}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-500" />
              Configuración de Studio IA
            </DialogTitle>
            <DialogDescription>
              Personaliza las herramientas de IA según tus necesidades y preferencias
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="tools">Herramientas</TabsTrigger>
              <TabsTrigger value="api">API Keys</TabsTrigger>
              <TabsTrigger value="preferences">Preferencias</TabsTrigger>
            </TabsList>
            
            {/* Pestaña General */}
            <TabsContent value="general" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Configuración General</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="auto-save">Guardado Automático</Label>
                        <p className="text-sm text-muted-foreground">Guarda automáticamente tu trabajo</p>
                      </div>
                      <Switch id="auto-save" defaultChecked />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="notifications">Notificaciones</Label>
                        <p className="text-sm text-muted-foreground">Recibe notificaciones de progreso</p>
                      </div>
                      <Switch id="notifications" defaultChecked />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="dark-mode">Modo Oscuro</Label>
                        <p className="text-sm text-muted-foreground">Usar tema oscuro por defecto</p>
                      </div>
                      <Switch id="dark-mode" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Límites y Cuotas</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="daily-limit">Límite Diario de Generaciones</Label>
                      <Select defaultValue="100">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="50">50 generaciones</SelectItem>
                          <SelectItem value="100">100 generaciones</SelectItem>
                          <SelectItem value="200">200 generaciones</SelectItem>
                          <SelectItem value="unlimited">Ilimitado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="quality">Calidad por Defecto</Label>
                      <Select defaultValue="high">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standard">Estándar</SelectItem>
                          <SelectItem value="high">Alta</SelectItem>
                          <SelectItem value="premium">Premium</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            
            {/* Pestaña Herramientas */}
            <TabsContent value="tools" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Configuración de Herramientas</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Activa o desactiva herramientas específicas y configura sus parámetros
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {aiTools.map((tool) => {
                    const Icon = tool.icon;
                    return (
                      <div key={tool.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg bg-gradient-to-r ${tool.color}`}>
                              <Icon className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <h3 className="font-medium">{tool.title}</h3>
                              <p className="text-sm text-muted-foreground">{tool.description}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(tool.status)}
                            <Switch defaultChecked={tool.status === 'available'} disabled={tool.status === 'coming_soon'} />
                          </div>
                        </div>
                        
                        {tool.status === 'available' && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
                            <div>
                              <Label htmlFor={`${tool.id}-quality`}>Calidad de Salida</Label>
                              <Select defaultValue="high">
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="standard">Estándar</SelectItem>
                                  <SelectItem value="high">Alta</SelectItem>
                                  <SelectItem value="premium">Premium</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label htmlFor={`${tool.id}-style`}>Estilo por Defecto</Label>
                              <Input 
                                id={`${tool.id}-style`}
                                placeholder="Estilo personalizado..."
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Pestaña API Keys */}
            <TabsContent value="api" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">OpenAI API</CardTitle>
                    <p className="text-sm text-muted-foreground">Para herramientas de texto y análisis</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="openai-key">API Key</Label>
                      <Input 
                        id="openai-key"
                        type="password"
                        placeholder="sk-..."
                      />
                    </div>
                    <div>
                      <Label htmlFor="openai-model">Modelo</Label>
                      <Select defaultValue="gpt-4">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                          <SelectItem value="gpt-4">GPT-4</SelectItem>
                          <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">DALL-E API</CardTitle>
                    <p className="text-sm text-muted-foreground">Para generación de imágenes</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="dalle-key">API Key</Label>
                      <Input 
                        id="dalle-key"
                        type="password"
                        placeholder="sk-..."
                      />
                    </div>
                    <div>
                      <Label htmlFor="dalle-size">Tamaño por Defecto</Label>
                      <Select defaultValue="1024x1024">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="256x256">256x256</SelectItem>
                          <SelectItem value="512x512">512x512</SelectItem>
                          <SelectItem value="1024x1024">1024x1024</SelectItem>
                          <SelectItem value="1792x1024">1792x1024</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Anthropic Claude</CardTitle>
                    <p className="text-sm text-muted-foreground">Para análisis avanzado y copywriting</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="claude-key">API Key</Label>
                      <Input 
                        id="claude-key"
                        type="password"
                        placeholder="sk-ant-..."
                      />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Google Analytics</CardTitle>
                    <p className="text-sm text-muted-foreground">Para análisis de rendimiento</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="ga-key">API Key</Label>
                      <Input 
                        id="ga-key"
                        type="password"
                        placeholder="AIza..."
                      />
                    </div>
                    <div>
                      <Label htmlFor="ga-property">Property ID</Label>
                      <Input 
                        id="ga-property"
                        placeholder="123456789"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            
            {/* Pestaña Preferencias */}
            <TabsContent value="preferences" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Preferencias de Idioma</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="language">Idioma Principal</Label>
                      <Select defaultValue="es">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="es">Español</SelectItem>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="pt">Português</SelectItem>
                          <SelectItem value="fr">Français</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="tone">Tono por Defecto</Label>
                      <Select defaultValue="professional">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="professional">Profesional</SelectItem>
                          <SelectItem value="friendly">Amigable</SelectItem>
                          <SelectItem value="casual">Casual</SelectItem>
                          <SelectItem value="formal">Formal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Preferencias de Marca</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="brand-name">Nombre de Automotora</Label>
                      <Input 
                        id="brand-name"
                        placeholder="Tu automotora..."
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="brand-description">Descripción de Marca</Label>
                      <Textarea 
                        id="brand-description"
                        placeholder="Describe tu automotora, valores, público objetivo..."
                        rows={3}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="brand-colors">Colores de Marca</Label>
                      <div className="flex gap-2">
                        <Input 
                          type="color"
                          className="w-12 h-10 p-1 border rounded"
                          defaultValue="#3B82F6"
                        />
                        <Input 
                          type="color"
                          className="w-12 h-10 p-1 border rounded"
                          defaultValue="#10B981"
                        />
                        <Input 
                          type="color"
                          className="w-12 h-10 p-1 border rounded"
                          defaultValue="#F59E0B"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
          
          <div className="flex justify-end gap-3 pt-6 border-t">
            <Button variant="outline" onClick={() => setShowConfiguration(false)}>
              Cancelar
            </Button>
            <Button onClick={() => setShowConfiguration(false)}>
              Guardar Configuración
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
